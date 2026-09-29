const mongoose = require('mongoose');

const communicationSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true
    },
    channel: {
      type: String,
      enum: ['EMAIL', 'WHATSAPP', 'CALL', 'MANUAL'],
      required: true
    },
    direction: {
      type: String,
      enum: ['OUTBOUND', 'INBOUND'],
      default: 'OUTBOUND'
    },
    subject: {
      type: String,
      default: ''
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      default: 'SENT'
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    deliveredAt: Date,
    readAt: Date,
    repliedAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Communication', communicationSchema);
