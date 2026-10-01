const Lead = require('../models/Lead');
const Communication = require('../models/Communication');
const { logAudit } = require('../services/auditLogService');

/**
 * @desc    GET verification endpoint for WhatsPortal / WhatsApp webhooks
 * @route   GET /api/webhooks/whatsportal or GET /api/webhooks/whatsapp
 * @access  Public
 */
const verifyWebhook = async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Standard Meta WhatsApp verify challenge
    if (mode && token) {
      if (mode === 'subscribe') {
        console.log('[Webhook Verification] Meta challenge accepted');
        return res.status(200).send(challenge);
      }
      return res.status(403).json({ success: false, message: 'Verification failed' });
    }

    // WhatsPortal ping / health check verification
    return res.status(200).json({
      success: true,
      service: 'WhatsPortal Webhook Listener',
      status: 'active',
      domain: 'lead-b-0dlr.onrender.com',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[Webhook Verification Error]:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * @desc    POST handler for incoming WhatsPortal webhook events
 * @route   POST /api/webhooks/whatsportal
 * @access  Public
 */
const handleWhatsPortalWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('[WhatsPortal Webhook Event Received]:', JSON.stringify(payload, null, 2));

    const { event_type, customer, notification, event, status, phone, reference_id } = payload;

    const targetRefId = reference_id || notification?.reference_id;
    const targetPhone = phone || customer?.phone;
    const currentStatus = status || notification?.status || event;

    let lead = null;
    if (targetRefId) {
      lead = await Lead.findById(targetRefId).catch(() => null);
    }

    if (!lead && targetPhone) {
      const cleanPhone = String(targetPhone).replace(/\D/g, '').slice(-10);
      if (cleanPhone) {
        lead = await Lead.findOne({ phone: { $regex: cleanPhone } });
      }
    }

    if (lead) {
      const upperStatus = String(currentStatus || '').toUpperCase();
      if (['SENT', 'DELIVERED', 'READ'].includes(upperStatus)) {
        lead.whatsappStatus = 'SENT';
        lead.whatsappNotificationSent = true;
        lead.whatsappNotificationSentAt = new Date();
      } else if (['FAILED', 'UNDELIVERED', 'REJECTED'].includes(upperStatus)) {
        lead.whatsappStatus = 'FAILED';
        lead.whatsappNotificationError = payload.error || payload.reason || 'WhatsPortal delivery failed';
      }

      await lead.save();

      // Create Communication Record
      await Communication.create({
        leadId: lead._id,
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        subject: `WhatsPortal Event: ${upperStatus || 'NOTIFICATION'}`,
        message: JSON.stringify(payload),
        status: upperStatus === 'FAILED' ? 'FAILED' : 'DELIVERED',
        sentAt: new Date()
      });

      await logAudit({
        action: 'WHATSAPP_WEBHOOK_RECEIVED',
        leadId: lead._id,
        details: `WhatsPortal webhook update for ${lead.title}: ${upperStatus}`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'WhatsPortal webhook event processed successfully'
    });
  } catch (error) {
    console.error('[WhatsPortal Webhook Error]:', error.message);
    return res.status(200).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    POST handler for incoming WhatsApp Cloud API events
 * @route   POST /api/webhooks/whatsapp
 * @access  Public
 */
const handleWhatsAppCloudWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('[WhatsApp Cloud API Webhook Received]:', JSON.stringify(payload, null, 2));

    return res.status(200).json({
      success: true,
      message: 'WhatsApp Cloud API webhook received'
    });
  } catch (error) {
    console.error('[WhatsApp Webhook Error]:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
};

module.exports = {
  verifyWebhook,
  handleWhatsPortalWebhook,
  handleWhatsAppCloudWebhook
};
