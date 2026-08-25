/**
 * {{Org_name}} Experience Platform — Core Portal Domain Service
 *
 * Provides transactional CRUD, lifecycle state machine transitions, mode preset
 * generation, slug collision resolution, and duplication for Portal aggregates.
 *
 * Architecture Notes:
 * - Tenancy: Strictly bound to organizationId and workspaceIds array.
 * - Single source of truth for Portal configurations.
 * - Strictly typed (Zero any / any[]).
 * - Emits standardized domain events via PortalEventService.
 */

import { adminDb } from '../firebase-admin';
import { PortalEventService } from './portal-event-service';
import { PortalAccessService } from './portal-access-service';
import type {
  Portal,
  PortalMode,
  PortalStatus,
  PortalVisibility,
  PortalModePreset,
  CreatePortalInput,
  UpdatePortalInput,
  PortalThemeConfig,
  PortalNavigationConfig,
  PortalAccessPolicy,
  PortalFeatureToggles,
  PortalSeoConfig,
  PortalBranding,
} from '../types/portal';

// ─── Default Mode Preset Configurations ───────────────────────────────────────

const DEFAULT_FEATURE_TOGGLES: PortalFeatureToggles = {
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

const DEFAULT_THEME: PortalThemeConfig = {
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

const DEFAULT_NAVIGATION: PortalNavigationConfig = {
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

const DEFAULT_ACCESS_POLICY: PortalAccessPolicy = {
  visibility: 'public',
  requireAuth: false,
  allowedRoles: [],
  passwordProtected: false,
};

const DEFAULT_SEO: PortalSeoConfig = {
  twitterCard: 'summary_large_image',
  noIndex: false,
};

// ─── Mode Presets Catalog ─────────────────────────────────────────────────────

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

// ─── Portal Service Implementation ───────────────────────────────────────────

export class PortalService {
  /**
   * Returns all available preset configurations.
   */
  static listAllPresets(): PortalModePreset[] {
    return Object.values(PORTAL_MODE_PRESETS);
  }

  /**
   * Generates a mode preset configuration.
   */
  static getPresetConfiguration(mode: PortalMode): PortalModePreset {
    return PORTAL_MODE_PRESETS[mode] || PORTAL_MODE_PRESETS.custom;
  }

  /**
   * Sanitizes a slug into clean kebab-case without prohibited characters.
   */
  static sanitizeSlug(raw: string): string {
    return raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Generates a guaranteed unique slug within the organization.
   */
  static async generateUniqueSlug(
    name: string,
    organizationId: string,
    currentPortalId?: string
  ): Promise<string> {
    const baseSlug = this.sanitizeSlug(name) || 'portal';
    let candidate = baseSlug;
    let counter = 1;

    while (true) {
      const snap = await adminDb
        .collection('portals')
        .where('organizationId', '==', organizationId)
        .where('slug', '==', candidate)
        .limit(1)
        .get();

      if (snap.empty || (currentPortalId && snap.docs[0].id === currentPortalId)) {
        return candidate;
      }

      counter += 1;
      candidate = `${baseSlug}-${counter}`;
    }
  }

  /**
   * Creates a new Experience Portal with preset defaults and emits domain event.
   */
  static async createPortal(input: CreatePortalInput, userId: string): Promise<Portal> {
    const mode = input.primaryMode || 'custom';
    const preset = this.getPresetConfiguration(mode);
    const now = new Date().toISOString();

    const slug = input.slug
      ? this.sanitizeSlug(input.slug)
      : await this.generateUniqueSlug(input.name, input.organizationId);

    const docRef = adminDb.collection('portals').doc();
    const portalId = docRef.id;

    const portal: Portal = {
      id: portalId,
      organizationId: input.organizationId,
      workspaceIds: input.workspaceIds && input.workspaceIds.length > 0 ? input.workspaceIds : ['default'],
      name: input.name.trim(),
      slug,
      description: input.description || preset.description,
      primaryMode: mode,
      enabledModes: [mode],
      status: 'draft',
      visibility: input.accessPolicy?.visibility || 'public',
      branding: {
        brandName: input.branding?.brandName || input.name,
        tagline: input.branding?.tagline || preset.tagline,
        logoUrl: input.branding?.logoUrl || undefined,
        darkLogoUrl: input.branding?.darkLogoUrl || undefined,
        faviconUrl: input.branding?.faviconUrl || undefined,
        coverImageUrl: input.branding?.coverImageUrl || undefined,
        copyrightText: input.branding?.copyrightText || `© ${new Date().getFullYear()} ${input.name}. All rights reserved.`,
      },
      theme: {
        colors: {
          ...DEFAULT_THEME.colors,
          ...preset.defaultThemeColors,
          ...(input.theme?.colors || {}),
        },
        typography: input.theme?.typography || DEFAULT_THEME.typography,
        ui: input.theme?.ui || DEFAULT_THEME.ui,
        colorMode: input.theme?.colorMode || DEFAULT_THEME.colorMode,
        customCssVariables: input.theme?.customCssVariables || {},
      },
      navigation: {
        headerItems: preset.defaultNavItems,
        headerActions: DEFAULT_NAVIGATION.headerActions,
        sidebarItems: [],
        footerColumns: DEFAULT_NAVIGATION.footerColumns,
        socialLinks: [],
      },
      accessPolicy: {
        ...DEFAULT_ACCESS_POLICY,
        ...(input.accessPolicy || {}),
        passwordHash: input.accessPolicy?.passwordProtected && input.accessPolicy.passwordHash
          ? PortalAccessService.hashPassword(input.accessPolicy.passwordHash)
          : undefined,
      },
      features: {
        ...preset.defaultFeatures,
        ...(input.features || {}),
      },
      seo: {
        metaTitle: input.seo?.metaTitle || `${input.name} — ${preset.name}`,
        metaDescription: input.seo?.metaDescription || preset.description,
        ...input.seo,
      },
      homeLayout: preset.recommendedLayout,
      stats: {
        totalMembers: 0,
        activeLearners: 0,
        totalViews: 0,
        courseCompletions: 0,
      },
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(portal);
    await PortalEventService.emitPortalCreated(portal, userId);

    return portal;
  }

  /**
   * Updates an existing Portal configuration.
   */
  static async updatePortal(
    portalId: string,
    updates: UpdatePortalInput,
    userId: string
  ): Promise<Portal> {
    const docRef = adminDb.collection('portals').doc(portalId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error(`Portal ${portalId} not found`);
    }

    const current = snap.data() as Portal;
    const now = new Date().toISOString();
    const changedFields: string[] = [];

    const updatedPortal: Portal = { ...current };

    if (updates.name !== undefined && updates.name !== current.name) {
      updatedPortal.name = updates.name.trim();
      changedFields.push('name');
    }

    if (updates.slug !== undefined && updates.slug !== current.slug) {
      const sanitized = this.sanitizeSlug(updates.slug);
      const uniqueSlug = await this.generateUniqueSlug(sanitized, current.organizationId, portalId);
      updatedPortal.slug = uniqueSlug;
      changedFields.push('slug');
    }

    if (updates.description !== undefined) {
      updatedPortal.description = updates.description;
      changedFields.push('description');
    }

    if (updates.workspaceIds !== undefined) {
      updatedPortal.workspaceIds = updates.workspaceIds;
      changedFields.push('workspaceIds');
    }

    if (updates.primaryMode !== undefined) {
      updatedPortal.primaryMode = updates.primaryMode;
      changedFields.push('primaryMode');
    }

    if (updates.enabledModes !== undefined) {
      updatedPortal.enabledModes = updates.enabledModes;
      changedFields.push('enabledModes');
    }

    if (updates.status !== undefined && updates.status !== current.status) {
      updatedPortal.status = updates.status;
      if (updates.status === 'published') updatedPortal.publishedAt = now;
      if (updates.status === 'suspended') updatedPortal.suspendedAt = now;
      if (updates.status === 'archived') updatedPortal.archivedAt = now;
      changedFields.push('status');
    }

    if (updates.visibility !== undefined) {
      updatedPortal.visibility = updates.visibility;
      changedFields.push('visibility');
    }

    if (updates.branding) {
      updatedPortal.branding = { ...current.branding, ...updates.branding };
      changedFields.push('branding');
    }

    if (updates.theme) {
      updatedPortal.theme = {
        ...current.theme,
        ...updates.theme,
        colors: { ...current.theme.colors, ...(updates.theme.colors || {}) },
        typography: { ...current.theme.typography, ...(updates.theme.typography || {}) },
        ui: { ...current.theme.ui, ...(updates.theme.ui || {}) },
      };
      changedFields.push('theme');
    }

    if (updates.navigation) {
      updatedPortal.navigation = { ...current.navigation, ...updates.navigation };
      changedFields.push('navigation');
    }

    if (updates.accessPolicy) {
      const newPolicy = { ...current.accessPolicy, ...updates.accessPolicy };
      // Hash password if plain text was supplied
      if (
        updates.accessPolicy.passwordHash &&
        updates.accessPolicy.passwordHash !== current.accessPolicy.passwordHash
      ) {
        newPolicy.passwordHash = PortalAccessService.hashPassword(updates.accessPolicy.passwordHash);
      }
      updatedPortal.accessPolicy = newPolicy;
      changedFields.push('accessPolicy');
    }

    if (updates.features) {
      updatedPortal.features = { ...current.features, ...updates.features };
      changedFields.push('features');
    }

    if (updates.seo) {
      updatedPortal.seo = { ...current.seo, ...updates.seo };
      changedFields.push('seo');
    }

    if (updates.homeLayout !== undefined) {
      updatedPortal.homeLayout = updates.homeLayout;
      changedFields.push('homeLayout');
    }

    if (updates.homePageDocumentId !== undefined) {
      updatedPortal.homePageDocumentId = updates.homePageDocumentId;
      changedFields.push('homePageDocumentId');
    }

    if (updates.customDomain !== undefined) {
      updatedPortal.customDomain = updates.customDomain;
      changedFields.push('customDomain');
    }

    updatedPortal.updatedAt = now;

    await docRef.set(updatedPortal);

    if (changedFields.length > 0) {
      await PortalEventService.emitPortalUpdated(updatedPortal, changedFields, userId);
    }

    return updatedPortal;
  }

  /**
   * Publishes a portal with preflight validation.
   */
  static async publishPortal(portalId: string, userId: string): Promise<Portal> {
    const portal = await this.getPortalById(portalId);
    if (!portal) throw new Error(`Portal ${portalId} not found`);

    if (!portal.name || portal.name.trim().length === 0) {
      throw new Error('Portal name is required to publish.');
    }

    if (!portal.slug || portal.slug.trim().length === 0) {
      throw new Error('Portal slug is required to publish.');
    }

    return this.updatePortal(portalId, { status: 'published' }, userId);
  }

  /**
   * Suspends a portal taking it temporarily offline.
   */
  static async suspendPortal(portalId: string, reason: string, userId: string): Promise<Portal> {
    const portal = await this.getPortalById(portalId);
    if (!portal) throw new Error(`Portal ${portalId} not found`);

    const updated = await this.updatePortal(
      portalId,
      {
        status: 'suspended',
        accessPolicy: { ...portal.accessPolicy, suspendedReason: reason },
      },
      userId
    );

    await PortalEventService.emitPortalSuspended(updated, reason, userId);
    return updated;
  }

  /**
   * Archives a portal.
   */
  static async archivePortal(portalId: string, userId: string): Promise<Portal> {
    const updated = await this.updatePortal(portalId, { status: 'archived' }, userId);
    await PortalEventService.emitPortalArchived(updated, userId);
    return updated;
  }

  /**
   * Deep duplicates a portal.
   */
  static async duplicatePortal(
    portalId: string,
    newName: string,
    newSlug: string | undefined,
    userId: string
  ): Promise<Portal> {
    const source = await this.getPortalById(portalId);
    if (!source) throw new Error(`Source portal ${portalId} not found`);

    const slug = newSlug
      ? this.sanitizeSlug(newSlug)
      : await this.generateUniqueSlug(newName, source.organizationId);

    const docRef = adminDb.collection('portals').doc();
    const now = new Date().toISOString();

    const duplicated: Portal = {
      ...source,
      id: docRef.id,
      name: newName.trim(),
      slug,
      status: 'draft',
      publishedAt: undefined,
      suspendedAt: undefined,
      archivedAt: undefined,
      stats: { totalMembers: 0, activeLearners: 0, totalViews: 0, courseCompletions: 0 },
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(duplicated);
    await PortalEventService.emitPortalCreated(duplicated, userId);

    return duplicated;
  }

  /**
   * Deletes a portal document.
   */
  static async deletePortal(portalId: string, userId: string): Promise<void> {
    const docRef = adminDb.collection('portals').doc(portalId);
    const snap = await docRef.get();
    if (!snap.exists) return;

    const portal = snap.data() as Portal;
    await docRef.delete();
    await PortalEventService.emitPortalArchived(portal, userId);
  }

  /**
   * Fetches a portal by its document ID.
   */
  static async getPortalById(portalId: string): Promise<Portal | null> {
    const docRef = adminDb.collection('portals').doc(portalId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return snap.data() as Portal;
  }

  /**
   * Fetches a portal by slug (and optional organizationId).
   */
  static async getPortalBySlug(slug: string, organizationId?: string): Promise<Portal | null> {
    const cleanSlug = this.sanitizeSlug(slug);
    let q = adminDb.collection('portals').where('slug', '==', cleanSlug);

    if (organizationId) {
      q = q.where('organizationId', '==', organizationId);
    }

    const snap = await q.limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].data() as Portal;
  }

  /**
   * Lists all portals for an organization, optionally filtered by workspaceId.
   */
  static async listPortalsByOrganization(
    organizationId: string,
    workspaceId?: string
  ): Promise<Portal[]> {
    let q = adminDb
      .collection('portals')
      .where('organizationId', '==', organizationId)
      .orderBy('updatedAt', 'desc');

    if (workspaceId && workspaceId !== 'global') {
      q = adminDb
        .collection('portals')
        .where('organizationId', '==', organizationId)
        .where('workspaceIds', 'array-contains', workspaceId)
        .orderBy('updatedAt', 'desc');
    }

    const snap = await q.get();
    return snap.docs.map(doc => doc.data() as Portal);
  }
}
