/**
 * @fileoverview Deals Platform 2.0 Saved Views Server Actions
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 123 & Sections 31, 32):
 * - Manages persistent, personalized, and workspace-shared saved view configurations.
 * - Handles authorization checks via `canUser()`.
 * - Combines built-in system presets with database custom views.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 9, Rule 5):
 * - Strict zero 'any' / zero 'any[]'.
 * - Multi-tenant isolation: All queries filter by `workspaceId`.
 * - Author protection: Private views are visible only to the creator.
 *
 * TESTABILITY POINTER:
 * Unit and integration tests in `src/app/actions/__tests__/deal-actions.phase6.test.ts`.
 */

'use server';

import { adminDb } from '@/lib/firebase-admin';
import { canUser } from '@/lib/workspace-permissions';
import { logActivity } from '@/lib/activity-logger';
import { revalidatePath } from 'next/cache';
import {
  type DealSavedView,
  SYSTEM_SAVED_VIEW_PRESETS,
  DEFAULT_DEAL_COLUMNS,
} from '@/lib/deals/deal-saved-views';

export interface CreateDealSavedViewInput {
  workspaceId: string;
  organizationId?: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  visibility?: 'private' | 'workspace';
  pipelineId?: string | null;
  filters: DealSavedView['filters'];
  columns?: DealSavedView['columns'];
  density?: DealSavedView['density'];
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  viewMode?: DealSavedView['viewMode'];
  isDefault?: boolean;
}

/**
 * Creates a new custom Deal Saved View.
 */
export async function createDealSavedViewAction(
  input: CreateDealSavedViewInput,
  userId: string,
  userName?: string
): Promise<{ success: boolean; view?: DealSavedView; error?: string }> {
  try {
    if (!input.name?.trim() || !input.workspaceId || !userId) {
      return { success: false, error: 'Missing required parameters for saved view.' };
    }

    const permission = await canUser(userId, 'operations', 'pipeline', 'edit', input.workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason || 'Permission denied.' };
    }

    const viewId = `view_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newView: DealSavedView = {
      id: viewId,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId || 'default',
      userId,
      userName: userName || 'User',
      name: input.name.trim(),
      icon: input.icon || 'Bookmark',
      color: input.color || '#6366f1',
      description: input.description?.trim() || '',
      visibility: input.visibility || 'workspace',
      pipelineId: input.pipelineId || null,
      filters: input.filters || {},
      columns: input.columns || DEFAULT_DEAL_COLUMNS,
      density: input.density || 'standard',
      sortBy: input.sortBy || 'createdAt',
      sortDir: input.sortDir || 'desc',
      viewMode: input.viewMode || 'kanban',
      isDefault: Boolean(input.isDefault),
      isSystemPreset: false,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('deal_saved_views').doc(viewId).set(newView);

    await logActivity({
      organizationId: input.organizationId || 'default',
      workspaceId: input.workspaceId,
      entityId: 'saved_view',
      userId,
      type: 'deal_saved_view_created',
      source: 'user',
      description: `created saved deal view "${input.name.trim()}"`,
      metadata: { viewId, visibility: input.visibility },
    });

    revalidatePath('/admin/pipeline');
    return { success: true, view: newView };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create saved view';
    console.error('[createDealSavedViewAction] Error:', err);
    return { success: false, error: message };
  }
}

/**
 * Updates an existing Deal Saved View.
 */
export async function updateDealSavedViewAction(
  viewId: string,
  updates: Partial<DealSavedView>,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('deal_saved_views').doc(viewId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Saved view not found.' };
    }

    const existing = snap.data() as DealSavedView;

    // Check authorization: author or workspace admin
    if (existing.userId !== userId) {
      const permission = await canUser(userId, 'operations', 'pipeline', 'edit', existing.workspaceId);
      if (!permission.granted) {
        return { success: false, error: 'Unauthorized to modify this saved view.' };
      }
    }

    const now = new Date().toISOString();
    const cleanUpdates = {
      ...updates,
      updatedAt: now,
    };
    delete (cleanUpdates as Record<string, unknown>).id;
    delete (cleanUpdates as Record<string, unknown>).isSystemPreset;

    await docRef.update(cleanUpdates);

    revalidatePath('/admin/pipeline');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update saved view';
    return { success: false, error: message };
  }
}

/**
 * Deletes a custom Deal Saved View.
 */
export async function deleteDealSavedViewAction(
  viewId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('deal_saved_views').doc(viewId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Saved view not found.' };
    }

    const existing = snap.data() as DealSavedView;

    if (existing.userId !== userId) {
      const permission = await canUser(userId, 'operations', 'pipeline', 'edit', existing.workspaceId);
      if (!permission.granted) {
        return { success: false, error: 'Unauthorized to delete this saved view.' };
      }
    }

    await docRef.delete();

    revalidatePath('/admin/pipeline');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete saved view';
    return { success: false, error: message };
  }
}

/**
 * Lists all available saved views for the current user and workspace.
 */
export async function listDealSavedViewsAction(
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; views?: DealSavedView[]; error?: string }> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'WorkspaceId is required.' };
    }

    // 1. Fetch workspace custom views
    const snap = await adminDb
      .collection('deal_saved_views')
      .where('workspaceId', '==', workspaceId)
      .get();

    const customViews: DealSavedView[] = [];
    snap.docs.forEach(doc => {
      const v = doc.data() as DealSavedView;
      // Filter out private views created by other users
      if (v.visibility === 'workspace' || v.userId === userId) {
        customViews.push(v);
      }
    });

    // 2. Map system presets into full DealSavedView instances
    const systemPresets: DealSavedView[] = SYSTEM_SAVED_VIEW_PRESETS.map(preset => ({
      ...preset,
      workspaceId,
      userId: 'system',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));

    // System presets first, then custom views sorted alphabetically
    customViews.sort((a, b) => a.name.localeCompare(b.name));
    const allViews = [...systemPresets, ...customViews];

    return { success: true, views: allViews };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list saved views';
    return { success: false, error: message };
  }
}
