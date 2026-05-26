import { describe, it, expect } from 'vitest';
import { evaluateConditionNode } from '../automation-condition';

describe('evaluateConditionNode (P5-2)', () => {
  const node = {
    data: {
      config: { field: 'status', operator: 'equals', value: 'active' },
    },
  };

  it('evaluates equals on true branch', () => {
    expect(evaluateConditionNode(node, { status: 'active' })).toBe(true);
    expect(evaluateConditionNode(node, { status: 'inactive' })).toBe(false);
  });

  it('evaluates contains operator', () => {
    const containsNode = {
      data: { config: { field: 'email', operator: 'contains', value: '@school.edu' } },
    };
    expect(evaluateConditionNode(containsNode, { email: 'admin@school.edu' })).toBe(true);
  });

  it('returns false when field or operator missing', () => {
    expect(evaluateConditionNode({ data: { config: { field: 'x' } } }, {})).toBe(false);
  });
});
