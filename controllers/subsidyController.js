const SubsidyApplication = require('../models/SubsidyApplication');
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

// GET /api/subsidies
const getApplications = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const filter = { isDeleted: false };

    if (req.query.search) {
      filter.$or = [
        { applicationId: { $regex: req.query.search, $options: 'i' } },
        { schemeName: { $regex: req.query.search, $options: 'i' } },
        { departmentName: { $regex: req.query.search, $options: 'i' } },
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

    // DATA ENTRY: see assigned applications AND their own created ones
    if (req.user.role === 'data-entry') {
      filter.$or = [{ assignedTo: req.user._id }, { createdBy: req.user._id }];
    }

    const [apps, total] = await Promise.all([
      SubsidyApplication.find(filter)
        .populate('clientId', 'clientId name mobile')
        .populate('assignedTo', 'fullName username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SubsidyApplication.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, 'Subsidy applications retrieved', apps, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// POST /api/subsidies
const createApplication = async (req, res, next) => {
  try {
    const FieldConfiguration = require('../models/FieldConfiguration');
    const client = await Client.findOne({ _id: req.body.clientId, isDeleted: false });
    if (!client) return next(ApiError.notFound('Client not found.'));

    const fields = await FieldConfiguration.find({ type: 'subsidy', isActive: true, isDeleted: false }).sort({ displayOrder: 1 });
    const documentChecklist = fields.map(f => ({
      documentType: f._id,
      documentName: f.name,
      isRequired: f.required,
      status: 'pending'
    }));

    // Auto-assign to creator if data-entry user
    const assignedTo = req.body.assignedTo || (req.user.role === 'data-entry' ? req.user._id : undefined);
    const app = await SubsidyApplication.create({ ...req.body, documentChecklist, assignedTo, createdBy: req.user._id });
    await app.populate(populateOptions);

    app.timeline.push({
      activity: 'Application created',
      activityType: 'note',
      performedBy: req.user._id,
      isSystemGenerated: true,
    });
    await app.save();

    if (app.assignedTo) await notifyAssignment(app.assignedTo, app.applicationId, 'Subsidy');

    return ApiResponse.created(res, 'Subsidy application created', app);
  } catch (err) {
    next(err);
  }
};

// GET /api/subsidies/:id
const getApplicationById = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, isDeleted: false };

    const app = await SubsidyApplication.findOne(filter).populate(populateOptions);
    if (!app) return next(ApiError.notFound('Application not found.'));
    return ApiResponse.success(res, 'Application retrieved', app);
  } catch (err) {
    next(err);
  }
};

// PUT /api/subsidies/:id
const updateApplication = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, isDeleted: false };
    if (req.user.role === 'data-entry') filter.assignedTo = req.user._id;

    const app = await SubsidyApplication.findOne(filter);
    if (!app) return next(ApiError.notFound('Application not found.'));

    const allowed = ['schemeName', 'schemeType', 'departmentName', 'subsidyAmountApplied', 'eligibleAmount',
      'approvedAmount', 'subsidyPercentage', 'projectCost', 'submissionDate', 'approvalDate',
      'releaseDate', 'receivedDate', 'utrNumber', 'currentStage', 'priority'];
    allowed.forEach((f) => { if (req.body[f] !== undefined) app[f] = req.body[f]; });

    await app.save();
    await app.populate(populateOptions);
    return ApiResponse.success(res, 'Application updated', app);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/subsidies/:id
const deleteApplication = async (req, res, next) => {
  try {
    const app = await SubsidyApplication.findOneAndUpdate(
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

// PUT /api/subsidies/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    if (!status) return next(ApiError.badRequest('Status is required.'));

    const filter = { _id: req.params.id, isDeleted: false };
    if (req.user.role === 'data-entry') filter.assignedTo = req.user._id;

    const app = await SubsidyApplication.findOne(filter);
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
    if (app.assignedTo) await notifyStatusChange(app.assignedTo, app.applicationId, 'subsidy', previousStatus, status);

    return ApiResponse.success(res, 'Status updated', { applicationId: app.applicationId, currentStatus: app.currentStatus });
  } catch (err) {
    next(err);
  }
};

// PUT /api/subsidies/:id/documents
const updateDocumentChecklist = async (req, res, next) => {
  try {
    const { documentId, status, remarks, requestedDate, receivedDate, submittedDate, verifiedDate, verifiedBy } = req.body;

    const app = await SubsidyApplication.findOne({ _id: req.params.id, isDeleted: false });
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
      activity: `Document updated to "${status}"`,
      activityType: 'document-update',
      performedBy: req.user._id,
      previousStatus: prev,
      newStatus: status,
      isSystemGenerated: true,
    });

    await app.save();
    if (app.assignedTo) await notifyDocumentUpdate(app.assignedTo, app.applicationId, 'subsidy', doc.documentName);

    return ApiResponse.success(res, 'Document checklist updated', app.documentChecklist);
  } catch (err) {
    next(err);
  }
};

// POST /api/subsidies/:id/queries
const addQuery = async (req, res, next) => {
  try {
    const app = await SubsidyApplication.findOne({ _id: req.params.id, isDeleted: false });
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
    if (app.assignedTo) await notifyQueryRaised(app.assignedTo, app.applicationId, 'subsidy', queryNumber);

    return ApiResponse.created(res, 'Query added', app.queries[app.queries.length - 1]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/subsidies/:id/queries/:queryId
const updateQuery = async (req, res, next) => {
  try {
    const app = await SubsidyApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    const q = app.queries.id(req.params.queryId);
    if (!q) return next(ApiError.notFound('Query not found.'));

    ['status', 'resolutionRemarks', 'responseSubmittedDate', 'resolutionDate', 'assignedTo'].forEach((f) => {
      if (req.body[f] !== undefined) q[f] = req.body[f];
    });
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

// POST /api/subsidies/:id/timeline
const addTimelineEntry = async (req, res, next) => {
  try {
    const { activity, remarks } = req.body;
    if (!activity) return next(ApiError.badRequest('Activity description is required.'));

    const app = await SubsidyApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    app.timeline.push({ activity, activityType: 'note', performedBy: req.user._id, remarks, isSystemGenerated: false });
    await app.save();

    return ApiResponse.created(res, 'Timeline entry added', app.timeline[app.timeline.length - 1]);
  } catch (err) {
    next(err);
  }
};

// GET /api/subsidies/:id/timeline
const getTimeline = async (req, res, next) => {
  try {
    const app = await SubsidyApplication.findOne({ _id: req.params.id, isDeleted: false })
      .populate('timeline.performedBy', 'fullName username');
    if (!app) return next(ApiError.notFound('Application not found.'));
    const sorted = [...app.timeline].sort((a, b) => new Date(b.activityDate) - new Date(a.activityDate));
    return ApiResponse.success(res, 'Timeline retrieved', sorted);
  } catch (err) {
    next(err);
  }
};

// PUT /api/subsidies/:id/assign
const assignApplication = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;
    if (!assignedTo) return next(ApiError.badRequest('assignedTo is required.'));

    const app = await SubsidyApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    app.assignedTo = assignedTo;
    app.timeline.push({
      activity: 'Application assigned to new user',
      activityType: 'assignment',
      performedBy: req.user._id,
      isSystemGenerated: true,
    });

    await app.save();
    await notifyAssignment(assignedTo, app.applicationId, 'Subsidy');

    return ApiResponse.success(res, 'Application assigned', { applicationId: app.applicationId, assignedTo });
  } catch (err) {
    next(err);
  }
};

// PUT /api/subsidies/:id/goc-credentials
const updateGocCredentials = async (req, res, next) => {
  try {
    const { email, mobile, password } = req.body;
    const app = await SubsidyApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    if (!app.gocCredentials) app.gocCredentials = {};
    if (email !== undefined) app.gocCredentials.email = email;
    if (mobile !== undefined) app.gocCredentials.mobile = mobile;
    if (password) {
      const { encryptText } = require('../utils/helpers');
      app.gocCredentials._passwordEncrypted = encryptText(password);
    }

    app.markModified('gocCredentials');
    await app.save();
    return ApiResponse.success(res, 'GOC credentials saved', {
      email: app.gocCredentials.email,
      mobile: app.gocCredentials.mobile,
      hasPassword: !!app.gocCredentials._passwordEncrypted,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getApplications, createApplication, getApplicationById, updateApplication,
  deleteApplication, updateStatus, updateDocumentChecklist, addQuery,
  updateQuery, addTimelineEntry, getTimeline, assignApplication, updateGocCredentials,
};
