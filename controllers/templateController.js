const MessageTemplate = require('../models/MessageTemplate');
const { logAudit } = require('../services/auditLogService');

// @desc    Get all message templates
// @route   GET /api/templates
// @access  Private
const getTemplates = async (req, res, next) => {
  try {
    const { category, type } = req.query;
    const query = {};
    if (category) query.category = category;
    if (type) query.type = type;

    const templates = await MessageTemplate.find(query).sort({ category: 1, createdAt: -1 });
    res.json({ success: true, count: templates.length, templates });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a message template
// @route   POST /api/templates
// @access  Private
const createTemplate = async (req, res, next) => {
  try {
    const { title, category, type, whatsappContent, emailSubject, emailBody, isDefault } = req.body;

    if (isDefault) {
      // Unset previous defaults in same category
      await MessageTemplate.updateMany({ category }, { isDefault: false });
    }

    const template = await MessageTemplate.create({
      title,
      category,
      type,
      whatsappContent,
      emailSubject,
      emailBody,
      isDefault
    });

    await logAudit({
      user: req.user?._id,
      action: 'TEMPLATE_CREATED',
      details: `Created template "${title}" for category "${category}"`
    });

    res.status(201).json({ success: true, template });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a message template
// @route   PUT /api/templates/:id
// @access  Private
const updateTemplate = async (req, res, next) => {
  try {
    const template = await MessageTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    if (req.body.isDefault) {
      await MessageTemplate.updateMany(
        { category: req.body.category || template.category },
        { isDefault: false }
      );
    }

    Object.assign(template, req.body);
    await template.save();

    await logAudit({
      user: req.user?._id,
      action: 'TEMPLATE_UPDATED',
      details: `Updated template "${template.title}"`
    });

    res.json({ success: true, template });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a message template
// @route   DELETE /api/templates/:id
// @access  Private
const deleteTemplate = async (req, res, next) => {
  try {
    const template = await MessageTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    await template.deleteOne();

    await logAudit({
      user: req.user?._id,
      action: 'TEMPLATE_DELETED',
      details: `Deleted template "${template.title}"`
    });

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
