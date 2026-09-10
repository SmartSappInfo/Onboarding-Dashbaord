'use client';

/**
 * @fileoverview Reactive Hook for Optimistic Offline Knowledge Mutations (Phase 10).
 *
 * ARCHITECTURAL NOTES & FUTURE MAINTAINER GUIDES:
 * - Applies instantaneous local updates to React state and IndexedDB storage.
 * - Enqueues deterministic OfflineMutationJobs into the FIFO queue.
 * - Dispatches background syncing when online without blocking user interactions.
 * - Strictly typed without `any` or `any[]`.
 */

import { useCallback } from 'react';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { OfflineStorageService } from '../offline/offline-storage-service';
import { createOfflineMutationJob } from '../quick-notes-domain';
import type {
  QuickNote,
  NoteDocument,
} from '../quick-notes-types';

export function useOfflineKnowledgeSync(workspaceId: string) {
  const syncContext = useOfflineSync();

  /**
   * Optimistically creates a note locally and queues the create mutation.
   */
  const optimisticCreateNote = useCallback(
    async (input: {
      title: string;
      document: NoteDocument;
      tags?: string[];
      categoryId?: string;
      color?: string;
      links?: QuickNote['links'];
      authorId?: string;
      authorName?: string;
    }): Promise<QuickNote> => {
      const nowIso = new Date().toISOString();
      const localId = `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const newNote: QuickNote = {
        id: localId,
        organizationId: 'org_offline',
        workspaceId,
        authorId: input.authorId || 'local_user',
        authorName: input.authorName || 'You (Offline)',
        createdBy: input.authorId || 'local_user',
        title: input.title || 'Untitled Note',
        plainText: input.title || 'Untitled Note',
        contentVersion: 1,
        content: input.document || { type: 'doc', content: [] },
        document: input.document,
        tags: input.tags || [],
        attachments: [],
        categoryId: input.categoryId,
        color: input.color,
        links: input.links || {},
        isPinned: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // 1. Save to local IndexedDB mirror
      await OfflineStorageService.putCachedNote(newNote);

      // 2. Enqueue mutation job
      const job = createOfflineMutationJob({
        workspaceId,
        entityId: localId,
        type: 'create_note',
        payload: {
          title: newNote.title,
          document: newNote.document,
          tags: newNote.tags,
          categoryId: newNote.categoryId,
          color: newNote.color,
          links: newNote.links,
        },
        clientTimestamp: nowIso,
      });
      await OfflineStorageService.enqueueMutation(job);

      // 3. Trigger sync if online
      if (syncContext.isOnline) {
        syncContext.triggerSync();
      }

      return newNote;
    },
    [workspaceId, syncContext]
  );

  /**
   * Optimistically updates a note locally and queues the update mutation.
   */
  const optimisticUpdateNote = useCallback(
    async (
      noteId: string,
      updates: Partial<QuickNote>,
      baseServerUpdatedAt?: string
    ): Promise<void> => {
      const nowIso = new Date().toISOString();

      // 1. Fetch current cached note and merge
      const cachedNotes = await OfflineStorageService.getCachedNotes(workspaceId);
      const existing = cachedNotes.find((n) => n.id === noteId);

      if (existing) {
        const merged: QuickNote = {
          ...existing,
          ...updates,
          updatedAt: nowIso,
        };
        await OfflineStorageService.putCachedNote(merged);
      }

      // 2. Enqueue mutation job
      const job = createOfflineMutationJob({
        workspaceId,
        entityId: noteId,
        type: 'update_note',
        payload: updates as Record<string, unknown>,
        baseServerUpdatedAt,
        clientTimestamp: nowIso,
      });
      await OfflineStorageService.enqueueMutation(job);

      // 3. Trigger sync if online
      if (syncContext.isOnline) {
        syncContext.triggerSync();
      }
    },
    [workspaceId, syncContext]
  );

  /**
   * Optimistically deletes a note locally and queues the delete mutation.
   */
  const optimisticDeleteNote = useCallback(
    async (noteId: string): Promise<void> => {
      // 1. Remove from local IndexedDB mirror
      await OfflineStorageService.deleteCachedNote(noteId);

      // 2. Enqueue delete mutation job
      const job = createOfflineMutationJob({
        workspaceId,
        entityId: noteId,
        type: 'delete_note',
        payload: { id: noteId },
      });
      await OfflineStorageService.enqueueMutation(job);

      // 3. Trigger sync if online
      if (syncContext.isOnline) {
        syncContext.triggerSync();
      }
    },
    [workspaceId, syncContext]
  );

  return {
    ...syncContext,
    optimisticCreateNote,
    optimisticUpdateNote,
    optimisticDeleteNote,
  };
}
