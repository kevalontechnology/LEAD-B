const express = require('express');
const router = express.Router();
const {
  verifyWebhook,
  handleWhatsPortalWebhook,
  handleWhatsAppCloudWebhook
} = require('../controllers/webhookController');

// WhatsPortal Webhook Endpoints
router.get('/whatsportal', verifyWebhook);
router.post('/whatsportal', handleWhatsPortalWebhook);

// Meta WhatsApp Cloud API Webhook Endpoints
router.get('/whatsapp', verifyWebhook);
router.post('/whatsapp', handleWhatsAppCloudWebhook);

module.exports = router;
