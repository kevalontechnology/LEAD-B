const xlsx = require('xlsx');
const Lead = require('../models/Lead');
const { generateLeadMessages } = require('./messageGeneratorService');

const DEFAULT_COLUMN_MAPPING = {
  Title: 'title',
  'Company Name': 'title',
  Company: 'title',
  TitleName: 'title',
  Name: 'title',
  'Business Name': 'title',
  'Company / Title': 'title',
  'Column 1': 'title',
  CategoryName: 'categoryName',
  Category: 'categoryName',
  Industry: 'categoryName',
  Business: 'categoryName',
  'Column 2': 'categoryName',
  Phone: 'phone',
  Mobile: 'phone',
  Contact: 'phone',
  'Phone Number': 'phone',
  'Mobile Number': 'phone',
  'Phone / Address': 'phone',
  'Column 3': 'phone',
  Address: 'address',
  City: 'city',
  Location: 'city',
  State: 'state',
  Website: 'website',
  URL: 'website',
  Domain: 'website',
  Email: 'email',
  'Email Address': 'email',
  'Mail ID': 'email',
  'Contact Person': 'contactPerson',
  Owner: 'contactPerson',
  Manager: 'contactPerson'
};

const normalizeString = (val) => (val !== undefined && val !== null ? String(val).trim() : '');

const isValidEmail = (email) => {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const normalizeEmail = (val) => {
  const str = normalizeString(val).toLowerCase();
  if (isValidEmail(str)) return str;
  return '';
};

const extractCleanPhone = (val) => {
  const str = normalizeString(val);
  if (!str) return '';
  const digits = str.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10); // Standard 10-digit phone
  } else if (digits.length >= 7) {
    return digits;
  }
  return '';
};

const normalizeWebsiteDomain = (val) => {
  let web = normalizeString(val).toLowerCase();
  if (!web || web === 'n/a' || web === 'none' || web === 'null') return '';
  web = web.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
  const genericDomains = [
    'facebook.com',
    'instagram.com',
    'linkedin.com',
    'twitter.com',
    'youtube.com',
    'gmail.com',
    'yahoo.com',
    'google.com',
    'com',
    'in',
    'org'
  ];
  if (genericDomains.includes(web) || web.length < 4 || !web.includes('.')) {
    return '';
  }
  return web;
};

const escapeRegex = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

/**
 * Parses uploaded Excel/CSV file buffer or filepath with smart header detection
 */
const parseExcelFile = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get raw matrix (array of arrays)
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows || rows.length === 0) return [];

  const firstRow = rows[0].map((c) => String(c).trim().toLowerCase());
  const knownHeaders = ['title', 'company', 'company name', 'name', 'category', 'categoryname', 'phone', 'mobile', 'email', 'city', 'address', 'website', 'industry'];
  const hasStandardHeader = firstRow.some((cell) => knownHeaders.includes(cell));

  if (hasStandardHeader) {
    // File has standard header row in Row 1
    return xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
  } else {
    // Headerless file: Generate Col 1, Col 2, Col 3 headers so Row 1 data is preserved
    const objectRows = [];
    rows.forEach((row) => {
      if (row.some((cell) => String(cell).trim() !== '')) {
        const obj = {};
        row.forEach((cellVal, colIdx) => {
          const colName = colIdx === 0 ? 'Company / Title' : colIdx === 1 ? 'Category' : colIdx === 2 ? 'Phone / Address' : `Column ${colIdx + 1}`;
          obj[colName] = String(cellVal).trim();
        });
        objectRows.push(obj);
      }
    });
    return objectRows;
  }
};

/**
 * Previews import data before committing to DB
 */
const previewImport = async (rawData, customMapping = {}) => {
  const mapping = { ...DEFAULT_COLUMN_MAPPING, ...customMapping };
  const detectedHeaders = rawData.length > 0 ? Object.keys(rawData[0]).map((h) => h.trim()) : [];
  
  let totalRows = rawData.length;
  let validRowsCount = 0;
  let invalidRowsCount = 0;
  let newCount = 0;
  let duplicateCount = 0;
  let invalidEmailCount = 0;
  let invalidPhoneCount = 0;

  const previewList = [];

  // Track in-batch duplicates
  const batchEmails = new Set();
  const batchPhones = new Set();
  const batchWebsites = new Set();

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const record = { originalRowIndex: i + 1, tags: ['Excel Import'] };
    
    Object.keys(row).forEach((colHeader) => {
      const cleanHeader = colHeader.trim();
      const mappedField = mapping[cleanHeader] || mapping[colHeader];
      if (mappedField && mappedField !== 'ignore') {
        record[mappedField] = normalizeString(row[colHeader]);
      }
    });

    // Flexible Company Title derivation
    const possibleTitle = record.title || row.Title || row.Company || row['Company Name'] || row.Name || row['Business Name'] || row.TitleName || row['Company / Title'] || row['Column 1'];
    if (possibleTitle) {
      record.title = normalizeString(possibleTitle);
    }

    if (!record.title) {
      invalidRowsCount++;
      previewList.push({
        record,
        isValid: false,
        invalidReason: 'Missing Title / Company Name',
        isDuplicate: false
      });
      continue;
    }

    validRowsCount++;

    const cleanEmail = normalizeEmail(record.email);
    const cleanPhone = extractCleanPhone(record.phone);
    const cleanWeb = normalizeWebsiteDomain(record.website);

    const isEmailValid = record.email ? isValidEmail(normalizeString(record.email).toLowerCase()) : true;
    const isPhoneValid = record.phone ? extractCleanPhone(record.phone).length >= 7 : true;

    if (record.email && !isEmailValid) invalidEmailCount++;
    if (record.phone && !isPhoneValid) invalidPhoneCount++;

    // Construct precise MongoDB query conditions
    const queryConditions = [];
    if (cleanEmail) {
      queryConditions.push({ email: cleanEmail });
    }
    if (cleanPhone) {
      queryConditions.push({ phone: { $regex: `${escapeRegex(cleanPhone)}$` } });
    }
    if (cleanWeb) {
      queryConditions.push({ website: { $regex: escapeRegex(cleanWeb), $options: 'i' } });
    }

    let existingLead = null;
    if (queryConditions.length > 0) {
      existingLead = await Lead.findOne({ $or: queryConditions });
    }

    // Check in-batch duplicates
    const inBatchDup =
      (cleanEmail && batchEmails.has(cleanEmail)) ||
      (cleanPhone && batchPhones.has(cleanPhone)) ||
      (cleanWeb && batchWebsites.has(cleanWeb));

    const isDuplicate = !!existingLead || inBatchDup;
    if (isDuplicate) {
      duplicateCount++;
    } else {
      newCount++;
    }

    if (cleanEmail) batchEmails.add(cleanEmail);
    if (cleanPhone) batchPhones.add(cleanPhone);
    if (cleanWeb) batchWebsites.add(cleanWeb);

    previewList.push({
      record,
      isValid: true,
      isDuplicate,
      existingLead: existingLead ? { id: existingLead._id, title: existingLead.title, email: existingLead.email, phone: existingLead.phone } : null,
      duplicateReason: existingLead
        ? (existingLead.email === cleanEmail ? 'Same Email' : existingLead.phone === record.phone ? 'Same Phone' : 'Same Website')
        : (inBatchDup ? 'Duplicate in current Excel batch' : null)
    });
  }

  return {
    totalRows,
    validRows: validRowsCount,
    invalidRows: invalidRowsCount,
    newCount,
    duplicateCount,
    invalidEmailCount,
    invalidPhoneCount,
    detectedHeaders,
    previewList
  };
};

/**
 * Commit previewed records to DB after user confirms and resolves duplicates
 */
const commitImport = async (recordsToImport, customSender = {}, duplicateAction = 'SKIP') => {
  let totalRows = recordsToImport.length;
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  const importedLeads = [];
  const updatedLeads = [];
  const skippedLeads = [];

  // Track in-batch created keys
  const batchEmails = new Set();
  const batchPhones = new Set();
  const batchWebsites = new Set();

  for (const item of recordsToImport) {
    const leadTitle = item.title || item.Company || item['Company Name'] || item.Title || item.Name || item['Business Name'] || item['Company / Title'] || item['Column 1'];
    if (!leadTitle || !normalizeString(leadTitle)) {
      invalidCount++;
      skippedLeads.push(item);
      continue;
    }

    item.title = normalizeString(leadTitle);
    const cleanEmail = normalizeEmail(item.email);
    const cleanPhone = extractCleanPhone(item.phone);
    const cleanWeb = normalizeWebsiteDomain(item.website);

    // Check existing lead in DB
    const queryConditions = [];
    if (cleanEmail) {
      queryConditions.push({ email: cleanEmail });
    }
    if (cleanPhone) {
      queryConditions.push({ phone: { $regex: `${escapeRegex(cleanPhone)}$` } });
    }
    if (cleanWeb) {
      queryConditions.push({ website: { $regex: escapeRegex(cleanWeb), $options: 'i' } });
    }

    let existingLead = null;
    if (queryConditions.length > 0) {
      existingLead = await Lead.findOne({ $or: queryConditions });
    }

    const inBatchDup =
      (cleanEmail && batchEmails.has(cleanEmail)) ||
      (cleanPhone && batchPhones.has(cleanPhone)) ||
      (cleanWeb && batchWebsites.has(cleanWeb));

    if (existingLead || inBatchDup) {
      duplicateCount++;
      if (duplicateAction === 'SKIP') {
        skippedCount++;
        skippedLeads.push(item);
        continue;
      } else if (duplicateAction === 'UPDATE' && existingLead) {
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
        updatedCount++;
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
      leadStatus: 'MESSAGE_READY',
      whatsappStatus: item.phone ? 'NOT_SENT' : 'NOT_AVAILABLE',
      emailStatus: item.email ? 'NOT_SENT' : 'NOT_AVAILABLE'
    });

    await newLead.save();
    createdCount++;
    importedLeads.push(newLead);

    if (cleanEmail) batchEmails.add(cleanEmail);
    if (cleanPhone) batchPhones.add(cleanPhone);
    if (cleanWeb) batchWebsites.add(cleanWeb);
  }

  // Calculate actual total directly from MongoDB after all ops complete
  const databaseTotal = await Lead.countDocuments();

  return {
    importSummary: {
      totalRows,
      validRows: totalRows - invalidCount,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      invalid: invalidCount,
      duplicates: duplicateCount
    },
    databaseTotal,
    importedLeads
  };
};

module.exports = {
  parseExcelFile,
  previewImport,
  commitImport,
  DEFAULT_COLUMN_MAPPING
};
