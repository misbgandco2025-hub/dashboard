const Vendor = require('../models/Vendor');
const Client = require('../models/Client');
const BankLoanApplication = require('../models/BankLoanApplication');
const SubsidyApplication = require('../models/SubsidyApplication');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/helpers');

// GET /api/vendors
const getVendors = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const filter = { isDeleted: false };

    if (req.query.search) {
      filter.$or = [
        { vendorName: { $regex: req.query.search, $options: 'i' } },
        { vendorCode: { $regex: req.query.search, $options: 'i' } },
        { contactPerson: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.status) filter.status = req.query.status;

    const [vendors, total] = await Promise.all([
      Vendor.find(filter).populate('createdBy', 'fullName username').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Vendor.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, 'Vendors retrieved', vendors, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// POST /api/vendors
const createVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.create({ ...req.body, createdBy: req.user._id });
    return ApiResponse.created(res, 'Vendor created successfully', vendor);
  } catch (err) {
    next(err);
  }
};

// GET /api/vendors/:id
const getVendorById = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, isDeleted: false })
      .populate('createdBy', 'fullName username');
    if (!vendor) return next(ApiError.notFound('Vendor not found.'));
    return ApiResponse.success(res, 'Vendor retrieved', vendor);
  } catch (err) {
    next(err);
  }
};

// PUT /api/vendors/:id
const updateVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      req.body,
      { new: true, runValidators: true }
    );
    if (!vendor) return next(ApiError.notFound('Vendor not found.'));
    return ApiResponse.success(res, 'Vendor updated successfully', vendor);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/vendors/:id  (soft delete)
const deleteVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true, status: 'inactive' },
      { new: true }
    );
    if (!vendor) return next(ApiError.notFound('Vendor not found.'));
    return ApiResponse.success(res, 'Vendor deleted successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/vendors/:id/statistics
const getVendorStatistics = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, isDeleted: false });
    if (!vendor) return next(ApiError.notFound('Vendor not found.'));

    const [totalClients, activeClients, bankLoans, subsidies] = await Promise.all([
      Client.countDocuments({ vendorId: req.params.id, isDeleted: false }),
      Client.countDocuments({ vendorId: req.params.id, isDeleted: false, status: 'active' }),
      BankLoanApplication.countDocuments({ isDeleted: false, clientId: { $in: await Client.find({ vendorId: req.params.id }).distinct('_id') } }),
      SubsidyApplication.countDocuments({ isDeleted: false, clientId: { $in: await Client.find({ vendorId: req.params.id }).distinct('_id') } }),
    ]);

    return ApiResponse.success(res, 'Vendor statistics retrieved', {
      vendor: { _id: vendor._id, vendorName: vendor.vendorName, vendorCode: vendor.vendorCode },
      totalClients,
      activeClients,
      totalBankLoanApplications: bankLoans,
      totalSubsidyApplications: subsidies,
      totalApplications: bankLoans + subsidies,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getVendors, createVendor, getVendorById, updateVendor, deleteVendor, getVendorStatistics };
