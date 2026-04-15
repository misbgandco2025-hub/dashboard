const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    notificationId: { type: String, unique: true, trim: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    type: {
      type: String,
      enum: ['info', 'warning', 'success', 'error'],
      default: 'info',
    },
    category: {
      type: String,
      enum: ['query', 'status-change', 'assignment', 'document', 'reminder'],
      default: 'info',
    },
    relatedEntity: {
      type: String,
      enum: ['client', 'bank-loan', 'subsidy', 'vendor', 'user'],
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  const count = await mongoose.model('Notification').countDocuments();
  this.notificationId = `NTF-${String(count + 1).padStart(6, '0')}`;
  next();
});

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
