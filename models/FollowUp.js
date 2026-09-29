const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true
    },
    followUpDate: {
      type: Date,
      required: true
    },
    followUpTime: {
      type: String,
      default: '10:00'
    },
    channel: {
      type: String,
      enum: ['WHATSAPP', 'EMAIL', 'CALL', 'MEETING', 'OTHER'],
      default: 'WHATSAPP'
    },
    followUpMessage: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('FollowUp', followUpSchema);
