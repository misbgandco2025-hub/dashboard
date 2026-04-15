const express = require('express');
const router = express.Router();
const {
  getUsers, createUser, getUserById, updateUser, deactivateUser, resetPassword, changeRole,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');
const { createUserValidation } = require('../middleware/validator');

// All user routes are admin-only
router.use(protect, adminOnly);

router.route('/')
  .get(getUsers)
  .post(createUserValidation, createUser);

router.route('/:id')
  .get(getUserById)
  .put(updateUser)
  .delete(deactivateUser);

router.put('/:id/reset-password', resetPassword);
router.put('/:id/change-role', changeRole);

module.exports = router;
