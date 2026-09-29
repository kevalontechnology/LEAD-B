const xlsx = require('xlsx');
const Lead = require('../models/Lead');
const { generateLeadMessages } = require('./messageGeneratorService');

const DEFAULT_COLUMN_MAPPING = {
  Title: 'title',
  'Company Name': 'title',
  Company: 'title',
  TitleName: 'title',
  CategoryName: 'categoryName',
  Category: 'categoryName',
  Phone: 'phone',
  Mobile: 'phone',
  Contact: 'phone',
  'Phone Number': 'phone',
  Address: 'address',
  City: 'city',
  State: 'state',
  Website: 'website',
  URL: 'website',
  Email: 'email',
  'Email Address': 'email',
  'Contact Person': 'contactPerson',
  Name: 'contactPerson'
};

const normalizeValue = (val) => (val ? String(val).trim() : '');

const isValidEmail = (email) => {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const isValidPhone = (phone) => {
  if (!phone) return false;
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
};

/**
 * Parses uploaded Excel/CSV file buffer or filepath
 */
const parseExcelFile = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  return rawData;
};

/**
 * Previews import data before committing to DB
 */
const previewImport = async (rawData, customMapping = {}) => {
  const mapping = { ...DEFAULT_COLUMN_MAPPING, ...customMapping };
  
  const mappedRecords = rawData.map((row, index) => {
    const record = { originalRowIndex: index + 1, tags: ['Excel Import'] };
    
    Object.keys(row).forEach((colHeader) => {
      const cleanHeader = colHeader.trim();
      const mappedField = mapping[cleanHeader] || mapping[colHeader];
      if (mappedField) {
        record[mappedField] = normalizeValue(row[colHeader]);
      }
    });

    if (!record.title && row.Title) record.title = normalizeValue(row.Title);
    if (!record.title && row.Company) record.title = normalizeValue(row.Company);
    if (!record.title && row['Company Name']) record.title = normalizeValue(row['Company Name']);

    return record;
  });

  const previewList = [];
  let totalRecords = mappedRecords.length;
  let newCount = 0;
  let duplicateCount = 0;
  let invalidEmailCount = 0;
  let invalidPhoneCount = 0;

  for (const item of mappedRecords) {
    let isInvalidEmail = item.email ? !isValidEmail(item.email) : false;
    let isInvalidPhone = item.phone ? !isValidPhone(item.phone) : false;

    if (isInvalidEmail) invalidEmailCount++;
    if (isInvalidPhone) invalidPhoneCount++;

    // Check duplicate in database
    const queryConditions = [];
    if (item.email && isValidEmail(item.email)) queryConditions.push({ email: item.email.toLowerCase() });
    if (item.phone) queryConditions.push({ phone: item.phone });
    if (item.website) queryConditions.push({ website: item.website.toLowerCase() });

    let existingLead = null;
    if (queryConditions.length > 0) {
      existingLead = await Lead.findOne({ $or: queryConditions });
    }

    const isDuplicate = !!existingLead;
    if (isDuplicate) {
      duplicateCount++;
    } else {
      newCount++;
    }

    previewList.push({
      record: item,
      isDuplicate,
      existingLead: existingLead ? { id: existingLead._id, title: existingLead.title, email: existingLead.email, phone: existingLead.phone } : null,
      duplicateReason: existingLead ? (existingLead.email === item.email ? 'Same Email' : existingLead.phone === item.phone ? 'Same Phone' : 'Same Website') : null,
      isInvalidEmail,
      isInvalidPhone
    });
  }

  return {
    totalRecords,
    newCount,
    duplicateCount,
    invalidEmailCount,
    invalidPhoneCount,
    previewList
  };
};

/**
 * Commit previewed records to DB after user confirms and resolves duplicates
 */
const commitImport = async (recordsToImport, customSender = {}, duplicateAction = 'SKIP') => {
  const importedLeads = [];
  const skippedLeads = [];
  const updatedLeads = [];

  for (const item of recordsToImport) {
    if (!item.title) continue;

    // Check duplicate in DB
    const queryConditions = [];
    if (item.email && isValidEmail(item.email)) queryConditions.push({ email: item.email.toLowerCase() });
    if (item.phone) queryConditions.push({ phone: item.phone });
    if (item.website) queryConditions.push({ website: item.website.toLowerCase() });

    let existingLead = null;
    if (queryConditions.length > 0) {
      existingLead = await Lead.findOne({ $or: queryConditions });
    }

    if (existingLead) {
      if (duplicateAction === 'SKIP') {
        skippedLeads.push(item);
        continue;
      } else if (duplicateAction === 'UPDATE') {
        const generated = generateLeadMessages(item, customSender);
        existingLead.title = item.title || existingLead.title;
        existingLead.categoryName = item.categoryName || existingLead.categoryName;
        existingLead.contactPerson = item.contactPerson || existingLead.contactPerson;
        existingLead.phone = item.phone || existingLead.phone;
        existingLead.email = item.email || existingLead.email;
        existingLead.website = item.website || existingLead.website;
        existingLead.address = item.address || existingLead.address;
        existingLead.city = item.city || existingLead.city;
        existingLead.state = item.state || existingLead.state;
        existingLead.generatedWhatsAppMessage = generated.generatedWhatsAppMessage;
        existingLead.generatedEmailSubject = generated.generatedEmailSubject;
        existingLead.generatedEmailBody = generated.generatedEmailBody;
        existingLead.leadStatus = 'MESSAGE_READY';

        await existingLead.save();
        updatedLeads.push(existingLead);
        continue;
      }
    }

    // Generate Personalized Message automatically upon import
    const generated = generateLeadMessages(item, customSender);

    const newLead = new Lead({
      title: item.title,
      categoryName: item.categoryName || 'General',
      contactPerson: item.contactPerson || '',
      phone: item.phone || '',
      email: item.email || '',
      website: item.website || '',
      address: item.address || '',
      city: item.city || '',
      state: item.state || '',
      source: 'Excel Import',
      tags: ['Excel Import'],
      generatedWhatsAppMessage: generated.generatedWhatsAppMessage,
      generatedEmailSubject: generated.generatedEmailSubject,
      generatedEmailBody: generated.generatedEmailBody,
      leadStatus: 'MESSAGE_READY', // Generated, ready for review
      whatsappStatus: item.phone ? 'NOT_SENT' : 'NOT_AVAILABLE',
      emailStatus: item.email ? 'NOT_SENT' : 'NOT_AVAILABLE'
    });

    await newLead.save();
    importedLeads.push(newLead);
  }

  return {
    importedCount: importedLeads.length,
    updatedCount: updatedLeads.length,
    skippedCount: skippedLeads.length,
    importedLeads
  };
};

module.exports = {
  parseExcelFile,
  previewImport,
  commitImport,
  DEFAULT_COLUMN_MAPPING
};
