const axios = require('axios');
const nodemailer = require('nodemailer');
const Lead = require('../models/Lead');
const Settings = require('../models/Settings');
const Communication = require('../models/Communication');
const { logAudit } = require('./auditLogService');

/**
 * Convert plain text email body with linebreaks & bullet points into styled responsive HTML
 */
const formatEmailBodyToHtml = (bodyText) => {
  if (!bodyText) return '';

  const paragraphs = bodyText.split(/\n\s*\n/);

  const formattedElements = paragraphs.map((para) => {
    const trimmed = para.trim();
    if (!trimmed) return '';

    // Check if paragraph contains bullet list items
    if (trimmed.includes('\n-') || trimmed.includes('\n*') || trimmed.includes('\n•') || trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const lines = trimmed.split('\n');
      let htmlOut = '';
      let inList = false;

      lines.forEach((line) => {
        const lineTrim = line.trim();
        if (lineTrim.startsWith('-') || lineTrim.startsWith('*') || lineTrim.startsWith('•')) {
          if (!inList) {
            htmlOut += '<ul style="margin: 12px 0; padding-left: 22px; list-style-type: disc;">';
            inList = true;
          }
          const itemText = lineTrim.replace(/^[-*•]\s*/, '');
          htmlOut += `<li style="margin-bottom: 6px; font-size: 14px; line-height: 1.6; color: #334155;">${itemText}</li>`;
        } else {
          if (inList) {
            htmlOut += '</ul>';
            inList = false;
          }
          htmlOut += `<p style="margin-bottom: 8px; font-weight: 700; font-size: 14px; color: #0f172a;">${lineTrim}</p>`;
        }
      });
      if (inList) htmlOut += '</ul>';
      return htmlOut;
    }

    // Check if paragraph is Regards / Sign-off section
    if (trimmed.startsWith('Regards,') || trimmed.startsWith('Best Regards,') || trimmed.startsWith('Warm regards,')) {
      const signLines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
      const signHtml = signLines
        .map((line, idx) => {
          if (idx === 0) return `<p style="margin-bottom: 6px; font-weight: bold; color: #0f172a; font-size: 14px;">${line}</p>`;
          if (idx === 1) return `<p style="margin: 2px 0; font-size: 15px; font-weight: 800; color: #003865;">${line}</p>`;
          if (idx === 2) return `<p style="margin: 2px 0; font-size: 13px; font-weight: 600; color: #0a4b7c;">${line}</p>`;

          let formattedLine = line;
          if (line.includes('Website:') || line.includes('Email:') || line.includes('Phone:')) {
            formattedLine = line
              .replace(/(https?:\/\/[^\s]+|www\.[^\s]+)/g, '<a href="https://$1" style="color: #0a4b7c; font-weight: bold; text-decoration: underline;">$1</a>')
              .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" style="color: #0a4b7c; font-weight: bold;">$1</a>');
          }
          return `<p style="margin: 3px 0; font-size: 13px; color: #475569;">${formattedLine}</p>`;
        })
        .join('');

      return `<div style="margin-top: 24px; padding-top: 14px; border-top: 2px solid #003865;">${signHtml}</div>`;
    }

    // Standard paragraph with linebreaks preserved
    const paraHtml = trimmed.replace(/\n/g, '<br/>');
    return `<p style="margin-bottom: 14px; line-height: 1.6; font-size: 14px; color: #1e293b;">${paraHtml}</p>`;
  });

  return formattedElements.join('');
};

/**
 * Send a transactional email to a single lead via Brevo API (or SMTP / Simulation)
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

  // Brevo Parameters (from Settings DB or process.env)
  const brevoApiKey = settings?.brevoApiKey || process.env.BREVO_API_KEY;
  const brevoSenderEmail = settings?.brevoSenderEmail || process.env.BREVO_SENDER_EMAIL || settings?.email || 'sales@kevalontechnology.in';
  const brevoSenderName = settings?.brevoSenderName || process.env.BREVO_SENDER_NAME || settings?.senderName || 'Harsh Kothari | Kevalon Technology';
  const brevoTemplateId = Number(settings?.brevoTemplateId || process.env.BREVO_LEAD_TEMPLATE_ID || 0);

  // Secondary SMTP Parameters
  const smtpHost = settings?.smtpHost || process.env.SMTP_HOST;
  const smtpPort = Number(settings?.smtpPort || process.env.SMTP_PORT || 587);
  const smtpUser = settings?.smtpUsername || process.env.SMTP_USER;
  const smtpPass = settings?.smtpPassword || process.env.SMTP_PASS;

  const formattedBodyHtml = formatEmailBodyToHtml(bodyText);

  let sendSuccess = false;
  let responseData = null;
  let errorMessage = null;

  // Primary Choice: Brevo Transactional API
  if (brevoApiKey && brevoApiKey.trim() !== '') {
    try {
      const fullEmailCard = `
        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          ${formattedBodyHtml}
        </div>
      `;

      const payload = {
        sender: {
          email: brevoSenderEmail.trim(),
          name: brevoSenderName.trim()
        },
        to: [
          {
            email: lead.email.trim(),
            name: lead.contactPerson || lead.title
          }
        ],
        subject: subjectText.trim(),
        htmlContent: fullEmailCard,
        textContent: bodyText
      };

      if (brevoTemplateId > 0) {
        payload.templateId = brevoTemplateId;
        payload.params = {
          generatedEmailBody: formattedBodyHtml,
          emailBody: formattedBodyHtml,
          bodyContent: formattedBodyHtml,
          rawBody: bodyText
        };
      }

      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        payload,
        {
          headers: {
            accept: 'application/json',
            'api-key': brevoApiKey.trim(),
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
  } else if (smtpHost && smtpUser && smtpPass) {
    // Secondary Choice: Nodemailer SMTP
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
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000
      });

      const fullEmailCard = `
        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          ${formattedBodyHtml}
        </div>
      `;

      const info = await transporter.sendMail({
        from: `"${brevoSenderName}" <${brevoSenderEmail}>`,
        to: lead.email,
        subject: subjectText,
        text: bodyText,
        html: fullEmailCard
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
  } else {
    // Fallback: Brevo Simulation Mode (for testing/demo)
    sendSuccess = true;
    responseData = {
      engine: 'BREVO_SIMULATION',
      message: 'Simulated Brevo Email dispatch. Enter your Brevo API Key under Settings for live inbox delivery.'
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
      details: `Brevo Email sent to ${lead.email} ("${lead.title}") via ${responseData?.engine}`
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
      details: `Brevo Email failed for ${lead.email}: ${errorMessage}`
    });

    throw new Error(errorMessage || 'Failed to send email via Brevo');
  }
};

module.exports = { sendEmailMessage, formatEmailBodyToHtml };
