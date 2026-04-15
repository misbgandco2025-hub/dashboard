const AuditLog = require('../models/AuditLog');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/helpers');

// GET /api/audit-logs  (ADMIN only)
const getAuditLogs = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const filter = {};

    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.entity) filter.entity = req.query.entity;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.entityId) filter.entityId = req.query.entityId;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'fullName username role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, 'Audit logs retrieved', logs, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

module.exports = { getAuditLogs };
