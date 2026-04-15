const express = require('express');
const router = express.Router();
const {
  getDocumentTypes, createDocumentType, updateDocumentType, deleteDocumentType,
  getStatusOptions, createStatusOption, updateStatusOption,
} = require('../controllers/configController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');
const { createDocumentTypeValidation, createStatusOptionValidation } = require('../middleware/validator');

router.use(protect);

// Document types - GET is public (all roles), mutations are admin-only
router.get('/documents/:type', getDocumentTypes);
router.post('/documents', adminOnly, createDocumentTypeValidation, createDocumentType);
router.put('/documents/:id', adminOnly, updateDocumentType);
router.delete('/documents/:id', adminOnly, deleteDocumentType);

// Status options
router.get('/status-options/:type', getStatusOptions);
router.post('/status-options', adminOnly, createStatusOptionValidation, createStatusOption);
router.put('/status-options/:id', adminOnly, updateStatusOption);

module.exports = router;
