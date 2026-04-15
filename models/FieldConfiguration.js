const mongoose = require('mongoose');

const fieldConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
      maxlength: [200, 'Document name cannot exceed 200 characters'],
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: ['bank-loan', 'subsidy'],
    },
    required: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
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

fieldConfigSchema.index({ type: 1, isDeleted: 1, isActive: 1 });
fieldConfigSchema.index({ displayOrder: 1 });

module.exports = mongoose.model('FieldConfiguration', fieldConfigSchema);
