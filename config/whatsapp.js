module.exports = {
  getWhatsAppConfig: (dbSettings) => {
    return {
      accessToken: dbSettings?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: dbSettings?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: dbSettings?.whatsappBusinessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      apiVersion: dbSettings?.whatsappApiVersion || process.env.WHATSAPP_API_VERSION || 'v18.0',
      baseUrl: 'https://graph.facebook.com'
    };
  }
};
