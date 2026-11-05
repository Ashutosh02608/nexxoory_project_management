// Nexxoory website services and project types, shared by UI and API validation.
export const projectTypes = [
  'Social Media Marketing',
  'Website Development',
  'Mobile App Development',
  'Search Engine Optimization',
  'Brand Identity',
  'Google Business Page & Cloud Storage',
  'Video and Photo Shoots',
  'Custom Web Application',
  'Influencer Collaborations',
  'Domain and Hosting',
  'Graphic Design',
  'Other'
];

export const deliverySchedules = [
  'Monthly Deliverables',
  'One-Time Deliverables',
  'Both'
];

export const deliveryCategories = [
  'Monthly Deliverable',
  'One-Time Deliverable'
];

/**
 * Task Types mapped directly to each Project Type.
 */
export const projectTaskTypes = {
  'Social Media Marketing': [
    'Post',
    'Reel',
    'AI Reel'
  ],
  'Website Development': [
    'UI Design',
    'Frontend Development',
    'Backend Development',
    'Testing',
    'Deployment'
  ],
  'Mobile App Development': [
    'UI/UX Design',
    'iOS Development',
    'Android Development',
    'API Integration',
    'QA & Testing'
  ],
  'Search Engine Optimization': [
    'Keyword Research',
    'On-Page SEO',
    'Technical SEO',
    'Content Optimization',
    'Backlink Building'
  ],
  'Brand Identity': [
    'Logo Design',
    'Brand Guidelines',
    'Typography & Palette',
    'Collateral Design'
  ],
  'Google Business Page & Cloud Storage': [
    'GBP Setup / Verification',
    'NAP Audit',
    'Cloud Drive Structuring',
    'Review Strategy'
  ],
  'Video and Photo Shoots': [
    'Pre-Production Planning',
    'Shoot Execution',
    'Video Editing',
    'Color Grading & Audio'
  ],
  'Custom Web Application': [
    'Architecture Design',
    'Database Modeling',
    'API Development',
    'Frontend Implementation',
    'Deployment & CI/CD'
  ],
  'Influencer Collaborations': [
    'Influencer Sourcing',
    'Contract & Briefing',
    'Content Review',
    'Campaign Tracking'
  ],
  'Domain and Hosting': [
    'Domain Configuration',
    'DNS Management',
    'SSL Installation',
    'Server Optimization'
  ],
  'Graphic Design': [
    'Social Media Graphic',
    'Print Collateral',
    'Banner & Ad Creative',
    'Packaging Design'
  ],
  'Other': [
    'Deliverable',
    'Milestone',
    'General Task'
  ]
};

/**
 * Get applicable task types for a given project type.
 */
export function getTaskTypesForProjectType(projectType) {
  if (!projectType || !projectTaskTypes[projectType]) {
    return projectTaskTypes['Other'];
  }
  return projectTaskTypes[projectType];
}

/**
 * Get allowed delivery categories for a project's delivery schedule.
 */
export function getAllowedDeliveryCategories(deliverySchedule) {
  if (deliverySchedule === 'One-Time Deliverables') {
    return ['One-Time Deliverable'];
  }
  if (deliverySchedule === 'Both') {
    return ['Monthly Deliverable', 'One-Time Deliverable'];
  }
  // Default to Monthly Deliverables
  return ['Monthly Deliverable'];
}

/**
 * All allowed content types across all projects.
 */
const allTaskTypes = Array.from(new Set([
  ...Object.values(projectTaskTypes).flat(),
  ...projectTypes
]));

export const contentTypes = allTaskTypes;
