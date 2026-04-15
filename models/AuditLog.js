const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    logId: { type: String, unique: true, trim: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      enum: ['create', 'update', 'delete', 'login', 'logout', 'view'],
    },
    entity: {
      type: String,
      required: true,
      enum: ['client', 'bank-loan', 'subsidy', 'vendor', 'user', 'config', 'status-option', 'notification', 'auth'],
    },
    entityId: {
      type: String,
    },
    previousData: {
      type: mongoose.Schema.Types.Mixed,
    },
    newData: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { timestamps: true }
);

auditLogSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  const count = await mongoose.model('AuditLog').countDocuments();
  this.logId = `LOG-${String(count + 1).padStart(7, '0')}`;
  next();
});

auditLogSchema.index({ userId: 1, entity: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
