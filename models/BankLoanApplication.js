const mongoose = require('mongoose');
const { encryptText, decryptText } = require('../utils/helpers');

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const documentChecklistSchema = new mongoose.Schema({
  documentType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FieldConfiguration',
    required: true,
  },
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
  registrationStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'query-raised'],
    default: 'pending',
  },
  approvalDate: { type: Date },
  remarks: { type: String, trim: true },
});

// Virtual for password (encrypt on set, decrypt on get)
portalCredentialSchema.virtual('password')
  .set(function (val) {
    if (val) this._passwordEncrypted = encryptText(val);
  })
  .get(function () {
    if (this._passwordEncrypted) return decryptText(this._passwordEncrypted);
    return '';
  });

const querySchema = new mongoose.Schema({
  queryNumber: { type: String, trim: true },
  queryRaisedDate: { type: Date, default: Date.now },
  queryRaisedBy: { type: String, trim: true },
  description: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['documentation', 'technical', 'financial', 'other'],
    default: 'other',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    default: 'open',
  },
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

// ─── Main Schema ─────────────────────────────────────────────────────────────

const bankLoanApplicationSchema = new mongoose.Schema(
  {
    applicationId: { type: String, unique: true, trim: true },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client ID is required'],
    },
    applicationDate: { type: Date, default: Date.now },
    loanAmount: {
      type: Number,
      required: [true, 'Loan amount is required'],
      min: [0, 'Loan amount must be positive'],
    },
    loanScheme: { type: String, trim: true },
    loanType: { type: String, trim: true },
    bankRefNumber: { type: String, trim: true },
    currentStatus: {
      type: String,
      default: 'Documentation In Progress',
      trim: true,
    },
    currentStage: { type: String, trim: true },
    applicationSubmissionDate: { type: Date },
    approvalDate: { type: Date },
    disbursementDate: { type: Date },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    documentChecklist: [documentChecklistSchema],
    portalCredentials: [portalCredentialSchema],
    queries: [querySchema],
    timeline: [timelineSchema],
    aifCredentials: {
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
bankLoanApplicationSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  const year = new Date().getFullYear();
  const count = await mongoose.model('BankLoanApplication').countDocuments();
  const num = String(count + 1).padStart(4, '0');
  this.applicationId = `BL-${year}-${num}`;
  // Auto-generate query numbers
  this.queries.forEach((q, i) => {
    if (!q.queryNumber) q.queryNumber = `QRY-${String(i + 1).padStart(4, '0')}`;
  });
  next();
});

// Virtual: days in process
bankLoanApplicationSchema.virtual('daysInProcess').get(function () {
  return Math.floor((Date.now() - new Date(this.applicationDate).getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual: document completion percentage
bankLoanApplicationSchema.virtual('documentCompletionPercentage').get(function () {
  if (!this.documentChecklist.length) return 0;
  const done = this.documentChecklist.filter((d) => d.status === 'received').length;
  return Math.round((done / this.documentChecklist.length) * 100);
});

bankLoanApplicationSchema.index({ clientId: 1, isDeleted: 1 });
bankLoanApplicationSchema.index({ assignedTo: 1, currentStatus: 1 });
bankLoanApplicationSchema.index({ applicationDate: -1 });

module.exports = mongoose.model('BankLoanApplication', bankLoanApplicationSchema);
