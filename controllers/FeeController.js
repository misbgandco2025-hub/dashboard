const FeeEntry = require('../models/FeeEntry');
const Client = require('../models/Client');
const SubsidyApplication = require('../models/SubsidyApplication');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/helpers');

// ─── POST /api/fees ────────────────────────────────────────────────────────────
const createFee = async (req, res, next) => {
  try {
    const { clientId, applicationId, description, feeType, baseAmount, gstRate, dueDate, remarks } = req.body;

    // Validate client exists
    const client = await Client.findOne({ _id: clientId, isDeleted: false });
    if (!client) return next(ApiError.notFound('Client not found'));

    // Validate application if provided
    if (applicationId) {
      const app = await SubsidyApplication.findOne({ _id: applicationId, isDeleted: false });
      if (!app) return next(ApiError.notFound('Application not found'));
      if (app.clientId.toString() !== clientId) {
        return next(ApiError.badRequest('Application does not belong to this client'));
      }
    }

    const fee = await FeeEntry.create({
      clientId,
      applicationId: applicationId || undefined,
      description,
      feeType,
      baseAmount,
      gstRate: gstRate ?? 18,
      dueDate,
      remarks,
      createdBy: req.user._id,
    });

    await fee.populate([
      { path: 'clientId', select: 'clientId name mobile email' },
      { path: 'applicationId', select: 'applicationId schemeType currentStatus' },
      { path: 'createdBy', select: 'fullName username' },
    ]);

    return ApiResponse.created(res, 'Fee created successfully', fee);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/fees ─────────────────────────────────────────────────────────────
const getAllFees = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const { clientId, applicationId, status, overdue, search } = req.query;

    const filter = { isDeleted: false };

    if (clientId) filter.clientId = clientId;
    if (applicationId) filter.applicationId = applicationId;
    if (status) filter.status = status;

    if (overdue === 'true') {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $nin: ['paid', 'waived', 'cancelled'] };
    }

    if (search) {
      filter.$or = [
        { feeId: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [fees, total] = await Promise.all([
      FeeEntry.find(filter)
        .populate('clientId', 'clientId name mobile email')
        .populate('applicationId', 'applicationId schemeType currentStatus')
        .populate('createdBy', 'fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      FeeEntry.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, 'Fees retrieved', fees, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/fees/analytics ───────────────────────────────────────────────────
const getFeeAnalytics = async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;

    let dateFilter = {};
    if (period === 'month') {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: start } };
    } else if (period === 'year') {
      dateFilter = { createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) } };
    }

    const baseMatch = { isDeleted: false, ...dateFilter };

    const [stats, feeTypeBreakdown, monthlyTrend] = await Promise.all([
      FeeEntry.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalFees: { $sum: '$totalAmount' },
            totalPaid: { $sum: '$paidAmount' },
            totalPending: { $sum: '$pendingAmount' },
            totalWaived: { $sum: '$waivedAmount' },
            count: { $sum: 1 },
            paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            partialCount: { $sum: { $cond: [{ $eq: ['$status', 'partial'] }, 1, 0] } },
            waivedCount: { $sum: { $cond: [{ $eq: ['$status', 'waived'] }, 1, 0] } },
          },
        },
      ]),

      FeeEntry.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: '$feeType',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
            paidAmount: { $sum: '$paidAmount' },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),

      FeeEntry.aggregate([
        { $match: { isDeleted: false, createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            totalFees: { $sum: '$totalAmount' },
            paidAmount: { $sum: '$paidAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    const overdueCount = await FeeEntry.countDocuments({
      isDeleted: false,
      status: { $nin: ['paid', 'waived', 'cancelled'] },
      dueDate: { $lt: new Date() },
    });

    const summary = stats[0] || { totalFees: 0, totalPaid: 0, totalPending: 0, count: 0, paidCount: 0, pendingCount: 0, partialCount: 0 };
    const collectionRate = summary.totalFees > 0
      ? parseFloat(((summary.totalPaid / summary.totalFees) * 100).toFixed(1))
      : 0;

    return ApiResponse.success(res, 'Analytics retrieved', {
      summary,
      collectionRate,
      overdueCount,
      feeTypeBreakdown,
      monthlyTrend,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/fees/:id ─────────────────────────────────────────────────────────
const getFeeById = async (req, res, next) => {
  try {
    const fee = await FeeEntry.findOne({ _id: req.params.id, isDeleted: false })
      .populate('clientId', 'clientId name mobile email address bankName')
      .populate('applicationId', 'applicationId schemeType currentStatus schemeName')
      .populate('createdBy', 'fullName username')
      .populate('updatedBy', 'fullName username')
      .populate('waivedBy', 'fullName username')
      .populate('payments.recordedBy', 'fullName username');

    if (!fee) return next(ApiError.notFound('Fee not found'));
    return ApiResponse.success(res, 'Fee retrieved', fee);
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/fees/:id ─────────────────────────────────────────────────────────
const updateFee = async (req, res, next) => {
  try {
    const fee = await FeeEntry.findOne({ _id: req.params.id, isDeleted: false });
    if (!fee) return next(ApiError.notFound('Fee not found'));

    if (['paid', 'waived', 'cancelled'].includes(fee.status)) {
      return next(ApiError.badRequest(`Cannot update a fee with status "${fee.status}"`));
    }

    const allowed = ['description', 'feeType', 'baseAmount', 'gstRate', 'dueDate', 'remarks'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) fee[field] = req.body[field];
    });

    fee.updatedBy = req.user._id;
    await fee.save();

    return ApiResponse.success(res, 'Fee updated', fee);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/fees/:id/payment ────────────────────────────────────────────────
const addPayment = async (req, res, next) => {
  try {
    const fee = await FeeEntry.findOne({ _id: req.params.id, isDeleted: false });
    if (!fee) return next(ApiError.notFound('Fee not found'));

    if (['paid', 'waived', 'cancelled'].includes(fee.status)) {
      return next(ApiError.badRequest('Cannot add payment to this fee'));
    }

    const { amount, paidDate, paymentMode, reference, remarks } = req.body;

    if (!amount || amount <= 0) return next(ApiError.badRequest('Payment amount must be positive'));
    if (amount > fee.pendingAmount + 0.01) {
      return next(ApiError.badRequest(`Payment (₹${amount}) exceeds pending amount (₹${fee.pendingAmount})`));
    }
    if (!paidDate) return next(ApiError.badRequest('Payment date is required'));
    if (!paymentMode) return next(ApiError.badRequest('Payment mode is required'));

    await fee.addPayment({ amount, paidDate, paymentMode, reference, remarks }, req.user._id);

    await fee.populate('payments.recordedBy', 'fullName');

    return ApiResponse.success(res, 'Payment recorded successfully', fee);
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/fees/:id/waive ───────────────────────────────────────────────────
const waiveFee = async (req, res, next) => {
  try {
    const fee = await FeeEntry.findOne({ _id: req.params.id, isDeleted: false });
    if (!fee) return next(ApiError.notFound('Fee not found'));

    if (['paid', 'cancelled'].includes(fee.status)) {
      return next(ApiError.badRequest('Cannot waive this fee'));
    }

    const { waivedAmount, waiverReason } = req.body;
    if (!waivedAmount || waivedAmount <= 0) return next(ApiError.badRequest('Waived amount must be positive'));
    if (waivedAmount > fee.pendingAmount + 0.01) {
      return next(ApiError.badRequest('Waiver amount exceeds pending amount'));
    }

    fee.waivedAmount = (fee.waivedAmount || 0) + waivedAmount;
    fee.waiverReason = waiverReason;
    fee.waivedBy = req.user._id;
    fee.waivedDate = new Date();
    fee.status = 'waived';
    fee.updatedBy = req.user._id;

    await fee.save();
    return ApiResponse.success(res, 'Fee waived successfully', fee);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/fees/:id (soft) ───────────────────────────────────────────────
const deleteFee = async (req, res, next) => {
  try {
    const fee = await FeeEntry.findOne({ _id: req.params.id, isDeleted: false });
    if (!fee) return next(ApiError.notFound('Fee not found'));

    fee.isDeleted = true;
    fee.updatedBy = req.user._id;
    await fee.save();

    return ApiResponse.success(res, 'Fee deleted successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createFee,
  getAllFees,
  getFeeById,
  updateFee,
  addPayment,
  waiveFee,
  deleteFee,
  getFeeAnalytics,
};
