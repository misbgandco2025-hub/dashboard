const express = require('express');
const router = express.Router();
const {
  getClients, createClient, getClientById, updateClient, deleteClient, checkDuplicate, getClientStatistics,
} = require('../controllers/clientController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly, adminOrDataEntry } = require('../middleware/roleMiddleware');
const { createClientValidation } = require('../middleware/validator');
const { auditLog } = require('../middleware/auditLogger');

router.use(protect);

router.get('/check-duplicate', checkDuplicate);

router.route('/')
  .get(getClients)
  .post(adminOrDataEntry, createClientValidation, auditLog('create', 'client', (req, body) => body?.data?.clientId), createClient);

router.route('/:id')
  .get(getClientById)
  .put(adminOrDataEntry, auditLog('update', 'client', (req) => req.params.id), updateClient)
  .delete(adminOnly, auditLog('delete', 'client', (req) => req.params.id), deleteClient);

router.get('/:id/statistics', getClientStatistics);

module.exports = router;
