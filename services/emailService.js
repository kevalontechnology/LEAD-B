const axios = require('axios');
const Lead = require('../models/Lead');
const Communication = require('../models/Communication');
const { logAudit } = require('./auditLogService');

/**
 * Send a transactional template email to a single lead via Brevo
 */
const sendEmailMessage = async ({ leadId, customSubject, customBody, userId }) => {
  const lead = await Lead.findById(leadId);
  if (!lead) {
    throw new Error('Lead not found');
  }

  // Safety check: DO_NOT_CONTACT
  if (lead.leadStatus === 'DO_NOT_CONTACT') {
    throw new Error(`Lead "${lead.title}" has opted out of outreach (DO_NOT_CONTACT).`);
  }

  if (!lead.email) {
    throw new Error(`Lead "${lead.title}" does not have an email address.`);
  }

  const subjectText = customSubject ?? lead.generatedEmailSubject;
  const bodyText = customBody ?? lead.generatedEmailBody;

  if (!subjectText?.trim() || !bodyText?.trim()) {
    throw new Error(`No email subject/body content found for lead "${lead.title}".`);
  }

  let sendSuccess = false;
  let responseData = null;
  let errorMessage = null;
  const templateId = Number(process.env.BREVO_LEAD_TEMPLATE_ID);
  const hasBrevoConfiguration = Boolean(
    process.env.BREVO_API_KEY &&
    Number.isInteger(templateId) &&
    templateId > 0 &&
    process.env.BREVO_SENDER_EMAIL &&
    process.env.BREVO_SENDER_NAME
  );

  if (!hasBrevoConfiguration) {
    errorMessage = 'Brevo email configuration is incomplete.';
  } else {
    try {
      const payload = {
        sender: {
          email: process.env.BREVO_SENDER_EMAIL,
          name: process.env.BREVO_SENDER_NAME
        },
        to: [
          {
            email: lead.email,
            name: lead.contactPerson || lead.title
          }
        ],
        replyTo: {
          email: process.env.BREVO_SENDER_EMAIL,
          name: process.env.BREVO_SENDER_NAME
        },
        templateId,
        subject: subjectText,
        params: {
          generatedEmailBody: bodyText
        }
      };

      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        payload,
        {
          headers: {
            accept: 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json'
          },
          timeout: 15000
        }
      );

      sendSuccess = true;
      responseData = {
        messageId: response.data?.messageId,
        response: response.data
      };
    } catch (error) {
      const status = error.response?.status;
      const providerMessage = error.response?.data?.message;
      errorMessage = status
        ? `Brevo request failed (${status})${providerMessage ? `: ${providerMessage}` : ''}`
        : error.message || 'Brevo request failed';
    }
  }

  if (sendSuccess) {
    lead.emailStatus = 'SENT';
    lead.leadStatus = 'CONTACTED';
    lead.lastContactedAt = new Date();
    await lead.save();

    // Create Communication Record
    const comm = new Communication({
      leadId: lead._id,
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      subject: subjectText,
      message: bodyText,
      status: 'SENT',
      sentAt: new Date(),
      createdBy: userId
    });
    await comm.save();

    // Audit Log
    await logAudit({
      user: userId,
      action: 'EMAIL_SENT',
      leadId: lead._id,
      details: `Email sent for lead ${lead._id}`
    });

    return {
      success: true,
      leadId: lead._id,
      leadTitle: lead.title,
      emailStatus: 'SENT',
      communicationId: comm._id,
      responseData
    };
  } else {
    lead.emailStatus = 'FAILED';
    await lead.save();

    // Create failed Communication Record
    await Communication.create({
      leadId: lead._id,
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      subject: subjectText,
      message: bodyText,
      status: 'FAILED',
      sentAt: new Date(),
      createdBy: userId
    });

    await logAudit({
      user: userId,
      action: 'EMAIL_FAILED',
      leadId: lead._id,
      details: `Email delivery failed for lead ${lead._id}: ${errorMessage}`
    });

    return {
      success: false,
      leadId: lead._id,
      leadTitle: lead.title,
      emailStatus: 'FAILED',
      error: errorMessage || 'Failed to send email'
    };
  }
};

module.exports = { sendEmailMessage };
