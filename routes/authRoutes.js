const express = require('express');
const router = express.Router();
const { login, logout, refreshToken, getMe, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { loginValidation, changePasswordValidation } = require('../middleware/validator');
const { authRateLimiter } = require('../middleware/rateLimiter');

router.post('/login', authRateLimiter, loginValidation, login);
router.post('/logout', protect, logout);
router.post('/refresh-token', refreshToken);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePasswordValidation, changePassword);

module.exports = router;
