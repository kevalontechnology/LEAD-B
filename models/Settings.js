const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      default: 'Kevalon Technology'
    },
    website: {
      type: String,
      default: 'www.kevalontechnology.in'
    },
    email: {
      type: String,
      default: 'sales@kevalontechnology.in'
    },
    phone: {
      type: String,
      default: '+91 90810 12218'
    },
    senderName: {
      type: String,
      default: 'Harsh Kothari'
    },
    designation: {
      type: String,
      default: 'CEO & Founder'
    },
    // SMTP Settings
    smtpHost: {
      type: String,
      default: ''
    },
    smtpPort: {
      type: Number,
      default: 587
    },
    smtpUsername: {
      type: String,
      default: ''
    },
    smtpPassword: {
      type: String,
      default: ''
    },
    smtpFromName: {
      type: String,
      default: 'Kevalon Technology Sales'
    },
    smtpFromEmail: {
      type: String,
      default: 'sales@kevalontechnology.in'
    },
    // WhatsApp Cloud API Settings
    whatsappAccessToken: {
      type: String,
      default: ''
    },
    whatsappPhoneNumberId: {
      type: String,
      default: ''
    },
    whatsappBusinessAccountId: {
      type: String,
      default: ''
    },
    whatsappApiVersion: {
      type: String,
      default: 'v18.0'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
