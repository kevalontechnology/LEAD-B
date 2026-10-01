const axios = require('axios');
const nodemailer = require('nodemailer');
const Lead = require('../models/Lead');
const Settings = require('../models/Settings');
const Communication = require('../models/Communication');
const { logAudit } = require('./auditLogService');

/**
 * Send a transactional email to a single lead (Nodemailer SMTP / Brevo API / Simulation)
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

  const settings = await Settings.findOne();

  const senderName = settings?.smtpFromName || settings?.senderName || process.env.BREVO_SENDER_NAME || 'Harsh Kothari | Kevalon Technology';
  const senderEmail = settings?.smtpFromEmail || settings?.email || process.env.BREVO_SENDER_EMAIL || 'sales@kevalontechnology.in';

  let sendSuccess = false;
  let responseData = null;
  let errorMessage = null;

  // Option A: Nodemailer SMTP (Settings DB or .env)
  const smtpHost = settings?.smtpHost || process.env.SMTP_HOST;
  const smtpPort = Number(settings?.smtpPort || process.env.SMTP_PORT || 587);
  const smtpUser = settings?.smtpUsername || process.env.SMTP_USER;
  const smtpPass = settings?.smtpPassword || process.env.SMTP_PASS;

  const hasSmtpConfig = Boolean(smtpHost && smtpUser && smtpPass);
  const hasBrevoKey = Boolean(process.env.BREVO_API_KEY);

  if (hasSmtpConfig) {
    try {
      const isSecure = smtpPort === 465;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: isSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000
      });

      const formattedHtml = bodyText.replace(/\n/g, '<br/>');

      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: lead.email,
        subject: subjectText,
        text: bodyText,
        html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${formattedHtml}</div>`
      });

      sendSuccess = true;
      responseData = {
        engine: 'SMTP',
        messageId: info.messageId,
        response: info.response
      };
    } catch (err) {
      errorMessage = `SMTP Dispatch Error (${smtpHost}): ${err.message}`;
    }
  } else if (hasBrevoKey) {
    try {
      const formattedHtml = bodyText.replace(/\n/g, '<br/>');
      const templateId = Number(process.env.BREVO_LEAD_TEMPLATE_ID);

      const payload = {
        sender: {
          email: process.env.BREVO_SENDER_EMAIL || senderEmail,
          name: process.env.BREVO_SENDER_NAME || senderName
        },
        to: [
          {
            email: lead.email,
            name: lead.contactPerson || lead.title
          }
        ],
        subject: subjectText,
        htmlContent: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${formattedHtml}</div>`,
        textContent: bodyText
      };

      if (templateId > 0) {
        payload.templateId = templateId;
        payload.params = { generatedEmailBody: bodyText };
      }

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
        engine: 'BREVO_API',
        messageId: response.data?.messageId,
        response: response.data
      };
    } catch (err) {
      const status = err.response?.status;
      const providerMessage = err.response?.data?.message;
      errorMessage = status
        ? `Brevo API Error (${status})${providerMessage ? `: ${providerMessage}` : ''}`
        : err.message || 'Brevo API request failed';
    }
  } else {
    // Option C: Simulation Fallback (for testing / demo mode)
    sendSuccess = true;
    responseData = {
      engine: 'SIMULATION',
      message: 'Simulated Email dispatch. Configure Nodemailer SMTP in Settings page for live inbox delivery.'
    };
  }

  if (sendSuccess) {
    lead.emailStatus = 'SENT';
    lead.leadStatus = 'CONTACTED';
    lead.lastContactedAt = new Date();
    await lead.save();

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

    await logAudit({
      user: userId,
      action: 'EMAIL_SENT',
      leadId: lead._id,
      details: `Email sent to ${lead.email} ("${lead.title}") via ${responseData?.engine}`
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
      details: `Email failed for ${lead.email}: ${errorMessage}`
    });

    throw new Error(errorMessage || 'Failed to send email outreach');
  }
};

module.exports = { sendEmailMessage };
