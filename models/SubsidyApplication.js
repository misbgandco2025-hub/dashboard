const mongoose = require('mongoose');
const { encryptText, decryptText } = require('../utils/helpers');

// Sub-schemas (same structure as BankLoan)
const documentChecklistSchema = new mongoose.Schema({
  documentType: { type: mongoose.Schema.Types.ObjectId, ref: 'FieldConfiguration', required: true },
  documentName: { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'received'],
    default: 'pending',
  },
  requestedDate: { type: Date },
  receivedDate: { type: Date },
  submittedDate: { type: Date },
  verifiedDate: { type: Date },
  remarks: { type: String, trim: true },
  verifiedBy: { type: String, trim: true },
});

const portalCredentialSchema = new mongoose.Schema({
  portalName: { type: String, required: true, trim: true },
  userId: { type: String, trim: true },
  _passwordEncrypted: { type: String },
  registrationDate: { type: Date },
  applicationNumber: { type: String, trim: true },
  registrationStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'query-raised'], default: 'pending' },
  approvalDate: { type: Date },
  remarks: { type: String, trim: true },
});

portalCredentialSchema.virtual('password')
  .set(function (val) { if (val) this._passwordEncrypted = encryptText(val); })
  .get(function () { return this._passwordEncrypted ? decryptText(this._passwordEncrypted) : ''; });

const querySchema = new mongoose.Schema({
  queryNumber: { type: String, trim: true },
  queryRaisedDate: { type: Date, default: Date.now },
  queryRaisedBy: { type: String, trim: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, enum: ['documentation', 'technical', 'financial', 'other'], default: 'other' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  responseSubmittedDate: { type: Date },
  resolutionDate: { type: Date },
  resolutionRemarks: { type: String, trim: true },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const timelineSchema = new mongoose.Schema({
  activity: { type: String, required: true, trim: true },
  activityType: {
    type: String,
    enum: ['status-change', 'document-update', 'query', 'note', 'portal-update', 'assignment', 'verification-update', 'payment-update', 'loan-update', 'claim-update'],
    default: 'note',
  },
  activityDate: { type: Date, default: Date.now },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  previousStatus: { type: String, trim: true },
  newStatus: { type: String, trim: true },
  remarks: { type: String, trim: true },
  isSystemGenerated: { type: Boolean, default: false },
});

// ── NHB Details Sub-schema ────────────────────────────────────────────────────
const nhbDetailsSchema = new mongoose.Schema({
  nhbId:                  { type: String, trim: true },
  _nhbPasswordEncrypted:  { type: String },
  nhbProjectCode:         { type: String, trim: true },
  nhbPortalStatus: {
    type: String,
    enum: ['goc-new', 'goc-processing', 'query-issued', 'query-replied', 'goc-received'],
    default: 'goc-new',
  },
}, { _id: false });

nhbDetailsSchema.virtual('nhbPassword')
  .set(function (val) { if (val) this._nhbPasswordEncrypted = encryptText(val); })
  .get(function () { return this._nhbPasswordEncrypted ? decryptText(this._nhbPasswordEncrypted) : ''; });

// ── GOC Details Sub-schema ────────────────────────────────────────────────────
const gocDetailsSchema = new mongoose.Schema({
  gocApplicationDate: { type: Date },
  gocStatus: {
    type: String,
    enum: ['not-started', 'applied', 'approved', 'rejected'],
    default: 'not-started',
  },
}, { _id: false });

// ── Payment Details Sub-schema ────────────────────────────────────────────────
const paymentDetailsSchema = new mongoose.Schema({
  paymentReceived:      { type: Boolean, default: false },
  paymentAmount:        { type: Number, min: 0 },
  paymentDate:          { type: Date },
  paymentMode:          { type: String, enum: ['neft', 'rtgs', 'cheque', 'cash'] },
  transactionReference: { type: String, trim: true },
}, { _id: false });

// ── Loan Preparation Sub-schema (NEW) ─────────────────────────────────────────
const loanPreparationSchema = new mongoose.Schema({
  preparationStartDate:     { type: Date },
  preparationCompletedDate: { type: Date },
  loanAmountCalculated:     { type: Number, min: 0 },
  preparationStatus: {
    type: String,
    enum: ['not-started', 'in-progress', 'ready'],
    default: 'not-started',
  },
}, { _id: false });

// ── Bank Submission Sub-schema (NEW) ──────────────────────────────────────────
const bankSubmissionSchema = new mongoose.Schema({
  submissionDate:          { type: Date },
  bankFileReferenceNumber: { type: String, trim: true },
  bankOfficerName:         { type: String, trim: true },
  bankOfficerContact:      { type: String, trim: true },
  submissionStatus: {
    type: String,
    enum: ['not-submitted', 'submitted', 'under-review'],
    default: 'not-submitted',
  },
}, { _id: false });

// ── Bank Loan Sanction Sub-schema (NEW) ───────────────────────────────────────
const bankLoanSanctionSchema = new mongoose.Schema({
  sanctionDate:         { type: Date },
  sanctionedAmount:     { type: Number, min: 0 },
  sanctionLetterNumber: { type: String, trim: true },
  sanctionConditions:   { type: String, trim: true },
  sanctionStatus: {
    type: String,
    enum: ['pending', 'sanctioned', 'rejected'],
    default: 'pending',
  },
  rejectionReason: { type: String, trim: true },
}, { _id: false });

// ── Subsidy Claim Sub-schema (NEW) ───────────────────────────────────────────
const subsidyClaimSchema = new mongoose.Schema({
  claimSubmissionDate:   { type: Date },
  claimReferenceNumber:  { type: String, trim: true },
  approvedSubsidyAmount: { type: Number, min: 0 },
  claimApprovalDate:     { type: Date },
  disbursementDate:      { type: Date },
  claimStatus: {
    type: String,
    enum: ['not-submitted', 'submitted', 'approved', 'rejected', 'disbursed'],
    default: 'not-submitted',
  },
  rejectionReason: { type: String, trim: true },
  rejectionDate:   { type: Date },
}, { _id: false });

// ── Main Schema ───────────────────────────────────────────────────────────────
const subsidyApplicationSchema = new mongoose.Schema(
  {
    applicationId: { type: String, unique: true, trim: true },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client ID is required'],
    },
    schemeName: {
      type: String,
      required: [true, 'Scheme name is required'],
      trim: true,
      minlength: [3, 'Scheme name must be at least 3 characters'],
      maxlength: [200, 'Scheme name cannot exceed 200 characters'],
    },
    // ── Upgraded: strict enum instead of free text ────────────────────────────
    schemeType: {
      type: String,
      enum: ['nhb', 'general', 'aif', 'none'],
      default: 'none',
      trim: true,
    },
    departmentName:        { type: String, trim: true },
    subsidyAmountApplied:  { type: Number, min: [0, 'Subsidy amount must be positive'] },
    eligibleAmount:        { type: Number, min: 0 },
    approvedAmount:        { type: Number, min: 0 },
    subsidyPercentage:     { type: Number, min: 0, max: 100 },
    projectCost:           { type: Number, min: 0 },
    applicationDate:       { type: Date, default: Date.now },
    submissionDate:        { type: Date },
    approvalDate:          { type: Date },
    releaseDate:           { type: Date },
    receivedDate:          { type: Date },
    utrNumber:             { type: String, trim: true },
    currentStatus: {
      type: String,
      default: 'Documentation In Progress',
      trim: true,
      enum: [
        'Documentation In Progress',
        'Documentation Completed',
        'Loan Preparation',
        'File Submitted to Bank',
        'Under Bank Review',
        'Bank Loan Sanctioned',
        'Bank Loan Rejected',
        'GOC Application Submitted',
        'GOC Processing',
        'GOC Approved',
        'GOC Rejected',
        'Subsidy Claim Submitted',
        'Subsidy Claim Approved',
        'Subsidy Claim Rejected',
        'Subsidy Disbursed',
        'Payment Received',
        'Completed',
        'Rejected',
      ],
    },
    currentStage:          { type: String, trim: true },
    lastStatusChangeDate:  { type: Date, default: Date.now },
    assignedTo:            { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    priority:              { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

    // ── NHB-specific fields (only meaningful when schemeType === 'nhb') ───────
    nhbDetails: { type: nhbDetailsSchema, default: () => ({}) },

    // ── GOC details (applies to all schemes that go through GOC) ─────────────
    gocDetails: { type: gocDetailsSchema, default: () => ({}) },

    // ── Loan Preparation (NEW) ───────────────────────────────────────────────
    loanPreparation: { type: loanPreparationSchema, default: () => ({}) },

    // ── Bank Submission (NEW) ────────────────────────────────────────────────
    bankSubmission: { type: bankSubmissionSchema, default: () => ({}) },

    // ── Bank Loan Sanction (NEW) ─────────────────────────────────────────────
    bankLoanSanction: { type: bankLoanSanctionSchema, default: () => ({}) },

    // ── Subsidy Claim (NEW) ──────────────────────────────────────────────────
    subsidyClaim: { type: subsidyClaimSchema, default: () => ({}) },

    // ── GOC-related verification statuses (renamed from bankVerification) ────
    gocBankVerificationStatus: {
      type: String,
      enum: ['not-started', 'pending', 'completed'],
      default: 'not-started',
    },
    gocBankVerificationDate: { type: Date },
    geoTaggingStatus: {
      type: String,
      enum: ['not-started', 'pending', 'completed'],
      default: 'not-started',
    },
    geoTaggingDate: { type: Date },

    // ── Payment details ───────────────────────────────────────────────────────
    paymentDetails: { type: paymentDetailsSchema, default: () => ({}) },

    // ── Existing sub-docs (unchanged) ─────────────────────────────────────────
    documentChecklist: [documentChecklistSchema],
    portalCredentials:  [portalCredentialSchema],
    queries:            [querySchema],
    timeline:           [timelineSchema],

    // ── Existing GOC portal credentials (email/mobile/password) ──────────────
    gocCredentials: {
      email:              { type: String, trim: true },
      mobile:             { type: String, trim: true },
      _passwordEncrypted: { type: String },
    },

    isDeleted:  { type: Boolean, default: false },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Auto-generate applicationId
subsidyApplicationSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  const year = new Date().getFullYear();
  const count = await mongoose.model('SubsidyApplication').countDocuments();
  const num = String(count + 1).padStart(4, '0');
  this.applicationId = `SUB-${year}-${num}`;
  this.queries.forEach((q, i) => {
    if (!q.queryNumber) q.queryNumber = `QRY-${String(i + 1).padStart(4, '0')}`;
  });
  next();
});

subsidyApplicationSchema.virtual('daysInProcess').get(function () {
  return Math.floor((Date.now() - new Date(this.applicationDate).getTime()) / (1000 * 60 * 60 * 24));
});

subsidyApplicationSchema.virtual('documentCompletionPercentage').get(function () {
  if (!this.documentChecklist.length) return 0;
  const done = this.documentChecklist.filter((d) => d.status === 'received').length;
  return Math.round((done / this.documentChecklist.length) * 100);
});

subsidyApplicationSchema.index({ clientId: 1, isDeleted: 1 });
subsidyApplicationSchema.index({ assignedTo: 1, currentStatus: 1 });
subsidyApplicationSchema.index({ applicationDate: -1 });
subsidyApplicationSchema.index({ schemeType: 1 });
subsidyApplicationSchema.index({ 'nhbDetails.nhbPortalStatus': 1 });
subsidyApplicationSchema.index({ gocBankVerificationStatus: 1, geoTaggingStatus: 1 });
subsidyApplicationSchema.index({ 'paymentDetails.paymentReceived': 1 });
subsidyApplicationSchema.index({ 'bankLoanSanction.sanctionStatus': 1 });
subsidyApplicationSchema.index({ 'subsidyClaim.claimStatus': 1 });

module.exports = mongoose.model('SubsidyApplication', subsidyApplicationSchema);
