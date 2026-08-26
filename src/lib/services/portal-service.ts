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

import {
  DEFAULT_FEATURE_TOGGLES,
  DEFAULT_THEME,
  DEFAULT_NAVIGATION,
  DEFAULT_ACCESS_POLICY,
  DEFAULT_SEO,
  PORTAL_MODE_PRESETS,
} from '../portal-presets';
import {
  getPortalRadiusCss,
  getGoogleFontsUrl,
  getPortalThemeVariables,
  getPortalButtonInlineStyle,
} from '../utils/portal-theme';
import { sanitizeSlug } from '../utils/slug-utils';

export {
  DEFAULT_FEATURE_TOGGLES,
  DEFAULT_THEME,
  DEFAULT_NAVIGATION,
  DEFAULT_ACCESS_POLICY,
  DEFAULT_SEO,
  PORTAL_MODE_PRESETS,
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
    return sanitizeSlug(raw);
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

  /**
   * Returns CSS radius value corresponding to the configured UI border radius.
   */
  static getPortalRadiusCss = getPortalRadiusCss;

  /**
   * Generates a Google Fonts stylesheet URL for the configured heading and body fonts.
   */
  static getGoogleFontsUrl = getGoogleFontsUrl;

  /**
   * Computes the complete CSS variable map for the given portal theme.
   */
  static getPortalThemeVariables = getPortalThemeVariables;

  /**
   * Computes inline CSS treatment for buttons based on primary color, border radius, and style preset.
   */
  static getPortalButtonInlineStyle = getPortalButtonInlineStyle;
}
