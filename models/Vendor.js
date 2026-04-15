const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
      unique: true,
      trim: true,
    },
    vendorName: {
      type: String,
      required: [true, 'Vendor name is required'],
      trim: true,
      maxlength: [150, 'Vendor name cannot exceed 150 characters'],
    },
    vendorCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: [100, 'Contact person name cannot exceed 100 characters'],
    },
    mobile: {
      type: String,
      trim: true,
      match: [/^\d{10}$/, 'Mobile must be 10 digits'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    address: {
      type: String,
      trim: true,
    },
    commissionDetails: {
      type: String,
      trim: true,
    },
    agreementDate: {
      type: Date,
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

// Auto-generate vendorId and vendorCode before save
vendorSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  const count = await mongoose.model('Vendor').countDocuments();
  const num = String(count + 1).padStart(4, '0');
  this.vendorId = `VND-${num}`;
  if (!this.vendorCode) {
    this.vendorCode = `V${num}`;
  }
  next();
});

// Index for search
vendorSchema.index({ vendorName: 'text', vendorCode: 1 });
vendorSchema.index({ isDeleted: 1, status: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
