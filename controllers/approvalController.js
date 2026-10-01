const ApprovalRequest = require('../models/ApprovalRequest');
const Lead = require('../models/Lead');
const { logAudit } = require('../services/auditLogService');

// @desc    Get all pending edit approval requests
// @route   GET /api/approvals/pending
// @access  Private (Admin / Manager)
const getPendingApprovals = async (req, res, next) => {
  try {
    const requests = await ApprovalRequest.find({ status: 'PENDING' })
      .populate('requestedBy', 'name email role')
      .populate('leadId', 'title phone email categoryName city')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: requests.length, requests });
  } catch (error) {
    next(error);
  }
};

// @desc    Get count of pending approval requests for Admin badge
// @route   GET /api/approvals/count
// @access  Private
const getPendingApprovalsCount = async (req, res, next) => {
  try {
    const count = await ApprovalRequest.countDocuments({ status: 'PENDING' });
    res.json({ success: true, count });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve a pending lead edit request
// @route   POST /api/approvals/:id/approve
// @access  Private (Admin / Manager)
const approveEditRequest = async (req, res, next) => {
  try {
    const request = await ApprovalRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Approval request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
    }

    const lead = await Lead.findById(request.leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Associated lead not found' });
    }

    // Apply proposed changes to the actual lead
    Object.assign(lead, request.proposedChanges);
    await lead.save();

    // Mark request as APPROVED
    request.status = 'APPROVED';
    request.reviewedBy = req.user?._id;
    request.reviewedByName = req.user?.name || 'Admin';
    request.reviewedAt = new Date();
    await request.save();

    await logAudit({
      user: req.user?._id,
      action: 'LEAD_EDIT_APPROVED',
      leadId: lead._id,
      details: `Admin approved edit request submitted by ${request.requestedByName} for lead "${lead.title}"`
    });

    res.json({
      success: true,
      message: `Edit request for "${lead.title}" approved successfully. Lead data updated.`,
      lead,
      request
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a pending lead edit request
// @route   POST /api/approvals/:id/reject
// @access  Private (Admin / Manager)
const rejectEditRequest = async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;
    const request = await ApprovalRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Approval request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
    }

    request.status = 'REJECTED';
    request.reviewedBy = req.user?._id;
    request.reviewedByName = req.user?.name || 'Admin';
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason || 'Rejected by Admin';
    await request.save();

    await logAudit({
      user: req.user?._id,
      action: 'LEAD_EDIT_REJECTED',
      leadId: request.leadId,
      details: `Admin rejected edit request for "${request.leadTitle}" by ${request.requestedByName}. Reason: ${request.rejectionReason}`
    });

    res.json({
      success: true,
      message: `Edit request for "${request.leadTitle}" rejected. Lead data remains unchanged.`,
      request
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingApprovals,
  getPendingApprovalsCount,
  approveEditRequest,
  rejectEditRequest
};
