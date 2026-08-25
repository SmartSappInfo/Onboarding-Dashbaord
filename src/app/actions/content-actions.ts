'use server';

/**
 * {{Org_name}} Experience Platform — Content Server Actions
 *
 * Strongly-typed Server Actions for ContentItem CRUD, publishing,
 * search indexing, and automatic Next.js path revalidation.
 */

import { revalidatePath } from 'next/cache';
import { ContentService } from '@/lib/services/content-service';
import type {
  ContentItem,
  CreateContentItemInput,
  UpdateContentItemInput,
  ContentFilterOptions,
  ContentSearchResult,
  ContentItemType,
} from '@/lib/types/content';

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createContentItemAction(
  input: CreateContentItemInput
): Promise<ActionResponse<ContentItem>> {
  try {
    const item = await ContentService.createContentItem(input, 'admin_user');
    revalidatePath(`/admin/portals/${input.portalId}`);
    revalidatePath(`/portal/[slug]`, 'layout');
    return { success: true, data: item };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create content item.',
    };
  }
}

export async function updateContentItemAction(
  itemId: string,
  input: UpdateContentItemInput,
  portalId?: string
): Promise<ActionResponse<ContentItem>> {
  try {
    const item = await ContentService.updateContentItem(itemId, input, 'admin_user');
    if (portalId) {
      revalidatePath(`/admin/portals/${portalId}`);
    }
    revalidatePath(`/portal/[slug]`, 'layout');
    return { success: true, data: item };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update content item.',
    };
  }
}

export async function publishContentItemAction(
  itemId: string,
  portalId?: string
): Promise<ActionResponse<ContentItem>> {
  try {
    const item = await ContentService.publishContentItem(itemId, 'admin_user');
    if (portalId) {
      revalidatePath(`/admin/portals/${portalId}`);
    }
    revalidatePath(`/portal/[slug]`, 'layout');
    return { success: true, data: item };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to publish content item.',
    };
  }
}

export async function archiveContentItemAction(
  itemId: string,
  portalId?: string
): Promise<ActionResponse<ContentItem>> {
  try {
    const item = await ContentService.archiveContentItem(itemId, 'admin_user');
    if (portalId) {
      revalidatePath(`/admin/portals/${portalId}`);
    }
    revalidatePath(`/portal/[slug]`, 'layout');
    return { success: true, data: item };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to archive content item.',
    };
  }
}

export async function deleteContentItemAction(
  itemId: string,
  portalId: string
): Promise<ActionResponse<void>> {
  try {
    await ContentService.deleteContentItem(itemId);
    revalidatePath(`/admin/portals/${portalId}`);
    revalidatePath(`/portal/[slug]`, 'layout');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete content item.',
    };
  }
}

export async function getContentItemBySlugAction(
  portalId: string,
  type: ContentItemType,
  slug: string
): Promise<ActionResponse<ContentItem | null>> {
  try {
    const item = await ContentService.getContentItemBySlug(portalId, type, slug);
    return { success: true, data: item };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch content item.',
    };
  }
}

export async function searchPortalContentAction(
  portalId: string,
  query: string,
  filters: ContentFilterOptions = {}
): Promise<ActionResponse<ContentSearchResult[]>> {
  try {
    const results = await ContentService.searchPortalContent(portalId, query, filters);
    return { success: true, data: results };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Search failed.',
    };
  }
}
