const Lead = require('../models/Lead');
const Settings = require('../models/Settings');
const ApprovalRequest = require('../models/ApprovalRequest');
const { parseExcelFile, previewImport, commitImport } = require('../services/excelService');
const { generateLeadMessages } = require('../services/messageGeneratorService');
const { logAudit } = require('../services/auditLogService');
const fs = require('fs');

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

    // Search query across title, phone, email, city, categoryName, contactPerson, address
    if (search) {
      const escapeRegex = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const cleanSearch = escapeRegex(search.trim());
      query.$or = [
        { title: { $regex: cleanSearch, $options: 'i' } },
        { phone: { $regex: cleanSearch, $options: 'i' } },
        { email: { $regex: cleanSearch, $options: 'i' } },
        { city: { $regex: cleanSearch, $options: 'i' } },
        { categoryName: { $regex: cleanSearch, $options: 'i' } },
        { contactPerson: { $regex: cleanSearch, $options: 'i' } },
        { address: { $regex: cleanSearch, $options: 'i' } }
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
        case 'HAS_MOBILE':
          query.phone = { $exists: true, $ne: null, $ne: '' };
          break;
        case 'HAS_EMAIL':
          query.email = { $exists: true, $ne: null, $ne: '' };
          break;
        case 'HAS_BOTH':
          query.phone = { $exists: true, $ne: null, $ne: '' };
          query.email = { $exists: true, $ne: null, $ne: '' };
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

    // Calculate actual count directly from MongoDB
    const total = await Lead.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum) || 1;

    // Fetch distinct categories and cities for dropdown filters
    const categories = await Lead.distinct('categoryName');
    const cities = await Lead.distinct('city');

    res.json({
      success: true,
      count: leads.length,
      total,
      page: pageNum,
      pages: totalPages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      },
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

    // Check if logged-in user is SALES role
    const isSalesRole = req.user && req.user.role === 'SALES';

    if (isSalesRole) {
      // Sales person CANNOT directly edit the lead in DB. Create pending approval request.
      const approval = await ApprovalRequest.create({
        leadId: lead._id,
        leadTitle: lead.title || 'Untitled Lead',
        requestedBy: req.user._id,
        requestedByName: req.user.name || 'Sales Person',
        actionType: 'UPDATE',
        proposedChanges: req.body,
        originalData: lead.toObject()
      });

      await logAudit({
        user: req.user._id,
        action: 'LEAD_EDIT_REQUESTED',
        leadId: lead._id,
        details: `Sales user ${req.user.name} submitted an edit request for "${lead.title}". Awaiting Admin Approval.`
      });

      return res.json({
        success: true,
        pendingApproval: true,
        approvalId: approval._id,
        message: 'Your edit request has been submitted for Admin approval. Changes will be applied after Admin approves.'
      });
    }

    // Admin / Manager directly updates lead
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
    if (req.user && req.user.role === 'SALES') {
      return res.status(403).json({
        success: false,
        message: 'Sales role is not authorized to delete leads. Only Admin can delete.'
      });
    }

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
    if (req.user && req.user.role === 'SALES') {
      return res.status(403).json({
        success: false,
        message: 'Sales role is not authorized to bulk delete leads. Only Admin can delete.'
      });
    }

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

// @desc    Step 1: Upload Excel/CSV & get Preview stats (Single or Multiple Files)
// @route   POST /api/leads/import/preview
// @access  Private
const previewImportExcel = async (req, res, next) => {
  try {
    const uploadedFiles = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'Please upload at least one Excel or CSV file' });
    }

    const customMapping = req.body.mapping ? JSON.parse(req.body.mapping) : {};

    let allRawData = [];
    const fileNames = [];

    for (const file of uploadedFiles) {
      fileNames.push(file.originalname);
      const fileRows = parseExcelFile(file.path);
      fileRows.forEach((row) => {
        row._sourceFile = file.originalname;
      });
      allRawData = allRawData.concat(fileRows);
    }

    const previewData = await previewImport(allRawData, customMapping);

    // Clean up temporary files from disk after parsing
    uploadedFiles.forEach((file) => {
      fs.unlink(file.path, (err) => {
        if (err) console.error(`Error deleting temp file ${file.path}:`, err);
      });
    });

    res.json({
      success: true,
      fileCount: uploadedFiles.length,
      fileNames,
      fileName: fileNames.join(', '),
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
    const { records, duplicateAction = 'SKIP', senderPersona = 'CEO' } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid records provided for import' });
    }

    const settings = await Settings.findOne();
    const customSender = {
      senderPersona,
      ...(settings
        ? {
            senderCompany: settings.companyName,
            senderPhone: settings.phone,
            senderEmail: settings.email,
            senderWebsite: settings.website
          }
        : {})
    };

    const commitResult = await commitImport(records, customSender, duplicateAction);
    const databaseTotal = await Lead.countDocuments();

    await logAudit({
      user: req.user?._id,
      action: 'EXCEL_IMPORTED',
      details: `Imported ${commitResult.importSummary.created} new leads, updated ${commitResult.importSummary.updated}, skipped ${commitResult.importSummary.skipped}. Database Total: ${databaseTotal}`
    });

    res.status(201).json({
      success: true,
      message: `Import complete! ${commitResult.importSummary.created} new leads created. Database Total: ${databaseTotal}`,
      importSummary: commitResult.importSummary,
      databaseTotal,
      result: {
        importedCount: commitResult.importSummary.created,
        updatedCount: commitResult.importSummary.updated,
        skippedCount: commitResult.importSummary.skipped,
        importedLeads: commitResult.importedLeads
      }
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

    const { senderPersona } = req.body;
    const settings = await Settings.findOne();
    const customSender = {
      senderPersona: senderPersona || (settings ? settings.senderName : 'CEO'),
      ...(settings
        ? {
            senderCompany: settings.companyName,
            senderPhone: settings.phone,
            senderEmail: settings.email,
            senderWebsite: settings.website
          }
        : {})
    };

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
