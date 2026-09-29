const mongoose = require('mongoose');

const messageTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Digital Marketing',
        'Branding',
        'Advertising',
        'IT / Web',
        'General',
        'Follow Up'
      ],
      default: 'General'
    },
    type: {
      type: String,
      enum: ['WHATSAPP', 'EMAIL', 'BOTH'],
      default: 'BOTH'
    },
    whatsappContent: {
      type: String,
      default: ''
    },
    emailSubject: {
      type: String,
      default: ''
    },
    emailBody: {
      type: String,
      default: ''
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('MessageTemplate', messageTemplateSchema);
