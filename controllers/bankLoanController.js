const BankLoanApplication = require('../models/BankLoanApplication');
const Client = require('../models/Client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginationMeta, generateQueryNumber } = require('../utils/helpers');
const { notifyAssignment, notifyStatusChange, notifyQueryRaised, notifyDocumentUpdate } = require('../utils/notificationHelper');

const populateOptions = [
  { path: 'clientId', select: 'clientId name email mobile businessName' },
  { path: 'assignedTo', select: 'fullName username' },
  { path: 'createdBy', select: 'fullName username' },
  { path: 'documentChecklist.documentType', select: 'name required' },
  { path: 'queries.assignedTo', select: 'fullName username' },
  { path: 'timeline.performedBy', select: 'fullName username' },
];

// GET /api/bank-loans
const getApplications = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const filter = { isDeleted: false };

    if (req.query.search) {
      filter.$or = [
        { applicationId: { $regex: req.query.search, $options: 'i' } },
        { bankRefNumber: { $regex: req.query.search, $options: 'i' } },
        { loanScheme: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.currentStatus) filter.currentStatus = req.query.currentStatus;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.clientId) filter.clientId = req.query.clientId;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.from || req.query.to) {
      filter.applicationDate = {};
      if (req.query.from) filter.applicationDate.$gte = new Date(req.query.from);
      if (req.query.to) filter.applicationDate.$lte = new Date(req.query.to);
    }

    const [apps, total] = await Promise.all([
      BankLoanApplication.find(filter)
        .populate('clientId', 'clientId name mobile')
        .populate('assignedTo', 'fullName username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BankLoanApplication.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, 'Bank loan applications retrieved', apps, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// POST /api/bank-loans
const createApplication = async (req, res, next) => {
  try {
    const FieldConfiguration = require('../models/FieldConfiguration');
    const client = await Client.findOne({ _id: req.body.clientId, isDeleted: false });
    if (!client) return next(ApiError.notFound('Client not found.'));

    const fields = await FieldConfiguration.find({ type: 'bank-loan', isActive: true, isDeleted: false }).sort({ displayOrder: 1 });
    const documentChecklist = fields.map(f => ({
      documentType: f._id,
      documentName: f.name,
      isRequired: f.required,
      status: 'pending'
    }));

    // Auto-assign to creator if data-entry user
    const assignedTo = req.body.assignedTo || (req.user.role === 'data-entry' ? req.user._id : undefined);
    const app = await BankLoanApplication.create({ ...req.body, documentChecklist, assignedTo, createdBy: req.user._id });
    await app.populate(populateOptions);

    // Timeline entry
    app.timeline.push({
      activity: 'Application created',
      activityType: 'note',
      performedBy: req.user._id,
      isSystemGenerated: true,
    });
    await app.save();

    if (app.assignedTo) {
      await notifyAssignment(app.assignedTo, app.applicationId, 'Bank Loan');
    }

    return ApiResponse.created(res, 'Bank loan application created', app);
  } catch (err) {
    next(err);
  }
};

// GET /api/bank-loans/:id
const getApplicationById = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, isDeleted: false };

    const app = await BankLoanApplication.findOne(filter).populate(populateOptions);
    if (!app) return next(ApiError.notFound('Application not found.'));
    return ApiResponse.success(res, 'Application retrieved', app);
  } catch (err) {
    next(err);
  }
};

// PUT /api/bank-loans/:id
const updateApplication = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, isDeleted: false };
    
    const app = await BankLoanApplication.findOne(filter);
    if (!app) return next(ApiError.notFound('Application not found.'));

    const allowedFields = ['loanAmount', 'loanScheme', 'loanType', 'bankRefNumber', 'currentStage',
      'applicationSubmissionDate', 'approvalDate', 'disbursementDate', 'priority'];
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) app[f] = req.body[f]; });

    await app.save();
    await app.populate(populateOptions);
    return ApiResponse.success(res, 'Application updated', app);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/bank-loans/:id
const deleteApplication = async (req, res, next) => {
  try {
    const app = await BankLoanApplication.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!app) return next(ApiError.notFound('Application not found.'));
    return ApiResponse.success(res, 'Application deleted successfully');
  } catch (err) {
    next(err);
  }
};

// PUT /api/bank-loans/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    if (!status) return next(ApiError.badRequest('Status is required.'));

    const filter = { _id: req.params.id, isDeleted: false };
    
    const app = await BankLoanApplication.findOne(filter);
    if (!app) return next(ApiError.notFound('Application not found.'));

    const previousStatus = app.currentStatus;
    app.currentStatus = status;

    app.timeline.push({
      activity: `Status changed from "${previousStatus}" to "${status}"`,
      activityType: 'status-change',
      performedBy: req.user._id,
      previousStatus,
      newStatus: status,
      remarks,
      isSystemGenerated: true,
    });

    await app.save();

    // Notify assigned user
    if (app.assignedTo) {
      await notifyStatusChange(app.assignedTo, app.applicationId, 'bank-loan', previousStatus, status);
    }

    return ApiResponse.success(res, 'Status updated', { applicationId: app.applicationId, currentStatus: app.currentStatus });
  } catch (err) {
    next(err);
  }
};

// PUT /api/bank-loans/:id/documents
const updateDocumentChecklist = async (req, res, next) => {
  try {
    const { documentId, status, remarks, requestedDate, receivedDate, submittedDate, verifiedDate, verifiedBy } = req.body;

    const app = await BankLoanApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    const doc = app.documentChecklist.id(documentId);
    if (!doc) return next(ApiError.notFound('Document not found in checklist.'));

    const prev = doc.status;
    if (status) doc.status = status;
    if (remarks) doc.remarks = remarks;
    if (requestedDate) doc.requestedDate = requestedDate;
    if (receivedDate) doc.receivedDate = receivedDate;
    if (submittedDate) doc.submittedDate = submittedDate;
    if (verifiedDate) doc.verifiedDate = verifiedDate;
    if (verifiedBy) doc.verifiedBy = verifiedBy;

    app.timeline.push({
      activity: `Document "${doc.documentName || documentId}" status updated to "${status}"`,
      activityType: 'document-update',
      performedBy: req.user._id,
      previousStatus: prev,
      newStatus: status,
      isSystemGenerated: true,
    });

    await app.save();

    if (app.assignedTo) {
      await notifyDocumentUpdate(app.assignedTo, app.applicationId, 'bank-loan', doc.documentName);
    }

    return ApiResponse.success(res, 'Document checklist updated', app.documentChecklist);
  } catch (err) {
    next(err);
  }
};

// POST /api/bank-loans/:id/queries
const addQuery = async (req, res, next) => {
  try {
    const app = await BankLoanApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    const queryNumber = generateQueryNumber(app.queries.length);
    app.queries.push({ ...req.body, queryNumber });

    app.timeline.push({
      activity: `Query ${queryNumber} raised`,
      activityType: 'query',
      performedBy: req.user._id,
      isSystemGenerated: true,
    });

    await app.save();

    if (app.assignedTo) {
      await notifyQueryRaised(app.assignedTo, app.applicationId, 'bank-loan', queryNumber);
    }

    return ApiResponse.created(res, 'Query added', app.queries[app.queries.length - 1]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/bank-loans/:id/queries/:queryId
const updateQuery = async (req, res, next) => {
  try {
    const app = await BankLoanApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    const q = app.queries.id(req.params.queryId);
    if (!q) return next(ApiError.notFound('Query not found.'));

    const updatable = ['status', 'resolutionRemarks', 'responseSubmittedDate', 'resolutionDate', 'assignedTo'];
    updatable.forEach((f) => { if (req.body[f] !== undefined) q[f] = req.body[f]; });

    if (req.body.status === 'closed') q.closedBy = req.user._id;

    app.timeline.push({
      activity: `Query ${q.queryNumber} updated to "${q.status}"`,
      activityType: 'query',
      performedBy: req.user._id,
      isSystemGenerated: true,
    });

    await app.save();
    return ApiResponse.success(res, 'Query updated', q);
  } catch (err) {
    next(err);
  }
};

// POST /api/bank-loans/:id/timeline
const addTimelineEntry = async (req, res, next) => {
  try {
    const { activity, remarks } = req.body;
    if (!activity) return next(ApiError.badRequest('Activity description is required.'));

    const app = await BankLoanApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    app.timeline.push({
      activity,
      activityType: 'note',
      performedBy: req.user._id,
      remarks,
      isSystemGenerated: false,
    });

    await app.save();
    return ApiResponse.created(res, 'Timeline entry added', app.timeline[app.timeline.length - 1]);
  } catch (err) {
    next(err);
  }
};

// GET /api/bank-loans/:id/timeline
const getTimeline = async (req, res, next) => {
  try {
    const app = await BankLoanApplication.findOne({ _id: req.params.id, isDeleted: false })
      .populate('timeline.performedBy', 'fullName username');
    if (!app) return next(ApiError.notFound('Application not found.'));
    const sorted = [...app.timeline].sort((a, b) => new Date(b.activityDate) - new Date(a.activityDate));
    return ApiResponse.success(res, 'Timeline retrieved', sorted);
  } catch (err) {
    next(err);
  }
};

// PUT /api/bank-loans/:id/assign
const assignApplication = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;
    if (!assignedTo) return next(ApiError.badRequest('assignedTo user ID is required.'));

    const app = await BankLoanApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    const previousAssignee = app.assignedTo;
    app.assignedTo = assignedTo;

    app.timeline.push({
      activity: `Application assigned to new user`,
      activityType: 'assignment',
      performedBy: req.user._id,
      isSystemGenerated: true,
    });

    await app.save();
    await notifyAssignment(assignedTo, app.applicationId, 'Bank Loan');

    return ApiResponse.success(res, 'Application assigned successfully', { applicationId: app.applicationId, assignedTo });
  } catch (err) {
    next(err);
  }
};

// PUT /api/bank-loans/:id/aif-credentials
const updateAifCredentials = async (req, res, next) => {
  try {
    const { email, mobile, password } = req.body;
    const app = await BankLoanApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    if (!app.aifCredentials) app.aifCredentials = {};
    if (email !== undefined) app.aifCredentials.email = email;
    if (mobile !== undefined) app.aifCredentials.mobile = mobile;
    if (password) {
      const { encryptText } = require('../utils/helpers');
      app.aifCredentials._passwordEncrypted = encryptText(password);
    }

    app.markModified('aifCredentials');
    await app.save();
    return ApiResponse.success(res, 'AIF credentials saved', {
      email: app.aifCredentials.email,
      mobile: app.aifCredentials.mobile,
      hasPassword: !!app.aifCredentials._passwordEncrypted,
    });
  } catch (err) {
    next(err);
  }
};


module.exports = {
  getApplications,
  createApplication,
  getApplicationById,
  updateApplication,
  deleteApplication,
  updateStatus,
  updateDocumentChecklist,
  addQuery,
  updateQuery,
  addTimelineEntry,
  getTimeline,
  assignApplication,
  updateAifCredentials,
};
