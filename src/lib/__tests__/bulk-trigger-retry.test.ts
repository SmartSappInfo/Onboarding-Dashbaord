import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { Automation } from '../types';

// ── Mock State ────────────────────────────────────────────────────────────────

const SECRET = process.env.CLOUD_TASKS_SECRET || 'local-secret';

const mockExecuteAutomation = vi.fn<
  [Automation, Record<string, unknown>],
  Promise<void>
>();

const mockAutomationData: Partial<Automation> = {
  workspaceIds: ['ws-test'],
  name: 'Retry Test',
  triggers: [],
  triggerTypes: [],
  nodes: [{ id: 'start-1', type: 'triggerNode' }],
  edges: [],
  isActive: true,
};

const mockAutoSnap = {
  exists: true,
  id: 'auto-retry',
  data: () => mockAutomationData,
};

/**
 * Tracks which entityIds are treated as valid workspace entities.
 * Reset in beforeEach; mutated by setupEntityValidation.
 */
let validEntityIdSet: Set<string> = new Set();

const mockCollectionFn = vi.fn((name: string) => {
  if (name === 'automations') {
    return {
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue(mockAutoSnap),
      })),
    };
  }
  if (name === 'workspace_entities') {
    return {
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            forEach: (cb: (doc: { data: () => { entityId: string; workspaceId: string } }) => void) => {
              validEntityIdSet.forEach((eid) =>
                cb({ data: () => ({ entityId: eid, workspaceId: 'ws-test' }) })
              );
            },
          }),
        })),
      })),
    };
  }
  return {
    doc: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({ exists: false }),
    })),
  };
});

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (...args: [string]) => mockCollectionFn(...args),
  },
}));

vi.mock('@/lib/automations/executor', () => ({
  executeAutomation: (...args: [Automation, Record<string, unknown>]) =>
    mockExecuteAutomation(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

interface TargetPayload {
  entityId: string;
  entityType: string;
  payload: Record<string, unknown>;
}

function makeTarget(entityId: string): TargetPayload {
  return { entityId, entityType: 'contact', payload: {} };
}

function makeRequest(targets: TargetPayload[]): NextRequest {
  return new NextRequest('http://localhost/api/automations/bulk-trigger', {
    method: 'POST',
    headers: { 'x-cloud-tasks-secret': SECRET },
    body: JSON.stringify({
      automationId: 'auto-retry',
      workspaceId: 'ws-test',
      organizationId: 'org-test',
      trigger: 'ENTITY_CREATED',
      targets,
    }),
  });
}

function setupEntityValidation(entityIds: string[]): void {
  validEntityIdSet = new Set(entityIds);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Bulk Trigger Retry Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteAutomation.mockResolvedValue(undefined);
    validEntityIdSet = new Set();
  });

  it('succeeds on 2nd attempt after transient failure', async () => {
    setupEntityValidation(['entity-1']);

    let callCount = 0;
    mockExecuteAutomation.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Transient Firestore timeout'));
      }
      return Promise.resolve();
    });

    const { POST } = await import('../../app/api/automations/bulk-trigger/route');
    const res = await POST(makeRequest([makeTarget('entity-1')]));
    const body = (await res.json()) as {
      success: boolean;
      processedCount: number;
      failedCount: number;
    };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.processedCount).toBe(1);
    expect(body.failedCount).toBe(0);
    // Called twice: first fails, second succeeds
    expect(mockExecuteAutomation).toHaveBeenCalledTimes(2);
  });

  it('records persistent failure in failedTargets', async () => {
    setupEntityValidation(['entity-fail']);

    mockExecuteAutomation.mockRejectedValue(new Error('Persistent error'));

    const { POST } = await import('../../app/api/automations/bulk-trigger/route');
    const res = await POST(makeRequest([makeTarget('entity-fail')]));
    const body = (await res.json()) as {
      success: boolean;
      processedCount: number;
      failedCount: number;
      failedTargets: Array<{ entityId: string; error: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.failedCount).toBe(1);
    expect(body.failedTargets).toHaveLength(1);
    expect(body.failedTargets[0].entityId).toBe('entity-fail');
    expect(body.failedTargets[0].error).toBe('Persistent error');
    // 3 attempts total (initial + 2 retries)
    expect(mockExecuteAutomation).toHaveBeenCalledTimes(3);
  });

  it('produces no failedTargets when all succeed', async () => {
    const entityIds = ['e-1', 'e-2', 'e-3'];
    setupEntityValidation(entityIds);

    const { POST } = await import('../../app/api/automations/bulk-trigger/route');
    const targets = entityIds.map(makeTarget);
    const res = await POST(makeRequest(targets));
    const body = (await res.json()) as {
      success: boolean;
      processedCount: number;
      failedCount: number;
      failedTargets?: Array<{ entityId: string; error: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.processedCount).toBe(3);
    expect(body.failedCount).toBe(0);
    expect(body.failedTargets).toBeUndefined();
  });

  it('caps failedTargets at 50 in the response', async () => {
    const count = 60;
    const entityIds = Array.from({ length: count }, (_, i) => `entity-${i}`);
    setupEntityValidation(entityIds);

    mockExecuteAutomation.mockRejectedValue(new Error('bulk failure'));

    const { POST } = await import('../../app/api/automations/bulk-trigger/route');
    const targets = entityIds.map(makeTarget);
    const res = await POST(makeRequest(targets));
    const body = (await res.json()) as {
      success: boolean;
      failedCount: number;
      failedTargets: Array<{ entityId: string; error: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.failedCount).toBe(count);
    // Response caps at 50
    expect(body.failedTargets).toHaveLength(50);
  });
});
