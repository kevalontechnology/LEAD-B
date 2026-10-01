const axios = require('axios');

const normalizePhoneNumber = (value) => {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: 'Recipient phone number is missing.' };
  }

  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return { valid: false, error: 'Recipient phone number is missing.' };
  }

  if (digits.length === 10) {
    return { valid: true, normalized: `91${digits}` };
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return { valid: true, normalized: digits };
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return { valid: true, normalized: `91${digits.slice(1)}` };
  }

  return {
    valid: false,
    error: 'Phone number is invalid for WhatsApp delivery. Use a valid 10-digit Indian mobile number.'
  };
};

const buildWhatsPortalPayload = ({ name, phone, requestType, referenceId, status, date }) => {
  const phoneInfo = normalizePhoneNumber(phone);

  if (!phoneInfo.valid) {
    throw new Error(phoneInfo.error);
  }

  return {
    event_type: 'admin_notification',
    customer: {
      name: String(name || 'Customer'),
      phone: phoneInfo.normalized
    },
    notification: {
      type: String(requestType || 'LEAD'),
      reference_id: String(referenceId || 'N/A'),
      status: String(status || 'UPDATED'),
      date: date || new Date().toISOString()
    }
  };
};

const sendWhatsPortalNotification = async (data = {}) => {
  const webhookUrl = process.env.WHATSPORTAL_WEBHOOK_URL;
  const webhookToken = process.env.WHATSPORTAL_WEBHOOK_TOKEN;

  if (!webhookUrl) {
    const error = 'WhatsPortal webhook URL is not configured.';
    console.error('[WhatsPortal] Notification failed:', { code: 'missing_webhook_url', message: error });
    return { success: false, code: 'missing_webhook_url', message: error };
  }

  if (!webhookToken) {
    const error = 'WhatsPortal webhook token is not configured.';
    console.error('[WhatsPortal] Notification failed:', { code: 'missing_webhook_token', message: error });
    return { success: false, code: 'missing_webhook_token', message: error };
  }

  let payload;
  try {
    payload = buildWhatsPortalPayload(data);
  } catch (error) {
    console.error('[WhatsPortal] Notification validation failed:', {
      code: 'invalid_phone',
      referenceId: data.referenceId || 'N/A',
      phoneLast4: String(data.phone || '').replace(/\D/g, '').slice(-4) || 'N/A',
      message: error.message
    });

    return {
      success: false,
      code: 'invalid_phone',
      message: error.message
    };
  }

  const phoneLast4 = payload.customer.phone.slice(-4);
  const referenceId = payload.notification.reference_id;

  try {
    console.log('[WhatsPortal] Sending notification', {
      referenceId,
      type: payload.notification.type,
      phoneLast4,
      status: payload.notification.status
    });

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'x-api-key': webhookToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.status >= 200 && response.status < 300) {
      console.log('[WhatsPortal] Notification accepted', {
        referenceId,
        type: payload.notification.type,
        phoneLast4,
        status: payload.notification.status,
        httpStatus: response.status
      });

      return {
        success: true,
        httpStatus: response.status,
        messageId: response.data?.id || response.data?.messageId || response.data?._id || null,
        responseData: response.data || null
      };
    }

    const failureMessage = response.data?.message || `WhatsPortal returned HTTP ${response.status}`;
    console.error('[WhatsPortal] Notification failed', {
      referenceId,
      type: payload.notification.type,
      phoneLast4,
      httpStatus: response.status,
      message: failureMessage
    });

    return {
      success: false,
      httpStatus: response.status,
      message: failureMessage
    };
  } catch (error) {
    const statusCode = error.response?.status || 0;
    const message = error.response?.data?.message || error.message || 'Network error while sending WhatsPortal notification';

    console.error('[WhatsPortal] Notification failed', {
      referenceId,
      type: payload.notification.type,
      phoneLast4,
      httpStatus: statusCode,
      message
    });

    return {
      success: false,
      httpStatus: statusCode,
      message
    };
  }
};

const sendWhatsPortalDirectMessage = async ({ phone, message, apiKey, apiBaseUrl }) => {
  const phoneInfo = normalizePhoneNumber(phone);
  if (!phoneInfo.valid) {
    return { success: false, error: phoneInfo.error };
  }

  const token = apiKey || process.env.WHATSPORTAL_API_KEY || 'wp_live_7gorCETjlPx2m05s6DJxDXozUPyX56Jg049D2l';
  const baseUrl = (apiBaseUrl || process.env.WHATSPORTAL_API_BASE_URL || 'https://app.whatsportal.io/api').replace(/\/+$/, '');

  const endpoints = [
    `${baseUrl}/v1/messages/send`,
    `${baseUrl}/messages/send`,
    `${baseUrl}/messages`,
    `https://app.whatsportal.io/api/v1/messages/send`
  ];

  const payload = {
    phone: phoneInfo.normalized,
    recipient: phoneInfo.normalized,
    to: phoneInfo.normalized,
    message: message,
    text: message,
    body: message
  };

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      console.log(`[WhatsPortal Direct API] Attempting send to ${endpoint}...`);
      const response = await axios.post(endpoint, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status >= 200 && response.status < 300) {
        console.log(`[WhatsPortal Direct API] Success via ${endpoint}:`, response.data);
        return {
          success: true,
          endpoint,
          responseData: response.data,
          messageId: response.data?.id || response.data?.messageId || response.data?.data?.id || null
        };
      }
    } catch (err) {
      lastError = err.response?.data?.message || err.message;
      console.error(`[WhatsPortal Direct API Error] ${endpoint}:`, lastError);
    }
  }

  return { success: false, error: lastError || 'Failed to send via WhatsPortal Direct API' };
};

module.exports = {
  normalizePhoneNumber,
  buildWhatsPortalPayload,
  sendWhatsPortalNotification,
  sendWhatsPortalDirectMessage
};
