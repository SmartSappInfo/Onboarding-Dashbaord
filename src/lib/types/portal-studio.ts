/**
 * @fileoverview Type definitions & Navigation Metadata for the Portal Studio Visual Configurator.
 *
 * ARCHITECTURAL RATIONALE:
 * Organizes the 16 flat configuration features into 5 distinct Information Architecture (IA) domains,
 * eliminating visual crowding and cognitive overload while strictly preserving 100% of underlying
 * feature bindings and props.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Strictly zero `any`, `any[]`, or `unknown`.
 * - Every tab must map to an existing, fully-typed studio manager component.
 */

export type StudioCategoryId =
  | 'brand_experience'
  | 'learning_content'
  | 'community_members'
  | 'commerce_access'
  | 'operations_scale';

export type StudioTabId =
  // Brand & Experience
  | 'identity'
  | 'theme'
  | 'navigation'
  | 'modules'
  | 'seo'
  // Learning & Content
  | 'content'
  | 'courses'
  | 'events'
  // Community & Members
  | 'community'
  | 'onboarding'
  | 'members'
  | 'credentials'
  // Commerce & Access
  | 'monetization'
  | 'access'
  // Operations & Scale
  | 'analytics'
  | 'enterprise';

export type StudioViewMode = 'split' | 'editor' | 'preview';

export interface StudioTabItem {
  id: StudioTabId;
  categoryId: StudioCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  iconName: string;
  badge?: string;
}

export interface StudioCategory {
  id: StudioCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  iconName: string;
  tabIds: StudioTabId[];
}

export const STUDIO_CATEGORIES: StudioCategory[] = [
  {
    id: 'brand_experience',
    label: 'Brand & Design',
    shortLabel: 'Design',
    description: 'Visual identity, theme tokens, menus, and SEO configuration',
    iconName: 'Palette',
    tabIds: ['identity', 'theme', 'navigation', 'modules', 'seo'],
  },
  {
    id: 'learning_content',
    label: 'Learning & Content',
    shortLabel: 'Learning',
    description: 'Masterclass courses, curriculum vault, and live workshops',
    iconName: 'GraduationCap',
    tabIds: ['content', 'courses', 'events'],
  },
  {
    id: 'community_members',
    label: 'Community & Members',
    shortLabel: 'Community',
    description: 'Member directory, social feeds, onboarding, and certificates',
    iconName: 'Users',
    tabIds: ['community', 'onboarding', 'members', 'credentials'],
  },
  {
    id: 'commerce_access',
    label: 'Commerce & Access',
    shortLabel: 'Access',
    description: 'Paid memberships, pricing plans, and registration paywalls',
    iconName: 'ShieldCheck',
    tabIds: ['monetization', 'access'],
  },
  {
    id: 'operations_scale',
    label: 'Operations & Scale',
    shortLabel: 'Operations',
    description: 'Engagement analytics, health KPIs, and enterprise SSO',
    iconName: 'LineChart',
    tabIds: ['analytics', 'enterprise'],
  },
];

export const STUDIO_TABS: Record<StudioTabId, StudioTabItem> = {
  // ── Brand & Experience ──────────────────────────────────────────────────────
  identity: {
    id: 'identity',
    categoryId: 'brand_experience',
    label: 'Portal Identity',
    shortLabel: 'Identity',
    description: 'Portal name, public URL slug, description, and workspace binding',
    iconName: 'Building2',
  },
  theme: {
    id: 'theme',
    categoryId: 'brand_experience',
    label: 'Theme & Styling',
    shortLabel: 'Theme',
    description: 'Color palettes, Google Fonts typography, and border radius tokens',
    iconName: 'Palette',
  },
  navigation: {
    id: 'navigation',
    categoryId: 'brand_experience',
    label: 'Header & Footer Menus',
    shortLabel: 'Navigation',
    description: 'Custom portal navigation links, CTA buttons, and space visibility',
    iconName: 'Menu',
  },
  modules: {
    id: 'modules',
    categoryId: 'brand_experience',
    label: 'Space Modules',
    shortLabel: 'Modules',
    description: 'Enable or disable Courses, Resources, Community, and Calendar spaces',
    iconName: 'LayoutGrid',
  },
  seo: {
    id: 'seo',
    categoryId: 'brand_experience',
    label: 'SEO & Metadata',
    shortLabel: 'SEO',
    description: 'Search engine titles, meta descriptions, and OpenGraph social preview tags',
    iconName: 'Globe',
  },

  // ── Learning & Content ──────────────────────────────────────────────────────
  content: {
    id: 'content',
    categoryId: 'learning_content',
    label: 'Content Vault',
    shortLabel: 'Content',
    description: 'Articles, playbooks, downloadable resources, and knowledge documents',
    iconName: 'FileText',
  },
  courses: {
    id: 'courses',
    categoryId: 'learning_content',
    label: 'Courses & Curriculums',
    shortLabel: 'Courses',
    description: 'Masterclass courses, module structures, and video lesson sequences',
    iconName: 'GraduationCap',
  },
  events: {
    id: 'events',
    categoryId: 'learning_content',
    label: 'Events & Workshops',
    shortLabel: 'Events',
    description: 'Scheduled live webinars, masterclass workshops, and member calendar',
    iconName: 'Calendar',
  },

  // ── Community & Members ─────────────────────────────────────────────────────
  community: {
    id: 'community',
    categoryId: 'community_members',
    label: 'Community Feed',
    shortLabel: 'Community',
    description: 'Discussion spaces, member threads, announcements, and moderation',
    iconName: 'MessageSquare',
  },
  onboarding: {
    id: 'onboarding',
    categoryId: 'community_members',
    label: 'Onboarding Flow',
    shortLabel: 'Onboarding',
    description: 'Automated orientation checklist, welcome video, and verification steps',
    iconName: 'CheckCircle2',
  },
  members: {
    id: 'members',
    categoryId: 'community_members',
    label: 'Member Directory',
    shortLabel: 'Members',
    description: 'Enrolled members, provenance badges, role management, and status',
    iconName: 'Users',
  },
  credentials: {
    id: 'credentials',
    categoryId: 'community_members',
    label: 'Credentials & Badges',
    shortLabel: 'Credentials',
    description: 'Graduation certificates, skill badges, and issuance criteria',
    iconName: 'Award',
  },

  // ── Commerce & Access ───────────────────────────────────────────────────────
  monetization: {
    id: 'monetization',
    categoryId: 'commerce_access',
    label: 'Monetization & Plans',
    shortLabel: 'Monetization',
    description: 'Subscription pricing tiers, paywalls, and billing currency settings',
    iconName: 'CreditCard',
  },
  access: {
    id: 'access',
    categoryId: 'commerce_access',
    label: 'Access Policies',
    shortLabel: 'Access',
    description: 'Registration gates, domain whitelisting, password protection, and 1-click join',
    iconName: 'Lock',
  },

  // ── Operations & Scale ──────────────────────────────────────────────────────
  analytics: {
    id: 'analytics',
    categoryId: 'operations_scale',
    label: 'Analytics & KPIs',
    shortLabel: 'Analytics',
    description: 'Active member engagement, course completion metrics, and growth trends',
    iconName: 'BarChart3',
  },
  enterprise: {
    id: 'enterprise',
    categoryId: 'operations_scale',
    label: 'Enterprise Governance',
    shortLabel: 'Enterprise',
    description: 'SSO SAML / OIDC connections, team billing quotas, and audit logs',
    iconName: 'Building',
  },
};

/**
 * Resolves the parent category for a given tab ID.
 */
export function getCategoryForTab(tabId: StudioTabId): StudioCategoryId {
  return STUDIO_TABS[tabId]?.categoryId || 'brand_experience';
}
