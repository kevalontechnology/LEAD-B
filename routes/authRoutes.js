const express = require('express');
const router = express.Router();
const {
  loginUser,
  registerUser,
  getMe,
  getUsers,
  updateUserRole
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.post('/register', protect, authorize('ADMIN'), registerUser);
router.get('/me', protect, getMe);
router.get('/users', protect, authorize('ADMIN', 'MANAGER'), getUsers);
router.put('/users/:id/role', protect, authorize('ADMIN'), updateUserRole);

module.exports = router;
