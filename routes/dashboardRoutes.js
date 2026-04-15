const express = require('express');
const router = express.Router();
const {
  getSummary, getVendorDistribution, getStatusDistribution,
  getMonthlyTrend, getPerformanceMetrics, getMyTasks,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { adminOrViewer, authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/summary', getSummary);
router.get('/vendor-distribution', getVendorDistribution);
router.get('/status-distribution', getStatusDistribution);
router.get('/monthly-trend', getMonthlyTrend);
router.get('/performance-metrics', adminOrViewer, getPerformanceMetrics);
router.get('/my-tasks', authorize('data-entry'), getMyTasks);

module.exports = router;
