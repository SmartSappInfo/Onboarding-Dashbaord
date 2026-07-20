import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Automation, AutomationTriggerDef } from '../types';

// ── Mock State ────────────────────────────────────────────────────────────────

interface MockDoc {
  id: string;
  data: () => Partial<Automation>;
}

const mockSnap = {
  empty: false,
  docs: [] as MockDoc[],
};

const mockGet = vi.fn(() => Promise.resolve(mockSnap));
const mockWhereChain = {
  where: vi.fn(() => mockWhereChain),
  get: mockGet,
};

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn(() => mockWhereChain),
    })),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTriggerDef(
  overrides: Partial<AutomationTriggerDef> & { config?: Record<string, unknown> } = {}
): AutomationTriggerDef {
  return {
    id: 'trig-1',
    type: 'TAG_ADDED',
    config: { tagIds: ['tag-alpha'], enrollOnce: false },
    ...overrides,
  };
}

function makeAutomationDoc(
  id: string,
  overrides: {
    workspaceIds?: string[];
    triggers?: AutomationTriggerDef[];
    name?: string;
  } = {}
): MockDoc {
  const triggers = overrides.triggers ?? [makeTriggerDef()];
  return {
    id,
    data: () => ({
      name: overrides.name ?? 'Test Automation',
      workspaceIds: overrides.workspaceIds ?? ['ws-1'],
      triggers,
      triggerTypes: triggers.map((t) => t.type),
      nodes: [],
      edges: [],
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      createdBy: 'user-1',
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('checkTagAutomations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSnap.empty = false;
    mockSnap.docs = [];
  });

  it('returns a match when the input tag matches a configured automation tag', async () => {
    mockSnap.docs = [
      makeAutomationDoc('auto-1', {
        triggers: [
          makeTriggerDef({ config: { tagIds: ['tag-alpha'], enrollOnce: false } }),
        ],
      }),
    ];

    const { checkTagAutomations } = await import('../automations/checkTagAutomations');
    const result = await checkTagAutomations(['tag-alpha'], 'ws-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      automationId: 'auto-1',
      automationName: 'Test Automation',
      tagId: 'tag-alpha',
      enrollOnce: false,
    });
  });

  it('wildcard (empty tagIds config) matches all input tags', async () => {
    mockSnap.docs = [
      makeAutomationDoc('auto-wild', {
        triggers: [
          makeTriggerDef({ config: { tagIds: [], enrollOnce: false } }),
        ],
      }),
    ];

    const { checkTagAutomations } = await import('../automations/checkTagAutomations');
    const result = await checkTagAutomations(['tag-a', 'tag-b', 'tag-c'], 'ws-1');

    // Wildcard matches every input tag → 3 matches
    expect(result).toHaveLength(3);
    const matchedTags = result.map((m) => m.tagId);
    expect(matchedTags).toContain('tag-a');
    expect(matchedTags).toContain('tag-b');
    expect(matchedTags).toContain('tag-c');
  });

  it('excludes automations from a different workspace (workspace isolation)', async () => {
    mockSnap.docs = [
      makeAutomationDoc('auto-other-ws', {
        workspaceIds: ['ws-other'],
        triggers: [
          makeTriggerDef({ config: { tagIds: ['tag-alpha'], enrollOnce: false } }),
        ],
      }),
    ];

    const { checkTagAutomations } = await import('../automations/checkTagAutomations');
    const result = await checkTagAutomations(['tag-alpha'], 'ws-1');

    expect(result).toHaveLength(0);
  });

  it('propagates enrollOnce=true flag correctly in the result', async () => {
    mockSnap.docs = [
      makeAutomationDoc('auto-enroll', {
        triggers: [
          makeTriggerDef({ config: { tagIds: ['tag-alpha'], enrollOnce: true } }),
        ],
      }),
    ];

    const { checkTagAutomations } = await import('../automations/checkTagAutomations');
    const result = await checkTagAutomations(['tag-alpha'], 'ws-1');

    expect(result).toHaveLength(1);
    expect(result[0].enrollOnce).toBe(true);
  });

  it('returns empty array when tagIds input is empty', async () => {
    // This should short-circuit before querying Firestore
    mockSnap.docs = [
      makeAutomationDoc('auto-should-not-reach'),
    ];

    const { checkTagAutomations } = await import('../automations/checkTagAutomations');
    const result = await checkTagAutomations([], 'ws-1');

    expect(result).toEqual([]);
    // Should not query Firestore at all
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns empty array when no active automations exist', async () => {
    mockSnap.empty = true;
    mockSnap.docs = [];

    const { checkTagAutomations } = await import('../automations/checkTagAutomations');
    const result = await checkTagAutomations(['tag-alpha'], 'ws-1');

    expect(result).toEqual([]);
  });
});
