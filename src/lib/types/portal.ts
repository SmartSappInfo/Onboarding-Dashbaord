/**
 * {{Org_name}} Experience Platform — Core Portal Domain Types
 *
 * Single source of truth for Portal aggregates, mode presets, branding,
 * themes, recursive navigation trees, access policies, and SEO configs.
 *
 * Rules:
 * - Strictly typed (Zero any / any[]).
 * - Scoped to organizationId and workspaceIds array for multi-workspace sharing.
 * - Conforms to domain boundaries defined in docs/membership/membership_prd.md.
 */

// ─── Portal Modes ─────────────────────────────────────────────────────────────

/**
 * 17 Standard Experience Modes supported by the platform.
 * A portal can be configured with a primary mode and optional active feature modules.
 */
export type PortalMode =
  | 'academy'
  | 'course'
  | 'membership'
  | 'community'
  | 'classroom'
  | 'documentation'
  | 'knowledge_base'
  | 'blog'
  | 'news'
  | 'resource_center'
  | 'customer_academy'
  | 'certification'
  | 'coaching'
  | 'product_training'
  | 'internal_academy'
  | 'waitlist'
  | 'custom';

// ─── Lifecycle State Machine ──────────────────────────────────────────────────

/**
 * Portal lifecycle states:
 * DRAFT -> CONFIGURING -> PUBLISHED -> SUSPENDED -> ARCHIVED
 */
export type PortalStatus =
  | 'draft'
  | 'configuring'
  | 'published'
  | 'suspended'
  | 'archived';

// ─── Access & Visibility ──────────────────────────────────────────────────────

export type PortalVisibility =
  | 'public'
  | 'authenticated'
  | 'invite_only'
  | 'password_protected'
  | 'membership_required';

export interface PortalAccessPolicy {
  visibility: PortalVisibility;
  requireAuth: boolean;
  allowedRoles: string[];
  passwordProtected: boolean;
  passwordHash?: string;
  allowedEmailDomains?: string[];
  ipWhitelist?: string[];
  suspendedReason?: string;
}

// ─── Branding & Visual Identity ───────────────────────────────────────────────

export interface PortalBranding {
  brandName: string;
  tagline?: string;
  logoUrl?: string;
  darkLogoUrl?: string;
  faviconUrl?: string;
  coverImageUrl?: string;
  copyrightText?: string;
}

// ─── Theme & Design System Tokens ─────────────────────────────────────────────

export interface PortalThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
}

export interface PortalTypographyConfig {
  headingFont: string;
  bodyFont: string;
  baseSize: 'sm' | 'md' | 'lg';
}

export interface PortalUIConfig {
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  buttonStyle: 'flat' | 'glow' | 'glass' | 'pill';
}

export interface PortalThemeConfig {
  colors: PortalThemeColors;
  typography: PortalTypographyConfig;
  ui: PortalUIConfig;
  colorMode: 'light' | 'dark' | 'system' | 'user_choice';
  customCssVariables?: Record<string, string>;
}

// ─── Navigation Hierarchy (Recursive Tree) ────────────────────────────────────

export type PortalNavItemType =
  | 'internal_page'
  | 'external_url'
  | 'resource'
  | 'space'
  | 'dropdown';

export interface PortalNavItem {
  id: string;
  label: string;
  path: string;
  type: PortalNavItemType;
  iconName?: string;
  badgeText?: string;
  isProtected?: boolean;
  requiredRole?: string;
  target?: '_self' | '_blank';
  children?: PortalNavItem[];
  order: number;
}

export interface PortalHeaderActions {
  showLoginButton: boolean;
  showSearch: boolean;
  ctaButton?: {
    label: string;
    path: string;
    target?: '_self' | '_blank';
    style: 'primary' | 'secondary' | 'outline';
  };
}

export interface PortalFooterColumn {
  id: string;
  title: string;
  items: PortalNavItem[];
}

export interface PortalSocialLink {
  platform: 'twitter' | 'linkedin' | 'facebook' | 'youtube' | 'instagram' | 'github' | 'website';
  url: string;
}

export interface PortalNavigationConfig {
  headerItems: PortalNavItem[];
  headerActions: PortalHeaderActions;
  sidebarItems: PortalNavItem[];
  footerColumns: PortalFooterColumn[];
  socialLinks: PortalSocialLink[];
}

// ─── Feature Toggles / Active Spaces ──────────────────────────────────────────

export interface PortalFeatureToggles {
  enableCourses: boolean;
  enableBlog: boolean;
  enableDocs: boolean;
  enableCommunity: boolean;
  enableResources: boolean;
  enableEvents: boolean;
  enableGamification: boolean;
  enableAiTutor: boolean;
  enableAffiliates: boolean;
}

// ─── SEO & Social Graph ───────────────────────────────────────────────────────

export interface PortalSeoConfig {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  canonicalUrl?: string;
  noIndex?: boolean;
  customHead?: string;
  customBody?: string;
}

// ─── Portal Aggregate Entity ──────────────────────────────────────────────────

export interface Portal {
  id: string;
  organizationId: string;
  /**
   * Workspace IDs this portal is linked to.
   * Enables sharing portals across multiple workspaces or restricting to specific ones.
   */
  workspaceIds: string[];

  name: string;
  slug: string;
  description?: string;

  /** Primary experience mode & configured secondary modes */
  primaryMode: PortalMode;
  enabledModes: PortalMode[];

  status: PortalStatus;
  visibility: PortalVisibility;

  branding: PortalBranding;
  theme: PortalThemeConfig;
  navigation: PortalNavigationConfig;
  accessPolicy: PortalAccessPolicy;
  features: PortalFeatureToggles;
  seo: PortalSeoConfig;

  /** Optional custom domain binding (e.g., learn.customer.com) */
  customDomain?: string;
  isCustomDomainVerified?: boolean;

  /** Home layout / default landing configuration */
  homeLayout?: 'hero_grid' | 'document_reader' | 'feed' | 'course_catalog' | 'custom_page';
  homePageDocumentId?: string;

  /** Metrics and stats cache */
  stats?: {
    totalMembers: number;
    activeLearners: number;
    totalViews: number;
    courseCompletions: number;
  };

  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  suspendedAt?: string;
  archivedAt?: string;
}

// ─── DTOs for Service & Actions ───────────────────────────────────────────────

export interface CreatePortalInput {
  organizationId: string;
  workspaceIds: string[];
  name: string;
  slug?: string;
  description?: string;
  primaryMode?: PortalMode;
  branding?: Partial<PortalBranding>;
  theme?: Partial<PortalThemeConfig>;
  accessPolicy?: Partial<PortalAccessPolicy>;
  features?: Partial<PortalFeatureToggles>;
  seo?: Partial<PortalSeoConfig>;
}

export interface UpdatePortalInput {
  name?: string;
  slug?: string;
  description?: string;
  workspaceIds?: string[];
  primaryMode?: PortalMode;
  enabledModes?: PortalMode[];
  status?: PortalStatus;
  visibility?: PortalVisibility;
  branding?: Partial<PortalBranding>;
  theme?: Partial<PortalThemeConfig>;
  navigation?: Partial<PortalNavigationConfig>;
  accessPolicy?: Partial<PortalAccessPolicy>;
  features?: Partial<PortalFeatureToggles>;
  seo?: Partial<PortalSeoConfig>;
  homeLayout?: Portal['homeLayout'];
  homePageDocumentId?: string;
  customDomain?: string;
}

/**
 * Lean Public Projection of a Portal safely exposed to unauthenticated clients.
 * Strips out sensitive administrative metadata, password hashes, and internal audit logs.
 */
export interface PublicPortalProjection {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  primaryMode: PortalMode;
  enabledModes: PortalMode[];
  status: PortalStatus;
  visibility: PortalVisibility;
  branding: PortalBranding;
  theme: PortalThemeConfig;
  navigation: PortalNavigationConfig;
  features: PortalFeatureToggles;
  seo: PortalSeoConfig;
  homeLayout?: Portal['homeLayout'];
  isPasswordProtected: boolean;
  requiresAuth: boolean;
}

// ─── Mode Preset Metadata ─────────────────────────────────────────────────────

export interface PortalModePreset {
  id: PortalMode;
  name: string;
  tagline: string;
  description: string;
  iconName: string;
  badge: string;
  recommendedLayout: Portal['homeLayout'];
  defaultFeatures: PortalFeatureToggles;
  defaultThemeColors: Partial<PortalThemeColors>;
  defaultNavItems: PortalNavItem[];
}
