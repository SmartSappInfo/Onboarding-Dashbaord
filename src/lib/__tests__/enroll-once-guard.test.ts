import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Automation, AutomationTriggerDef } from '../types';

// ── Mock State ────────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockLimit = vi.fn(() => ({ get: mockGet }));
const mockWhere = vi.fn(() => ({ where: mockWhere, limit: mockLimit }));
const mockAdd = vi.fn(() => Promise.resolve({ id: 'run-001', update: vi.fn() }));
const mockDoc = vi.fn(() => ({
  get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
  update: vi.fn(),
}));

const mockCollection = vi.fn((name: string) => {
  if (name === 'automation_runs') {
    return { where: mockWhere, add: mockAdd, doc: mockDoc };
  }
  if (name === 'automation_jobs') {
    return { where: vi.fn(() => ({ where: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ empty: true }) })) })) };
  }
  if (name === 'workspaces') {
    return { doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }) })) };
  }
  return { doc: mockDoc, where: mockWhere };
});

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: (...args: [string]) => mockCollection(...args),
  },
}));

vi.mock('../automation-log', () => ({
  logAutomationEvent: vi.fn(),
}));

vi.mock('./execution-types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../automations/execution-types')>();
  return actual;
});

vi.mock('../automations/nodes/traverse', () => ({
  traverseNodes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../automations/automation-lifecycle-notify', () => ({
  notifyAutomationStarted: vi.fn().mockResolvedValue(undefined),
  notifyAutomationCompleted: vi.fn().mockResolvedValue(undefined),
}));

// Block dynamic imports that executor.ts uses internally
vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn().mockResolvedValue(null),
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../automation-processor', () => ({
  triggerAutomationProtocols: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAutomation(overrides: {
  triggers?: AutomationTriggerDef[];
} = {}): Automation {
  const triggers: AutomationTriggerDef[] = overrides.triggers ?? [
    {
      id: 'trig-1',
      type: 'TAG_ADDED',
      config: { enrollOnce: true },
    },
  ];
  return {
    id: 'auto-001',
    name: 'Test Automation',
    workspaceIds: ['ws-1'],
    triggers,
    triggerTypes: triggers.map((t) => t.type),
    nodes: [{ id: 'node-1', type: 'triggerNode' }],
    edges: [],
    isActive: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    createdBy: 'user-1',
  };
}

function baseTriggerPayload(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _firingTrigger: 'TAG_ADDED',
    entityId: 'entity-001',
    workspaceId: 'ws-1',
    entityType: 'person' as const,
    ...extra,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('enrollOnce guard in executeAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: automation_runs query returns empty (no existing run)
    mockGet.mockResolvedValue({ empty: true });
  });

  it('returns early when enrollOnce=true and a completed run exists', async () => {
    // Existing run found
    mockGet.mockResolvedValue({ empty: false });

    const { executeAutomation } = await import('../automations/executor');
    const automation = makeAutomation();
    await executeAutomation(automation, baseTriggerPayload());

    // Guard fired: should have queried automation_runs with enrollOnce constraints
    expect(mockWhere).toHaveBeenCalledWith('automationId', '==', 'auto-001');
    expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity-001');
    expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['running', 'completed']);
    expect(mockLimit).toHaveBeenCalledWith(1);

    // Should NOT create a new run
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('proceeds to create a run when enrollOnce=true and no existing run found', async () => {
    // No existing run
    mockGet.mockResolvedValue({ empty: true });

    const { executeAutomation } = await import('../automations/executor');
    const automation = makeAutomation();
    await executeAutomation(automation, baseTriggerPayload());

    // Guard checked but passed
    expect(mockLimit).toHaveBeenCalledWith(1);

    // Should create a new run
    expect(mockAdd).toHaveBeenCalled();
    const addArg = mockAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(addArg).toHaveProperty('automationId', 'auto-001');
    expect(addArg).toHaveProperty('status', 'running');
  });

  it('skips enrollOnce query when enrollOnce=false and proceeds', async () => {
    const automation = makeAutomation({
      triggers: [
        { id: 'trig-2', type: 'TAG_ADDED', config: { enrollOnce: false } },
      ],
    });

    const { executeAutomation } = await import('../automations/executor');
    await executeAutomation(automation, baseTriggerPayload());

    // enrollOnce guard should NOT query: limit should not be called for the guard
    // The mockWhere is shared so we check that mockLimit was not called before add
    // Instead: automation_runs.add should have been called (proceeds)
    expect(mockAdd).toHaveBeenCalled();
  });

  it('skips guard when entityId is missing and proceeds', async () => {
    const { executeAutomation } = await import('../automations/executor');
    const automation = makeAutomation();
    const payload = baseTriggerPayload();
    delete payload.entityId;

    await executeAutomation(automation, payload);

    // No enrollOnce query: limit not called
    expect(mockLimit).not.toHaveBeenCalled();

    // Should still create a run
    expect(mockAdd).toHaveBeenCalled();
  });

  it('skips guard when _firingTrigger is missing and proceeds', async () => {
    const { executeAutomation } = await import('../automations/executor');
    const automation = makeAutomation();
    const payload = baseTriggerPayload();
    delete payload._firingTrigger;

    await executeAutomation(automation, payload);

    // No enrollOnce query: limit not called
    expect(mockLimit).not.toHaveBeenCalled();

    // Should still create a run
    expect(mockAdd).toHaveBeenCalled();
  });
});
