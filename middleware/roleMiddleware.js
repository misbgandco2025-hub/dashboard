const ApiError = require('../utils/ApiError');

/**
 * Role-based access control middleware factory
 * @param {...string} roles - Allowed roles
 * @returns Express middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`
        )
      );
    }
    next();
  };
};

// Pre-composed role guards
const adminOnly = authorize('admin');
const adminOrDataEntry = authorize('admin', 'data-entry');
const allRoles = authorize('admin', 'data-entry', 'viewer');
const adminOrViewer = authorize('admin', 'viewer');

module.exports = { authorize, adminOnly, adminOrDataEntry, allRoles, adminOrViewer };
