const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp
} = require('../controllers/followUpController');

router.use(protect);

router.get('/', getFollowUps);
router.post('/', createFollowUp);
router.put('/:id', updateFollowUp);
router.delete('/:id', deleteFollowUp);

module.exports = router;
