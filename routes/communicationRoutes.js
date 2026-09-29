const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getCommunications, getLeadTimeline } = require('../controllers/communicationController');

router.use(protect);

router.get('/', getCommunications);
router.get('/lead/:leadId', getLeadTimeline);

module.exports = router;
