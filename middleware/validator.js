const { body, param, query, validationResult } = require('express-validator');

/**
 * Run Express-Validator result check and return 422 on first error
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username or email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  validate,
];

// ─── Users ────────────────────────────────────────────────────────────────────

const createUserValidation = [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  body('fullName').trim().isLength({ min: 2, max: 100 }).withMessage('Full name is required (2-100 chars)'),
  body('role').isIn(['admin', 'data-entry', 'viewer']).withMessage('Invalid role'),
  body('mobile').optional().matches(/^\d{10}$/).withMessage('Mobile must be 10 digits'),
  validate,
];

// ─── Vendors ──────────────────────────────────────────────────────────────────

const createVendorValidation = [
  body('vendorName').trim().isLength({ min: 2, max: 150 }).withMessage('Vendor name is required (2-150 chars)'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('mobile').optional().matches(/^\d{10}$/).withMessage('Mobile must be 10 digits'),
  validate,
];

// ─── Clients ──────────────────────────────────────────────────────────────────

const createClientValidation = [
  body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Name must be 3-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('mobile').matches(/^\d{10}$/).withMessage('Mobile must be 10 digits'),
  body('sourceType').isIn(['vendor', 'direct']).withMessage('sourceType must be vendor or direct'),
  body('vendorId')
    .if(body('sourceType').equals('vendor'))
    .notEmpty().withMessage('vendorId is required when sourceType is vendor'),
  body('clientType').isIn(['bank-loan', 'subsidy', 'both']).withMessage('Invalid clientType'),
  validate,
];

// ─── Bank Loan Applications ───────────────────────────────────────────────────

const createBankLoanValidation = [
  body('clientId').isMongoId().withMessage('Valid clientId is required'),
  body('loanAmount').isFloat({ min: 0 }).withMessage('loanAmount must be a positive number'),
  body('applicationDate').optional().isISO8601().withMessage('applicationDate must be a valid date'),
  validate,
];

// ─── Subsidy Applications ─────────────────────────────────────────────────────

const createSubsidyValidation = [
  body('clientId').isMongoId().withMessage('Valid clientId is required'),
  body('schemeName').trim().isLength({ min: 3, max: 200 }).withMessage('schemeName must be 3-200 characters'),
  body('subsidyAmountApplied').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('subsidyAmountApplied must be a positive number'),
  body('applicationDate').optional().isISO8601().withMessage('applicationDate must be a valid date'),
  validate,
];

// ─── Config ───────────────────────────────────────────────────────────────────

const createDocumentTypeValidation = [
  body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Document name is required'),
  body('type').isIn(['bank-loan', 'subsidy']).withMessage('Type must be bank-loan or subsidy'),
  body('required').optional().isBoolean().withMessage('required must be boolean'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('displayOrder must be a non-negative integer'),
  validate,
];

const createStatusOptionValidation = [
  body('label').trim().isLength({ min: 2, max: 150 }).withMessage('Label is required (2-150 chars)'),
  body('type').isIn(['bank-loan', 'subsidy']).withMessage('Type must be bank-loan or subsidy'),
  body('order').optional().isInt({ min: 0 }).withMessage('order must be a non-negative integer'),
  validate,
];

module.exports = {
  validate,
  loginValidation,
  changePasswordValidation,
  createUserValidation,
  createVendorValidation,
  createClientValidation,
  createBankLoanValidation,
  createSubsidyValidation,
  createDocumentTypeValidation,
  createStatusOptionValidation,
};
