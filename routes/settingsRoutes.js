const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getSettings, updateSettings } = require('../controllers/settingsController');

router.use(protect);

router.get('/', getSettings);
router.put('/', authorize('ADMIN'), updateSettings);

module.exports = router;
