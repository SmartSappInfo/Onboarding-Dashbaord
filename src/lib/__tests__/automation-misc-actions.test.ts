import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUpdateTask } from '../automations/actions/task-actions';
import { handleUpdateLeadScore } from '../automations/actions/score-automation-actions';
import { handleTriggerOutboundWebhook } from '../automations/actions/webhook-actions';
import { handleRunAutomation } from '../automations/actions/run-automation';
import type { ExecutionContext } from '../automations/execution-types';

/**
 * Behavior coverage for the remaining configurable automation steps:
 * UPDATE_TASK, UPDATE_LEAD_SCORE, TRIGGER_OUTBOUND_WEBHOOK, RUN_AUTOMATION.
 */

const mockLogActivity = vi.fn().mockResolvedValue(undefined);
const mockCalcAdjustment = vi.fn().mockReturnValue({ entityContacts: [{ id: 'c1' }], leadScore: 42 });
const mockDispatchWebhook = vi.fn().mockResolvedValue(undefined);
const mockExecuteAutomation = vi.fn().mockResolvedValue(undefined);

const tasksUpdate = vi.fn().mockResolvedValue(undefined);
const txGet = vi.fn();
const txUpdate = vi.fn();
const txSet = vi.fn();
const automationsGet = vi.fn();
const mockSyncProjection = vi.fn().mockResolvedValue(undefined);

vi.mock('../activity-logger', () => ({
  logActivity: (args: Record<string, unknown>) => mockLogActivity(args),
}));

vi.mock('../scoring-rules-engine', () => ({
  calculateEngagementAdjustment: (...args: unknown[]) => mockCalcAdjustment(...args),
}));

vi.mock('../webhook-engine', () => ({
  dispatchWebhook: (args: Record<string, unknown>) => mockDispatchWebhook(args),
}));

vi.mock('../automations/executor', () => ({
  executeAutomation: (...args: unknown[]) => mockExecuteAutomation(...args),
}));

vi.mock('../contacts/contact-projection-writer', () => ({
  syncContactProjectionForWE: (...args: unknown[]) => mockSyncProjection(...args),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'tasks') return { doc: () => ({ update: tasksUpdate }) };
      if (name === 'entities') return { doc: () => ({ id: 'entity-ref' }) };
      if (name === 'workspace_entities') {
        const chain: Record<string, unknown> = {};
        chain.where = () => chain;
        chain.limit = () => chain;
        return chain;
      }
      if (name === 'automations') return { doc: () => ({ get: automationsGet }) };
      if (name === 'workspaces') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ organizationId: 'org-1' }) }) }) };
      if (name === 'leadScores') return { doc: (id: string) => ({ id }) };
      if (name === 'leadScoreHistory') return { doc: () => ({ id: 'hist-1' }) };
      return { doc: () => ({ update: vi.fn(), get: async () => ({ exists: false }) }) };
    }),
    runTransaction: (fn: (tx: { get: typeof txGet; update: typeof txUpdate; set: typeof txSet }) => Promise<unknown>) =>
      fn({ get: txGet, update: txUpdate, set: txSet }),
  },
}));

const ctx = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  automationId: 'auto-1',
  runId: 'run-1',
  workspaceId: 'ws-1',
  entityId: 'ent-1',
  entityType: 'institution',
  organizationId: 'org-1',
  payload: {},
  ...overrides,
});

describe('handleUpdateTask (UPDATE_TASK)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the task by explicit taskId', async () => {
    await handleUpdateTask({ taskId: 'task-9', status: 'done', priority: 'high' }, ctx());
    expect(tasksUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'done', priority: 'high' }));
  });

  it('uses the triggering payload taskId when useTriggerTaskId is set', async () => {
    await handleUpdateTask({ useTriggerTaskId: true, status: 'in_progress' }, ctx({ payload: { taskId: 'task-from-trigger' } }));
    expect(tasksUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'in_progress' }));
  });

  it('throws when no taskId can be resolved', async () => {
    await expect(handleUpdateTask({ status: 'done' }, ctx())).rejects.toThrow(/missing taskId/i);
  });
});

describe('handleUpdateLeadScore (UPDATE_LEAD_SCORE)', () => {
  // The handler delegates to adjustLeadScoreAction (scoring-performance-engine),
  // which requires the entity, its workspace_entities relationship, and a
  // resolvable contact; it writes the new score in-transaction and appends a
  // leadScoreHistory ledger entry (activity logging was replaced by the ledger).
  const primeScoringTransaction = (contactScore: number) => {
    txGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ entityContacts: [{ id: 'c1', name: 'Primary Contact', email: 'c1@x.com', isPrimary: true, score: contactScore }] }),
      }) // entity
      .mockResolvedValueOnce({
        empty: false,
        docs: [{ ref: { id: 'we-1' }, data: () => ({ entityContacts: [], workspaceTags: [] }) }],
      }); // workspace_entity query
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when context has no entityId', async () => {
    await expect(handleUpdateLeadScore({ operation: 'add', value: 10 }, ctx({ entityId: undefined })))
      .rejects.toThrow(/missing entityId/i);
  });

  it('applies the computed leadScore to the entity inside a transaction', async () => {
    primeScoringTransaction(32); // 32 + 10 = 42
    await handleUpdateLeadScore({ operation: 'add', value: 10 }, ctx());
    expect(txUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ leadScore: 42 }));
  });

  it('writes a leadScoreHistory ledger entry with the adjustment', async () => {
    primeScoringTransaction(0);
    await handleUpdateLeadScore({ operation: 'set', value: 5 }, ctx());
    expect(txSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ oldScore: 0, newScore: 5, source: 'automation' })
    );
  });
});

describe('handleTriggerOutboundWebhook (TRIGGER_OUTBOUND_WEBHOOK)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when webhookId is missing', async () => {
    await expect(handleTriggerOutboundWebhook({}, ctx())).rejects.toThrow(/missing webhookId/i);
  });

  it('dispatches the webhook with the run payload and automation provenance', async () => {
    await handleTriggerOutboundWebhook({ webhookId: 'wh-1' }, ctx({ payload: { foo: 'bar', organizationId: 'org-1' } }));
    expect(mockDispatchWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookIdOrUrl: 'wh-1',
        workspaceId: 'ws-1',
        source: 'automation',
        entityId: 'ent-1',
      }),
    );
  });
});

describe('handleRunAutomation (RUN_AUTOMATION)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when the chain depth limit is reached', async () => {
    await expect(handleRunAutomation({ automationId: 'auto-2' }, ctx({ chainDepth: 5 })))
      .rejects.toThrow(/chain depth/i);
    expect(mockExecuteAutomation).not.toHaveBeenCalled();
  });

  it('throws when automationId is missing', async () => {
    await expect(handleRunAutomation({}, ctx())).rejects.toThrow(/missing automationId/i);
  });

  it('does nothing when the target automation is inactive', async () => {
    automationsGet.mockResolvedValueOnce({ exists: true, id: 'auto-2', data: () => ({ isActive: false }) });
    await handleRunAutomation({ automationId: 'auto-2' }, ctx());
    expect(mockExecuteAutomation).not.toHaveBeenCalled();
  });

  it('executes an active sub-automation with an incremented chain depth', async () => {
    automationsGet.mockResolvedValueOnce({ exists: true, id: 'auto-2', data: () => ({ isActive: true }) });
    await handleRunAutomation({ automationId: 'auto-2' }, ctx({ chainDepth: 1 }));
    expect(mockExecuteAutomation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'auto-2' }),
      expect.objectContaining({ _chainDepth: 2 }),
      2,
    );
  });
});
