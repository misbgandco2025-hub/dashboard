const Client = require('../models/Client');
const BankLoanApplication = require('../models/BankLoanApplication');
const SubsidyApplication = require('../models/SubsidyApplication');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');

const buildDateFilter = (from, to) => {
  if (!from && !to) return {};
  const filter = {};
  if (from) filter.$gte = new Date(from);
  if (to) filter.$lte = new Date(to);
  return filter;
};

// GET /api/dashboard/summary
const getSummary = async (req, res, next) => {
  try {
    const { from, to, vendorId, status, type } = req.query;
    const dateFilter = buildDateFilter(from, to);
    const baseFilter = { isDeleted: false };
    if (Object.keys(dateFilter).length) baseFilter.applicationDate = dateFilter;

    const blFilter = { ...baseFilter };
    const subFilter = { ...baseFilter };
    if (status) { blFilter.currentStatus = status; subFilter.currentStatus = status; }
    if (vendorId) {
      const clientIds = await Client.find({ vendorId, isDeleted: false }).distinct('_id');
      blFilter.clientId = { $in: clientIds };
      subFilter.clientId = { $in: clientIds };
    }
    if (type === 'bank-loan') delete subFilter;
    if (type === 'subsidy') delete blFilter;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalClients,
      activeBankLoans,
      activeSubsidies,
      completedBLMonth,
      completedSubMonth,
      completedBLYear,
      completedSubYear,
      vendorClients,
      directClients,
      openQueries,
    ] = await Promise.all([
      Client.countDocuments({ isDeleted: false }),
      BankLoanApplication.countDocuments(blFilter),
      SubsidyApplication.countDocuments(subFilter),
      BankLoanApplication.countDocuments({ isDeleted: false, currentStatus: { $in: ['Approved', 'Disbursement Completed'] }, updatedAt: { $gte: startOfMonth } }),
      SubsidyApplication.countDocuments({ isDeleted: false, currentStatus: { $in: ['Approved', 'Subsidy Released'] }, updatedAt: { $gte: startOfMonth } }),
      BankLoanApplication.countDocuments({ isDeleted: false, currentStatus: { $in: ['Approved', 'Disbursement Completed'] }, updatedAt: { $gte: startOfYear } }),
      SubsidyApplication.countDocuments({ isDeleted: false, currentStatus: { $in: ['Approved', 'Subsidy Released'] }, updatedAt: { $gte: startOfYear } }),
      Client.countDocuments({ isDeleted: false, sourceType: 'vendor' }),
      Client.countDocuments({ isDeleted: false, sourceType: 'direct' }),
      BankLoanApplication.countDocuments({ isDeleted: false, 'queries.status': { $in: ['open', 'in-progress'] } }),
    ]);

    // Pending documents count
    const blWithPending = await BankLoanApplication.countDocuments({
      isDeleted: false, 'documentChecklist.status': 'pending',
    });
    const subWithPending = await SubsidyApplication.countDocuments({
      isDeleted: false, 'documentChecklist.status': 'pending',
    });

    return ApiResponse.success(res, 'Dashboard summary retrieved', {
      totalClients,
      activeBankLoans,
      activeSubsidies,
      completedThisMonth: { bankLoans: completedBLMonth, subsidies: completedSubMonth, total: completedBLMonth + completedSubMonth },
      completedThisYear: { bankLoans: completedBLYear, subsidies: completedSubYear, total: completedBLYear + completedSubYear },
      pendingDocumentsApplications: blWithPending + subWithPending,
      openQueries,
      vendorClients: { count: vendorClients, percentage: totalClients ? Math.round((vendorClients / totalClients) * 100) : 0 },
      directClients: { count: directClients, percentage: totalClients ? Math.round((directClients / totalClients) * 100) : 0 },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/vendor-distribution
const getVendorDistribution = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFilter = buildDateFilter(from, to);

    const vendors = await Vendor.find({ isDeleted: false }).select('vendorName vendorCode _id');
    const result = await Promise.all(
      vendors.map(async (v) => {
        const clientIds = await Client.find({ vendorId: v._id, isDeleted: false }).distinct('_id');
        const blFilter = { isDeleted: false, clientId: { $in: clientIds } };
        const subFilter = { isDeleted: false, clientId: { $in: clientIds } };
        if (Object.keys(dateFilter).length) { blFilter.applicationDate = dateFilter; subFilter.applicationDate = dateFilter; }

        const [bl, sub, approved] = await Promise.all([
          BankLoanApplication.countDocuments(blFilter),
          SubsidyApplication.countDocuments(subFilter),
          BankLoanApplication.countDocuments({ ...blFilter, currentStatus: { $in: ['Approved', 'Disbursement Completed'] } }),
        ]);
        const total = bl + sub;
        return {
          vendor: { _id: v._id, vendorName: v.vendorName, vendorCode: v.vendorCode },
          totalClients: clientIds.length,
          bankLoanApplications: bl,
          subsidyApplications: sub,
          totalApplications: total,
          successRate: total ? Math.round((approved / total) * 100) : 0,
        };
      })
    );

    return ApiResponse.success(res, 'Vendor distribution retrieved', result);
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/status-distribution
const getStatusDistribution = async (req, res, next) => {
  try {
    const [blStatus, subStatus] = await Promise.all([
      BankLoanApplication.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$currentStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      SubsidyApplication.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$currentStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return ApiResponse.success(res, 'Status distribution retrieved', {
      bankLoan: blStatus.map((s) => ({ status: s._id, count: s.count })),
      subsidy: subStatus.map((s) => ({ status: s._id, count: s.count })),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/monthly-trend
const getMonthlyTrend = async (req, res, next) => {
  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const groupStage = {
      $group: {
        _id: { year: { $year: '$applicationDate' }, month: { $month: '$applicationDate' } },
        created: { $sum: 1 },
        approved: {
          $sum: {
            $cond: [{ $in: ['$currentStatus', ['Approved', 'Disbursement Completed', 'Subsidy Released']] }, 1, 0],
          },
        },
      },
    };

    const [blTrend, subTrend] = await Promise.all([
      BankLoanApplication.aggregate([
        { $match: { isDeleted: false, applicationDate: { $gte: twelveMonthsAgo } } },
        groupStage,
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      SubsidyApplication.aggregate([
        { $match: { isDeleted: false, applicationDate: { $gte: twelveMonthsAgo } } },
        groupStage,
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    const fmt = (arr) =>
      arr.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        created: item.created,
        approved: item.approved,
        successRate: item.created ? Math.round((item.approved / item.created) * 100) : 0,
      }));

    return ApiResponse.success(res, 'Monthly trend retrieved', {
      bankLoan: fmt(blTrend),
      subsidy: fmt(subTrend),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/performance-metrics  (ADMIN + VIEWER)
const getPerformanceMetrics = async (req, res, next) => {
  try {
    const [blApps, subApps] = await Promise.all([
      BankLoanApplication.find({ isDeleted: false, approvalDate: { $exists: true } }, 'applicationDate approvalDate queries'),
      SubsidyApplication.find({ isDeleted: false, approvalDate: { $exists: true } }, 'applicationDate approvalDate queries'),
    ]);

    const avgDays = (apps) => {
      if (!apps.length) return 0;
      const total = apps.reduce((sum, a) => {
        const d = Math.floor((new Date(a.approvalDate) - new Date(a.applicationDate)) / (1000 * 60 * 60 * 24));
        return sum + d;
      }, 0);
      return Math.round(total / apps.length);
    };

    const allBl = await BankLoanApplication.countDocuments({ isDeleted: false });
    const approvedBl = await BankLoanApplication.countDocuments({ isDeleted: false, currentStatus: { $in: ['Approved', 'Disbursement Completed'] } });
    const allSub = await SubsidyApplication.countDocuments({ isDeleted: false });
    const approvedSub = await SubsidyApplication.countDocuments({ isDeleted: false, currentStatus: { $in: ['Approved', 'Subsidy Released'] } });

    // Query resolution time
    const allAppsWithQueries = [...blApps, ...subApps];
    let totalResolutionDays = 0, resolvedCount = 0;
    allAppsWithQueries.forEach((app) => {
      (app.queries || []).forEach((q) => {
        if (q.resolutionDate && q.queryRaisedDate) {
          totalResolutionDays += Math.floor(
            (new Date(q.resolutionDate) - new Date(q.queryRaisedDate)) / (1000 * 60 * 60 * 24)
          );
          resolvedCount++;
        }
      });
    });

    return ApiResponse.success(res, 'Performance metrics retrieved', {
      bankLoan: {
        avgProcessingDays: avgDays(blApps),
        total: allBl,
        approved: approvedBl,
        successRate: allBl ? Math.round((approvedBl / allBl) * 100) : 0,
      },
      subsidy: {
        avgProcessingDays: avgDays(subApps),
        total: allSub,
        approved: approvedSub,
        successRate: allSub ? Math.round((approvedSub / allSub) * 100) : 0,
      },
      queryMetrics: {
        totalResolved: resolvedCount,
        avgResolutionDays: resolvedCount ? Math.round(totalResolutionDays / resolvedCount) : 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/my-tasks  (DATA ENTRY)
const getMyTasks = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const filter = { isDeleted: false, assignedTo: userId };

    const [bankLoans, subsidies] = await Promise.all([
      BankLoanApplication.find(filter)
        .populate('clientId', 'clientId name mobile')
        .select('applicationId currentStatus priority applicationDate clientId')
        .sort({ priority: -1, applicationDate: 1 })
        .limit(50),
      SubsidyApplication.find(filter)
        .populate('clientId', 'clientId name mobile')
        .select('applicationId currentStatus priority applicationDate schemeName clientId')
        .sort({ priority: -1, applicationDate: 1 })
        .limit(50),
    ]);

    const pendingBl = bankLoans.filter((a) => a.currentStatus !== 'Disbursement Completed' && a.currentStatus !== 'Rejected');
    const pendingSub = subsidies.filter((a) => a.currentStatus !== 'Subsidy Released' && a.currentStatus !== 'Rejected');

    return ApiResponse.success(res, 'My tasks retrieved', {
      totalAssigned: bankLoans.length + subsidies.length,
      pendingBankLoans: pendingBl.length,
      pendingSubsidies: pendingSub.length,
      bankLoanApplications: bankLoans,
      subsidyApplications: subsidies,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSummary, getVendorDistribution, getStatusDistribution, getMonthlyTrend, getPerformanceMetrics, getMyTasks };
