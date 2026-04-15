const Notification = require('../models/Notification');

/**
 * Create a notification for a user
 * @param {Object} options
 * @param {string} options.userId - User to notify
 * @param {string} options.message - Notification message
 * @param {string} options.type - 'info'|'warning'|'success'|'error'
 * @param {string} options.category - 'query'|'status-change'|'assignment'|'document'|'reminder'
 * @param {string} [options.relatedEntity] - Entity type
 * @param {string} [options.relatedEntityId] - Entity ID
 */
const createNotification = async (options) => {
  try {
    await Notification.create({
      userId: options.userId,
      message: options.message,
      type: options.type || 'info',
      category: options.category || 'info',
      relatedEntity: options.relatedEntity,
      relatedEntityId: options.relatedEntityId,
    });
  } catch (err) {
    // Notifications are non-critical - log and swallow error
    console.error('Notification creation failed:', err.message);
  }
};

/**
 * Notify when an application is assigned to a user
 */
const notifyAssignment = async (userId, appId, appType) => {
  await createNotification({
    userId,
    message: `You have been assigned a new ${appType} application (${appId}).`,
    type: 'info',
    category: 'assignment',
    relatedEntity: appType === 'Bank Loan' ? 'bank-loan' : 'subsidy',
    relatedEntityId: appId,
  });
};

/**
 * Notify on status change
 */
const notifyStatusChange = async (userId, appId, appType, oldStatus, newStatus) => {
  await createNotification({
    userId,
    message: `Application ${appId} status changed from "${oldStatus}" to "${newStatus}".`,
    type: 'info',
    category: 'status-change',
    relatedEntity: appType === 'bank-loan' ? 'bank-loan' : 'subsidy',
    relatedEntityId: appId,
  });
};

/**
 * Notify when a query is raised
 */
const notifyQueryRaised = async (userId, appId, appType, queryNumber) => {
  await createNotification({
    userId,
    message: `A new query (${queryNumber}) has been raised on application ${appId}.`,
    type: 'warning',
    category: 'query',
    relatedEntity: appType === 'bank-loan' ? 'bank-loan' : 'subsidy',
    relatedEntityId: appId,
  });
};

/**
 * Notify on document status update
 */
const notifyDocumentUpdate = async (userId, appId, appType, documentName) => {
  await createNotification({
    userId,
    message: `Document "${documentName}" updated for application ${appId}.`,
    type: 'info',
    category: 'document',
    relatedEntity: appType === 'bank-loan' ? 'bank-loan' : 'subsidy',
    relatedEntityId: appId,
  });
};

module.exports = {
  createNotification,
  notifyAssignment,
  notifyStatusChange,
  notifyQueryRaised,
  notifyDocumentUpdate,
};
