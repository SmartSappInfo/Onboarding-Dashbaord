'use server';

/**
 * {{Org_name}} Experience Platform — Content Server Actions
 *
 * Strongly-typed Server Actions for ContentItem CRUD, publishing,
 * search indexing, and automatic Next.js path revalidation.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a / audit F2): public endpoints.
 * - Authoring, publishing, templates: staff (`requirePortalAdmin`); the item must belong to that portal,
 *   the organization is the portal's, and the actor is the verified staff uid (was 'admin_user').
 * - Reads/search: staff see every status; everyone else gets published items shaped by
 *   `presentForViewer` (gated bodies/media trimmed server-side — Round 4 item 4).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ContentService } from '@/lib/services/content-service';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  assertRecordInPortal,
  portalAuthErrorMessage,
  portalIdOfRecord,
  requirePortalAdmin,
  resolvePortalViewer,
  type PortalViewer,
} from '@/lib/auth/require-portal-access';
import { EntitlementService } from '@/lib/services/entitlement-service';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import type { EntitlementCheckResult } from '@/lib/types/membership';
import type {
  ContentItem,
  CreateContentItemInput,
  UpdateContentItemInput,
  ContentFilterOptions,
  ContentSearchResult,
  PortalContentTemplate,
  CreatePortalContentTemplateInput,
} from '@/lib/types/content';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: portalAuthErrorMessage(err) ?? toClientErrorMessage('actions.content-actions', err, undefined, fallback) };
}

/** Staff guard for an existing item: resolves the portal from the item itself when the caller omits it. */
async function requireItemAdmin(itemId: string, portalId: string | undefined): Promise<{ uid: string; portalId: string }> {
  const resolvedPortalId = portalId ?? (await portalIdOfRecord('content_items', itemId));
  const { auth } = await requirePortalAdmin(resolvedPortalId);
  await assertRecordInPortal('content_items', itemId, resolvedPortalId);
  return { uid: auth.uid, portalId: resolvedPortalId };
}

export async function createContentItemAction(
  input: CreateContentItemInput
): Promise<ActionResponse<ContentItem>> {
  try {
    const { auth, portal } = await requirePortalAdmin(input.portalId);
    const item = await ContentService.createContentItem({ ...input, organizationId: portal.organizationId }, auth.uid);
    revalidatePath(`/admin/portals/${input.portalId}`);
    revalidatePath(`/portal/[slug]`, 'layout');
    return { success: true, data: item };
  } catch (err) {
    return failure(err, 'Failed to create content item.');
  }
}

export async function updateContentItemAction(
  itemId: string,
  input: UpdateContentItemInput,
  portalId?: string
): Promise<ActionResponse<ContentItem>> {
  try {
    const { uid } = await requireItemAdmin(itemId, portalId);
    const item = await ContentService.updateContentItem(itemId, input, uid);
    if (portalId) {
      revalidatePath(`/admin/portals/${portalId}`);
    }
    revalidatePath(`/portal/[slug]`, 'layout');
    return { success: true, data: item };
  } catch (err) {
    return failure(err, 'Failed to update content item.');
  }
}

export async function publishContentItemAction(
  itemId: string,
  portalId?: string
): Promise<ActionResponse<ContentItem>> {
  try {
    const { uid } = await requireItemAdmin(itemId, portalId);
    const item = await ContentService.publishContentItem(itemId, uid);
    if (portalId) {
      revalidatePath(`/admin/portals/${portalId}`);
    }
    revalidatePath(`/portal/[slug]`, 'layout');
    return { success: true, data: item };
  } catch (err) {
    return failure(err, 'Failed to publish content item.');
  }
}

export async function archiveContentItemAction(
  itemId: string,
  portalId?: string
): Promise<ActionResponse<ContentItem>> {
  try {
    const { uid } = await requireItemAdmin(itemId, portalId);
    const item = await ContentService.archiveContentItem(itemId, uid);
    if (portalId) {
      revalidatePath(`/admin/portals/${portalId}`);
    }
    revalidatePath(`/portal/[slug]`, 'layout');
    return { success: true, data: item };
  } catch (err) {
    return failure(err, 'Failed to archive content item.');
  }
}

export async function deleteContentItemAction(
  itemId: string,
  portalId: string
): Promise<ActionResponse<void>> {
  try {
    await requireItemAdmin(itemId, portalId);
    await ContentService.deleteContentItem(itemId);
    revalidatePath(`/admin/portals/${portalId}`);
    revalidatePath(`/portal/[slug]`, 'layout');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to delete content item.');
  }
}

/** What a viewer may see of an item, plus why (drives the reader's paywall / sign-in prompts). */
export interface ContentItemForViewer {
  item: ContentItem | null;
  access: EntitlementCheckResult;
}

/**
 * SECURITY (Round 4 item 4): the ONE place portal content is shaped for a viewer. Staff get items
 * as stored (drafts included). Everyone else gets published items only, each passed through the
 * entitlement rules and `sanitizeContentItemForVisitor`, so gated bodies, media and file links never
 * leave the server. Firestore reads of `content_items` are staff-only (firestore.rules).
 */
async function presentForViewer(items: ContentItem[], portalId: string, viewer: PortalViewer): Promise<Array<{ item: ContentItem; access: EntitlementCheckResult }>> {
  if (viewer.isStaff) return items.map(item => ({ item, access: { hasAccess: true, reason: 'admin_bypass' } }));
  const published = items.filter(item => item.status === 'published');
  // Load the viewer's membership and grants once for the whole list.
  const viewerContext = viewer.userId
    ? {
        membership: await PortalMembershipService.getMembership(portalId, viewer.userId),
        grants: await EntitlementService.listUserGrants(portalId, viewer.userId),
      }
    : undefined;
  return Promise.all(
    published.map(async item => {
      const access = await EntitlementService.evaluateContentItemAccess(item, viewer.userId, portalId, false, viewerContext);
      return { item: EntitlementService.sanitizeContentItemForVisitor(item, access), access };
    })
  );
}

const ContentItemTypeSchema = z.enum(['page', 'article', 'lesson', 'resource', 'video', 'file', 'announcement', 'embed']);

/**
 * Reader: one item by slug, shaped for the viewer (null when missing, or a draft for non-staff).
 * `type` is the raw route segment; it is validated here rather than cast on the client.
 */
export async function getContentItemForViewerAction(
  idToken: string | null,
  portalId: string,
  type: string,
  slug: string
): Promise<ActionResponse<ContentItemForViewer>> {
  try {
    const parsedType = ContentItemTypeSchema.safeParse(type);
    if (!parsedType.success) {
      return { success: true, data: { item: null, access: { hasAccess: false, reason: 'no_entitlement' } } };
    }
    const viewer = await resolvePortalViewer(idToken, portalId);
    const stored = await ContentService.getContentItemBySlug(portalId, parsedType.data, slug);
    const [shaped] = stored ? await presentForViewer([stored], portalId, viewer) : [];
    return {
      success: true,
      data: shaped ?? { item: null, access: { hasAccess: false, reason: 'no_entitlement' } },
    };
  } catch (err) {
    return failure(err, 'Failed to fetch content item.');
  }
}

/**
 * @param idToken Optional member ID token (portal pages). Staff screens rely on the admin session.
 *   Trailing + optional so existing `(portalId, query, filters)` callers keep working unchanged.
 */
export async function searchPortalContentAction(
  portalId: string,
  query: string,
  filters: ContentFilterOptions = {},
  idToken?: string | null
): Promise<ActionResponse<ContentSearchResult[]>> {
  try {
    const viewer = await resolvePortalViewer(idToken, portalId);
    const results = await ContentService.searchPortalContent(portalId, query, viewer.isStaff ? filters : { ...filters, status: 'published' });
    const shaped = await presentForViewer(results.map(r => r.item), portalId, viewer);
    const byId = new Map(shaped.map(s => [s.item.id, s.item]));
    return {
      success: true,
      data: results.flatMap(r => {
        const item = byId.get(r.item.id);
        return item ? [{ ...r, item }] : [];
      }),
    };
  } catch (err) {
    return failure(err, 'Search failed.');
  }
}

/**
 * @param idToken Optional member ID token (portal pages). Staff screens rely on the admin session.
 *   Trailing + optional so existing `(portalId, options)` callers keep working unchanged.
 */
export async function listContentItemsByPortalAction(
  portalId: string,
  options?: ContentFilterOptions,
  idToken?: string | null
): Promise<ActionResponse<ContentItem[]>> {
  try {
    const viewer = await resolvePortalViewer(idToken, portalId);
    const items = await ContentService.listContentItems(portalId, viewer.isStaff ? options : { ...options, status: 'published' });
    const shaped = await presentForViewer(items, portalId, viewer);
    return { success: true, data: shaped.map(s => s.item) };
  } catch (err) {
    return failure(err, 'Failed to list content items.');
  }
}

export async function createPortalContentTemplateAction(
  input: CreatePortalContentTemplateInput
): Promise<ActionResponse<PortalContentTemplate>> {
  try {
    const { auth, portal } = await requirePortalAdmin(input.portalId);
    const template = await ContentService.createPortalContentTemplate({ ...input, organizationId: portal.organizationId }, auth.uid);
    return { success: true, data: template };
  } catch (err) {
    return failure(err, 'Failed to save template.');
  }
}

export async function listPortalContentTemplatesAction(
  portalId: string
): Promise<ActionResponse<PortalContentTemplate[]>> {
  try {
    await requirePortalAdmin(portalId);
    const templates = await ContentService.listPortalContentTemplates(portalId);
    return { success: true, data: templates };
  } catch (err) {
    return failure(err, 'Failed to fetch templates.');
  }
}

