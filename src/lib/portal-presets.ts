/**
 * @fileOverview Pure Portal Mode Presets & Default Configurations
 * Safe to import in both Client and Server Components without dragging in Node/Firebase Admin.
 */

import type {
  PortalMode,
  PortalModePreset,
  PortalThemeConfig,
  PortalNavigationConfig,
  PortalAccessPolicy,
  PortalFeatureToggles,
  PortalSeoConfig,
} from './types/portal';
import type { OnboardingStep } from './types/engagement';

export const DEFAULT_FEATURE_TOGGLES: PortalFeatureToggles = {
  enableCourses: true,
  enableBlog: false,
  enableDocs: false,
  enableCommunity: true,
  enableResources: true,
  enableEvents: false,
  enableGamification: false,
  enableAiTutor: true,
  enableAffiliates: false,
};

export const DEFAULT_THEME: PortalThemeConfig = {
  colors: {
    primary: '#3B82F6',
    secondary: '#1E293B',
    accent: '#6366F1',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#0F172A',
    mutedText: '#64748B',
    border: '#E2E8F0',
  },
  typography: {
    headingFont: 'Plus Jakarta Sans',
    bodyFont: 'Inter',
    baseSize: 'md',
  },
  ui: {
    borderRadius: 'lg',
    buttonStyle: 'flat',
  },
  colorMode: 'system',
};

export const DEFAULT_NAVIGATION: PortalNavigationConfig = {
  headerItems: [
    { id: 'nav-home', label: 'Home', path: '/', type: 'internal_page', order: 0 },
    { id: 'nav-explore', label: 'Explore', path: '/explore', type: 'internal_page', order: 1 },
  ],
  headerActions: {
    showLoginButton: true,
    showSearch: true,
    ctaButton: {
      label: 'Get Started',
      path: '/get-started',
      style: 'primary',
    },
  },
  sidebarItems: [],
  footerColumns: [
    {
      id: 'foot-col-1',
      title: 'Platform',
      items: [
        { id: 'foot-about', label: 'About', path: '/about', type: 'internal_page', order: 0 },
        { id: 'foot-contact', label: 'Contact', path: '/contact', type: 'internal_page', order: 1 },
      ],
    },
    {
      id: 'foot-col-2',
      title: 'Legal',
      items: [
        { id: 'foot-privacy', label: 'Privacy Policy', path: '/privacy', type: 'internal_page', order: 0 },
        { id: 'foot-terms', label: 'Terms of Service', path: '/terms', type: 'internal_page', order: 1 },
      ],
    },
  ],
  socialLinks: [],
};

export const DEFAULT_ACCESS_POLICY: PortalAccessPolicy = {
  visibility: 'public',
  requireAuth: false,
  allowedRoles: [],
  passwordProtected: false,
};

export const DEFAULT_SEO: PortalSeoConfig = {
  twitterCard: 'summary_large_image',
  noIndex: false,
};

export const PORTAL_MODE_PRESETS: Record<PortalMode, PortalModePreset> = {
  academy: {
    id: 'academy',
    name: 'Learning Academy',
    tagline: 'Comprehensive structured curriculum with courses and certificates',
    description: 'Ideal for schools, institutions, and training academies delivering multi-course curricula.',
    iconName: 'GraduationCap',
    badge: 'Education',
    recommendedLayout: 'course_catalog',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableCourses: true,
      enableDocs: true,
      enableCommunity: true,
      enableResources: true,
      enableGamification: true,
    },
    defaultThemeColors: {
      primary: '#3B82F6',
      accent: '#2563EB',
    },
    defaultNavItems: [
      { id: 'nav-courses', label: 'Courses', path: '/courses', type: 'internal_page', order: 0 },
      { id: 'nav-resources', label: 'Resources', path: '/resources', type: 'internal_page', order: 1 },
      { id: 'nav-community', label: 'Community', path: '/community', type: 'internal_page', order: 2 },
    ],
  },
  course: {
    id: 'course',
    name: 'Single Course / Masterclass',
    tagline: 'Focused video & assessment learning experience',
    description: 'Designed for flagship workshops, masterclasses, and targeted instructional modules.',
    iconName: 'BookOpen',
    badge: 'Course',
    recommendedLayout: 'hero_grid',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableCourses: true,
      enableCommunity: true,
      enableResources: true,
    },
    defaultThemeColors: {
      primary: '#6366F1',
      accent: '#4F46E5',
    },
    defaultNavItems: [
      { id: 'nav-curriculum', label: 'Curriculum', path: '/curriculum', type: 'internal_page', order: 0 },
      { id: 'nav-resources', label: 'Downloads', path: '/resources', type: 'internal_page', order: 1 },
    ],
  },
  membership: {
    id: 'membership',
    name: 'Paid Membership Hub',
    tagline: 'Exclusive gated community, content library & member benefits',
    description: 'Monetize recurring subscribers with premium content, workshops, and exclusive spaces.',
    iconName: 'Crown',
    badge: 'Monetization',
    recommendedLayout: 'feed',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableCourses: true,
      enableCommunity: true,
      enableResources: true,
      enableEvents: true,
      enableAffiliates: true,
    },
    defaultThemeColors: {
      primary: '#EC4899',
      accent: '#DB2777',
    },
    defaultNavItems: [
      { id: 'nav-hub', label: 'Member Hub', path: '/hub', type: 'internal_page', order: 0 },
      { id: 'nav-library', label: 'Vault', path: '/vault', type: 'internal_page', order: 1 },
      { id: 'nav-events', label: 'Live Calls', path: '/events', type: 'internal_page', order: 2 },
    ],
  },
  community: {
    id: 'community',
    name: 'Interactive Community',
    tagline: 'Skool-style social feeds, member directory & discussions',
    description: 'Facilitate conversations, peer engagement, Q&A, and gamified leaderboards.',
    iconName: 'Users',
    badge: 'Social',
    recommendedLayout: 'feed',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableCommunity: true,
      enableGamification: true,
      enableEvents: true,
    },
    defaultThemeColors: {
      primary: '#F59E0B',
      accent: '#D97706',
    },
    defaultNavItems: [
      { id: 'nav-feed', label: 'Community Feed', path: '/feed', type: 'internal_page', order: 0 },
      { id: 'nav-members', label: 'Members', path: '/members', type: 'internal_page', order: 1 },
      { id: 'nav-leaderboard', label: 'Leaderboard', path: '/leaderboard', type: 'internal_page', order: 2 },
    ],
  },
  documentation: {
    id: 'documentation',
    name: 'Documentation & Help Centre',
    tagline: 'Searchable technical guides, API references & knowledge base',
    description: 'Organize structured product docs, manuals, FAQs, and AI search.',
    iconName: 'FileCode',
    badge: 'Help',
    recommendedLayout: 'document_reader',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableDocs: true,
      enableCourses: false,
      enableCommunity: false,
    },
    defaultThemeColors: {
      primary: '#10B981',
      accent: '#059669',
    },
    defaultNavItems: [
      { id: 'nav-docs', label: 'Documentation', path: '/docs', type: 'internal_page', order: 0 },
      { id: 'nav-faq', label: 'FAQ', path: '/faq', type: 'internal_page', order: 1 },
    ],
  },
  knowledge_base: {
    id: 'knowledge_base',
    name: 'Knowledge Base',
    tagline: 'Internal & customer knowledge library with search',
    description: 'Centralized repository of SOPs, policy guides, articles, and troubleshooting steps.',
    iconName: 'Library',
    badge: 'Knowledge',
    recommendedLayout: 'document_reader',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableDocs: true,
      enableResources: true,
      enableCourses: false,
    },
    defaultThemeColors: {
      primary: '#06B6D4',
      accent: '#0891B2',
    },
    defaultNavItems: [
      { id: 'nav-articles', label: 'Articles', path: '/articles', type: 'internal_page', order: 0 },
      { id: 'nav-categories', label: 'Categories', path: '/categories', type: 'internal_page', order: 1 },
    ],
  },
  customer_academy: {
    id: 'customer_academy',
    name: 'Customer Onboarding Academy',
    tagline: 'Accelerate product adoption and customer proficiency',
    description: 'Guide new clients through onboarding checklists, product tutorials, and milestone certifications.',
    iconName: 'Compass',
    badge: 'Onboarding',
    recommendedLayout: 'hero_grid',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableCourses: true,
      enableDocs: true,
      enableResources: true,
    },
    defaultThemeColors: {
      primary: '#8B5CF6',
      accent: '#7C3AED',
    },
    defaultNavItems: [
      { id: 'nav-start', label: 'Get Started', path: '/getting-started', type: 'internal_page', order: 0 },
      { id: 'nav-tutorials', label: 'Tutorials', path: '/tutorials', type: 'internal_page', order: 1 },
      { id: 'nav-support', label: 'Support', path: '/support', type: 'internal_page', order: 2 },
    ],
  },
  resource_center: {
    id: 'resource_center',
    name: 'Resource Centre',
    tagline: 'Downloadable templates, toolkits, PDFs & media assets',
    description: 'Deliver marketing kits, spreadsheet templates, guides, and downloadable files.',
    iconName: 'FolderArchive',
    badge: 'Library',
    recommendedLayout: 'hero_grid',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableResources: true,
      enableCourses: false,
      enableCommunity: false,
    },
    defaultThemeColors: {
      primary: '#F97316',
      accent: '#EA580C',
    },
    defaultNavItems: [
      { id: 'nav-templates', label: 'Templates', path: '/templates', type: 'internal_page', order: 0 },
      { id: 'nav-downloads', label: 'Downloads', path: '/downloads', type: 'internal_page', order: 1 },
    ],
  },
  blog: {
    id: 'blog',
    name: 'Blog & Publication',
    tagline: 'Editorial articles, thought leadership & company news',
    description: 'Publish search-engine-optimized long-form content, updates, and articles.',
    iconName: 'Newspaper',
    badge: 'Publication',
    recommendedLayout: 'hero_grid',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableBlog: true,
      enableCourses: false,
      enableCommunity: false,
    },
    defaultThemeColors: {
      primary: '#64748B',
      accent: '#475569',
    },
    defaultNavItems: [
      { id: 'nav-posts', label: 'Articles', path: '/posts', type: 'internal_page', order: 0 },
      { id: 'nav-topics', label: 'Topics', path: '/topics', type: 'internal_page', order: 1 },
    ],
  },
  news: {
    id: 'news',
    name: 'News & Announcements',
    tagline: 'Company bulletins, press releases & milestone updates',
    description: 'Broadcast important organization announcements and press releases.',
    iconName: 'Megaphone',
    badge: 'Announcements',
    recommendedLayout: 'hero_grid',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableBlog: true,
    },
    defaultThemeColors: {
      primary: '#3B82F6',
      accent: '#1D4ED8',
    },
    defaultNavItems: [
      { id: 'nav-latest', label: 'Latest News', path: '/news', type: 'internal_page', order: 0 },
    ],
  },
  classroom: {
    id: 'classroom',
    name: 'Student Classroom',
    tagline: 'Daily lesson schedules, submissions & grade tracking',
    description: 'Classroom environment for teachers, cohorts, assignments, and student submissions.',
    iconName: 'School',
    badge: 'Classroom',
    recommendedLayout: 'course_catalog',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableCourses: true,
      enableCommunity: true,
      enableEvents: true,
    },
    defaultThemeColors: {
      primary: '#14B8A6',
      accent: '#0D9488',
    },
    defaultNavItems: [
      { id: 'nav-classes', label: 'Classes', path: '/classes', type: 'internal_page', order: 0 },
      { id: 'nav-tasks', label: 'Assignments', path: '/assignments', type: 'internal_page', order: 1 },
    ],
  },
  certification: {
    id: 'certification',
    name: 'Professional Certification',
    tagline: 'Proctored exams, verifiable badges & credential verification',
    description: 'Deliver high-stakes exams, professional certifications, and verifiable public badges.',
    iconName: 'Award',
    badge: 'Certifications',
    recommendedLayout: 'hero_grid',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableCourses: true,
      enableGamification: true,
    },
    defaultThemeColors: {
      primary: '#A855F7',
      accent: '#9333EA',
    },
    defaultNavItems: [
      { id: 'nav-certs', label: 'Certifications', path: '/certifications', type: 'internal_page', order: 0 },
      { id: 'nav-verify', label: 'Verify Credential', path: '/verify', type: 'internal_page', order: 1 },
    ],
  },
  coaching: {
    id: 'coaching',
    name: 'Coaching & Cohort Program',
    tagline: 'Live weekly calls, action accountability & cohort milestones',
    description: 'High-touch group coaching with live Google Meet / Zoom integration and weekly check-ins.',
    iconName: 'UserCheck',
    badge: 'Coaching',
    recommendedLayout: 'hero_grid',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableCourses: true,
      enableEvents: true,
      enableCommunity: true,
    },
    defaultThemeColors: {
      primary: '#E11D48',
      accent: '#BE123C',
    },
    defaultNavItems: [
      { id: 'nav-roadmap', label: 'Roadmap', path: '/roadmap', type: 'internal_page', order: 0 },
      { id: 'nav-calls', label: 'Live Calls', path: '/calls', type: 'internal_page', order: 1 },
    ],
  },
  product_training: {
    id: 'product_training',
    name: 'Product Education',
    tagline: 'Interactive feature walk-throughs & best practices',
    description: 'Equip staff, sales teams, or clients with deep product mastery.',
    iconName: 'Cpu',
    badge: 'Product',
    recommendedLayout: 'hero_grid',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableCourses: true,
      enableDocs: true,
    },
    defaultThemeColors: {
      primary: '#0284C7',
      accent: '#0369A1',
    },
    defaultNavItems: [
      { id: 'nav-modules', label: 'Training Modules', path: '/modules', type: 'internal_page', order: 0 },
    ],
  },
  internal_academy: {
    id: 'internal_academy',
    name: 'Internal Staff Academy',
    tagline: 'Employee onboarding, compliance training & company knowledge',
    description: 'Internal learning hub strictly accessible to staff and teammates.',
    iconName: 'ShieldAlert',
    badge: 'Internal',
    recommendedLayout: 'course_catalog',
    defaultFeatures: {
      ...DEFAULT_FEATURE_TOGGLES,
      enableCourses: true,
      enableDocs: true,
    },
    defaultThemeColors: {
      primary: '#334155',
      accent: '#1E293B',
    },
    defaultNavItems: [
      { id: 'nav-training', label: 'Staff Training', path: '/training', type: 'internal_page', order: 0 },
      { id: 'nav-sop', label: 'SOPs', path: '/sops', type: 'internal_page', order: 1 },
    ],
  },
  waitlist: {
    id: 'waitlist',
    name: 'Pre-launch Waitlist & Teaser',
    tagline: 'Capture early signups, validate demand & build anticipation',
    description: 'High-converting pre-launch page connected to CRM leads and launch automations.',
    iconName: 'Hourglass',
    badge: 'Pre-Launch',
    recommendedLayout: 'hero_grid',
    defaultFeatures: {
      enableCourses: false,
      enableBlog: false,
      enableDocs: false,
      enableCommunity: false,
      enableResources: false,
      enableEvents: false,
      enableGamification: false,
      enableAiTutor: false,
      enableAffiliates: true,
    },
    defaultThemeColors: {
      primary: '#7C3AED',
      accent: '#6D28D9',
    },
    defaultNavItems: [
      { id: 'nav-about', label: 'About', path: '/about', type: 'internal_page', order: 0 },
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom Experience Portal',
    tagline: 'Tailor every space, module and feature to your exact requirements',
    description: 'Blank canvas allowing full customization of modules, navigation, and theme.',
    iconName: 'Sliders',
    badge: 'Custom',
    recommendedLayout: 'hero_grid',
    defaultFeatures: DEFAULT_FEATURE_TOGGLES,
    defaultThemeColors: {
      primary: '#3B82F6',
      accent: '#6366F1',
    },
    defaultNavItems: DEFAULT_NAVIGATION.headerItems,
  },
};

export const DEFAULT_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'step_welcome',
    title: 'Watch Orientation & Welcome',
    description: 'Get an overview of your academy curriculum and tools.',
    type: 'welcome_video',
    order: 1,
    isRequired: true,
  },
  {
    id: 'step_profile',
    title: 'Complete Bursary Profile',
    description: 'Add your school name, title, and WhatsApp direct number.',
    type: 'complete_profile',
    order: 2,
    isRequired: true,
  },
  {
    id: 'step_course',
    title: 'Begin First Masterclass Lesson',
    description: 'Start Module 1 of Invoicing & Fee Recovery.',
    type: 'start_course',
    order: 3,
    isRequired: true,
  },
  {
    id: 'step_community',
    title: 'Introduce Yourself in Community',
    description: 'Post a quick hello in #general discussion.',
    type: 'community_post',
    order: 4,
    isRequired: false,
  },
  {
    id: 'step_call',
    title: 'Book 1-on-1 Strategy Session',
    description: 'Schedule a tailored bursary consultation with our specialists.',
    type: 'book_meeting',
    order: 5,
    isRequired: false,
  },
];
