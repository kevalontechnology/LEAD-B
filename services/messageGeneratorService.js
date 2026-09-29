const { detectCategoryType, CATEGORY_TYPES } = require('../utils/categoryRules');

const DEFAULT_SENDER = {
  senderName: 'Harsh Kothari',
  senderTitle: 'CEO & Founder',
  senderCompany: 'Kevalon Technology',
  senderPhone: '+91 90810 12218',
  senderEmail: 'sales@kevalontechnology.in',
  senderWebsite: 'www.kevalontechnology.in'
};

/**
 * Replace placeholders like {{companyName}}, {{category}}, etc.
 */
const replaceVariables = (templateStr, data) => {
  let result = templateStr;
  const merged = { ...DEFAULT_SENDER, ...data };

  Object.keys(merged).forEach((key) => {
    const val = merged[key] || '';
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, val);
  });

  return result;
};

/**
 * Generate category-specific WhatsApp and Email messages for a lead
 */
const generateLeadMessages = (lead, customSender = {}) => {
  const sender = { ...DEFAULT_SENDER, ...customSender };
  const company = lead.title || 'Team';
  const contactPerson = lead.contactPerson ? ` ${lead.contactPerson}` : '';
  const greeting = lead.contactPerson
    ? `Hello ${lead.contactPerson},`
    : `Hello ${company} Team,`;

  const cityInfo = lead.city ? ` in ${lead.city}` : '';
  const category = lead.categoryName || 'your industry';
  const categoryType = detectCategoryType(lead.categoryName);

  let whatsappBody = '';
  let emailSubject = '';
  let emailBody = '';

  switch (categoryType) {
    case CATEGORY_TYPES.DIGITAL_MARKETING:
      whatsappBody = `${greeting}

I’m ${sender.senderName}, ${sender.senderTitle} of ${sender.senderCompany}.

I came across ${company}${cityInfo} and wanted to reach out regarding a potential technology delivery partnership.

${sender.senderCompany} collaborates with leading digital marketing & SEO agencies as their backend technology partner for website development, web applications, mobile apps, CRM/ERP, SaaS and AI solutions.

We operate seamlessly as your white-label technical delivery team so your agency can offer end-to-end digital solutions without overheads. We also offer Tapzy – Smart NFC Digital Business Cards for corporate clients.

Would you be open to a quick call this week to explore collaboration opportunities?

Regards,
${sender.senderName}
${sender.senderTitle}
${sender.senderCompany}
${sender.senderWebsite}
${sender.senderEmail}
${sender.senderPhone}`;

      emailSubject = `Technology Delivery Partnership for ${company} - Kevalon Technology`;
      emailBody = `Dear ${lead.contactPerson || company + ' Team'},

I hope this email finds you well.

I am ${sender.senderName}, ${sender.senderTitle} of ${sender.senderCompany}.

I noticed ${company}'s work in ${category}${cityInfo} and wanted to connect regarding a strategic technology partnership.

Many digital marketing agencies partner with ${sender.senderCompany} to handle complex technical execution, enabling them to expand client service offerings without increasing in-house tech overhead.

Our Technical Delivery Capabilities Include:
- Custom Website & Web Application Development
- Native & Cross-Platform Mobile Applications (iOS & Android)
- Enterprise CRM / ERP Customizations & Integrations
- Custom SaaS Architecture & AI Solutions
- White-Label Development Support

We also produce Tapzy – Smart NFC Digital Business Cards, which many of our partner agencies offer to their corporate clients as an innovative branding touchpoint.

If you are open to exploring a mutually beneficial collaboration, I would love to share a short introduction and portfolio.

Best Regards,

${sender.senderName}
${sender.senderTitle} | ${sender.senderCompany}
Website: ${sender.senderWebsite}
Email: ${sender.senderEmail}
Phone: ${sender.senderPhone}`;
      break;

    case CATEGORY_TYPES.BRANDING:
      whatsappBody = `${greeting}

I’m ${sender.senderName}, ${sender.senderTitle} of ${sender.senderCompany}.

I noticed ${company}${cityInfo} and admire your creative & branding output.

${sender.senderCompany} partners with top branding & design studios to turn UI/UX designs into high-performing websites, e-commerce stores, mobile apps, and custom software.

We bring your design vision to life with clean, scalable code. Plus, we offer Tapzy – Smart NFC Digital Business Card, an ideal complement to your branding packages.

If you’re open to exploring a tech partner for upcoming client projects, let’s connect!

Regards,
${sender.senderName}
${sender.senderTitle}
${sender.senderCompany}
${sender.senderWebsite}
${sender.senderEmail}
${sender.senderPhone}`;

      emailSubject = `Branding + Technology Collaboration | ${company} & Kevalon Technology`;
      emailBody = `Dear ${lead.contactPerson || company + ' Team'},

I hope you are having a productive week.

My name is ${sender.senderName}, ${sender.senderTitle} at ${sender.senderCompany}.

I came across ${company} and was impressed by your creative and branding work${cityInfo}.

At ${sender.senderCompany}, we specialize in turning high-concept branding and creative design into fully functional digital products. We work as the technology partner for creative agencies who want to deliver world-class digital experiences without managing internal dev teams.

How We Can Collaborate:
- High-Performance Web Development & E-Commerce Implementations
- Interactive Mobile Applications (iOS/Android)
- Custom Web Software & Web Portals
- Tapzy – Smart NFC Digital Business Cards for corporate client branding

We would be delighted to serve as your technical execution engine. Let me know if you would be open to a 10-minute introductory call.

Warm regards,

${sender.senderName}
${sender.senderTitle} | ${sender.senderCompany}
Website: ${sender.senderWebsite}
Email: ${sender.senderEmail}
Phone: ${sender.senderPhone}`;
      break;

    case CATEGORY_TYPES.ADVERTISING:
      whatsappBody = `${greeting}

I’m ${sender.senderName}, ${sender.senderTitle} of ${sender.senderCompany}.

I came across ${company} and wanted to connect regarding a potential technology collaboration.

${sender.senderCompany} can support agencies with website development, web applications, mobile apps, CRM/ERP, e-commerce, custom software, SaaS and AI solutions.

We can work as a technology delivery partner while your team continues managing the client relationship.

We also have Tapzy – Smart NFC Digital Business Card, which can be offered as an additional solution to your business and corporate clients.

If you’re open to exploring a collaboration, I’d be happy to share our portfolio and a quick introduction.

Regards,
${sender.senderName}
${sender.senderTitle}
${sender.senderCompany}
${sender.senderWebsite}
${sender.senderEmail}
${sender.senderPhone}`;

      emailSubject = `Technology Delivery Partnership for ${company} - Kevalon Technology`;
      emailBody = `Dear ${lead.contactPerson || company + ' Team'},

I hope you are doing well.

I am ${sender.senderName}, ${sender.senderTitle} of ${sender.senderCompany}.

I came across ${company} and wanted to reach out regarding a potential technology delivery collaboration.

${sender.senderCompany} acts as a reliable technology delivery partner for advertising and media agencies across India. While your agency manages client strategy and media, our engineering team handles the complete technical build—from websites and mobile applications to custom CRM/ERP platforms.

Our Collaboration Scope:
- Modern Web Applications & Corporate Websites
- Mobile App Development (iOS / Android)
- Enterprise CRM, ERP & Automation Dashboards
- Tapzy – Smart NFC Digital Business Cards for corporate clients

We offer flexible engagement models, including white-label partnerships. I would welcome the opportunity to introduce our capabilities to your team.

Best regards,

${sender.senderName}
${sender.senderTitle} | ${sender.senderCompany}
Website: ${sender.senderWebsite}
Email: ${sender.senderEmail}
Phone: ${sender.senderPhone}`;
      break;

    case CATEGORY_TYPES.IT_SOFTWARE:
      whatsappBody = `${greeting}

I’m ${sender.senderName}, ${sender.senderTitle} of ${sender.senderCompany}.

I noticed ${company}${cityInfo} and wanted to explore potential development outsourcing & tech collaboration.

${sender.senderCompany} acts as an extended development arm for IT & Software companies, offering additional capacity in web development, mobile apps, SaaS, AI solutions, APIs, and integrations under white-label terms.

If your team ever needs reliable capacity scaling or specialized dev resource support, let’s connect!

Regards,
${sender.senderName}
${sender.senderTitle}
${sender.senderCompany}
${sender.senderWebsite}
${sender.senderEmail}
${sender.senderPhone}`;

      emailSubject = `Development Capacity & Technology Partnership | ${company} & Kevalon`;
      emailBody = `Dear ${lead.contactPerson || company + ' Team'},

I hope this email finds you well.

I am ${sender.senderName}, ${sender.senderTitle} at ${sender.senderCompany}.

I came across ${company} and wanted to introduce ${sender.senderCompany} as a prospective development partner and resource scaling extension.

We collaborate with software firms and IT integrators to provide dedicated engineering capacity, specialized technology execution, and white-label project delivery.

Our Core Expertise:
- Custom Full-Stack Web Development (Node, React, Python, Cloud)
- Mobile Application Development (Flutter, React Native, Native iOS/Android)
- SaaS Product Engineering & Microservices Architecture
- AI Model Integrations, Custom APIs & Automation Workflows
- Tapzy – Smart NFC Digital Business Cards

Whether you need to scale up engineering output or outsource specific project modules, we are equipped to support your objectives seamlessly.

Would you be open to an initial call to discuss potential synergies?

Best Regards,

${sender.senderName}
${sender.senderTitle} | ${sender.senderCompany}
Website: ${sender.senderWebsite}
Email: ${sender.senderEmail}
Phone: ${sender.senderPhone}`;
      break;

    case CATEGORY_TYPES.OTHER:
    default:
      whatsappBody = `${greeting}

I’m ${sender.senderName}, ${sender.senderTitle} of ${sender.senderCompany}.

I came across ${company}${cityInfo} and wanted to share a brief introduction of our enterprise technology and digital transformation services.

${sender.senderCompany} provides custom website development, mobile apps, e-commerce, CRM/ERP systems, and AI automation for growing businesses.

We also offer Tapzy – Smart NFC Digital Business Cards, a modern digital solution for corporate networking and brand identity.

If you’d like to explore how technology can streamline your business operations or elevate your digital presence, I’d be delighted to connect.

Regards,
${sender.senderName}
${sender.senderTitle}
${sender.senderCompany}
${sender.senderWebsite}
${sender.senderEmail}
${sender.senderPhone}`;

      emailSubject = `Elevating ${company}'s Digital Capabilities - Kevalon Technology`;
      emailBody = `Dear ${lead.contactPerson || company + ' Team'},

I hope you are well.

I am ${sender.senderName}, ${sender.senderTitle} at ${sender.senderCompany}.

I am reaching out to introduce ${sender.senderCompany}, a technology solutions provider specializing in helping enterprises and growing businesses scale through modern digital tools.

Our Key Solutions:
- Custom Website & Portal Development
- Enterprise CRM, ERP & Workflow Automations
- E-Commerce Platforms & Custom Mobile Apps
- Tapzy – Smart NFC Digital Business Cards for Corporate Networking

If you are considering enhancing your organization's digital infrastructure or exploring smart NFC solutions, we would love to assist.

Please let me know if we can schedule a brief 10-minute call.

Best Regards,

${sender.senderName}
${sender.senderTitle} | ${sender.senderCompany}
Website: ${sender.senderWebsite}
Email: ${sender.senderEmail}
Phone: ${sender.senderPhone}`;
      break;
  }

  // Replace any lead-specific placeholders
  const leadData = {
    companyName: lead.title || '',
    category: lead.categoryName || '',
    city: lead.city || '',
    website: lead.website || '',
    phone: lead.phone || '',
    email: lead.email || '',
    contactPerson: lead.contactPerson || ''
  };

  return {
    generatedWhatsAppMessage: replaceVariables(whatsappBody, leadData),
    generatedEmailSubject: replaceVariables(emailSubject, leadData),
    generatedEmailBody: replaceVariables(emailBody, leadData)
  };
};

module.exports = {
  DEFAULT_SENDER,
  replaceVariables,
  generateLeadMessages
};
