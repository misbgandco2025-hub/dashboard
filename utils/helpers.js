const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a plaintext string using AES-256-CBC
 */
const encryptText = (text) => {
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default_32_char_key_padding_12!!', 'utf8').slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    return text;
  }
};

/**
 * Decrypt a previously encrypted string
 */
const decryptText = (encryptedText) => {
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default_32_char_key_padding_12!!', 'utf8').slice(0, 32);
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '';
  }
};

/**
 * Generate a query number for a given count
 */
const generateQueryNumber = (count) => {
  return `QRY-${String(count + 1).padStart(4, '0')}`;
};

/**
 * Build mongoose pagination options from query params
 */
const getPaginationOptions = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Build pagination response metadata
 */
const buildPaginationMeta = (total, page, limit) => {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
};

/**
 * Get client IP from request
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.ip ||
    'unknown'
  );
};

/**
 * Sanitize object to remove __v and sensitive fields
 */
const sanitizeOutput = (obj, fieldsToRemove = []) => {
  const result = obj.toObject ? obj.toObject() : { ...obj };
  delete result.__v;
  fieldsToRemove.forEach((f) => delete result[f]);
  return result;
};

/**
 * Build mongo text search / filter query from request query params
 */
const buildSearchQuery = (query, searchFields, filterFields) => {
  const filter = { isDeleted: false };

  if (query.search && searchFields.length) {
    filter.$or = searchFields.map((field) => ({
      [field]: { $regex: query.search, $options: 'i' },
    }));
  }

  filterFields.forEach(({ param, field, transform }) => {
    if (query[param] !== undefined && query[param] !== '') {
      filter[field || param] = transform ? transform(query[param]) : query[param];
    }
  });

  // Date range
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  return filter;
};

module.exports = {
  encryptText,
  decryptText,
  generateQueryNumber,
  getPaginationOptions,
  buildPaginationMeta,
  getClientIp,
  sanitizeOutput,
  buildSearchQuery,
};
