const express = require('express');
const router = express.Router();
const {
  getApplications, createApplication, getApplicationById, updateApplication,
  deleteApplication, updateStatus, updateDocumentChecklist, addQuery,
  updateQuery, addTimelineEntry, getTimeline, assignApplication, updateGocCredentials,
} = require('../controllers/subsidyController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly, adminOrDataEntry } = require('../middleware/roleMiddleware');
const { createSubsidyValidation } = require('../middleware/validator');
const { auditLog } = require('../middleware/auditLogger');

router.use(protect);

router.route('/')
  .get(getApplications)
  .post(adminOrDataEntry, createSubsidyValidation, auditLog('create', 'subsidy', (req, body) => body?.data?.applicationId), createApplication);

router.route('/:id')
  .get(getApplicationById)
  .put(adminOrDataEntry, auditLog('update', 'subsidy', (req) => req.params.id), updateApplication)
  .delete(adminOnly, auditLog('delete', 'subsidy', (req) => req.params.id), deleteApplication);

router.put('/:id/status', adminOrDataEntry, auditLog('update', 'subsidy', (req) => req.params.id), updateStatus);
router.put('/:id/documents', adminOrDataEntry, updateDocumentChecklist);
router.post('/:id/queries', adminOrDataEntry, addQuery);
router.put('/:id/queries/:queryId', adminOrDataEntry, updateQuery);
router.post('/:id/timeline', adminOrDataEntry, addTimelineEntry);
router.get('/:id/timeline', getTimeline);
router.put('/:id/assign', adminOnly, auditLog('update', 'subsidy', (req) => req.params.id), assignApplication);
router.put('/:id/goc-credentials', adminOrDataEntry, updateGocCredentials);

module.exports = router;
