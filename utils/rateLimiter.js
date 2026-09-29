/**
  Rate Limiter Helper for Bulk Outreach
  Ensures requests are sent sequentially with controlled delay.
 */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const processBulkQueue = async (items, asyncWorker, delayMs = 600) => {
  const results = [];

  for (const item of items) {
    try {
      const result = await asyncWorker(item);
      results.push({ item, success: true, result });
    } catch (error) {
      results.push({ item, success: false, error: error.message });
    }
    if (delayMs > 0) {
      await delay(delayMs);
    }
  }

  return results;
};

module.exports = { processBulkQueue, delay };
