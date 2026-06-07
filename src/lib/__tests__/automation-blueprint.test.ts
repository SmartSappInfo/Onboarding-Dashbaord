import { describe, it, expect } from 'vitest';
import { deriveTriggerDefsFromNodes, serializeBlueprint } from '../automation-blueprint';

describe('serializeBlueprint', () => {
  it('derives triggers and triggerTypes from triggerNode.data.trigger', () => {
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

    expect(result.triggers?.[0]?.type).toBe('TAG_ADDED');
    expect(result.triggerTypes).toContain('TAG_ADDED');
    const triggerNode = result.nodes?.find((n) => n.id === 't1');
    expect(triggerNode?.data?.trigger).toBe('TAG_ADDED');
  });

  it('falls back to triggerType on legacy nodes', () => {
    const result = deriveTriggerDefsFromNodes([
      { id: 't1', type: 'triggerNode', data: { triggerType: 'ENTITY_CREATED' } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('ENTITY_CREATED');
  });

  it('preserves explicit triggers when nodes omit trigger node', () => {
    const result = serializeBlueprint({
      triggers: [{ id: 't1', type: 'TASK_COMPLETED', config: {} }],
      nodes: [],
      edges: [],
    });
    expect(result.triggers?.[0]?.type).toBe('TASK_COMPLETED');
    expect(result.triggerTypes).toContain('TASK_COMPLETED');
  });

  it('P5-1: mirrors saveAutomationAction normalization (nodes-only → triggers)', () => {
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
    expect(saved.triggers?.[0]?.type).toBe('MEETING_REGISTRANT_ADDED');
    expect(saved.triggerTypes).toContain('MEETING_REGISTRANT_ADDED');
    expect(saved.nodes?.[0]?.data?.trigger).toBe('MEETING_REGISTRANT_ADDED');
  });
});
