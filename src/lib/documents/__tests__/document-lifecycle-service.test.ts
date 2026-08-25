import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  auditWorkspaceStorageLifecycle,
  executeDataRetentionPruning,
} from '../document-lifecycle-service';

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    batch: vi.fn().mockReturnValue({
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(true),
    }),
    collection: vi.fn().mockImplementation((colName: string) => {
      const queryObj: any = {
        where: vi.fn().mockImplementation(() => queryObj),
        get: vi.fn().mockImplementation(async () => {
          if (colName === 'documents') {
            return {
              size: 2,
              docs: [
                { id: 'doc_1', data: () => ({ workspaceId: 'ws_test', title: 'Doc 1' }) },
                { id: 'doc_2', data: () => ({ workspaceId: 'ws_test', title: 'Doc 2' }) },
              ],
            };
          }
          if (colName === 'document_versions') {
            return {
              size: 4,
              docs: [
                { id: 'v1', ref: { id: 'v1' }, data: () => ({ status: 'published', createdAt: '2026-01-01T00:00:00Z' }) },
                { id: 'v2', ref: { id: 'v2' }, data: () => ({ status: 'published', createdAt: '2026-01-01T00:00:00Z' }) },
                { id: 'v3', ref: { id: 'v3' }, data: () => ({ status: 'superseded', createdAt: '2025-01-01T00:00:00Z' }) }, // >30 days
                { id: 'v4', ref: { id: 'v4' }, data: () => ({ status: 'superseded', createdAt: '2026-08-20T00:00:00Z' }) }, // recent
              ],
            };
          }
          if (colName === 'document_pages') {
            return {
              size: 20,
              docs: Array.from({ length: 20 }, (_, idx) => ({
                id: `page_${idx}`,
                data: () => ({ pageNumber: idx + 1 }),
              })),
            };
          }
          return { size: 0, docs: [] };
        }),
      };
      return queryObj;
    }),
  },
}));

describe('Document Storage Lifecycle & Archival Service (Phase 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('audits workspace storage lifecycle and calculates metrics', async () => {
    const report = await auditWorkspaceStorageLifecycle('ws_test');

    expect(report.workspaceId).toBe('ws_test');
    expect(report.totalDocumentsCount).toBe(2);
    expect(report.totalVersionsCount).toBe(4);
    expect(report.activeVersionsCount).toBe(2);
    expect(report.archivedVersionsCount).toBe(2);
    expect(report.totalPagesCount).toBe(20);
    expect(report.estimatedStorageBytes).toBe(20 * 256 * 1024);
    expect(report.supersededVersionsEligibleForPurge).toBe(1);
  });

  it('simulates retention pruning in dryRun mode', async () => {
    const result = await executeDataRetentionPruning('ws_test', {
      workspaceId: 'ws_test',
      archivedVersionRetentionDays: 30,
      purgeOrphanPages: true,
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.purgedVersionsCount).toBe(1);
    expect(result.freedBytesEstimate).toBeGreaterThan(0);
  });

  it('executes real batch pruning deletions when dryRun is false', async () => {
    const result = await executeDataRetentionPruning('ws_test', {
      workspaceId: 'ws_test',
      archivedVersionRetentionDays: 30,
      purgeOrphanPages: true,
      dryRun: false,
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(result.purgedVersionsCount).toBe(1);
  });
});
