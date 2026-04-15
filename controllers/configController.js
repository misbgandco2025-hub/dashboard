const FieldConfiguration = require('../models/FieldConfiguration');
const StatusOption = require('../models/StatusOption');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/config/documents/:type
const getDocumentTypes = async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!['bank-loan', 'subsidy'].includes(type)) {
      return next(ApiError.badRequest('Type must be bank-loan or subsidy'));
    }
    const docs = await FieldConfiguration.find({ type, isDeleted: false, isActive: true })
      .sort({ displayOrder: 1, name: 1 });
    return ApiResponse.success(res, 'Document types retrieved', docs);
  } catch (err) {
    next(err);
  }
};

// POST /api/config/documents
const createDocumentType = async (req, res, next) => {
  try {
    const doc = await FieldConfiguration.create({ ...req.body, createdBy: req.user._id });
    return ApiResponse.created(res, 'Document type created', doc);
  } catch (err) {
    next(err);
  }
};

// PUT /api/config/documents/:id
const updateDocumentType = async (req, res, next) => {
  try {
    const doc = await FieldConfiguration.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      req.body,
      { new: true, runValidators: true }
    );
    if (!doc) return next(ApiError.notFound('Document type not found.'));
    return ApiResponse.success(res, 'Document type updated', doc);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/config/documents/:id  (soft delete)
const deleteDocumentType = async (req, res, next) => {
  try {
    const doc = await FieldConfiguration.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true, isActive: false },
      { new: true }
    );
    if (!doc) return next(ApiError.notFound('Document type not found.'));
    return ApiResponse.success(res, 'Document type deleted');
  } catch (err) {
    next(err);
  }
};

// GET /api/config/status-options/:type
const getStatusOptions = async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!['bank-loan', 'subsidy'].includes(type)) {
      return next(ApiError.badRequest('Type must be bank-loan or subsidy'));
    }
    const statuses = await StatusOption.find({ type, isActive: true }).sort({ order: 1, label: 1 });
    return ApiResponse.success(res, 'Status options retrieved', statuses);
  } catch (err) {
    next(err);
  }
};

// POST /api/config/status-options
const createStatusOption = async (req, res, next) => {
  try {
    const status = await StatusOption.create({ ...req.body, createdBy: req.user._id });
    return ApiResponse.created(res, 'Status option created', status);
  } catch (err) {
    next(err);
  }
};

// PUT /api/config/status-options/:id
const updateStatusOption = async (req, res, next) => {
  try {
    const status = await StatusOption.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!status) return next(ApiError.notFound('Status option not found.'));
    return ApiResponse.success(res, 'Status option updated', status);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
  getStatusOptions,
  createStatusOption,
  updateStatusOption,
};
