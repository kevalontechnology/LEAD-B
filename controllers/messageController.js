const Lead = require('../models/Lead');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const { sendEmailMessage } = require('../services/emailService');
const { processBulkQueue } = require('../utils/rateLimiter');
const { logAudit } = require('../services/auditLogService');

// @desc    Send WhatsApp message to a single lead
// @route   POST /api/leads/whatsapp/send
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
// @route   POST /api/leads/email/send
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

// @desc    Bulk send WhatsApp, Email, or Both to user-selected leads or filtered criteria
// @route   POST /api/leads/messages/bulk-send
// @access  Private
const bulkSendMessages = async (req, res, next) => {
  try {
    const { leadIds, channel = 'WHATSAPP', filter, category } = req.body;
    const upperChannel = String(channel || 'WHATSAPP').toUpperCase();

    let leads = [];
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      leads = await Lead.find({ _id: { $in: leadIds } });
    } else if (filter || upperChannel) {
      const query = {};
      const targetFilter = filter || (upperChannel === 'EMAIL' ? 'HAS_EMAIL' : 'HAS_MOBILE');

      if (targetFilter === 'HAS_EMAIL') query.email = { $exists: true, $ne: null, $ne: '' };
      else if (targetFilter === 'HAS_MOBILE') query.phone = { $exists: true, $ne: null, $ne: '' };
      else if (targetFilter === 'HAS_BOTH') {
        query.email = { $exists: true, $ne: null, $ne: '' };
        query.phone = { $exists: true, $ne: null, $ne: '' };
      }

      if (category) query.categoryName = { $regex: category, $options: 'i' };
      leads = await Lead.find(query);
    }

    if (!leads || leads.length === 0) {
      return res.status(400).json({ success: false, message: 'No matching leads found for bulk dispatch' });
    }

    const eligibleLeads = leads.filter((l) => l.leadStatus !== 'DO_NOT_CONTACT');
    const skippedDoNotContactCount = leads.length - eligibleLeads.length;

    const worker = async (lead) => {
      const outcome = { leadId: lead._id, title: lead.title, success: false };

      let waResult = null;
      let emailResult = null;

      if (upperChannel === 'WHATSAPP' || upperChannel === 'BOTH') {
        try {
          waResult = await sendWhatsAppMessage({
            leadId: lead._id,
            userId: req.user?._id
          });
          outcome.whatsapp = waResult;
        } catch (err) {
          outcome.whatsapp = { success: false, error: err.message };
        }
      }

      if (upperChannel === 'EMAIL' || upperChannel === 'BOTH') {
        try {
          emailResult = await sendEmailMessage({
            leadId: lead._id,
            userId: req.user?._id
          });
          outcome.email = emailResult;
        } catch (err) {
          outcome.email = { success: false, error: err.message };
        }
      }

      // Determine overall success for this lead item
      if (upperChannel === 'WHATSAPP') outcome.success = waResult?.success || false;
      else if (upperChannel === 'EMAIL') outcome.success = emailResult?.success || false;
      else if (upperChannel === 'BOTH') outcome.success = (waResult?.success || false) || (emailResult?.success || false);

      return outcome;
    };

    // Execute bulk queue with 600ms delay between leads to respect rate limits
    const queueResults = await processBulkQueue(eligibleLeads, worker, 600);

    const detailedResults = queueResults.map((q) => q.result || { leadId: q.item._id, title: q.item.title, success: false, error: q.error });
    const sentCount = detailedResults.filter((r) => r.success).length;
    const failedCount = detailedResults.filter((r) => !r.success).length;

    await logAudit({
      user: req.user?._id,
      action: 'BULK_MESSAGES_SENT',
      details: `Executed bulk send (${upperChannel}) for ${eligibleLeads.length} leads. Success: ${sentCount}, Failed: ${failedCount}, Skipped DO_NOT_CONTACT: ${skippedDoNotContactCount}`
    });

    res.json({
      success: true,
      channel: upperChannel,
      totalRequested: leadIds.length,
      eligibleCount: eligibleLeads.length,
      skippedDoNotContactCount,
      sentCount,
      failedCount,
      results: detailedResults
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
