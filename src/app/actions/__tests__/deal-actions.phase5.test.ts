/**
 * @fileoverview Unit and Integration Tests for Deals Platform 2.0 Phase 5
 * (Automation Engine, Event Bus, SLA Breaches, Dead-Letter Queue & Bulk Jobs)
 *
 * WORKSPACE RULES & TESTING:
 * - Strict zero 'any' / zero 'any[]'.
 * - Verifies error recovery, idempotency key generation, SLA evaluations, and bulk jobs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkIdempotency,
  markIdempotencyComplete,
  recordDeadLetter,
  listAutomationDeadLettersAction,
  dismissAutomationDeadLetterAction,
} from '@/lib/automations/dead-letter-service';
import { evaluateWorkspaceDealSlasAction } from '@/lib/deals/deal-sla-monitor';
import { createDealBulkJobAction, getDealBulkJobStatusAction } from '../deal-bulk-job-actions';
import type { Deal, OnboardingStage, AutomationDeadLetter, DealBulkJob } from '@/lib/types';

// Mock canUser
let permissionGranted = true;
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockImplementation(async () => ({
    granted: permissionGranted,
    reason: permissionGranted ? undefined : 'Permission denied',
  })),
}));

// Mock activity logger
let loggedActivities: Array<Record<string, unknown>> = [];
vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockImplementation(async (activity: Record<string, unknown>) => {
    loggedActivities.push(activity);
  }),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// In-Memory Database Stores
const mockDealsStore = new Map<string, Deal>();
const mockStagesStore = new Map<string, OnboardingStage>();
const mockDlqStore = new Map<string, AutomationDeadLetter>();
const mockIdempotencyStore = new Map<string, { status: string; completedAt: string }>();
const mockBulkJobsStore = new Map<string, DealBulkJob>();

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((name: string) => {
        if (name === 'deals') {
          return {
            doc: vi.fn((id: string) => ({
              id,
              get: vi.fn().mockImplementation(async () => ({
                exists: mockDealsStore.has(id),
                data: () => mockDealsStore.get(id),
              })),
              update: vi.fn().mockImplementation(async (data: Partial<Deal>) => {
                const existing = mockDealsStore.get(id);
                if (existing) {
                  mockDealsStore.set(id, { ...existing, ...data });
                }
              }),
            })),
            where: vi.fn((field: string, op: string, val: unknown) => ({
              where: vi.fn((field2: string, op2: string, val2: unknown) => ({
                get: vi.fn().mockImplementation(async () => {
                  const docs = Array.from(mockDealsStore.values())
                    .filter(d => (d as unknown as Record<string, unknown>)[field] === val && (d as unknown as Record<string, unknown>)[field2] === val2)
                    .map(d => ({
                      id: d.id,
                      ref: { id: d.id },
                      data: () => d,
                    }));
                  return { empty: docs.length === 0, docs, size: docs.length };
                }),
              })),
              get: vi.fn().mockImplementation(async () => {
                const docs = Array.from(mockDealsStore.values())
                  .filter(d => (d as unknown as Record<string, unknown>)[field] === val)
                  .map(d => ({
                    id: d.id,
                    ref: { id: d.id },
                    data: () => d,
                  }));
                return { empty: docs.length === 0, docs, size: docs.length };
              }),
            })),
          };
        }

        if (name === 'onboardingStages') {
          return {
            where: vi.fn((field: string, op: string, val: unknown) => ({
              get: vi.fn().mockImplementation(async () => {
                const docs = Array.from(mockStagesStore.values())
                  .filter(s => (s as unknown as Record<string, unknown>)[field] === val)
                  .map(s => ({
                    id: s.id,
                    data: () => s,
                  }));
                return { empty: docs.length === 0, docs, size: docs.length };
              }),
            })),
          };
        }

        if (name === 'automation_dead_letters') {
          return {
            doc: vi.fn((id: string) => ({
              id,
              get: vi.fn().mockImplementation(async () => ({
                exists: mockDlqStore.has(id),
                data: () => mockDlqStore.get(id),
              })),
              set: vi.fn().mockImplementation(async (data: AutomationDeadLetter) => {
                mockDlqStore.set(id, data);
              }),
              update: vi.fn().mockImplementation(async (data: Partial<AutomationDeadLetter>) => {
                const existing = mockDlqStore.get(id);
                if (existing) {
                  mockDlqStore.set(id, { ...existing, ...data });
                }
              }),
            })),
            where: vi.fn((field: string, op: string, val: unknown) => ({
              where: vi.fn((field2: string, op2: string, val2: unknown) => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    get: vi.fn().mockImplementation(async () => {
                      const docs = Array.from(mockDlqStore.values())
                        .filter(d => (d as unknown as Record<string, unknown>)[field] === val && (d as unknown as Record<string, unknown>)[field2] === val2)
                        .map(d => ({ id: d.id, data: () => d }));
                      return { empty: docs.length === 0, docs };
                    }),
                  })),
                })),
              })),
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn().mockImplementation(async () => {
                    const docs = Array.from(mockDlqStore.values())
                      .filter(d => (d as unknown as Record<string, unknown>)[field] === val)
                      .map(d => ({ id: d.id, data: () => d }));
                    return { empty: docs.length === 0, docs };
                  }),
                })),
              })),
            })),
          };
        }

        if (name === 'automation_idempotency_keys') {
          return {
            doc: vi.fn((key: string) => ({
              id: key,
              get: vi.fn().mockImplementation(async () => ({
                exists: mockIdempotencyStore.has(key),
                data: () => mockIdempotencyStore.get(key),
              })),
              set: vi.fn().mockImplementation(async (data: { status: string; completedAt: string }) => {
                mockIdempotencyStore.set(key, data);
              }),
            })),
          };
        }

        if (name === 'deal_bulk_jobs') {
          return {
            doc: vi.fn((id: string) => ({
              id,
              get: vi.fn().mockImplementation(async () => ({
                exists: mockBulkJobsStore.has(id),
                data: () => mockBulkJobsStore.get(id),
              })),
              set: vi.fn().mockImplementation(async (data: DealBulkJob) => {
                mockBulkJobsStore.set(id, data);
              }),
              update: vi.fn().mockImplementation(async (data: Partial<DealBulkJob>) => {
                const existing = mockBulkJobsStore.get(id);
                if (existing) {
                  mockBulkJobsStore.set(id, { ...existing, ...data });
                }
              }),
            })),
          };
        }

        return { doc: vi.fn() };
      }),
      batch: vi.fn(() => ({
        update: vi.fn((ref: { id: string }, data: Partial<Deal>) => {
          const existing = mockDealsStore.get(ref.id);
          if (existing) {
            mockDealsStore.set(ref.id, { ...existing, ...data });
          }
        }),
        commit: vi.fn().mockResolvedValue(undefined),
      })),
    },
  };
});

describe('Phase 5 Automation & SLA Suite', () => {
  beforeEach(() => {
    mockDealsStore.clear();
    mockStagesStore.clear();
    mockDlqStore.clear();
    mockIdempotencyStore.clear();
    mockBulkJobsStore.clear();
    loggedActivities = [];
    permissionGranted = true;
  });

  describe('Idempotency Service', () => {
    it('accurately tracks and enforces completion keys', async () => {
      const key = 'idem_auto1_run1_node1';
      expect(await checkIdempotency(key)).toBe(false);

      await markIdempotencyComplete(key, 'ws-1');
      expect(await checkIdempotency(key)).toBe(true);
    });
  });

  describe('Dead-Letter Queue (DLQ)', () => {
    it('records step failures and permits administrator dismissal', async () => {
      const dlqId = await recordDeadLetter({
        workspaceId: 'ws-1',
        automationId: 'auto-1',
        automationName: 'Stage Lead Routing',
        runId: 'run-100',
        nodeLabel: 'Send WhatsApp Alert',
        error: 'Network 503 Provider Timeout',
        payload: { dealId: 'deal-1', phone: '+1234567890' },
      });

      expect(dlqId).toBeDefined();
      expect(mockDlqStore.has(dlqId)).toBe(true);

      const listRes = await listAutomationDeadLettersAction('ws-1');
      expect(listRes.success).toBe(true);
      expect(listRes.items?.length).toBe(1);

      const dismissRes = await dismissAutomationDeadLetterAction(dlqId, 'user-1');
      expect(dismissRes.success).toBe(true);
      expect(mockDlqStore.get(dlqId)?.status).toBe('dismissed');
    });
  });

  describe('Stage SLA Breach Monitor', () => {
    it('identifies breached deals and updates alert timestamps', async () => {
      const now = new Date('2026-08-29T12:00:00.000Z');

      mockStagesStore.set('stage-1', {
        id: 'stage-1',
        name: 'Discovery Call',
        pipelineId: 'pipe-1',
        order: 1,
        slaDays: 3, // 3 day limit
        probability: 30,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      });

      // Deal created 10 days ago (breaches 3 day limit)
      mockDealsStore.set('deal-101', {
        id: 'deal-101',
        name: 'Enterprise Pilot',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        entityId: 'ent-101',
        pipelineId: 'pipe-1',
        stageId: 'stage-1',
        status: 'open',
        value: 25000,
        stageEnteredAt: '2026-08-19T12:00:00.000Z',
        createdAt: '2026-08-19T12:00:00.000Z',
        updatedAt: '2026-08-19T12:00:00.000Z',
      });

      const res = await evaluateWorkspaceDealSlasAction('ws-1', { now: now.toISOString() });
      expect(res.success).toBe(true);
      expect(res.totalEvaluated).toBe(1);
      expect(res.breachedCount).toBe(1);
      expect(res.alertedCount).toBe(1);

      const updatedDeal = mockDealsStore.get('deal-101');
      expect(updatedDeal?.isSlaBreached).toBe(true);
      expect(updatedDeal?.lastSlaAlertAt).toBe(now.toISOString());
    });
  });

  describe('Asynchronous Bulk Job Engine', () => {
    it('creates background job and returns tracked status', async () => {
      const dealIds = ['deal-1', 'deal-2', 'deal-3'];
      const res = await createDealBulkJobAction(
        'bulk_archive',
        dealIds,
        {},
        'ws-1',
        'admin-user',
        'Admin User'
      );

      expect(res.success).toBe(true);
      expect(res.jobId).toBeDefined();

      const statusRes = await getDealBulkJobStatusAction(res.jobId!, 'ws-1');
      expect(statusRes.success).toBe(true);
      expect(statusRes.job?.totalRecords).toBe(3);
      expect(statusRes.job?.jobType).toBe('bulk_archive');
    });
  });
});
