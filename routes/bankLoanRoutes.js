const express = require('express');
const router = express.Router();
const {
  getApplications, createApplication, getApplicationById, updateApplication,
  deleteApplication, updateStatus, updateDocumentChecklist, addQuery,
  updateQuery, addTimelineEntry, getTimeline, assignApplication, updateAifCredentials,
} = require('../controllers/bankLoanController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly, adminOrDataEntry } = require('../middleware/roleMiddleware');
const { createBankLoanValidation } = require('../middleware/validator');
const { auditLog } = require('../middleware/auditLogger');

router.use(protect);

router.route('/')
  .get(getApplications)
  .post(adminOrDataEntry, createBankLoanValidation, auditLog('create', 'bank-loan', (req, body) => body?.data?.applicationId), createApplication);

router.route('/:id')
  .get(getApplicationById)
  .put(adminOrDataEntry, auditLog('update', 'bank-loan', (req) => req.params.id), updateApplication)
  .delete(adminOnly, auditLog('delete', 'bank-loan', (req) => req.params.id), deleteApplication);

router.put('/:id/status', adminOrDataEntry, auditLog('update', 'bank-loan', (req) => req.params.id), updateStatus);
router.put('/:id/documents', adminOrDataEntry, updateDocumentChecklist);
router.post('/:id/queries', adminOrDataEntry, addQuery);
router.put('/:id/queries/:queryId', adminOrDataEntry, updateQuery);
router.post('/:id/timeline', adminOrDataEntry, addTimelineEntry);
router.get('/:id/timeline', getTimeline);
router.put('/:id/assign', adminOnly, auditLog('update', 'bank-loan', (req) => req.params.id), assignApplication);
router.put('/:id/aif-credentials', adminOrDataEntry, updateAifCredentials);

module.exports = router;
