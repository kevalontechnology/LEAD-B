const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getAuditLogs } = require('../controllers/auditLogController');

router.use(protect);

router.get('/', authorize('ADMIN', 'MANAGER'), getAuditLogs);

module.exports = router;
