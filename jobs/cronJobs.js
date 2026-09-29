const cron = require('node-cron');
const FollowUp = require('../models/FollowUp');

const initCronJobs = () => {
  // Check for overdue follow-ups daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    try {
      console.log('[Cron Job] Checking for overdue follow-ups...');
      const now = new Date();
      const count = await FollowUp.countDocuments({
        followUpDate: { $lt: now },
        status: 'PENDING'
      });
      console.log(`[Cron Job] Found ${count} overdue follow-ups.`);
    } catch (err) {
      console.error('[Cron Job Error]', err.message);
    }
  });

  console.log('[Cron] Background scheduler initialized.');
};

module.exports = initCronJobs;
