// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processScheduledJobsAction } from '../automation-processor';

const mockClaimJob = vi.fn();
const mockFinalizeJob = vi.fn().mockResolvedValue(undefined);
const mockFindDue = vi.fn();
const mockGetAutomation = vi.fn();

vi.mock('../automations/repository', () => ({
  findDuePendingJobs: (...args: unknown[]) => mockFindDue(...args),
  claimAutomationJob: (...args: unknown[]) => mockClaimJob(...args),
  finalizeAutomationJob: (...args: unknown[]) => mockFinalizeJob(...args),
  getAutomationById: (...args: unknown[]) => mockGetAutomation(...args),
  findActiveAutomationsByTrigger: vi.fn(),
  getWorkspaceOrganizationId: vi.fn(),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: { collection: vi.fn() },
}));

vi.mock('next/server', () => ({
  after: vi.fn(),
}));

// Capture how the resumed message step calls the messaging engine.
const mockSendMessage = vi.fn().mockResolvedValue({ success: true, logId: 'log-1' });
vi.mock('../messaging-engine', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  sendRawMessage: vi.fn().mockResolvedValue({ success: true, logId: 'log-raw-1' }),
}));

// resolveContact is hit during recipient resolution + context enrichment; keep it inert.
vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn().mockResolvedValue(null),
}));

describe('Delay job resume (P5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ success: true, logId: 'log-1' });
  });

  it('resumes a delayed run and sends the next message with an org resolved from the workspace', async () => {
    const delayNodeId = 'delay-1';
    const automation = {
      id: 'auto-1',
      name: 'Delayed Message',
      trigger: 'ENTITY_CREATED',
      isActive: true,
      workspaceIds: ['ws-1'],
      nodes: [
        { id: 't1', type: 'triggerNode', data: { trigger: 'ENTITY_CREATED' } },
        { id: delayNodeId, type: 'delayNode', data: { config: { value: 1, unit: 'Minutes' } } },
        {
          id: 'a1',
          type: 'actionNode',
          data: {
            actionType: 'SEND_MESSAGE',
            config: {
              channel: 'email',
              templateId: 'tmpl-1',
              recipientTargets: ['fixed'],
              recipient: 'test@example.com',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 't1', target: delayNodeId },
        { id: 'e2', source: delayNodeId, target: 'a1' },
      ],
    };

    // Honest payload: organizationId is NOT present — exactly what a real Wait node
    // persists. The resume path must re-derive the org from the workspace so the
    // message step can resolve a sender. If org resolution regresses, sendMessage
    // receives organizationId: undefined and this test fails.
    const job = {
      id: 'job-delay-1',
      automationId: 'auto-1',
      runId: 'run-1',
      targetNodeId: delayNodeId,
      payload: { workspaceId: 'ws-1', entityId: 'ent-1' },
      executeAt: new Date().toISOString(),
      status: 'pending',
    };

    mockFindDue.mockResolvedValue([job]);
    mockClaimJob.mockResolvedValue(job);
    mockGetAutomation.mockResolvedValue(automation);

    const runUpdate = vi.fn();
    const { adminDb } = await import('../firebase-admin');

    (adminDb.collection as any).mockImplementation((name: string) => {
      if (name === 'automations') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: true, id: 'auto-1', data: () => automation }),
          })),
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        };
      }
      if (name === 'automation_runs') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'running' }) }),
            update: runUpdate,
          })),
        };
      }
      if (name === 'workspaces') {
        // The org is recovered here on resume (it is absent from job.payload).
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ organizationId: 'org-1' }) }),
          })),
        };
      }
      if (name === 'automation_jobs') {
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        };
      }
      return {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        doc: vi.fn(() => ({ get: vi.fn(), update: vi.fn() })),
      };
    });

    const result = await processScheduledJobsAction();

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);

    // The message step ran and received a concrete org (recovered from the workspace),
    // not undefined — this is the regression guard for the resumed-context fix.
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'tmpl-1',
        recipient: 'test@example.com',
        organizationId: 'org-1',
      })
    );

    expect(mockFinalizeJob).toHaveBeenCalledWith('job-delay-1', 'completed');
    expect(runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });
});
