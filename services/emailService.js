const nodemailer = require('nodemailer');
const Lead = require('../models/Lead');
const Communication = require('../models/Communication');
const Settings = require('../models/Settings');
const { logAudit } = require('./auditLogService');

/**
 * Send Email to a single lead via Nodemailer
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

  const subjectText = customSubject || lead.generatedEmailSubject;
  const bodyText = customBody || lead.generatedEmailBody;

  if (!subjectText || !bodyText) {
    throw new Error(`No email subject/body content found for lead "${lead.title}".`);
  }

  // Fetch Settings
  const settings = await Settings.findOne();
  const smtpHost = settings?.smtpHost || process.env.SMTP_HOST;
  const smtpPort = settings?.smtpPort || process.env.SMTP_PORT || 587;
  const smtpUsername = settings?.smtpUsername || process.env.SMTP_USERNAME;
  const smtpPassword = settings?.smtpPassword || process.env.SMTP_PASSWORD;
  const fromName = settings?.smtpFromName || settings?.senderName || 'Harsh Kothari | Kevalon Technology';
  const fromEmail = settings?.smtpFromEmail || settings?.email || 'sales@kevalontechnology.in';

  let sendSuccess = false;
  let responseData = null;
  let errorMessage = null;

  if (smtpHost && smtpUsername && smtpPassword) {
    try {
      const portNum = Number(smtpPort);
      const isSecurePort = portNum === 465;

      const transporter = nodemailer.createTransport({
        host: smtpHost.trim(),
        port: portNum,
        secure: isSecurePort, // true for 465 (SSL), false for 587 (TLS)
        requireTLS: !isSecurePort, // require STARTTLS for 587
        auth: {
          user: smtpUsername.trim(),
          pass: smtpPassword.trim()
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });

      // Format linebreaks to HTML
      const htmlContent = bodyText.replace(/\n/g, '<br/>');

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: lead.email,
        subject: subjectText,
        text: bodyText,
        html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${htmlContent}</div>`
      });

      sendSuccess = true;
      responseData = { messageId: info.messageId, response: info.response };
    } catch (error) {
      errorMessage = error.message;
      console.error(`[Email SMTP Error] for Lead ${lead.title}:`, errorMessage);
    }
  } else {
    // Local development mode / Simulation mode
    console.log(`[Email API Simulation] Sending email to ${lead.email} for ${lead.title}...`);
    sendSuccess = true;
    responseData = { simulation: true, messageId: `msg_${Date.now()}@kevalontechnology.in` };
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
      details: `Email sent to ${lead.title} (${lead.email}) - Subject: ${subjectText}`
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
      details: `Email send failed for ${lead.title}: ${errorMessage}`
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
