const Lead = require('../models/Lead');
const Settings = require('../models/Settings');
const { parseExcelFile, previewImport, commitImport } = require('../services/excelService');
const { generateLeadMessages } = require('../services/messageGeneratorService');
const { logAudit } = require('../services/auditLogService');

// @desc    Get all leads with search & filters
// @route   GET /api/leads
// @access  Private
const getLeads = async (req, res, next) => {
  try {
    const {
      search,
      category,
      city,
      leadStatus,
      whatsappStatus,
      emailStatus,
      quickFilter,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Search query across title, phone, email, city, categoryName
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { categoryName: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) query.categoryName = { $regex: category, $options: 'i' };
    if (city) query.city = { $regex: city, $options: 'i' };
    if (leadStatus) query.leadStatus = leadStatus;
    if (whatsappStatus) query.whatsappStatus = whatsappStatus;
    if (emailStatus) query.emailStatus = emailStatus;

    // Quick filter presets
    if (quickFilter) {
      switch (quickFilter) {
        case 'NOT_CONTACTED':
          query.leadStatus = { $in: ['NEW', 'MESSAGE_READY'] };
          break;
        case 'MESSAGE_READY':
          query.leadStatus = 'MESSAGE_READY';
          break;
        case 'WHATSAPP_SENT':
          query.whatsappStatus = 'SENT';
          break;
        case 'EMAIL_SENT':
          query.emailStatus = 'SENT';
          break;
        case 'FAILED':
          query.$or = [{ whatsappStatus: 'FAILED' }, { emailStatus: 'FAILED' }];
          break;
        case 'FOLLOW_UP_DUE':
          query.leadStatus = 'FOLLOW_UP';
          query.nextFollowUpAt = { $lte: new Date() };
          break;
        case 'INTERESTED':
          query.leadStatus = 'INTERESTED';
          break;
        case 'CONVERTED':
          query.leadStatus = 'CONVERTED';
          break;
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const leads = await Lead.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('assignedTo', 'name email');

    const total = await Lead.countDocuments(query);

    // Fetch distinct categories and cities for dropdown filters
    const categories = await Lead.distinct('categoryName');
    const cities = await Lead.distinct('city');

    res.json({
      success: true,
      count: leads.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      categories,
      cities,
      leads
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single lead by ID
// @route   GET /api/leads/:id
// @access  Private
const getLeadById = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name email');
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    res.json({ success: true, lead });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new manual lead
// @route   POST /api/leads
// @access  Private
const createLead = async (req, res, next) => {
  try {
    const leadData = req.body;

    // Fetch sender info from settings for personalization
    const settings = await Settings.findOne();
    const customSender = settings
      ? {
          senderName: settings.senderName,
          senderTitle: settings.designation,
          senderCompany: settings.companyName,
          senderPhone: settings.phone,
          senderEmail: settings.email,
          senderWebsite: settings.website
        }
      : {};

    // Auto-generate messages for manual lead
    const generated = generateLeadMessages(leadData, customSender);

    const lead = new Lead({
      ...leadData,
      generatedWhatsAppMessage: leadData.generatedWhatsAppMessage || generated.generatedWhatsAppMessage,
      generatedEmailSubject: leadData.generatedEmailSubject || generated.generatedEmailSubject,
      generatedEmailBody: leadData.generatedEmailBody || generated.generatedEmailBody,
      leadStatus: leadData.leadStatus || 'MESSAGE_READY'
    });

    await lead.save();

    await logAudit({
      user: req.user?._id,
      action: 'LEAD_CREATED',
      leadId: lead._id,
      details: `Created lead "${lead.title}" (${lead.categoryName})`
    });

    res.status(201).json({ success: true, lead });
  } catch (error) {
    next(error);
  }
};

// @desc    Update an existing lead
// @route   PUT /api/leads/:id
// @access  Private
const updateLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    Object.assign(lead, req.body);
    await lead.save();

    await logAudit({
      user: req.user?._id,
      action: 'LEAD_UPDATED',
      leadId: lead._id,
      details: `Updated lead details for "${lead.title}"`
    });

    res.json({ success: true, lead });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a lead
// @route   DELETE /api/leads/:id
// @access  Private
const deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    await lead.deleteOne();

    await logAudit({
      user: req.user?._id,
      action: 'LEAD_DELETED',
      leadId: req.params.id,
      details: `Deleted lead "${lead.title}"`
    });

    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk delete leads
// @route   POST /api/leads/bulk-delete
// @access  Private
const bulkDeleteLeads = async (req, res, next) => {
  try {
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of lead IDs' });
    }

    const result = await Lead.deleteMany({ _id: { $in: leadIds } });

    await logAudit({
      user: req.user?._id,
      action: 'LEADS_BULK_DELETED',
      details: `Deleted ${result.deletedCount} leads`
    });

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} leads`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Step 1: Upload Excel/CSV & get Preview stats
// @route   POST /api/leads/import/preview
// @access  Private
const previewImportExcel = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel or CSV file' });
    }

    const customMapping = req.body.mapping ? JSON.parse(req.body.mapping) : {};
    const rawData = parseExcelFile(req.file.path);
    const previewData = await previewImport(rawData, customMapping);

    res.json({
      success: true,
      filePath: req.file.path,
      fileName: req.file.originalname,
      preview: previewData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Step 2: Confirm import records into MongoDB & Auto-Generate Messages
// @route   POST /api/leads/import/confirm
// @access  Private
const confirmImportExcel = async (req, res, next) => {
  try {
    const { records, duplicateAction = 'SKIP' } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid records provided for import' });
    }

    const settings = await Settings.findOne();
    const customSender = settings
      ? {
          senderName: settings.senderName,
          senderTitle: settings.designation,
          senderCompany: settings.companyName,
          senderPhone: settings.phone,
          senderEmail: settings.email,
          senderWebsite: settings.website
        }
      : {};

    const importResult = await commitImport(records, customSender, duplicateAction);

    await logAudit({
      user: req.user?._id,
      action: 'EXCEL_IMPORTED',
      details: `Imported ${importResult.importedCount} new leads, updated ${importResult.updatedCount}, skipped ${importResult.skippedCount}`
    });

    res.status(201).json({
      success: true,
      message: `Import complete! ${importResult.importedCount} new leads imported and messages generated.`,
      result: importResult
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update generated messages for a lead
// @route   PUT /api/leads/:id/message
// @access  Private
const updateLeadMessage = async (req, res, next) => {
  try {
    const { generatedWhatsAppMessage, generatedEmailSubject, generatedEmailBody } = req.body;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    if (generatedWhatsAppMessage !== undefined) lead.generatedWhatsAppMessage = generatedWhatsAppMessage;
    if (generatedEmailSubject !== undefined) lead.generatedEmailSubject = generatedEmailSubject;
    if (generatedEmailBody !== undefined) lead.generatedEmailBody = generatedEmailBody;

    await lead.save();

    await logAudit({
      user: req.user?._id,
      action: 'MESSAGE_EDITED',
      leadId: lead._id,
      details: `Edited generated messages for "${lead.title}"`
    });

    res.json({ success: true, lead });
  } catch (error) {
    next(error);
  }
};

// @desc    Regenerate personalized message for a lead
// @route   POST /api/leads/:id/regenerate-message
// @access  Private
const regenerateLeadMessage = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const settings = await Settings.findOne();
    const customSender = settings
      ? {
          senderName: settings.senderName,
          senderTitle: settings.designation,
          senderCompany: settings.companyName,
          senderPhone: settings.phone,
          senderEmail: settings.email,
          senderWebsite: settings.website
        }
      : {};

    const generated = generateLeadMessages(lead, customSender);
    lead.generatedWhatsAppMessage = generated.generatedWhatsAppMessage;
    lead.generatedEmailSubject = generated.generatedEmailSubject;
    lead.generatedEmailBody = generated.generatedEmailBody;

    await lead.save();

    await logAudit({
      user: req.user?._id,
      action: 'MESSAGE_REGENERATED',
      leadId: lead._id,
      details: `Regenerated personalized message for "${lead.title}"`
    });

    res.json({ success: true, lead });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  bulkDeleteLeads,
  previewImportExcel,
  confirmImportExcel,
  updateLeadMessage,
  regenerateLeadMessage
};
