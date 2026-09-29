const AuditLog = require('../models/AuditLog');

// @desc    Get audit logs
// @route   GET /api/audit-logs
// @access  Private/Admin
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, page = 1, limit = 50 } = req.query;
    const query = {};

    if (action) query.action = action;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('user', 'name email role')
      .populate('leadId', 'title categoryName');

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      count: logs.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      logs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAuditLogs };
