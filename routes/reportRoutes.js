const express = require('express');
const router = express.Router();
const {
  clientWiseReport, vendorWiseReport, statusWiseReport,
  dateRangeReport, performanceReport, auditLogReport, subsidyAnalytics,
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly, adminOrViewer } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/client-wise', clientWiseReport);
router.get('/vendor-wise', vendorWiseReport);
router.get('/status-wise', statusWiseReport);
router.get('/date-range', dateRangeReport);
router.get('/performance', adminOrViewer, performanceReport);
router.get('/audit-log', adminOnly, auditLogReport);
router.get('/subsidy-analytics', subsidyAnalytics);

module.exports = router;
