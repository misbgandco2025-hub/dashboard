const express = require('express');
const router = express.Router();
const {
  createFee, getAllFees, getFeeById, updateFee,
  addPayment, waiveFee, deleteFee, getFeeAnalytics,
} = require('../controllers/feeController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');

// All fee routes — auth + admin only
router.use(protect);
router.use(adminOnly);

router.get('/analytics', getFeeAnalytics);

router.route('/')
  .get(getAllFees)
  .post(createFee);

router.route('/:id')
  .get(getFeeById)
  .put(updateFee)
  .delete(deleteFee);

router.post('/:id/payment', addPayment);
router.put('/:id/waive', waiveFee);

module.exports = router;
