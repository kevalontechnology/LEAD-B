const axios = require('axios');
const Lead = require('../models/Lead');
const Communication = require('../models/Communication');
const Settings = require('../models/Settings');
const { logAudit } = require('./auditLogService');

/**
 * Send WhatsApp message to a single lead
 */
const sendWhatsAppMessage = async ({ leadId, customMessage, userId }) => {
  const lead = await Lead.findById(leadId);
  if (!lead) {
    throw new Error('Lead not found');
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
  const accessToken = settings?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = settings?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = settings?.whatsappApiVersion || process.env.WHATSAPP_API_VERSION || 'v18.0';

  let apiSuccess = false;
  let apiResponseData = null;
  let errorMessage = null;

  // Check if official Cloud API credentials are provided
  if (accessToken && phoneNumberId) {
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
      }
    } catch (error) {
      errorMessage = error.response?.data?.error?.message || error.message;
      console.error(`[WhatsApp API Error] for Lead ${lead.title}:`, errorMessage);
    }
  } else {
    // Local development mode / Simulation mode when API keys are not provided
    console.log(`[WhatsApp API Simulation] Sending message to ${recipientPhone} for ${lead.title}...`);
    apiSuccess = true; // Simulated success for local dev testing
    apiResponseData = { simulation: true, messageId: `wamid.simulated_${Date.now()}` };
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

    // Log Audit
    await logAudit({
      user: userId,
      action: 'WHATSAPP_SENT',
      leadId: lead._id,
      details: `WhatsApp message sent to ${lead.title} (${lead.phone})`
    });

    return {
      success: true,
      leadId: lead._id,
      leadTitle: lead.title,
      whatsappStatus: 'SENT',
      communicationId: comm._id,
      apiData: apiResponseData
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
