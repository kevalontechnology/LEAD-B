const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getPendingApprovals,
  getPendingApprovalsCount,
  approveEditRequest,
  rejectEditRequest
} = require('../controllers/approvalController');

router.use(protect);

router.get('/pending', authorize('ADMIN', 'MANAGER'), getPendingApprovals);
router.get('/count', getPendingApprovalsCount);
router.post('/:id/approve', authorize('ADMIN', 'MANAGER'), approveEditRequest);
router.post('/:id/reject', authorize('ADMIN', 'MANAGER'), rejectEditRequest);

module.exports = router;
