const Notification = require('../models/Notification');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/helpers');

// GET /api/notifications
const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const filter = { userId: req.user._id };
    if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';
    if (req.query.category) filter.category = req.query.category;

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, 'Notifications retrieved', notifications, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    return ApiResponse.success(res, 'Unread count retrieved', { unreadCount: count });
  } catch (err) {
    next(err);
  }
};

// PUT /api/notifications/:id/read
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return next(ApiError.notFound('Notification not found.'));
    return ApiResponse.success(res, 'Notification marked as read', notification);
  } catch (err) {
    next(err);
  }
};

// PUT /api/notifications/read-all
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return ApiResponse.success(res, 'All notifications marked as read', { updated: result.modifiedCount });
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
