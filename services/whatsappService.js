const axios = require('axios');
const Lead = require('../models/Lead');
const Communication = require('../models/Communication');
const Settings = require('../models/Settings');
const { logAudit } = require('./auditLogService');
const { sendWhatsPortalNotification, sendWhatsPortalDirectMessage } = require('./whatsportal.service');

/**
 * Send WhatsApp message to a single lead
 */
const sendWhatsAppMessage = async ({ leadId, customMessage, userId, force = false }) => {
  const lead = await Lead.findById(leadId);
  if (!lead) {
    throw new Error('Lead not found');
  }

  if (lead.whatsappNotificationSent && !force && !customMessage) {
    return {
      success: true,
      leadId: lead._id,
      leadTitle: lead.title,
      whatsappStatus: lead.whatsappStatus || 'SENT',
      skippedDuplicate: true,
      message: 'WhatsApp notification was already sent for this lead.'
    };
  }

  // Safety check: DO_NOT_CONTACT
  if (lead.leadStatus === 'DO_NOT_CONTACT') {
    throw new Error(`Lead "${lead.title}" has opted out of outreach (DO_NOT_CONTACT).`);
  }

  if (!lead.phone) {
    throw new Error(`Lead "${lead.title}" does not have a phone number.`);
  }

  const messageText = customMessage || lead.generatedWhatsAppMessage;
  if (!messageText) {
    throw new Error(`No message content found for lead "${lead.title}".`);
  }

  // Sanitize phone number (strip spaces, dashes, ensure country code)
  let recipientPhone = lead.phone.replace(/\D/g, '');
  if (recipientPhone.length === 10) {
    recipientPhone = `91${recipientPhone}`; // Default India country code
  }

  // Fetch WhatsApp settings
  const settings = await Settings.findOne();
  const whatsportalApiKey = settings?.whatsportalApiKey || process.env.WHATSPORTAL_API_KEY || 'wp_live_7gorCETjlPx2m05s6DJxDXozUPyX56Jg049D2l';
  const whatsportalApiBaseUrl = settings?.whatsportalApiBaseUrl || process.env.WHATSPORTAL_API_BASE_URL || 'https://app.whatsportal.io/api';

  const accessToken = settings?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || whatsportalApiKey;
  const phoneNumberId = settings?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '285349974658896';
  const apiVersion = settings?.whatsappApiVersion || process.env.WHATSAPP_API_VERSION || 'v18.0';

  let apiSuccess = false;
  let apiResponseData = null;
  let errorMessage = null;

  // 1. First attempt via WhatsPortal Direct API (wp_live_...)
  if (whatsportalApiKey) {
    console.log(`[WhatsPortal Direct API Send] Sending message to ${recipientPhone}...`);
    const directResult = await sendWhatsPortalDirectMessage({
      phone: recipientPhone,
      message: messageText,
      apiKey: whatsportalApiKey,
      apiBaseUrl: whatsportalApiBaseUrl
    });

    if (directResult.success) {
      apiSuccess = true;
      apiResponseData = directResult.responseData;
    } else {
      errorMessage = directResult.error;
    }
  }

  // 2. Fallback / Parallel attempt via Meta Graph API if accessToken & phoneNumberId available
  if (!apiSuccess && accessToken && phoneNumberId && !accessToken.startsWith('wp_live_')) {
    try {
      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'text',
        text: { body: messageText }
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status === 200 || response.status === 201) {
        apiSuccess = true;
        apiResponseData = response.data;
        errorMessage = null;
      }
    } catch (error) {
      errorMessage = error.response?.data?.error?.message || error.message;
      console.error(`[WhatsApp Meta API Error] for Lead ${lead.title}:`, errorMessage);
    }
  }

  // Update lead status based on explicit API outcome
  if (apiSuccess) {
    lead.whatsappStatus = 'SENT';
    lead.leadStatus = 'CONTACTED';
    lead.lastContactedAt = new Date();
    await lead.save();

    // Create Communication Record
    const comm = new Communication({
      leadId: lead._id,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      subject: 'WhatsApp Outreach',
      message: messageText,
      status: 'SENT',
      sentAt: new Date(),
      createdBy: userId
    });
    await comm.save();

    const whatsportalResult = await sendWhatsPortalNotification({
      name: lead.contactPerson || lead.title || 'Customer',
      phone: lead.phone,
      requestType: lead.categoryName || 'LEAD',
      referenceId: String(lead._id),
      status: lead.leadStatus,
      date: new Date().toISOString()
    });

    if (whatsportalResult.success) {
      lead.whatsappNotificationSent = true;
      lead.whatsappNotificationSentAt = new Date();
      lead.whatsappNotificationMessageId = whatsportalResult.messageId || '';
      lead.whatsappNotificationError = '';
      await lead.save();
    } else {
      lead.whatsappNotificationSent = false;
      lead.whatsappNotificationSentAt = null;
      lead.whatsappNotificationError = whatsportalResult.message || 'WhatsPortal notification failed';
      await lead.save();
    }

    // Log Audit
    await logAudit({
      user: userId,
      action: 'WHATSAPP_SENT',
      leadId: lead._id,
      details: `WhatsApp message sent to ${lead.title} (${lead.phone})` + (whatsportalResult.success ? ' | WhatsPortal accepted' : ` | WhatsPortal failed: ${whatsportalResult.message}`)
    });

    return {
      success: true,
      leadId: lead._id,
      leadTitle: lead.title,
      whatsappStatus: 'SENT',
      communicationId: comm._id,
      apiData: apiResponseData,
      whatsportal: whatsportalResult
    };
  } else {
    lead.whatsappStatus = 'FAILED';
    await lead.save();

    // Create failed Communication Record
    await Communication.create({
      leadId: lead._id,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      subject: 'WhatsApp Outreach (Failed)',
      message: messageText,
      status: 'FAILED',
      sentAt: new Date(),
      createdBy: userId
    });

    await logAudit({
      user: userId,
      action: 'WHATSAPP_FAILED',
      leadId: lead._id,
      details: `WhatsApp send failed for ${lead.title}: ${errorMessage}`
    });

    return {
      success: false,
      leadId: lead._id,
      leadTitle: lead.title,
      whatsappStatus: 'FAILED',
      error: errorMessage || 'Failed to send WhatsApp message'
    };
  }
};

module.exports = { sendWhatsAppMessage };
