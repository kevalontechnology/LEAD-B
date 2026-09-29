const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getDashboardStats } = require('../controllers/dashboardController');

router.use(protect);

router.get('/dashboard', getDashboardStats);

module.exports = router;
