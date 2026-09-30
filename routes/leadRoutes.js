const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  bulkDeleteLeads,
  previewImportExcel,
  confirmImportExcel,
  updateLeadMessage,
  regenerateLeadMessage
} = require('../controllers/leadController');
const { sendSingleWhatsApp, sendSingleEmail, bulkSendMessages } = require('../controllers/messageController');

router.use(protect);

// 1. Static & Bulk Routes (Must be before dynamic /:id routes)
router.get('/', getLeads);
router.post('/', createLead);

router.post('/import/preview', upload.any(), previewImportExcel);
router.post('/import/confirm', confirmImportExcel);

router.post('/bulk-delete', bulkDeleteLeads);

// WhatsApp & Email sending routes (Static routes before /:id)
router.post('/whatsapp/send', sendSingleWhatsApp);
router.post('/email/send', sendSingleEmail);
router.post('/messages/bulk-send', bulkSendMessages);

// 2. Dynamic Param Routes
router.get('/:id', getLeadById);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);

router.put('/:id/message', updateLeadMessage);
router.post('/:id/regenerate-message', regenerateLeadMessage);

module.exports = router;
