const Communication = require('../models/Communication');

// @desc    Get all communications history
// @route   GET /api/communications
// @access  Private
const getCommunications = async (req, res, next) => {
  try {
    const { channel, status, page = 1, limit = 50 } = req.query;
    const query = {};

    if (channel) query.channel = channel;
    if (status) query.status = status;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const communications = await Communication.find(query)
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('leadId', 'title categoryName phone email city')
      .populate('createdBy', 'name email');

    const total = await Communication.countDocuments(query);

    res.json({
      success: true,
      count: communications.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      communications
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get timeline history for a specific lead
// @route   GET /api/communications/lead/:leadId
// @access  Private
const getLeadTimeline = async (req, res, next) => {
  try {
    const communications = await Communication.find({ leadId: req.params.leadId })
      .sort({ sentAt: -1 })
      .populate('createdBy', 'name email');

    res.json({ success: true, count: communications.length, timeline: communications });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCommunications,
  getLeadTimeline
};
