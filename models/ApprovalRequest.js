const mongoose = require('mongoose');

const approvalRequestSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true
    },
    leadTitle: {
      type: String,
      default: ''
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    requestedByName: {
      type: String,
      default: 'Sales Person'
    },
    actionType: {
      type: String,
      enum: ['UPDATE', 'DELETE'],
      default: 'UPDATE'
    },
    proposedChanges: {
      type: Object,
      required: true
    },
    originalData: {
      type: Object,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedByName: {
      type: String,
      default: ''
    },
    reviewedAt: Date,
    rejectionReason: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ApprovalRequest', approvalRequestSchema);
