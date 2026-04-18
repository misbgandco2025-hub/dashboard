const Client = require('../models/Client');
const Vendor = require('../models/Vendor');
const BankLoanApplication = require('../models/BankLoanApplication');
const SubsidyApplication = require('../models/SubsidyApplication');
const AuditLog = require('../models/AuditLog');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/helpers');

// GET /api/reports/client-wise
const clientWiseReport = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const filter = { isDeleted: false };
    if (req.query.clientId) filter._id = req.query.clientId;
    if (req.query.status) filter.status = req.query.status;

    const [clients, total] = await Promise.all([
      Client.find(filter).populate('vendorId', 'vendorName vendorCode').skip(skip).limit(limit).sort({ createdAt: -1 }),
      Client.countDocuments(filter),
    ]);

    const result = await Promise.all(
      clients.map(async (c) => {
        const [bankLoans, subsidies] = await Promise.all([
          BankLoanApplication.find({ clientId: c._id, isDeleted: false })
            .select('applicationId currentStatus applicationDate loanAmount documentChecklist'),
          SubsidyApplication.find({ clientId: c._id, isDeleted: false })
            .select('applicationId currentStatus applicationDate subsidyAmountApplied schemeName documentChecklist'),
        ]);

        const docPct = (apps) => {
          const allDocs = apps.flatMap((a) => a.documentChecklist);
          if (!allDocs.length) return 0;
          const done = allDocs.filter((d) => d.status === 'verified-by-bank').length;
          return Math.round((done / allDocs.length) * 100);
        };

        return {
          client: { _id: c._id, clientId: c.clientId, name: c.name, mobile: c.mobile, email: c.email, sourceType: c.sourceType, vendor: c.vendorId },
          bankLoanApplications: { count: bankLoans.length, list: bankLoans.map((a) => ({ applicationId: a.applicationId, status: a.currentStatus, date: a.applicationDate, amount: a.loanAmount })) },
          subsidyApplications: { count: subsidies.length, list: subsidies.map((a) => ({ applicationId: a.applicationId, status: a.currentStatus, date: a.applicationDate, amount: a.subsidyAmountApplied, scheme: a.schemeName })) },
          documentCompletionPercentage: docPct([...bankLoans, ...subsidies]),
        };
      })
    );

    return ApiResponse.paginated(res, 'Client-wise report retrieved', result, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/vendor-wise
const vendorWiseReport = async (req, res, next) => {
  try {
    const vendors = await Vendor.find({ isDeleted: false }).select('vendorName vendorCode vendorId contactPerson mobile');

    const result = await Promise.all(
      vendors.map(async (v) => {
        const clientIds = await Client.find({ vendorId: v._id, isDeleted: false }).distinct('_id');
        const [bl, sub, approvedBl, approvedSub] = await Promise.all([
          BankLoanApplication.countDocuments({ isDeleted: false, clientId: { $in: clientIds } }),
          SubsidyApplication.countDocuments({ isDeleted: false, clientId: { $in: clientIds } }),
          BankLoanApplication.countDocuments({ isDeleted: false, clientId: { $in: clientIds }, currentStatus: { $in: ['Approved', 'Disbursement Completed'] } }),
          SubsidyApplication.countDocuments({ isDeleted: false, clientId: { $in: clientIds }, currentStatus: { $in: ['Approved', 'Subsidy Released'] } }),
        ]);
        const total = bl + sub;
        const approved = approvedBl + approvedSub;
        return {
          vendor: v,
          totalClients: clientIds.length,
          bankLoanApplications: bl,
          subsidyApplications: sub,
          totalApplications: total,
          approvedApplications: approved,
          successRate: total ? Math.round((approved / total) * 100) : 0,
        };
      })
    );

    return ApiResponse.success(res, 'Vendor-wise report retrieved', result);
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/status-wise
const statusWiseReport = async (req, res, next) => {
  try {
    const { type } = req.query;
    const Model = type === 'subsidy' ? SubsidyApplication : BankLoanApplication;

    // Aggregate counts + avg days
    const statusGroups = await Model.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$currentStatus',
          count: { $sum: 1 },
          avgDaysInProcess: {
            $avg: { $divide: [{ $subtract: ['$$NOW', '$applicationDate'] }, 86400000] },
          },
          ids: { $push: '$_id' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // For each group, fetch full application list with client populated
    const result = await Promise.all(
      statusGroups.map(async (g) => {
        const apps = await Model.find({ _id: { $in: g.ids }, isDeleted: false })
          .populate({
            path: 'clientId',
            select: 'name clientId mobile bankName branchName vendorId',
            populate: { path: 'vendorId', select: 'vendorName' },
          })
          .select('applicationId applicationDate priority schemeType nhbDetails paymentDetails gocBankVerificationStatus geoTaggingStatus')
          .lean();
        return {
          status: g._id,
          count: g.count,
          avgDaysInProcess: Math.round(g.avgDaysInProcess || 0),
          applications: apps,
        };
      })
    );

    return ApiResponse.success(res, 'Status-wise report retrieved', result);
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/subsidy-analytics  — NHB/subsidy-specific breakdown
const subsidyAnalytics = async (req, res, next) => {
  try {
    const base = { isDeleted: false };

    const [schemeBreakdown, nhbPortalBreakdown, bankVerifBreakdown, geoTagBreakdown, paymentStats, totalSubsidies] =
      await Promise.all([
        // Scheme type distribution
        SubsidyApplication.aggregate([
          { $match: base },
          { $group: { _id: '$schemeType', count: { $sum: 1 } } },
        ]),
        // NHB portal status (only NHB records)
        SubsidyApplication.aggregate([
          { $match: { ...base, schemeType: 'nhb' } },
          { $group: { _id: '$nhbDetails.nhbPortalStatus', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        ]),
        // Bank verification status
        SubsidyApplication.aggregate([
          { $match: base },
          { $group: { _id: '$gocBankVerificationStatus', count: { $sum: 1 } } },
        ]),
        // Geo-tagging status
        SubsidyApplication.aggregate([
          { $match: base },
          { $group: { _id: '$geoTaggingStatus', count: { $sum: 1 } } },
        ]),
        // Payment stats
        SubsidyApplication.aggregate([
          { $match: base },
          {
            $group: {
              _id: null,
              paymentReceived: { $sum: { $cond: ['$paymentDetails.paymentReceived', 1, 0] } },
              paymentPending:  { $sum: { $cond: ['$paymentDetails.paymentReceived', 0, 1] } },
              totalAmountReceived: { $sum: { $ifNull: ['$paymentDetails.paymentAmount', 0] } },
            },
          },
        ]),
        SubsidyApplication.countDocuments(base),
      ]);

    // For each NHB portal group, fetch the full application list
    const nhbPortalWithApps = await Promise.all(
      nhbPortalBreakdown.map(async (g) => {
        const apps = await SubsidyApplication.find({ _id: { $in: g.ids }, isDeleted: false })
          .populate({
            path: 'clientId',
            select: 'name clientId mobile bankName branchName vendorId',
            populate: { path: 'vendorId', select: 'vendorName' },
          })
          .select('applicationId applicationDate currentStatus nhbDetails gocBankVerificationStatus geoTaggingStatus paymentDetails')
          .lean();
        return { status: g._id || 'goc-new', count: g.count, applications: apps };
      })
    );

    return ApiResponse.success(res, 'Subsidy analytics retrieved', {
      totalSubsidies,
      schemeBreakdown: schemeBreakdown.map(g => ({ type: g._id || 'none', count: g.count })),
      nhbPortalStatus: nhbPortalWithApps,
      bankVerification: bankVerifBreakdown.map(g => ({ status: g._id || 'not-started', count: g.count })),
      geoTagging:       geoTagBreakdown.map(g => ({ status: g._id || 'not-started', count: g.count })),
      payment: paymentStats[0] ?? { paymentReceived: 0, paymentPending: 0, totalAmountReceived: 0 },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/date-range
const dateRangeReport = async (req, res, next) => {
  try {
    const { from, to, status, vendorId, type } = req.query;

    const blFilter = { isDeleted: false };
    const subFilter = { isDeleted: false };

    if (from || to) {
      const dateFilter = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) dateFilter.$lte = new Date(to);
      blFilter.applicationDate = dateFilter;
      subFilter.applicationDate = dateFilter;
    }
    if (status) { blFilter.currentStatus = status; subFilter.currentStatus = status; }

    if (vendorId) {
      const clientIds = await Client.find({ vendorId, isDeleted: false }).distinct('_id');
      blFilter.clientId = { $in: clientIds };
      subFilter.clientId = { $in: clientIds };
    }

    const promises = [];
    if (!type || type === 'bank-loan') promises.push(BankLoanApplication.find(blFilter).populate('clientId', 'clientId name').select('applicationId applicationDate currentStatus loanAmount priority clientId'));
    if (!type || type === 'subsidy') promises.push(SubsidyApplication.find(subFilter).populate('clientId', 'clientId name').select('applicationId applicationDate currentStatus subsidyAmountApplied schemeName priority clientId'));

    const [blApps = [], subApps = []] = await Promise.all(promises);
    const total = blApps.length + subApps.length;

    return ApiResponse.success(res, 'Date range report retrieved', {
      summary: { total, bankLoans: blApps.length, subsidies: subApps.length },
      bankLoanApplications: blApps,
      subsidyApplications: subApps,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/performance  (ADMIN + VIEWER)
const performanceReport = async (req, res, next) => {
  try {
    const [blApps, subApps] = await Promise.all([
      BankLoanApplication.find({ isDeleted: false }, 'applicationDate approvalDate currentStatus queries timeline'),
      SubsidyApplication.find({ isDeleted: false }, 'applicationDate approvalDate currentStatus queries timeline'),
    ]);

    const calcMetrics = (apps) => {
      const withApproval = apps.filter((a) => a.approvalDate);
      const avgProcess = withApproval.length
        ? Math.round(withApproval.reduce((s, a) => s + (new Date(a.approvalDate) - new Date(a.applicationDate)) / 86400000, 0) / withApproval.length)
        : 0;
      const approved = apps.filter((a) => ['Approved', 'Disbursement Completed', 'Subsidy Released'].includes(a.currentStatus)).length;
      return { total: apps.length, approved, avgProcessingDays: avgProcess, successRate: apps.length ? Math.round((approved / apps.length) * 100) : 0 };
    };

    return ApiResponse.success(res, 'Performance report retrieved', {
      bankLoan: calcMetrics(blApps),
      subsidy: calcMetrics(subApps),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/audit-log  (ADMIN only)
const auditLogReport = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.entity) filter.entity = req.query.entity;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).populate('userId', 'fullName username role').sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, 'Audit log report retrieved', logs, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

module.exports = { clientWiseReport, vendorWiseReport, statusWiseReport, dateRangeReport, performanceReport, auditLogReport, subsidyAnalytics };
