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
      default: 'Varun'
    },
    designation: {
      type: String,
      default: 'Sales Executive'
    },
    // Brevo (Sendinblue) Email Settings
    brevoApiKey: {
      type: String,
      default: ''
    },
    brevoSenderEmail: {
      type: String,
      default: 'sales@kevalontechnology.in'
    },
    brevoSenderName: {
      type: String,
      default: 'Varun | Kevalon Technology'
    },
    brevoTemplateId: {
      type: Number,
      default: 0
    },
    // Legacy / Nodemailer SMTP Settings
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
      default: '285349974658896'
    },
    whatsappBusinessAccountId: {
      type: String,
      default: '250264581511046'
    },
    whatsappApiVersion: {
      type: String,
      default: 'v18.0'
    },
    whatsappPublicKey: {
      type: String,
      default: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArmSoi1aNB5EE9NDoNcNB
ZmVhGzUFxNcgdMK/bFmKx+BbsBT0nWIbQULHHldHnxjUDMkd+NZSkgmReiiB5BRA
FKiIqNzkFrd1Movb+OnbYPoT9g6cvNMBc9nnPDKc6aep4+TKc9nT6bQ20XIoE64R
5Ps/U2JPjhKAeYtBvUN7HmZUvfH2F5GuvnR45zt/oNC28H3h7MBZR/HcSKNSmef/
fqJ7u3ICKhLg1uuIXvlIyqPh1LrZRVPKnVdE1T6hcsEcOL6po8wQObmbxl8Vjjk2
uCSmIjSlkKN4W1QTq+b/icYORytWGgb9TEUHv+6D7JaQGgvfc+gx6Z0aJTPh4FMn
RwIDAQAB
-----END PUBLIC KEY-----`
    },
    whatsportalApiKey: {
      type: String,
      default: 'wp_live_7gorCETjlPx2m05s6DJxDXozUPyX56Jg049D2l'
    },
    whatsportalApiBaseUrl: {
      type: String,
      default: 'https://app.whatsportal.io/api'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
