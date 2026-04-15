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
    enum: ['status-change', 'document-update', 'query', 'note', 'portal-update', 'assignment'],
    default: 'note',
  },
  activityDate: { type: Date, default: Date.now },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  previousStatus: { type: String, trim: true },
  newStatus: { type: String, trim: true },
  remarks: { type: String, trim: true },
  isSystemGenerated: { type: Boolean, default: false },
});

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
    schemeType: { type: String, trim: true },
    departmentName: { type: String, trim: true },
    subsidyAmountApplied: {
      type: Number,
      required: [true, 'Subsidy amount is required'],
      min: [0, 'Subsidy amount must be positive'],
    },
    eligibleAmount: { type: Number, min: 0 },
    approvedAmount: { type: Number, min: 0 },
    subsidyPercentage: { type: Number, min: 0, max: 100 },
    projectCost: { type: Number, min: 0 },
    applicationDate: { type: Date, default: Date.now },
    submissionDate: { type: Date },
    approvalDate: { type: Date },
    releaseDate: { type: Date },
    receivedDate: { type: Date },
    utrNumber: { type: String, trim: true },
    currentStatus: { type: String, default: 'Documentation In Progress', trim: true },
    currentStage: { type: String, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    documentChecklist: [documentChecklistSchema],
    portalCredentials: [portalCredentialSchema],
    queries: [querySchema],
    timeline: [timelineSchema],
    gocCredentials: {
      email: { type: String, trim: true },
      mobile: { type: String, trim: true },
      _passwordEncrypted: { type: String },
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

module.exports = mongoose.model('SubsidyApplication', subsidyApplicationSchema);
