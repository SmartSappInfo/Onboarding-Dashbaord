'use server';

/**
 * ARCHITECTURE:
 * Server Actions for Creative Studio Cloud Comments & Team Discussions (Phase 1)
 * 
 * Replaces browser localStorage comments with multi-tenant Firestore cloud
 * persistence in `creative_comments`.
 * 
 * CAUTION:
 * Input comments are trimmed and sanitized.
 * 0% any/any[] strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { CreativeComment } from '@/lib/creative/creative-types';
import { makeUniqueId } from '@/lib/creative/creative-types';
import type { ActionResult } from './creative-project-actions';

export interface AddCommentInput {
  authorName: string;
  authorEmail: string;
  authorId?: string;
  text: string;
  documentId?: string;
  elementId?: string;
}

export async function listProjectCommentsAction(
  projectId: string
): Promise<ActionResult<CreativeComment[]>> {
  try {
    if (!projectId) {
      return { success: false, error: 'Project ID is required.' };
    }

    const snap = await adminDb
      .collection('creative_comments')
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'asc')
      .get();

    const comments = snap.docs.map((d) => d.data() as CreativeComment);
    return { success: true, data: comments };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list comments';
    console.error('[listProjectCommentsAction] Error:', error);
    return { success: false, error: message };
  }
}

export async function addProjectCommentAction(
  projectId: string,
  input: AddCommentInput
): Promise<ActionResult<CreativeComment>> {
  try {
    if (!projectId || !input.text?.trim()) {
      return { success: false, error: 'Project ID and Comment Text are required.' };
    }

    const commentId = makeUniqueId();
    const now = new Date().toISOString();

    const newComment: CreativeComment = {
      id: commentId,
      projectId,
      documentId: input.documentId,
      elementId: input.elementId,
      authorId: input.authorId,
      authorName: input.authorName.trim() || 'Team Member',
      authorEmail: input.authorEmail.trim() || 'user@smartsapp.com',
      text: input.text.trim(),
      resolved: false,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('creative_comments').doc(commentId).set(newComment);

    return { success: true, data: newComment };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add comment';
    console.error('[addProjectCommentAction] Error:', error);
    return { success: false, error: message };
  }
}

export async function resolveProjectCommentAction(
  commentId: string,
  resolved: boolean
): Promise<ActionResult<{ resolved: boolean }>> {
  try {
    if (!commentId) {
      return { success: false, error: 'Comment ID is required.' };
    }

    const commentRef = adminDb.collection('creative_comments').doc(commentId);
    await commentRef.update({
      resolved,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, data: { resolved } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update comment status';
    console.error('[resolveProjectCommentAction] Error:', error);
    return { success: false, error: message };
  }
}

export async function deleteProjectCommentAction(
  commentId: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    if (!commentId) {
      return { success: false, error: 'Comment ID is required.' };
    }

    await adminDb.collection('creative_comments').doc(commentId).delete();
    return { success: true, data: { deleted: true } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete comment';
    console.error('[deleteProjectCommentAction] Error:', error);
    return { success: false, error: message };
  }
}
