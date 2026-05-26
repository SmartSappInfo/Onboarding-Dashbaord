import { describe, it, expect } from 'vitest';
import { evaluateTriggerConfig } from '../automation-trigger-config';
import type { Automation } from '../types';

function automation(partial: Partial<Automation>): Automation {
  return {
    id: 'auto-1',
    name: 'Test',
    workspaceIds: ['ws-1'],
    trigger: 'ENTITY_CREATED',
    nodes: [],
    edges: [],
    isActive: true,
    createdAt: '',
    updatedAt: '',
    createdBy: 'user-1',
    ...partial,
  };
}

describe('evaluateTriggerConfig', () => {
  it('allows when trigger node has no config', () => {
    const auto = automation({
      trigger: 'MEETING_REGISTRANT_ADDED',
      nodes: [{ id: 't1', type: 'triggerNode', position: { x: 0, y: 0 }, data: { trigger: 'MEETING_REGISTRANT_ADDED' } }],
    });
    expect(evaluateTriggerConfig(auto, { meetingTypeId: 'parent' })).toBe(true);
  });

  it('filters meeting registrant by meetingTypeId (P5-3)', () => {
    const auto = automation({
      trigger: 'MEETING_REGISTRANT_ADDED',
      nodes: [
        {
          id: 't1',
          type: 'triggerNode',
          position: { x: 0, y: 0 },
          data: {
            trigger: 'MEETING_REGISTRANT_ADDED',
            config: { meetingTypeId: 'parent' },
          },
        },
      ],
    });

    expect(
      evaluateTriggerConfig(auto, { meetingTypeId: 'parent', workspaceId: 'ws-1' })
    ).toBe(true);
    expect(
      evaluateTriggerConfig(auto, { meetingTypeId: 'staff', workspaceId: 'ws-1' })
    ).toBe(false);
  });

  it('filters TAG_ADDED by tagIds', () => {
    const auto = automation({
      trigger: 'TAG_ADDED',
      nodes: [
        {
          id: 't1',
          type: 'triggerNode',
          position: { x: 0, y: 0 },
          data: { config: { tagIds: ['tag_hot'] } },
        },
      ],
    });

    expect(evaluateTriggerConfig(auto, { tagId: 'tag_hot' })).toBe(true);
    expect(evaluateTriggerConfig(auto, { tagId: 'tag_cold' })).toBe(false);
  });
});
