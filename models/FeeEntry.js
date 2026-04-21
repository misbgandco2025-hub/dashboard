const mongoose = require('mongoose');

const feeEntrySchema = new mongoose.Schema(
  {
    feeId: { type: String, unique: true, trim: true },
    invoiceNumber: { type: String, unique: true, sparse: true, trim: true },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client is required'],
    },

    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubsidyApplication',
      default: null,
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    feeType: {
      type: String,
      required: [true, 'Fee type is required'],
      enum: [
        'registration-fee',
        'documentation-fee',
        'processing-fee',
        'portal-registration',
        'consultation-fee',
        'success-fee',
        'commission',
        'miscellaneous',
      ],
    },

    // Amounts
    baseAmount: {
      type: Number,
      required: [true, 'Base amount is required'],
      min: [0, 'Base amount cannot be negative'],
    },

    gstRate: {
      type: Number,
      enum: [0, 5, 12, 18, 28],
      default: 18,
    },

    gstAmount: { type: Number, default: 0 },

    totalAmount: { type: Number, default: 0 },

    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
    },

    pendingAmount: { type: Number, default: 0 },

    // Status
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'waived', 'cancelled'],
      default: 'pending',
    },

    // Dates
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },

    invoiceDate: { type: Date, default: Date.now },

    // Payments array (partial payments)
    payments: [
      {
        paymentId: { type: String },
        amount: {
          type: Number,
          required: [true, 'Payment amount is required'],
          min: [0.01, 'Payment must be > 0'],
        },
        paidDate: { type: Date, required: [true, 'Payment date is required'] },
        paymentMode: {
          type: String,
          enum: ['cash', 'upi', 'neft', 'rtgs', 'cheque', 'card'],
          required: [true, 'Payment mode is required'],
        },
        reference: { type: String, trim: true },
        receiptNumber: { type: String, trim: true },
        receiptDate: { type: Date },
        remarks: { type: String, trim: true },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],

    // Waiver
    waivedAmount: { type: Number, default: 0 },
    waiverReason: { type: String, trim: true },
    waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    waivedDate: { type: Date },

    // Notes
    remarks: { type: String, trim: true },

    // Audit
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────────
feeEntrySchema.index({ clientId: 1 });
feeEntrySchema.index({ applicationId: 1 });
feeEntrySchema.index({ status: 1 });
feeEntrySchema.index({ dueDate: 1 });
feeEntrySchema.index({ isDeleted: 1 });

// ── Auto-generate sequential IDs ───────────────────────────────────────────────
feeEntrySchema.pre('save', async function (next) {
  if (this.isNew) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('FeeEntry').countDocuments();
    const num = String(count + 1).padStart(4, '0');
    if (!this.feeId) this.feeId = `FEE-${year}-${num}`;
    if (!this.invoiceNumber) this.invoiceNumber = `INV-${year}-${num}`;
  }

  // Recalculate amounts
  this.gstAmount = Math.round(this.baseAmount * (this.gstRate / 100) * 100) / 100;
  this.totalAmount = Math.round((this.baseAmount + this.gstAmount) * 100) / 100;
  this.paidAmount = Math.round(this.payments.reduce((sum, p) => sum + (p.amount || 0), 0) * 100) / 100;
  this.pendingAmount = Math.max(0, Math.round((this.totalAmount - this.paidAmount - (this.waivedAmount || 0)) * 100) / 100);

  // Auto status
  if (this.status !== 'waived' && this.status !== 'cancelled') {
    if (this.paidAmount === 0 && (this.waivedAmount || 0) === 0) {
      this.status = 'pending';
    } else if (this.pendingAmount <= 0) {
      this.status = 'paid';
    } else if (this.paidAmount > 0) {
      this.status = 'partial';
    }
  }

  next();
});

// ── Instance methods ───────────────────────────────────────────────────────────
feeEntrySchema.methods.addPayment = async function (paymentData, userId) {
  const idx = this.payments.length + 1;
  const year = new Date().getFullYear();
  const paymentId = `PAY-${Date.now()}`;
  const receiptNumber = `RCP-${year}-${String(idx).padStart(4, '0')}`;

  this.payments.push({
    paymentId,
    receiptNumber,
    receiptDate: paymentData.paidDate,
    recordedBy: userId,
    ...paymentData,
  });

  return this.save();
};

feeEntrySchema.methods.isOverdue = function () {
  return this.dueDate < new Date() && !['paid', 'waived', 'cancelled'].includes(this.status);
};

// ── Virtual for overdue flag ───────────────────────────────────────────────────
feeEntrySchema.virtual('isOverdueFlag').get(function () {
  return this.dueDate < new Date() && !['paid', 'waived', 'cancelled'].includes(this.status);
});

module.exports = mongoose.model('FeeEntry', feeEntrySchema);
