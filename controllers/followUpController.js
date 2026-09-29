const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const { logAudit } = require('../services/auditLogService');

// @desc    Get follow-ups with filter tabs
// @route   GET /api/followups
// @access  Private
const getFollowUps = async (req, res, next) => {
  try {
    const { status = 'PENDING', tab = 'TODAY' } = req.query;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const query = {};

    if (status) query.status = status;

    if (tab === 'TODAY') {
      query.followUpDate = { $gte: startOfToday, $lte: endOfToday };
      query.status = 'PENDING';
    } else if (tab === 'OVERDUE') {
      query.followUpDate = { $lt: startOfToday };
      query.status = 'PENDING';
    } else if (tab === 'UPCOMING') {
      query.followUpDate = { $gt: endOfToday };
      query.status = 'PENDING';
    } else if (tab === 'COMPLETED') {
      query.status = 'COMPLETED';
    }

    const followUps = await FollowUp.find(query)
      .sort({ followUpDate: 1 })
      .populate({
        path: 'leadId',
        select: 'title categoryName contactPerson phone email city leadStatus whatsappStatus emailStatus lastContactedAt'
      })
      .populate('createdBy', 'name email');

    const todayCount = await FollowUp.countDocuments({
      followUpDate: { $gte: startOfToday, $lte: endOfToday },
      status: 'PENDING'
    });
    const overdueCount = await FollowUp.countDocuments({
      followUpDate: { $lt: startOfToday },
      status: 'PENDING'
    });
    const upcomingCount = await FollowUp.countDocuments({
      followUpDate: { $gt: endOfToday },
      status: 'PENDING'
    });
    const completedCount = await FollowUp.countDocuments({ status: 'COMPLETED' });

    res.json({
      success: true,
      count: followUps.length,
      counts: {
        todayCount,
        overdueCount,
        upcomingCount,
        completedCount
      },
      followUps
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a follow-up for a lead
// @route   POST /api/followups
// @access  Private
const createFollowUp = async (req, res, next) => {
  try {
    const { leadId, followUpDate, followUpTime, channel, followUpMessage, notes } = req.body;

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const followUp = new FollowUp({
      leadId,
      followUpDate: new Date(followUpDate),
      followUpTime: followUpTime || '10:00',
      channel: channel || 'WHATSAPP',
      followUpMessage: followUpMessage || '',
      notes: notes || '',
      status: 'PENDING',
      createdBy: req.user?._id
    });

    await followUp.save();

    // Update lead's follow-up fields
    lead.nextFollowUpAt = new Date(followUpDate);
    lead.leadStatus = 'FOLLOW_UP';
    lead.followUpCount = (lead.followUpCount || 0) + 1;
    await lead.save();

    await logAudit({
      user: req.user?._id,
      action: 'FOLLOWUP_CREATED',
      leadId: lead._id,
      details: `Scheduled follow-up for "${lead.title}" on ${new Date(followUpDate).toLocaleDateString()}`
    });

    res.status(201).json({ success: true, followUp });
  } catch (error) {
    next(error);
  }
};

// @desc    Update follow-up status or details
// @route   PUT /api/followups/:id
// @access  Private
const updateFollowUp = async (req, res, next) => {
  try {
    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({ success: false, message: 'Follow-up not found' });
    }

    Object.assign(followUp, req.body);
    await followUp.save();

    if (req.body.status === 'COMPLETED') {
      const lead = await Lead.findById(followUp.leadId);
      if (lead) {
        lead.nextFollowUpAt = null;
        await lead.save();
      }
    }

    await logAudit({
      user: req.user?._id,
      action: 'FOLLOWUP_UPDATED',
      leadId: followUp.leadId,
      details: `Updated follow-up status to ${followUp.status}`
    });

    res.json({ success: true, followUp });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a follow-up
// @route   DELETE /api/followups/:id
// @access  Private
const deleteFollowUp = async (req, res, next) => {
  try {
    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({ success: false, message: 'Follow-up not found' });
    }

    await followUp.deleteOne();
    res.json({ success: true, message: 'Follow-up deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp
};
