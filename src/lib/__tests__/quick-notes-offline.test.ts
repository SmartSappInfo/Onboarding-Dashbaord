/**
 * @fileoverview Unit tests for Phase 10: Enterprise Offline Sync & Zero-Data-Loss PWA Pure Domain Logic.
 */

import { describe, it, expect } from 'vitest';
import {
  createOfflineMutationJob,
  computeOfflineBackoffDelay,
  generateDocumentDiffSummary,
  resolveOfflineConflict,
  calculateCacheStorageEstimate,
  filterOfflineMutations,
  getOfflineSyncStatusMeta,
} from '../quick-notes-domain';
import type {
  OfflineMutationJob,
  QuickNote,
  NoteDocument,
} from '../quick-notes-types';

describe('Phase 10: Enterprise Offline Sync Pure Domain Logic', () => {
  describe('createOfflineMutationJob', () => {
    it('creates a validated mutation job with defaults and timestamps', () => {
      const job = createOfflineMutationJob({
        workspaceId: 'ws-123',
        entityId: 'note-456',
        type: 'update_note',
        payload: { title: 'Updated Offline Title' },
        baseServerUpdatedAt: '2026-09-04T10:00:00.000Z',
      });

      expect(job.id).toBeDefined();
      expect(job.id.startsWith('mut_')).toBe(true);
      expect(job.workspaceId).toBe('ws-123');
      expect(job.entityId).toBe('note-456');
      expect(job.type).toBe('update_note');
      expect(job.status).toBe('pending');
      expect(job.retryCount).toBe(0);
      expect(job.baseServerUpdatedAt).toBe('2026-09-04T10:00:00.000Z');
      expect(job.clientTimestamp).toBeDefined();
    });
  });

  describe('computeOfflineBackoffDelay', () => {
    it('returns 0 delay for 0 retries', () => {
      expect(computeOfflineBackoffDelay(0)).toBe(0);
    });

    it('calculates exponential delay with jitter bounded by maxDelay', () => {
      const delay1 = computeOfflineBackoffDelay(1, 1000, 30000);
      const delay2 = computeOfflineBackoffDelay(2, 1000, 30000);
      const delay3 = computeOfflineBackoffDelay(5, 1000, 30000);
      const delayMax = computeOfflineBackoffDelay(20, 1000, 30000);

      expect(delay1).toBeGreaterThanOrEqual(1500);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
      expect(delayMax).toBe(30000);
    });
  });

  describe('generateDocumentDiffSummary', () => {
    it('accurately identifies local additions and server additions', () => {
      const localDoc: NoteDocument = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Common Line 1' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Local Offline Note Addition' }] },
        ],
      };

      const serverDoc: NoteDocument = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Common Line 1' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Cloud Server Update' }] },
        ],
      };

      const diff = generateDocumentDiffSummary(localDoc, serverDoc);
      expect(diff.localChanges).toContain('Local Offline Note Addition');
      expect(diff.serverChanges).toContain('Cloud Server Update');
      expect(diff.localChanges).not.toContain('Common Line 1');
    });
  });

  describe('resolveOfflineConflict', () => {
    const mockServerNote: QuickNote = {
      id: 'note-1',
      workspaceId: 'ws-1',
      authorId: 'user-server',
      authorName: 'Sarah Jenkins',
      title: 'Server Cloud Version',
      content: 'Server Cloud Body Content',
      document: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Server Cloud Body Content' }] }],
      },
      tags: ['server-tag'],
      createdAt: '2026-09-04T08:00:00.000Z',
      updatedAt: '2026-09-04T12:00:00.000Z', // Updated at 12:00
    };

    it('returns no conflict when server was not modified after client base snapshot', () => {
      const localJob: OfflineMutationJob = {
        id: 'mut-1',
        workspaceId: 'ws-1',
        entityId: 'note-1',
        type: 'update_note',
        payload: { title: 'Local Offline Edit' },
        baseServerUpdatedAt: '2026-09-04T12:00:00.000Z', // Client opened at 12:00
        clientTimestamp: '2026-09-04T12:30:00.000Z',
        retryCount: 0,
        status: 'pending',
      };

      const result = resolveOfflineConflict({
        localJob,
        serverSnapshot: mockServerNote,
        action: 'keep_local',
      });

      expect(result.isConflict).toBe(false);
      expect(result.resolvedPayload).toEqual(localJob.payload);
    });

    it('detects conflict when server timestamp is newer than base snapshot', () => {
      const localJob: OfflineMutationJob = {
        id: 'mut-2',
        workspaceId: 'ws-1',
        entityId: 'note-1',
        type: 'update_note',
        payload: {
          title: 'Local Client Title',
          document: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Local Client Content' }] }],
          },
          tags: ['local-tag'],
        },
        baseServerUpdatedAt: '2026-09-04T10:00:00.000Z', // Client opened at 10:00 (before 12:00 server update)
        clientTimestamp: '2026-09-04T12:15:00.000Z',
        retryCount: 0,
        status: 'pending',
      };

      const result = resolveOfflineConflict({
        localJob,
        serverSnapshot: mockServerNote,
        action: 'keep_local',
      });

      expect(result.isConflict).toBe(true);
      expect(result.conflictDetails).toBeDefined();
      expect(result.conflictDetails?.serverSnapshot.title).toBe('Server Cloud Version');
    });

    it('resolves conflict with smart_merge strategy by combining docs and tags', () => {
      const localJob: OfflineMutationJob = {
        id: 'mut-3',
        workspaceId: 'ws-1',
        entityId: 'note-1',
        type: 'update_note',
        payload: {
          title: 'Local Client Title',
          document: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Local Client Content' }] }],
          },
          tags: ['local-tag'],
        },
        baseServerUpdatedAt: '2026-09-04T10:00:00.000Z',
        clientTimestamp: '2026-09-04T12:15:00.000Z',
        retryCount: 0,
        status: 'pending',
      };

      const result = resolveOfflineConflict({
        localJob,
        serverSnapshot: mockServerNote,
        action: 'smart_merge',
      });

      expect(result.isConflict).toBe(true);
      const doc = result.resolvedPayload?.document as NoteDocument;
      expect(doc.content?.length).toBe(3); // target + divider + source
      expect(result.resolvedPayload?.tags).toContain('server-tag');
      expect(result.resolvedPayload?.tags).toContain('local-tag');
    });

    it('resolves conflict with send_to_inbox by creating a contradiction item', () => {
      const localJob: OfflineMutationJob = {
        id: 'mut-4',
        workspaceId: 'ws-1',
        entityId: 'note-1',
        type: 'update_note',
        payload: {
          title: 'Local Client Title',
          document: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Local Client Content' }] }],
          },
        },
        baseServerUpdatedAt: '2026-09-04T10:00:00.000Z',
        clientTimestamp: '2026-09-04T12:15:00.000Z',
        retryCount: 0,
        status: 'pending',
      };

      const result = resolveOfflineConflict({
        localJob,
        serverSnapshot: mockServerNote,
        action: 'send_to_inbox',
      });

      expect(result.isConflict).toBe(true);
      expect(result.inboxContradictionPayload).toBeDefined();
      expect(result.inboxContradictionPayload?.type).toBe('contradiction');
      expect(result.inboxContradictionPayload?.contradictionDetails?.sourceQuotes?.length).toBe(2);
    });
  });

  describe('calculateCacheStorageEstimate', () => {
    it('computes byte storage estimate properly', () => {
      const bytes = calculateCacheStorageEstimate(10, 2, 5);
      expect(bytes).toBe(10 * 4096 + 2 * 2048 + 5 * 1024);
    });
  });

  describe('filterOfflineMutations', () => {
    const jobs: OfflineMutationJob[] = [
      {
        id: 'mut-1',
        workspaceId: 'ws-1',
        entityId: 'note-1',
        type: 'create_note',
        payload: { title: 'First Note' },
        clientTimestamp: '2026-09-04T10:00:00.000Z',
        retryCount: 0,
        status: 'pending',
      },
      {
        id: 'mut-2',
        workspaceId: 'ws-1',
        entityId: 'note-2',
        type: 'update_note',
        payload: { title: 'Second Note' },
        clientTimestamp: '2026-09-04T10:05:00.000Z',
        retryCount: 2,
        status: 'conflict',
      },
    ];

    it('filters mutations by status and type', () => {
      const pending = filterOfflineMutations(jobs, { status: 'pending' });
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('mut-1');

      const conflicts = filterOfflineMutations(jobs, { status: 'conflict' });
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].id).toBe('mut-2');
    });
  });

  describe('getOfflineSyncStatusMeta', () => {
    it('returns descriptive labels and visual tokens', () => {
      expect(getOfflineSyncStatusMeta('online_synced').label).toBe('Online & Synced');
      expect(getOfflineSyncStatusMeta('offline').label).toBe('Working Offline');
      expect(getOfflineSyncStatusMeta('conflict_detected').label).toBe('Conflict Detected');
    });
  });
});
