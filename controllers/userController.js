const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginationMeta } = require('../utils/helpers');

// GET /api/users
const getUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const filter = {};

    if (req.query.search) {
      filter.$or = [
        { username: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { fullName: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, 'Users retrieved', users, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// POST /api/users
const createUser = async (req, res, next) => {
  try {
    const { username, email, password, fullName, role, mobile } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) return next(ApiError.conflict('Username already exists.'));

    let emailToSave = email;
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) return next(ApiError.conflict('Email already exists.'));
    } else {
      emailToSave = `no-email-${Date.now()}-${Math.floor(Math.random() * 10000)}@dummy.local`;
    }

    const user = await User.create({ username, email: emailToSave, password, fullName, role, mobile });
    const userObj = user.toObject();
    delete userObj.password;

    return ApiResponse.created(res, 'User created successfully', userObj);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(ApiError.notFound('User not found.'));
    return ApiResponse.success(res, 'User retrieved', user);
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const allowed = ['fullName', 'email', 'mobile', 'status'];
    const updates = { $set: {}, $unset: {} };
    
    allowed.forEach((f) => { 
      if (req.body[f] !== undefined) {
        if (f === 'email' && req.body[f] === '') {
          updates.$set[f] = `no-email-${Date.now()}-${Math.floor(Math.random() * 10000)}@dummy.local`;
        } else {
          updates.$set[f] = req.body[f]; 
        }
      } 
    });

    if (Object.keys(updates.$set).length === 0) delete updates.$set;
    if (Object.keys(updates.$unset).length === 0) delete updates.$unset;

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) return next(ApiError.notFound('User not found.'));

    return ApiResponse.success(res, 'User updated successfully', user);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:id  (soft delete = deactivate)
const deactivateUser = async (req, res, next) => {
  try {
    if (req.params.id === String(req.user._id)) {
      return next(ApiError.badRequest('You cannot deactivate your own account.'));
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'inactive' },
      { new: true }
    );
    if (!user) return next(ApiError.notFound('User not found.'));
    return ApiResponse.success(res, 'User deactivated successfully', user);
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/:id/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return next(ApiError.badRequest('New password must be at least 8 characters.'));
    }
    const user = await User.findById(req.params.id);
    if (!user) return next(ApiError.notFound('User not found.'));
    user.password = newPassword;
    await user.save();
    return ApiResponse.success(res, 'Password reset successfully');
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/:id/change-role
const changeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'data-entry', 'viewer'].includes(role)) {
      return next(ApiError.badRequest('Invalid role.'));
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return next(ApiError.notFound('User not found.'));
    return ApiResponse.success(res, 'Role updated successfully', user);
  } catch (err) {
    next(err);
  }
};

module.exports = { getUsers, createUser, getUserById, updateUser, deactivateUser, resetPassword, changeRole };
