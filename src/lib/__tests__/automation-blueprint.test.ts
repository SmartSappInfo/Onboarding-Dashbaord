import { describe, it, expect } from 'vitest';
import { deriveTriggerFromNodes, serializeBlueprint } from '../automation-blueprint';

describe('serializeBlueprint', () => {
  it('derives top-level trigger from triggerNode.data.trigger', () => {
    const result = serializeBlueprint({
      name: 'Test',
      nodes: [
        {
          id: 't1',
          type: 'triggerNode',
          position: { x: 0, y: 0 },
          data: { trigger: 'TAG_ADDED' },
        },
        {
          id: 'a1',
          type: 'actionNode',
          position: { x: 0, y: 100 },
          data: { actionType: 'SEND_EMAIL' },
        },
      ],
      edges: [],
    });

    expect(result.trigger).toBe('TAG_ADDED');
    const triggerNode = result.nodes?.find((n) => n.id === 't1');
    expect(triggerNode?.data?.trigger).toBe('TAG_ADDED');
  });

  it('falls back to triggerType on legacy nodes', () => {
    expect(
      deriveTriggerFromNodes([
        { id: 't1', type: 'triggerNode', data: { triggerType: 'ENTITY_CREATED' } },
      ])
    ).toBe('ENTITY_CREATED');
  });

  it('preserves explicit top-level trigger when nodes omit trigger node', () => {
    const result = serializeBlueprint({
      trigger: 'TASK_COMPLETED',
      nodes: [],
      edges: [],
    });
    expect(result.trigger).toBe('TASK_COMPLETED');
  });

  it('P5-1: mirrors saveAutomationAction normalization (nodes-only → top-level trigger)', () => {
    const nodesOnly = {
      name: 'Tag Follow-up',
      nodes: [
        {
          id: 't1',
          type: 'triggerNode',
          position: { x: 0, y: 0 },
          data: { trigger: 'MEETING_REGISTRANT_ADDED' },
        },
      ],
      edges: [],
    };

    const saved = serializeBlueprint(nodesOnly);
    expect(saved.trigger).toBe('MEETING_REGISTRANT_ADDED');
    expect(saved.nodes?.[0]?.data?.trigger).toBe('MEETING_REGISTRANT_ADDED');
  });
});
