'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';
import type { PlatformTemplate, PlatformTemplateType } from './backoffice-types';
import { 
  normalizePermissionsSchema, 
  getFullAdminPermissions, 
  getOperationsPermissions, 
  getFinancePermissions, 
  getMarketingPermissions 
} from '../permissions-engine';
import { propagateTemplateToWorkspaces, type PropagationTargetFilter, type PropagationResult } from './template-propagation-engine';

// ─────────────────────────────────────────────────
// Backoffice Template Server Actions
// Operations for managing global platform templates.
//
// Security: every action verifies the caller's ID token and enforces RBAC
// via `authorizeBackoffice` (server-auth-actions). Actor derived server-side.
// ─────────────────────────────────────────────────

export async function listAllTemplates(idToken: string): Promise<{
  success: boolean;
  data?: PlatformTemplate[];
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'templates', 'view');

    const snap = await adminDb.collection('platform_templates').orderBy('name', 'asc').get();
    const templates = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformTemplate));

    return { success: true, data: templates };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_TEMPLATE] listAllTemplates failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getTemplateDetail(templateId: string, idToken: string): Promise<{
  success: boolean;
  data?: PlatformTemplate;
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'templates', 'view');

    const doc = await adminDb.collection('platform_templates').doc(templateId).get();
    if (!doc.exists) {
      return { success: false, error: 'Template not found' };
    }

    return { success: true, data: { id: doc.id, ...doc.data() } as PlatformTemplate };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_TEMPLATE] getTemplateDetail failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function publishTemplate(
  templateId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'templates', 'edit');

    const ref = adminDb.collection('platform_templates').doc(templateId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, error: 'Template not found' };
    }

    const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

    await ref.update({
      status: 'published',
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    });

    const afterSnap = await ref.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'template.publish', 'template', templateId, {
      before,
      after,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_TEMPLATE] publishTemplate failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deprecateTemplate(
  templateId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'templates', 'edit');

    const ref = adminDb.collection('platform_templates').doc(templateId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, error: 'Template not found' };
    }

    const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

    await ref.update({
      status: 'deprecated',
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    });

    const afterSnap = await ref.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'template.deprecate', 'template', templateId, {
      before,
      after,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_TEMPLATE] deprecateTemplate failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createTemplateAction(
  data: {
    type: PlatformTemplateType;
    name: string;
    description: string;
    category: string;
    content: unknown;
    defaultForNewOrgs: boolean;
    visibilityRules: {
      orgIds?: string[];
      workspaceTypes?: string[];
    };
  },
  idToken: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'templates', 'create');
    const templateId = adminDb.collection('platform_templates').doc().id;
    const timestamp = new Date().toISOString();

    const template: PlatformTemplate = {
      id: templateId,
      ...data,
      scope: 'system',
      version: 1,
      versionHistory: [
        {
          version: 1,
          content: data.content,
          publishedAt: timestamp,
          publishedBy: actor.email,
          changelog: 'Initial version created.',
        },
      ],
      status: 'draft',
      usageCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: actor.userId,
    };

    await adminDb.collection('platform_templates').doc(templateId).set(template);

    await logBackofficeAction(actor, 'template.create', 'template', templateId, {
      before: null,
      after: createAuditSnapshot(template as unknown as Record<string, unknown>),
    });

    return { success: true, id: templateId };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_TEMPLATE] createTemplateAction failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateTemplateAction(
  templateId: string,
  updates: {
    name?: string;
    description?: string;
    category?: string;
    content?: unknown;
    defaultForNewOrgs?: boolean;
    status?: 'draft' | 'published' | 'deprecated' | 'archived';
    visibilityRules?: {
      orgIds?: string[];
      workspaceTypes?: string[];
    };
    changelog?: string;
  },
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'templates', 'edit');
    const ref = adminDb.collection('platform_templates').doc(templateId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, error: 'Template not found' };
    }

    const current = snap.data() as PlatformTemplate;
    const before = createAuditSnapshot(current as unknown as Record<string, unknown>);
    const timestamp = new Date().toISOString();

    const updatedFields: Record<string, unknown> = {
      ...updates,
      updatedAt: timestamp,
      updatedBy: actor.userId,
    };

    if (updates.content !== undefined && JSON.stringify(updates.content) !== JSON.stringify(current.content)) {
      const nextVersion = current.version + 1;
      updatedFields.version = nextVersion;
      updatedFields.versionHistory = [
        ...current.versionHistory,
        {
          version: nextVersion,
          content: updates.content,
          publishedAt: timestamp,
          publishedBy: actor.email,
          changelog: updates.changelog || `Updated to version ${nextVersion}.`,
        },
      ];
    }

    delete updatedFields.changelog;

    await ref.update(updatedFields);

    const afterSnap = await ref.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'template.update', 'template', templateId, {
      before,
      after,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_TEMPLATE] updateTemplateAction failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteTemplateAction(
  templateId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'templates', 'delete');
    const ref = adminDb.collection('platform_templates').doc(templateId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, error: 'Template not found' };
    }

    const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

    await ref.delete();

    await logBackofficeAction(actor, 'template.delete', 'template', templateId, {
      before,
      after: null,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_TEMPLATE] deleteTemplateAction failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Standard built-in role architecture blueprints available across all organizations.
 */
export const BUILTIN_ROLE_BLUEPRINTS: PlatformTemplate[] = [
  {
    id: 'builtin-super-admin',
    name: 'Super Admin (All Access)',
    description: 'Complete unrestricted access across all operational, financial, studio, and management silos.',
    category: 'Executive',
    type: 'role_architecture',
    scope: 'system',
    status: 'published',
    version: 1,
    versionHistory: [],
    defaultForNewOrgs: true,
    visibilityRules: { orgIds: [], workspaceTypes: [] },
    content: getFullAdminPermissions(),
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'builtin-operations-lead',
    name: 'Operations Lead',
    description: 'Full oversight of daily operations, campuses, pipelines, tasks, and team meetings.',
    category: 'Operations',
    type: 'role_architecture',
    scope: 'system',
    status: 'published',
    version: 1,
    versionHistory: [],
    defaultForNewOrgs: false,
    visibilityRules: { orgIds: [], workspaceTypes: [] },
    content: getOperationsPermissions(),
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'builtin-finance-officer',
    name: 'Finance Officer',
    description: 'Manages contracts, customer agreements, invoices, package tiers, and billing cycles.',
    category: 'Finance',
    type: 'role_architecture',
    scope: 'system',
    status: 'published',
    version: 1,
    versionHistory: [],
    defaultForNewOrgs: false,
    visibilityRules: { orgIds: [], workspaceTypes: [] },
    content: getFinancePermissions(),
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'builtin-studio-manager',
    name: 'Studio & Marketing Lead',
    description: 'Full management of landing pages, public portals, media assets, messaging, forms, and surveys.',
    category: 'Studios',
    type: 'role_architecture',
    scope: 'system',
    status: 'published',
    version: 1,
    versionHistory: [],
    defaultForNewOrgs: false,
    visibilityRules: { orgIds: [], workspaceTypes: [] },
    content: getMarketingPermissions(),
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
];

export async function getPublishedTemplatesAction(
  type: PlatformTemplateType,
  industry?: string,
  organizationId?: string
): Promise<{ success: boolean; data?: PlatformTemplate[]; error?: string }> {
  try {
    const snap = await adminDb.collection('platform_templates')
      .where('type', '==', type)
      .where('status', '==', 'published')
      .get();

    let templates: PlatformTemplate[] = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PlatformTemplate));

    // Scoping Rule: Filter by organization visibility
    templates = templates.filter(t => {
      const orgIds = t.visibilityRules?.orgIds;
      if (orgIds && orgIds.length > 0) {
        return organizationId ? orgIds.includes(organizationId) : false;
      }
      return true;
    });

    // Scoping Rule: Filter by Industry / Workspace Types
    if (industry && industry !== 'all') {
      templates = templates.filter(t => {
        const workspaceTypes = t.visibilityRules?.workspaceTypes;
        if (workspaceTypes && workspaceTypes.length > 0) {
          return workspaceTypes.includes(industry) || workspaceTypes.includes('all');
        }

        const content = t.content as Record<string, unknown> | null;
        const templateIndustry = (content && typeof content.industry === 'string')
          ? content.industry
          : (t as unknown as Record<string, unknown>).industry;
        
        if (templateIndustry && typeof templateIndustry === 'string' && templateIndustry !== 'all' && templateIndustry !== industry) {
          return false;
        }
        return true;
      });
    }

    // Schema Normalization: For role architecture templates, guarantee valid PermissionsSchema
    if (type === 'role_architecture') {
      templates = templates.map(t => ({
        ...t,
        content: normalizePermissionsSchema(t.content),
      }));

      // Combine published templates with built-in presets (avoiding duplicate names)
      const existingNames = new Set(templates.map(t => t.name.toLowerCase()));
      const filteredBuiltins = BUILTIN_ROLE_BLUEPRINTS.filter(
        b => !existingNames.has(b.name.toLowerCase())
      );
      templates = [...templates, ...filteredBuiltins];
    }

    return { success: true, data: templates };
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    console.error(`[TEMPLATE_ACTION] getPublishedTemplatesAction failed for type ${type}:`, msg);

    // Fallback: If DB query encounters error on role_architecture, provide safe builtins
    if (type === 'role_architecture') {
      return { success: true, data: BUILTIN_ROLE_BLUEPRINTS };
    }

    return { success: false, error: msg };
  }
}

/**
 * Server Action: Propagate a published platform template to matching workspaces.
 * Delegates to the template propagation engine securely on the server.
 */
export async function propagateTemplateAction(
  templateId: string,
  filter: PropagationTargetFilter,
  idToken: string
): Promise<PropagationResult> {
  return propagateTemplateToWorkspaces(templateId, filter, idToken);
}
