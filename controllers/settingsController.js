const Settings = require('../models/Settings');
const { logAudit } = require('../services/auditLogService');

// @desc    Get system settings
// @route   GET /api/settings
// @access  Private
const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

// @desc    Update system settings
// @route   PUT /api/settings
// @access  Private/Admin
const updateSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      Object.assign(settings, req.body);
    }

    await settings.save();

    await logAudit({
      user: req.user?._id,
      action: 'SETTINGS_UPDATED',
      details: 'System settings updated'
    });

    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings
};
