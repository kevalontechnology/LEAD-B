const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title / Company Name is required'],
      trim: true
    },
    categoryName: {
      type: String,
      default: 'General',
      trim: true
    },
    contactPerson: {
      type: String,
      default: '',
      trim: true
    },
    phone: {
      type: String,
      default: '',
      trim: true
    },
    email: {
      type: String,
      default: '',
      lowercase: true,
      trim: true
    },
    website: {
      type: String,
      default: '',
      trim: true
    },
    address: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: '',
      trim: true
    },
    state: {
      type: String,
      default: '',
      trim: true
    },
    source: {
      type: String,
      default: 'Excel Import'
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    generatedWhatsAppMessage: {
      type: String,
      default: ''
    },
    generatedEmailSubject: {
      type: String,
      default: ''
    },
    generatedEmailBody: {
      type: String,
      default: ''
    },
    leadStatus: {
      type: String,
      enum: [
        'NEW',
        'MESSAGE_READY',
        'CONTACTED',
        'FOLLOW_UP',
        'INTERESTED',
        'QUALIFIED',
        'CONVERTED',
        'NOT_INTERESTED',
        'DO_NOT_CONTACT'
      ],
      default: 'NEW'
    },
    whatsappStatus: {
      type: String,
      enum: [
        'NOT_AVAILABLE',
        'NOT_SENT',
        'SENT',
        'DELIVERED',
        'READ',
        'REPLIED',
        'FAILED'
      ],
      default: 'NOT_SENT'
    },
    emailStatus: {
      type: String,
      enum: [
        'NOT_AVAILABLE',
        'NOT_SENT',
        'SENT',
        'DELIVERED',
        'OPENED',
        'REPLIED',
        'FAILED'
      ],
      default: 'NOT_SENT'
    },
    lastContactedAt: {
      type: Date,
      default: null
    },
    nextFollowUpAt: {
      type: Date,
      default: null
    },
    followUpCount: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      default: ''
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

// Indexes for fast searching & filtering
leadSchema.index({ title: 'text', email: 'text', phone: 'text', city: 'text', categoryName: 'text' });
leadSchema.index({ leadStatus: 1, whatsappStatus: 1, emailStatus: 1 });

module.exports = mongoose.model('Lead', leadSchema);
