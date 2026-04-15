const mongoose = require('mongoose');

const statusOptionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: [true, 'Status label is required'],
      trim: true,
      maxlength: [150, 'Label cannot exceed 150 characters'],
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: ['bank-loan', 'subsidy'],
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

statusOptionSchema.index({ type: 1, isActive: 1, order: 1 });

module.exports = mongoose.model('StatusOption', statusOptionSchema);
