'use server';

/**
 * {{Org_name}} Experience Platform — Content Studio Draft Server Actions
 *
 * Provides strongly typed server actions for cross-device cloud draft synchronization,
 * team draft listing, and session recovery in Content Studio.
 *
 * Rules:
 * - Strictly typed: Zero `any`, zero `any[]`.
 * - Multi-tenant isolated: scoped by portalId and organizationId.
 */

import { ContentService } from '@/lib/services/content-service';
import { toClientErrorMessage } from '@/lib/errors/report-error';
import type { ContentStudioDraft } from '@/lib/types/content';

export interface DraftActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function saveContentStudioDraftAction(
  draft: ContentStudioDraft
): Promise<DraftActionResponse<void>> {
  try {
    await ContentService.saveDraft(draft);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('actions.draft-actions', err, undefined, 'Failed to save cloud draft.'),
    };
  }
}

export async function getContentStudioDraftAction(
  portalId: string,
  contentItemId: string | null,
  authorId?: string
): Promise<DraftActionResponse<ContentStudioDraft | null>> {
  try {
    const draft = await ContentService.getDraft(portalId, contentItemId, authorId);
    return { success: true, data: draft };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('actions.draft-actions', err, undefined, 'Failed to get cloud draft.'),
    };
  }
}

export async function discardContentStudioDraftAction(
  portalId: string,
  contentItemId: string | null,
  authorId?: string
): Promise<DraftActionResponse<void>> {
  try {
    await ContentService.discardDraft(portalId, contentItemId, authorId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('actions.draft-actions', err, undefined, 'Failed to discard cloud draft.'),
    };
  }
}

export async function listContentStudioDraftsByPortalAction(
  portalId: string
): Promise<DraftActionResponse<ContentStudioDraft[]>> {
  try {
    const drafts = await ContentService.listDraftsByPortal(portalId);
    return { success: true, data: drafts };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('actions.draft-actions', err, undefined, 'Failed to list cloud drafts.'),
    };
  }
}
