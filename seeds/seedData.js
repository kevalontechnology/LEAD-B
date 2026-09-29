const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Settings = require('../models/Settings');
const MessageTemplate = require('../models/MessageTemplate');
const Lead = require('../models/Lead');
const { generateLeadMessages } = require('../services/messageGeneratorService');

const sampleLeads = [
  {
    Title: 'Excellent Publicity',
    CategoryName: 'Advertising Agency',
    Phone: '07600623456',
    Address: 'S.G. Highway',
    City: 'Ahmedabad',
    State: 'Gujarat',
    Website: 'excellentpublicity.com',
    Email: 'archita@excellentpublicity.com'
  },
  {
    Title: 'Patel Publicity',
    CategoryName: 'Outdoor Advertising',
    Phone: '09825012345',
    Address: 'C.G. Road',
    City: 'Ahmedabad',
    State: 'Gujarat',
    Website: 'patelpublicity.com',
    Email: 'info@patelpublicity.com'
  },
  {
    Title: 'Mark Honest Digital Solution',
    CategoryName: 'Digital Marketing',
    Phone: '09909988776',
    Address: 'Varachha Road',
    City: 'Surat',
    State: 'Gujarat',
    Website: 'markhonest.in',
    Email: 'contact@markhonest.in'
  },
  {
    Title: '2BRAINS Creative Studio',
    CategoryName: 'Branding & Graphic Design',
    Phone: '09898911223',
    Address: 'Alkapuri',
    City: 'Vadodara',
    State: 'Gujarat',
    Website: '2brains.co.in',
    Email: 'hello@2brains.co.in'
  },
  {
    Title: 'Dev Opus Technology',
    CategoryName: 'Web Development & IT',
    Phone: '07940001122',
    Address: 'Prahlad Nagar',
    City: 'Ahmedabad',
    State: 'Gujarat',
    Website: 'devopus.com',
    Email: 'sales@devopus.com'
  }
];

const seed = async () => {
  // 1. Generate Sample Excel File regardless of DB state
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const worksheet = xlsx.utils.json_to_sheet(sampleLeads);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Leads');

  const excelPath = path.join(uploadsDir, 'sample_kevalon_leads.xlsx');
  xlsx.writeFile(workbook, excelPath);
  console.log(`[Seed] Sample Excel file generated at: ${excelPath}`);

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kevalon_crm';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log('[Seed] Connected to MongoDB');

    // Seed Admin User
    const adminEmail = 'admin@kevalontechnology.in';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        name: 'Harsh Kothari',
        email: adminEmail,
        password: 'Admin@123456',
        role: 'ADMIN',
        phone: '+91 90810 12218'
      });
      console.log(`[Seed] Admin user created: ${adminEmail} (Password: Admin@123456)`);
    } else {
      console.log(`[Seed] Admin user already exists: ${adminEmail}`);
    }

    // Seed Settings
    let settings = await Settings.findOne();
    if (!settings) {
      await Settings.create({
        companyName: 'Kevalon Technology',
        website: 'www.kevalontechnology.in',
        email: 'sales@kevalontechnology.in',
        phone: '+91 90810 12218',
        senderName: 'Harsh Kothari',
        designation: 'CEO & Founder'
      });
      console.log('[Seed] System settings initialized');
    }

    // Seed initial leads if empty
    const leadCount = await Lead.countDocuments();
    if (leadCount === 0) {
      for (const item of sampleLeads) {
        const msgs = generateLeadMessages({
          title: item.Title,
          categoryName: item.CategoryName,
          contactPerson: item.Title,
          phone: item.Phone,
          email: item.Email,
          website: item.Website,
          city: item.City
        });

        await Lead.create({
          title: item.Title,
          categoryName: item.CategoryName,
          phone: item.Phone,
          address: item.Address,
          city: item.City,
          state: item.State,
          website: item.Website,
          email: item.Email,
          source: 'Excel Import (Sample)',
          generatedWhatsAppMessage: msgs.generatedWhatsAppMessage,
          generatedEmailSubject: msgs.generatedEmailSubject,
          generatedEmailBody: msgs.generatedEmailBody,
          leadStatus: 'MESSAGE_READY',
          whatsappStatus: 'NOT_SENT',
          emailStatus: 'NOT_SENT'
        });
      }
      console.log(`[Seed] ${sampleLeads.length} sample leads imported and messages generated`);
    }

    console.log('[Seed] Seeding process complete.');
    process.exit(0);
  } catch (err) {
    console.warn('[Seed Notice] MongoDB connection skipped or failed:', err.message);
    console.log('[Seed Notice] Sample Excel file was generated successfully at server/uploads/sample_kevalon_leads.xlsx');
    process.exit(0);
  }
};

seed();
