const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const AuditLog = require('../models/AuditLog');
const { getClientIp } = require('../utils/helpers');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '7d',
  });
  return { accessToken, refreshToken };
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Allow login with username OR email
    const user = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
      isDeleted: { $ne: true },
    }).select('+password +refreshToken');

    if (!user || !(await user.comparePassword(password))) {
      return next(ApiError.unauthorized('Invalid credentials.'));
    }

    if (user.status === 'inactive') {
      return next(ApiError.forbidden('Your account is deactivated. Contact an administrator.'));
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Save refresh token & update login stats
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    user.totalLogins += 1;
    await user.save({ validateBeforeSave: false });

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Audit log
    await AuditLog.create({
      userId: user._id,
      action: 'login',
      entity: 'auth',
      entityId: String(user._id),
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    return ApiResponse.success(res, 'Login successful', {
      accessToken,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
      await AuditLog.create({
        userId: req.user._id,
        action: 'logout',
        entity: 'auth',
        entityId: String(req.user._id),
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });
    }
    res.clearCookie('refreshToken');
    return ApiResponse.success(res, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh-token
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) return next(ApiError.unauthorized('Refresh token not provided.'));

    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      return next(ApiError.unauthorized('Invalid refresh token.'));
    }

    if (user.status === 'inactive') {
      return next(ApiError.forbidden('Account deactivated.'));
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return ApiResponse.success(res, 'Token refreshed', { accessToken });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return ApiResponse.success(res, 'User profile retrieved', user);
  } catch (err) {
    next(err);
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      return next(ApiError.badRequest('Current password is incorrect.'));
    }

    user.password = newPassword;
    await user.save();

    return ApiResponse.success(res, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { login, logout, refreshToken, getMe, changePassword };
