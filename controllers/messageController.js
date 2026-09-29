const Lead = require('../models/Lead');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const { sendEmailMessage } = require('../services/emailService');
const { processBulkQueue } = require('../utils/rateLimiter');
const { logAudit } = require('../services/auditLogService');

// @desc    Send WhatsApp message to a single lead
// @route   POST /api/whatsapp/send
// @access  Private
const sendSingleWhatsApp = async (req, res, next) => {
  try {
    const { leadId, customMessage } = req.body;
    if (!leadId) {
      return res.status(400).json({ success: false, message: 'leadId is required' });
    }

    const result = await sendWhatsAppMessage({
      leadId,
      customMessage,
      userId: req.user?._id
    });

    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
};

// @desc    Send Email message to a single lead
// @route   POST /api/email/send
// @access  Private
const sendSingleEmail = async (req, res, next) => {
  try {
    const { leadId, customSubject, customBody } = req.body;
    if (!leadId) {
      return res.status(400).json({ success: false, message: 'leadId is required' });
    }

    const result = await sendEmailMessage({
      leadId,
      customSubject,
      customBody,
      userId: req.user?._id
    });

    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk send WhatsApp, Email, or Both to user-selected leads
// @route   POST /api/messages/bulk-send
// @access  Private
const bulkSendMessages = async (req, res, next) => {
  try {
    const { leadIds, channel = 'WHATSAPP' } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one lead' });
    }

    // Fetch leads and check DO_NOT_CONTACT
    const leads = await Lead.find({ _id: { $in: leadIds } });
    const eligibleLeads = leads.filter((l) => l.leadStatus !== 'DO_NOT_CONTACT');
    const skippedDoNotContactCount = leads.length - eligibleLeads.length;

    const worker = async (lead) => {
      const outcome = { leadId: lead._id, title: lead.title };

      if (channel === 'WHATSAPP' || channel === 'BOTH') {
        try {
          outcome.whatsapp = await sendWhatsAppMessage({
            leadId: lead._id,
            userId: req.user?._id
          });
        } catch (err) {
          outcome.whatsapp = { success: false, error: err.message };
        }
      }

      if (channel === 'EMAIL' || channel === 'BOTH') {
        try {
          outcome.email = await sendEmailMessage({
            leadId: lead._id,
            userId: req.user?._id
          });
        } catch (err) {
          outcome.email = { success: false, error: err.message };
        }
      }

      return outcome;
    };

    // Execute bulk queue with 600ms delay between leads to respect rate limits
    const results = await processBulkQueue(eligibleLeads, worker, 600);

    const sentCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    await logAudit({
      user: req.user?._id,
      action: 'BULK_MESSAGES_SENT',
      details: `Executed bulk send (${channel}) for ${eligibleLeads.length} leads. Success: ${sentCount}, Failed: ${failedCount}, Skipped DO_NOT_CONTACT: ${skippedDoNotContactCount}`
    });

    res.json({
      success: true,
      channel,
      totalRequested: leadIds.length,
      eligibleCount: eligibleLeads.length,
      skippedDoNotContactCount,
      sentCount,
      failedCount,
      results
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendSingleWhatsApp,
  sendSingleEmail,
  bulkSendMessages
};
