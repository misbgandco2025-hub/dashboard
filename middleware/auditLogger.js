const AuditLog = require('../models/AuditLog');
const { getClientIp } = require('../utils/helpers');

/**
 * Persist one audit record. Errors are logged but never bubble up — audit
 * failures must never break the main request flow.
 */
const persistAuditLog = async (payload) => {
  try {
    await AuditLog.create(payload);
  } catch (err) {
    console.error(`[AUDIT] Failed to persist log (action=${payload.action} entity=${payload.entity}):`, err.message);
  }
};

/**
 * Factory middleware that logs an action to the AuditLog collection.
 *
 * The log is written AFTER the response JSON is assembled so we can capture
 * newData from the response body. Uses Promise.resolve().then() (microtask)
 * instead of setImmediate so the write survives a graceful shutdown more
 * reliably and errors are clearly attributed.
 *
 * @param {string}   action            'create'|'update'|'delete'|'view'
 * @param {string}   entity            e.g. 'client', 'bank-loan'
 * @param {Function} [getEntityId]     (req, body) => string
 * @param {Function} [getPreviousData] async (req) => any
 */
const auditLog = (action, entity, getEntityId, getPreviousData) => {
  return async (req, res, next) => {
    // Capture snapshot BEFORE the handler mutates the document
    let previousData = null;
    if (getPreviousData) {
      try {
        previousData = await getPreviousData(req);
      } catch (_) { /* non-fatal */ }
    }

    const originalJson = res.json.bind(res);

    res.json = function (body) {
      Promise.resolve().then(() =>
        persistAuditLog({
          userId: req.user ? req.user._id : null,
          action,
          entity,
          entityId: getEntityId ? String(getEntityId(req, body)) : undefined,
          previousData,
          newData: body && body.success ? body.data : undefined,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          requestId: req.requestId,
        })
      );

      return originalJson(body);
    };

    next();
  };
};

module.exports = { auditLog };
