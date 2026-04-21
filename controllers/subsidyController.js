const SubsidyApplication = require('../models/SubsidyApplication');
const Client = require('../models/Client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { encryptText, getPaginationOptions, buildPaginationMeta, generateQueryNumber } = require('../utils/helpers');
const { notifyAssignment, notifyStatusChange, notifyQueryRaised, notifyDocumentUpdate } = require('../utils/notificationHelper');

// ── Deep-populate: Client → Vendor ───────────────────────────────────────────
const populateOptions = [
  {
    path: 'clientId',
    select: 'clientId name email mobile businessName bankName branchName vendorId sourceType',
    populate: { path: 'vendorId', select: 'vendorName vendorCode' },
  },
  { path: 'assignedTo',  select: 'fullName username' },
  { path: 'createdBy',   select: 'fullName username' },
  { path: 'documentChecklist.documentType', select: 'name required' },
  { path: 'queries.assignedTo',             select: 'fullName username' },
  { path: 'timeline.performedBy',           select: 'fullName username' },
];

// Lightweight populate for list queries (avoids heavy sub-doc population on lists)
const listPopulateOptions = [
  {
    path: 'clientId',
    select: 'clientId name mobile bankName branchName vendorId',
    populate: { path: 'vendorId', select: 'vendorName' },
  },
  { path: 'assignedTo', select: 'fullName username' },
];

// ── Derive currentStatus from sub-document states ────────────────────────────
const deriveStatus = (app) => {
  // Walk backwards from the END of the workflow
  if (app.paymentDetails?.paymentReceived)                                      return 'Payment Received';
  if (app.subsidyClaim?.claimStatus === 'disbursed')                            return 'Subsidy Disbursed';
  if (app.subsidyClaim?.claimStatus === 'rejected')                             return 'Subsidy Claim Rejected';
  if (app.subsidyClaim?.claimStatus === 'approved')                             return 'Subsidy Claim Approved';
  if (app.subsidyClaim?.claimStatus === 'submitted')                            return 'Subsidy Claim Submitted';
  if (app.gocDetails?.gocStatus === 'rejected')                                 return 'GOC Rejected';
  if (app.gocDetails?.gocStatus === 'approved')                                 return 'GOC Approved';
  if (app.gocDetails?.gocStatus === 'applied')                                  return 'GOC Application Submitted';
  if (app.nhbDetails?.nhbPortalStatus &&
      ['goc-processing','query-issued','query-replied'].includes(app.nhbDetails.nhbPortalStatus)) return 'GOC Processing';
  if (app.bankLoanSanction?.sanctionStatus === 'rejected')                      return 'Bank Loan Rejected';
  if (app.bankLoanSanction?.sanctionStatus === 'sanctioned')                    return 'Bank Loan Sanctioned';
  if (app.bankSubmission?.submissionStatus === 'under-review')                  return 'Under Bank Review';
  if (app.bankSubmission?.submissionStatus === 'submitted')                     return 'File Submitted to Bank';
  if (['in-progress','ready'].includes(app.loanPreparation?.preparationStatus)) return 'Loan Preparation';
  // Check document completion
  if (app.documentChecklist?.length > 0 && app.documentChecklist.every(d => d.status === 'received')) return 'Documentation Completed';
  return 'Documentation In Progress';
};

// ── GET /api/subsidies ────────────────────────────────────────────────────────
const getApplications = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const filter = { isDeleted: false };

    // Text search
    if (req.query.search) {
      filter.$or = [
        { applicationId: { $regex: req.query.search, $options: 'i' } },
        { schemeName:    { $regex: req.query.search, $options: 'i' } },
        { departmentName:{ $regex: req.query.search, $options: 'i' } },
      ];
    }

    // Existing filters
    if (req.query.currentStatus) filter.currentStatus = req.query.currentStatus;
    if (req.query.priority)      filter.priority = req.query.priority;
    if (req.query.clientId)      filter.clientId = req.query.clientId;
    if (req.query.assignedTo)    filter.assignedTo = req.query.assignedTo;
    if (req.query.from || req.query.to) {
      filter.applicationDate = {};
      if (req.query.from) filter.applicationDate.$gte = new Date(req.query.from);
      if (req.query.to)   filter.applicationDate.$lte = new Date(req.query.to);
    }

    // ── Filters ───────────────────────────────────────────────────────────────
    if (req.query.schemeType)                 filter.schemeType = req.query.schemeType;
    if (req.query.nhbPortalStatus)            filter['nhbDetails.nhbPortalStatus'] = req.query.nhbPortalStatus;
    if (req.query.gocBankVerificationStatus)  filter.gocBankVerificationStatus = req.query.gocBankVerificationStatus;
    if (req.query.geoTaggingStatus)           filter.geoTaggingStatus = req.query.geoTaggingStatus;
    if (req.query.sanctionStatus)             filter['bankLoanSanction.sanctionStatus'] = req.query.sanctionStatus;
    if (req.query.claimStatus)                filter['subsidyClaim.claimStatus'] = req.query.claimStatus;
    if (req.query.paymentReceived !== undefined && req.query.paymentReceived !== '') {
      filter['paymentDetails.paymentReceived'] = req.query.paymentReceived === 'true';
    }


    const [apps, total] = await Promise.all([
      SubsidyApplication.find(filter)
        .populate(listPopulateOptions)
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

// ── POST /api/subsidies ───────────────────────────────────────────────────────
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
      status: 'pending',
    }));

    // Handle NHB password encryption at creation time
    const body = { ...req.body };
    if (body.nhbDetails?.nhbPassword) {
      body.nhbDetails = {
        ...body.nhbDetails,
        _nhbPasswordEncrypted: encryptText(body.nhbDetails.nhbPassword),
      };
      delete body.nhbDetails.nhbPassword;
    }

    const assignedTo = body.assignedTo || (req.user.role === 'data-entry' ? req.user._id : undefined);
    const app = await SubsidyApplication.create({ ...body, documentChecklist, assignedTo, createdBy: req.user._id });
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

// ── GET /api/subsidies/:id ────────────────────────────────────────────────────
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

// ── PUT /api/subsidies/:id ───────────────────────────────────────────────────
const updateApplication = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, isDeleted: false };
    
    const app = await SubsidyApplication.findOne(filter);
    if (!app) return next(ApiError.notFound('Application not found.'));

    // ── Capture previous values for timeline comparison ─────────────────────
    const prevBankVerifStatus = app.gocBankVerificationStatus;
    const prevGeoTagStatus    = app.geoTaggingStatus;

    // ── Business Rule Validations ───────────────────────────────────────────

    // Rejection hard-stop: if sanction rejected, block all downstream updates
    if (app.bankLoanSanction?.sanctionStatus === 'rejected') {
      if (req.body.gocDetails || req.body.subsidyClaim || req.body.paymentDetails?.paymentReceived) {
        return next(ApiError.badRequest('Case closed: bank loan was rejected. No further updates allowed.'));
      }
    }
    // If GOC rejected, block claim and payment
    if (app.gocDetails?.gocStatus === 'rejected') {
      if (req.body.subsidyClaim || req.body.paymentDetails?.paymentReceived) {
        return next(ApiError.badRequest('Case closed: GOC was rejected. No further updates allowed.'));
      }
    }
    // If claim rejected, block payment
    if (app.subsidyClaim?.claimStatus === 'rejected') {
      if (req.body.paymentDetails?.paymentReceived) {
        return next(ApiError.badRequest('Case closed: subsidy claim was rejected. No further updates allowed.'));
      }
    }

    if (req.body.gocDetails && req.body.gocDetails.gocStatus &&
        req.body.gocDetails.gocStatus !== 'not-started' &&
        app.bankLoanSanction?.sanctionStatus !== 'sanctioned') {
      return next(ApiError.badRequest('GOC application requires bank loan to be sanctioned first.'));
    }

    if (req.body.subsidyClaim && req.body.subsidyClaim.claimStatus &&
        req.body.subsidyClaim.claimStatus !== 'not-submitted' &&
        app.gocDetails?.gocStatus !== 'approved') {
      return next(ApiError.badRequest('Subsidy claim requires GOC to be approved first.'));
    }

    if (req.body.paymentDetails?.paymentReceived === true &&
        app.subsidyClaim?.claimStatus !== 'disbursed') {
      return next(ApiError.badRequest('Payment cannot be marked received before subsidy is disbursed.'));
    }

    // ── Scalar / flat fields ──────────────────────────────────────────────────
    const allowedFlat = [
      'schemeName', 'schemeType', 'departmentName', 'subsidyAmountApplied', 'eligibleAmount',
      'approvedAmount', 'subsidyPercentage', 'projectCost', 'submissionDate', 'approvalDate',
      'releaseDate', 'receivedDate', 'utrNumber', 'currentStage', 'priority',
      'gocBankVerificationStatus', 'gocBankVerificationDate', 'geoTaggingStatus', 'geoTaggingDate',
    ];
    allowedFlat.forEach(f => { if (req.body[f] !== undefined) app[f] = req.body[f]; });

    // ── Auto-set verification dates on status → 'completed' ──────────────────
    if (req.body.gocBankVerificationStatus === 'completed' && !app.gocBankVerificationDate) {
      app.gocBankVerificationDate = new Date();
    }
    if (req.body.geoTaggingStatus === 'completed' && !app.geoTaggingDate) {
      app.geoTaggingDate = new Date();
    }

    // ── nhbDetails: merge + encrypt password ──────────────────────────────────
    if (req.body.nhbDetails) {
      const nd = req.body.nhbDetails;
      if (!app.nhbDetails) app.nhbDetails = {};
      if (nd.nhbId          !== undefined) app.nhbDetails.nhbId         = nd.nhbId;
      if (nd.nhbProjectCode !== undefined) app.nhbDetails.nhbProjectCode = nd.nhbProjectCode;
      if (nd.nhbPortalStatus !== undefined) {
        const prevNhbStatus = app.nhbDetails.nhbPortalStatus;
        app.nhbDetails.nhbPortalStatus = nd.nhbPortalStatus;
        if (prevNhbStatus !== nd.nhbPortalStatus) {
          app.timeline.push({
            activity: `NHB Portal Status changed to "${nd.nhbPortalStatus}"`,
            activityType: 'portal-update',
            performedBy: req.user._id,
            previousStatus: prevNhbStatus,
            newStatus: nd.nhbPortalStatus,
            isSystemGenerated: true,
          });
        }
      }
      if (nd.nhbPassword) {
        app.nhbDetails._nhbPasswordEncrypted = encryptText(nd.nhbPassword);
      }
      app.markModified('nhbDetails');
    }

    // ── gocDetails: shallow merge + timeline ──────────────────────────────────
    if (req.body.gocDetails) {
      const prevGocStatus = app.gocDetails?.gocStatus;
      if (!app.gocDetails) app.gocDetails = {};
      Object.assign(app.gocDetails, req.body.gocDetails);
      app.markModified('gocDetails');

      if (req.body.gocDetails.gocStatus && req.body.gocDetails.gocStatus !== prevGocStatus) {
        app.timeline.push({
          activity: `GOC status changed to "${req.body.gocDetails.gocStatus}"`,
          activityType: 'verification-update',
          performedBy: req.user._id,
          previousStatus: prevGocStatus,
          newStatus: req.body.gocDetails.gocStatus,
          isSystemGenerated: true,
        });
      }
    }

    // ── loanPreparation: shallow merge + timeline ────────────────────────────
    if (req.body.loanPreparation) {
      const prevStatus = app.loanPreparation?.preparationStatus;
      if (!app.loanPreparation) app.loanPreparation = {};
      Object.assign(app.loanPreparation, req.body.loanPreparation);
      app.markModified('loanPreparation');

      if (req.body.loanPreparation.preparationStatus && req.body.loanPreparation.preparationStatus !== prevStatus) {
        app.timeline.push({
          activity: `Loan preparation status changed to "${req.body.loanPreparation.preparationStatus}"`,
          activityType: 'loan-update',
          performedBy: req.user._id,
          previousStatus: prevStatus,
          newStatus: req.body.loanPreparation.preparationStatus,
          isSystemGenerated: true,
        });
      }
    }

    // ── bankSubmission: shallow merge + timeline ─────────────────────────────
    if (req.body.bankSubmission) {
      const prevStatus = app.bankSubmission?.submissionStatus;
      if (!app.bankSubmission) app.bankSubmission = {};
      Object.assign(app.bankSubmission, req.body.bankSubmission);
      app.markModified('bankSubmission');

      if (req.body.bankSubmission.submissionStatus && req.body.bankSubmission.submissionStatus !== prevStatus) {
        app.timeline.push({
          activity: `Bank submission status changed to "${req.body.bankSubmission.submissionStatus}"`,
          activityType: 'loan-update',
          performedBy: req.user._id,
          previousStatus: prevStatus,
          newStatus: req.body.bankSubmission.submissionStatus,
          isSystemGenerated: true,
        });
      }
    }

    // ── bankLoanSanction: shallow merge + timeline ───────────────────────────
    if (req.body.bankLoanSanction) {
      const prevStatus = app.bankLoanSanction?.sanctionStatus;
      if (!app.bankLoanSanction) app.bankLoanSanction = {};
      Object.assign(app.bankLoanSanction, req.body.bankLoanSanction);
      app.markModified('bankLoanSanction');

      if (req.body.bankLoanSanction.sanctionStatus && req.body.bankLoanSanction.sanctionStatus !== prevStatus) {
        app.timeline.push({
          activity: `Bank loan sanction status changed to "${req.body.bankLoanSanction.sanctionStatus}"`,
          activityType: 'loan-update',
          performedBy: req.user._id,
          previousStatus: prevStatus,
          newStatus: req.body.bankLoanSanction.sanctionStatus,
          isSystemGenerated: true,
        });
      }
    }

    // ── subsidyClaim: shallow merge + timeline ───────────────────────────────
    if (req.body.subsidyClaim) {
      const prevStatus = app.subsidyClaim?.claimStatus;
      const prevDisbDate = app.subsidyClaim?.disbursementDate;
      if (!app.subsidyClaim) app.subsidyClaim = {};
      Object.assign(app.subsidyClaim, req.body.subsidyClaim);
      app.markModified('subsidyClaim');

      if (req.body.subsidyClaim.claimStatus && req.body.subsidyClaim.claimStatus !== prevStatus) {
        app.timeline.push({
          activity: `Subsidy claim status changed to "${req.body.subsidyClaim.claimStatus}"`,
          activityType: 'claim-update',
          performedBy: req.user._id,
          previousStatus: prevStatus,
          newStatus: req.body.subsidyClaim.claimStatus,
          isSystemGenerated: true,
        });
      }

      if (req.body.subsidyClaim.disbursementDate && !prevDisbDate) {
        app.timeline.push({
          activity: `Subsidy disbursement date set to ${new Date(req.body.subsidyClaim.disbursementDate).toLocaleDateString('en-IN')}`,
          activityType: 'claim-update',
          performedBy: req.user._id,
          isSystemGenerated: true,
        });
      }
    }

    // ── paymentDetails: shallow merge + auto timeline ─────────────────────────
    if (req.body.paymentDetails) {
      const pd = req.body.paymentDetails;
      const wasReceived = app.paymentDetails?.paymentReceived;
      if (!app.paymentDetails) app.paymentDetails = {};
      Object.assign(app.paymentDetails, pd);
      app.markModified('paymentDetails');

      if (!wasReceived && pd.paymentReceived === true) {
        const amt = pd.paymentAmount ?? app.paymentDetails.paymentAmount;
        app.timeline.push({
          activity: amt ? `Payment received: ₹${Number(amt).toLocaleString('en-IN')}` : 'Payment marked as received',
          activityType: 'payment-update',
          performedBy: req.user._id,
          isSystemGenerated: true,
        });
      }
    }

    // ── Auto timeline for verification status changes ─────────────────────────
    if (req.body.gocBankVerificationStatus && req.body.gocBankVerificationStatus !== prevBankVerifStatus) {
      app.timeline.push({
        activity: `GOC Bank verification marked as "${req.body.gocBankVerificationStatus}"`,
        activityType: 'verification-update',
        performedBy: req.user._id,
        isSystemGenerated: true,
      });
    }
    if (req.body.geoTaggingStatus && req.body.geoTaggingStatus !== prevGeoTagStatus) {
      app.timeline.push({
        activity: `Geo-tagging marked as "${req.body.geoTaggingStatus}"`,
        activityType: 'verification-update',
        performedBy: req.user._id,
        isSystemGenerated: true,
      });
    }

    // ── Auto-derive currentStatus from sub-document states ────────────────────
    const prevStatus = app.currentStatus;
    const derived = deriveStatus(app);
    if (derived !== prevStatus) {
      app.currentStatus = derived;
      app.lastStatusChangeDate = new Date();
      app.timeline.push({
        activity: `Status auto-updated: "${prevStatus}" → "${derived}"`,
        activityType: 'status-change',
        performedBy: req.user._id,
        previousStatus: prevStatus,
        newStatus: derived,
        isSystemGenerated: true,
      });
    }

    await app.save();
    await app.populate(populateOptions);
    return ApiResponse.success(res, 'Application updated', app);
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/subsidies/:id ─────────────────────────────────────────────────
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

// ── PUT /api/subsidies/:id/status ─────────────────────────────────────────────
const updateStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    if (!status) return next(ApiError.badRequest('Status is required.'));

    const filter = { _id: req.params.id, isDeleted: false };
    
    const app = await SubsidyApplication.findOne(filter);
    if (!app) return next(ApiError.notFound('Application not found.'));

    const previousStatus = app.currentStatus;
    app.currentStatus = status;
    app.lastStatusChangeDate = new Date();

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

// ── PUT /api/subsidies/:id/documents ─────────────────────────────────────────
const updateDocumentChecklist = async (req, res, next) => {
  try {
    const { documentId, status, remarks, requestedDate, receivedDate, submittedDate, verifiedDate, verifiedBy } = req.body;

    const app = await SubsidyApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    const doc = app.documentChecklist.id(documentId);
    if (!doc) return next(ApiError.notFound('Document not found in checklist.'));

    const prev = doc.status;
    if (status)        doc.status = status;
    if (remarks)       doc.remarks = remarks;
    if (requestedDate) doc.requestedDate = requestedDate;
    if (receivedDate)  doc.receivedDate = receivedDate;
    if (submittedDate) doc.submittedDate = submittedDate;
    if (verifiedDate)  doc.verifiedDate = verifiedDate;
    if (verifiedBy)    doc.verifiedBy = verifiedBy;

    app.timeline.push({
      activity: `Document "${doc.documentName}" updated to "${status}"`,
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

// ── POST /api/subsidies/:id/queries ──────────────────────────────────────────
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

// ── PUT /api/subsidies/:id/queries/:queryId ──────────────────────────────────
const updateQuery = async (req, res, next) => {
  try {
    const app = await SubsidyApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    const q = app.queries.id(req.params.queryId);
    if (!q) return next(ApiError.notFound('Query not found.'));

    ['status', 'resolutionRemarks', 'responseSubmittedDate', 'resolutionDate', 'assignedTo'].forEach(f => {
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

// ── POST /api/subsidies/:id/timeline ─────────────────────────────────────────
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

// ── GET /api/subsidies/:id/timeline ──────────────────────────────────────────
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

// ── PUT /api/subsidies/:id/assign ─────────────────────────────────────────────
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

// ── PUT /api/subsidies/:id/goc-credentials ───────────────────────────────────
const updateGocCredentials = async (req, res, next) => {
  try {
    const { email, mobile, password } = req.body;
    const app = await SubsidyApplication.findOne({ _id: req.params.id, isDeleted: false });
    if (!app) return next(ApiError.notFound('Application not found.'));

    if (!app.gocCredentials) app.gocCredentials = {};
    if (email    !== undefined) app.gocCredentials.email  = email;
    if (mobile   !== undefined) app.gocCredentials.mobile = mobile;
    if (password) app.gocCredentials._passwordEncrypted = encryptText(password);

    app.markModified('gocCredentials');
    await app.save();
    return ApiResponse.success(res, 'GOC credentials saved', {
      email:       app.gocCredentials.email,
      mobile:      app.gocCredentials.mobile,
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
