const AuditLog = require('../models/AuditLog');

const logAudit = async ({ user, action, leadId, details, metadata = {} }) => {
  try {
    const log = new AuditLog({
      user: user || null,
      action,
      leadId: leadId || null,
      details: details || '',
      metadata,
      timestamp: new Date()
    });
    await log.save();
    return log;
  } catch (error) {
    console.error('[Audit Log Error]', error.message);
  }
};

module.exports = { logAudit };
