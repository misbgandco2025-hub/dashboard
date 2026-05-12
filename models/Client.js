const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      unique: true,
      trim: true,
    },
    // Basic Info
    name: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    mobile: {
      type: String,
      required: [true, 'Mobile is required'],
      trim: true,
      match: [/^\d{10}$/, 'Mobile must be 10 digits'],
    },
    alternateMobile: {
      type: String,
      trim: true,
      match: [/^\d{10}$/, 'Alternate mobile must be 10 digits'],
    },
    address: {
      type: String,
      trim: true,
    },
    businessName: {
      type: String,
      trim: true,
      maxlength: [200, 'Business name cannot exceed 200 characters'],
    },
    // Bank Info
    bankName: { type: String, trim: true },
    branchName: { type: String, trim: true },
    branchAddress: { type: String, trim: true },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please provide a valid IFSC code'],
    },
    accountNumber: { type: String, trim: true },
    // Bank Contact
    bankContactPerson: { type: String, trim: true },
    bankContactDesignation: { type: String, trim: true },
    bankContactMobile: {
      type: String,
      trim: true,
      match: [/^\d{10}$/, 'Bank contact mobile must be 10 digits'],
    },
    bankContactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    // Source
    sourceType: {
      type: String,
      required: [true, 'Source type is required'],
      enum: ['vendor', 'direct'],
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
    },
    clientType: {
      type: String,
      required: [true, 'Client type is required'],
      enum: ['bank-loan', 'subsidy', 'both'],
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Auto-generate clientId before save
clientSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  const year = new Date().getFullYear();
  const count = await mongoose.model('Client').countDocuments();
  const num = String(count + 1).padStart(4, '0');
  this.clientId = `CLT-${year}-${num}`;
  next();
});

clientSchema.index({ name: 'text', clientId: 1, mobile: 1, email: 1 });
clientSchema.index({ isDeleted: 1, status: 1, sourceType: 1, clientType: 1 });
clientSchema.index({ vendorId: 1 });

module.exports = mongoose.model('Client', clientSchema);
