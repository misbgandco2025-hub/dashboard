const Client = require('../models/Client');
const BankLoanApplication = require('../models/BankLoanApplication');
const SubsidyApplication = require('../models/SubsidyApplication');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/helpers');

// GET /api/clients
const getClients = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const filter = { isDeleted: false };

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { clientId: { $regex: req.query.search, $options: 'i' } },
        { mobile: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.sourceType) filter.sourceType = req.query.sourceType;
    if (req.query.clientType) filter.clientType = req.query.clientType;
    if (req.query.vendorId) filter.vendorId = req.query.vendorId;

    const [clients, total] = await Promise.all([
      Client.find(filter)
        .populate('vendorId', 'vendorName vendorCode')
        .populate('createdBy', 'fullName username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Client.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, 'Clients retrieved', clients, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// POST /api/clients
const createClient = async (req, res, next) => {
  try {
    // Duplicate check
    const existing = await Client.findOne({
      $or: [{ mobile: req.body.mobile }, { email: req.body.email }],
      isDeleted: false,
    });
    if (existing) {
      return next(ApiError.conflict('A client with this mobile or email already exists.'));
    }

    const client = await Client.create({ ...req.body, createdBy: req.user._id });
    await client.populate('vendorId', 'vendorName vendorCode');

    return ApiResponse.created(res, 'Client created successfully', client);
  } catch (err) {
    next(err);
  }
};

// GET /api/clients/:id
const getClientById = async (req, res, next) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, isDeleted: false })
      .populate('vendorId', 'vendorName vendorCode contactPerson mobile email')
      .populate('createdBy', 'fullName username');
    if (!client) return next(ApiError.notFound('Client not found.'));
    return ApiResponse.success(res, 'Client retrieved', client);
  } catch (err) {
    next(err);
  }
};

// PUT /api/clients/:id
const updateClient = async (req, res, next) => {
  try {
    // Check duplicate email/mobile if being changed
    if (req.body.email || req.body.mobile) {
      const orConds = [];
      if (req.body.email) orConds.push({ email: req.body.email });
      if (req.body.mobile) orConds.push({ mobile: req.body.mobile });
      const existing = await Client.findOne({
        $or: orConds,
        isDeleted: false,
        _id: { $ne: req.params.id },
      });
      if (existing) return next(ApiError.conflict('Mobile or email already used by another client.'));
    }

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      req.body,
      { new: true, runValidators: true }
    ).populate('vendorId', 'vendorName vendorCode');

    if (!client) return next(ApiError.notFound('Client not found.'));
    return ApiResponse.success(res, 'Client updated successfully', client);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/clients/:id  (soft delete)
const deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true, status: 'inactive' },
      { new: true }
    );
    if (!client) return next(ApiError.notFound('Client not found.'));
    return ApiResponse.success(res, 'Client deleted successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/clients/check-duplicate?email=x&mobile=y
const checkDuplicate = async (req, res, next) => {
  try {
    const { email, mobile, excludeId } = req.query;
    if (!email && !mobile) {
      return next(ApiError.badRequest('Provide email or mobile to check.'));
    }

    const orConds = [];
    if (email) orConds.push({ email });
    if (mobile) orConds.push({ mobile });

    const filter = { $or: orConds, isDeleted: false };
    if (excludeId) filter._id = { $ne: excludeId };

    const existing = await Client.findOne(filter).select('clientId name email mobile');
    return ApiResponse.success(res, 'Duplicate check complete', {
      isDuplicate: !!existing,
      existingClient: existing || null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/clients/:id/statistics
const getClientStatistics = async (req, res, next) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, isDeleted: false });
    if (!client) return next(ApiError.notFound('Client not found.'));

    const [bankLoans, subsidies] = await Promise.all([
      BankLoanApplication.find({ clientId: req.params.id, isDeleted: false }).select('applicationId currentStatus applicationDate'),
      SubsidyApplication.find({ clientId: req.params.id, isDeleted: false }).select('applicationId currentStatus applicationDate schemeName'),
    ]);

    return ApiResponse.success(res, 'Client statistics retrieved', {
      client: { _id: client._id, clientId: client.clientId, name: client.name },
      bankLoanApplications: { total: bankLoans.length, list: bankLoans },
      subsidyApplications: { total: subsidies.length, list: subsidies },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getClients, createClient, getClientById, updateClient, deleteClient, checkDuplicate, getClientStatistics };
