const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Communication = require('../models/Communication');

// @desc    Get SaaS Dashboard Aggregated Statistics & Charts
// @route   GET /api/reports/dashboard
// @access  Private
const getDashboardStats = async (req, res, next) => {
  try {
    const totalLeads = await Lead.countDocuments();
    const newLeads = await Lead.countDocuments({ leadStatus: 'NEW' });
    const messagesReady = await Lead.countDocuments({ leadStatus: 'MESSAGE_READY' });
    const whatsappSent = await Lead.countDocuments({ whatsappStatus: 'SENT' });
    const emailSent = await Lead.countDocuments({ emailStatus: 'SENT' });
    const failedCount = await Lead.countDocuments({
      $or: [{ whatsappStatus: 'FAILED' }, { emailStatus: 'FAILED' }]
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const followUpsToday = await FollowUp.countDocuments({
      followUpDate: { $gte: startOfToday, $lte: endOfToday },
      status: 'PENDING'
    });

    const overdueFollowUps = await FollowUp.countDocuments({
      followUpDate: { $lt: startOfToday },
      status: 'PENDING'
    });

    const interestedLeads = await Lead.countDocuments({ leadStatus: 'INTERESTED' });
    const convertedLeads = await Lead.countDocuments({ leadStatus: 'CONVERTED' });

    // Chart Data 1: Leads by Category
    const categoryAgg = await Lead.aggregate([
      { $group: { _id: '$categoryName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Chart Data 2: Leads by City
    const cityAgg = await Lead.aggregate([
      { $match: { city: { $ne: '' } } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Chart Data 3: Lead Status Breakdown
    const statusAgg = await Lead.aggregate([
      { $group: { _id: '$leadStatus', count: { $sum: 1 } } }
    ]);

    // Chart Data 4: Channel Communication Breakdown
    const totalWhatsAppComm = await Communication.countDocuments({ channel: 'WHATSAPP' });
    const totalEmailComm = await Communication.countDocuments({ channel: 'EMAIL' });

    res.json({
      success: true,
      cards: {
        totalLeads,
        newLeads,
        messagesReady,
        whatsappSent,
        emailSent,
        failedCount,
        followUpsToday,
        overdueFollowUps,
        interestedLeads,
        convertedLeads
      },
      charts: {
        byCategory: categoryAgg.map((c) => ({ category: c._id || 'Uncategorized', count: c.count })),
        byCity: cityAgg.map((c) => ({ city: c._id, count: c.count })),
        byStatus: statusAgg.map((s) => ({ status: s._id, count: s.count })),
        channelBreakdown: {
          whatsapp: totalWhatsAppComm,
          email: totalEmailComm
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardStats };
