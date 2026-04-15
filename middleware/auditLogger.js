const AuditLog = require('../models/AuditLog');
const { getClientIp } = require('../utils/helpers');

/**
 * Factory middleware that logs an action to the AuditLog collection.
 * @param {string} action - 'create'|'update'|'delete'|'view'
 * @param {string} entity - Entity type (e.g. 'client', 'bank-loan')
 * @param {Function} [getEntityId] - (req) => entityId string
 * @param {Function} [getPreviousData] - async (req) => snapshot of previous data
 */
const auditLog = (action, entity, getEntityId, getPreviousData) => {
  return async (req, res, next) => {
    // Capture previous data before the handler runs
    let previousData = null;
    if (getPreviousData) {
      try {
        previousData = await getPreviousData(req);
      } catch (_) {}
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Log after response is built (non-blocking)
      setImmediate(async () => {
        try {
          const entityId = getEntityId ? String(getEntityId(req, body)) : undefined;
          const newData = body && body.success ? body.data : undefined;

          await AuditLog.create({
            userId: req.user ? req.user._id : null,
            action,
            entity,
            entityId,
            previousData,
            newData,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
          });
        } catch (err) {
          console.error('Audit log failed:', err.message);
        }
      });

      return originalJson(body);
    };

    next();
  };
};

module.exports = { auditLog };
