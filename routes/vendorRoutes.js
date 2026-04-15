const express = require('express');
const router = express.Router();
const {
  getVendors, createVendor, getVendorById, updateVendor, deleteVendor, getVendorStatistics,
} = require('../controllers/vendorController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly, adminOrDataEntry } = require('../middleware/roleMiddleware');
const { createVendorValidation } = require('../middleware/validator');
const { auditLog } = require('../middleware/auditLogger');

router.use(protect);

router.route('/')
  .get(getVendors)
  .post(adminOrDataEntry, createVendorValidation, auditLog('create', 'vendor', (req, body) => body?.data?.vendorId), createVendor);

router.route('/:id')
  .get(getVendorById)
  .put(adminOrDataEntry, auditLog('update', 'vendor', (req) => req.params.id), updateVendor)
  .delete(adminOnly, auditLog('delete', 'vendor', (req) => req.params.id), deleteVendor);

router.get('/:id/statistics', getVendorStatistics);

module.exports = router;
