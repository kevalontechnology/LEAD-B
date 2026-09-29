const CATEGORY_TYPES = {
  DIGITAL_MARKETING: 'DIGITAL_MARKETING',
  BRANDING: 'BRANDING',
  ADVERTISING: 'ADVERTISING',
  IT_SOFTWARE: 'IT_SOFTWARE',
  OTHER: 'OTHER'
};

const detectCategoryType = (categoryName = '') => {
  const catLower = categoryName.toLowerCase().trim();

  if (
    catLower.includes('digital marketing') ||
    catLower.includes('seo') ||
    catLower.includes('social media') ||
    catLower.includes('performance marketing') ||
    catLower.includes('marketing')
  ) {
    return CATEGORY_TYPES.DIGITAL_MARKETING;
  }

  if (
    catLower.includes('branding') ||
    catLower.includes('creative') ||
    catLower.includes('graphic design') ||
    catLower.includes('design studio')
  ) {
    return CATEGORY_TYPES.BRANDING;
  }

  if (
    catLower.includes('advertising') ||
    catLower.includes('outdoor advertising') ||
    catLower.includes('ooh') ||
    catLower.includes('publicity') ||
    catLower.includes('media agency') ||
    catLower.includes('media')
  ) {
    return CATEGORY_TYPES.ADVERTISING;
  }

  if (
    catLower.includes('it') ||
    catLower.includes('software') ||
    catLower.includes('web development') ||
    catLower.includes('web design') ||
    catLower.includes('technology') ||
    catLower.includes('computer') ||
    catLower.includes('application development') ||
    catLower.includes('app development')
  ) {
    return CATEGORY_TYPES.IT_SOFTWARE;
  }

  return CATEGORY_TYPES.OTHER;
};

module.exports = {
  CATEGORY_TYPES,
  detectCategoryType
};
