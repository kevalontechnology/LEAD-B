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

    // Contact Availability Statistics
    const hasPhoneQuery = { phone: { $exists: true, $ne: null, $ne: '' } };
    const hasEmailQuery = { email: { $exists: true, $ne: null, $ne: '' } };

    const mobileAvailable = await Lead.countDocuments(hasPhoneQuery);
    const emailAvailable = await Lead.countDocuments(hasEmailQuery);
    const bothAvailable = await Lead.countDocuments({
      $and: [hasPhoneQuery, hasEmailQuery]
    });

    // Chart Data 1: Complete Category Breakdown for ALL Categories
    const categoryAgg = await Lead.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$categoryName', 'General / Uncategorized'] },
          count: { $sum: 1 },
          mobileAvailable: {
            $sum: { $cond: [{ $and: [{ $ne: ['$phone', null] }, { $ne: ['$phone', ''] }] }, 1, 0] }
          },
          emailAvailable: {
            $sum: { $cond: [{ $and: [{ $ne: ['$email', null] }, { $ne: ['$email', ''] }] }, 1, 0] }
          },
          bothAvailable: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$phone', null] },
                    { $ne: ['$phone', ''] },
                    { $ne: ['$email', null] },
                    { $ne: ['$email', ''] }
                  ]
                },
                1,
                0
              ]
            }
          },
          messageReady: {
            $sum: { $cond: [{ $eq: ['$leadStatus', 'MESSAGE_READY'] }, 1, 0] }
          },
          whatsappSent: {
            $sum: { $cond: [{ $eq: ['$whatsappStatus', 'SENT'] }, 1, 0] }
          },
          emailSent: {
            $sum: { $cond: [{ $eq: ['$emailStatus', 'SENT'] }, 1, 0] }
          },
          interested: {
            $sum: { $cond: [{ $eq: ['$leadStatus', 'INTERESTED'] }, 1, 0] }
          },
          converted: {
            $sum: { $cond: [{ $eq: ['$leadStatus', 'CONVERTED'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Chart Data 2: Leads by City
    const cityAgg = await Lead.aggregate([
      { $match: { city: { $ne: '' } } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 }
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
        mobileAvailable,
        emailAvailable,
        bothAvailable,
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
        byCategory: categoryAgg.map((c) => ({
          category: c._id || 'General',
          count: c.count,
          mobileAvailable: c.mobileAvailable || 0,
          emailAvailable: c.emailAvailable || 0,
          bothAvailable: c.bothAvailable || 0,
          messageReady: c.messageReady,
          whatsappSent: c.whatsappSent,
          emailSent: c.emailSent,
          interested: c.interested,
          converted: c.converted
        })),
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
