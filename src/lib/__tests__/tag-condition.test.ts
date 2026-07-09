// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { evaluateTagCondition, evaluateTagSplitSwitch } from '../tag-condition';
import type { TagConditionNode } from '../types';

function makeNode(
  logic: TagConditionNode['data']['logic'],
  tagIds: string[]
): TagConditionNode {
  return { id: 'test', type: 'tag_condition', data: { logic, tagIds } };
}

function makeSwitchNode(
  conditions: Array<{ id: string; tagId: string }>,
  evaluationMode?: 'first_match' | 'all_matches'
): TagConditionNode {
  return { id: 'test', type: 'tag_condition', data: { conditions, evaluationMode } };
}

describe('evaluateTagCondition', () => {
  describe('has_tag', () => {
    it('returns true when contact has at least one matching tag', () => {
      expect(evaluateTagCondition(['a', 'b'], makeNode('has_tag', ['b', 'c']))).toBe(true);
    });

    it('returns false when contact has none of the specified tags', () => {
      expect(evaluateTagCondition(['x', 'y'], makeNode('has_tag', ['a', 'b']))).toBe(false);
    });

    it('returns true when contact has exactly one matching tag', () => {
      expect(evaluateTagCondition(['a'], makeNode('has_tag', ['a']))).toBe(true);
    });
  });

  describe('has_any_tag', () => {
    it('behaves identically to has_tag — true on partial match', () => {
      expect(evaluateTagCondition(['a'], makeNode('has_any_tag', ['a', 'b']))).toBe(true);
    });

    it('returns false when no tags match', () => {
      expect(evaluateTagCondition(['z'], makeNode('has_any_tag', ['a', 'b']))).toBe(false);
    });
  });

  describe('has_all_tags', () => {
    it('returns true when contact has all specified tags', () => {
      expect(evaluateTagCondition(['a', 'b', 'c'], makeNode('has_all_tags', ['a', 'b']))).toBe(true);
    });

    it('returns false when contact is missing one tag', () => {
      expect(evaluateTagCondition(['a'], makeNode('has_all_tags', ['a', 'b']))).toBe(false);
    });

    it('returns false when contact has no tags', () => {
      expect(evaluateTagCondition([], makeNode('has_all_tags', ['a']))).toBe(false);
    });
  });

  describe('not_has_tag', () => {
    it('returns true when contact has none of the specified tags', () => {
      expect(evaluateTagCondition(['x', 'y'], makeNode('not_has_tag', ['a', 'b']))).toBe(true);
    });

    it('returns false when contact has at least one of the specified tags', () => {
      expect(evaluateTagCondition(['a', 'x'], makeNode('not_has_tag', ['a', 'b']))).toBe(false);
    });

    it('returns true when contact has no tags', () => {
      expect(evaluateTagCondition([], makeNode('not_has_tag', ['a']))).toBe(true);
    });
  });

  describe('empty tagIds', () => {
    it('returns true for any logic when no tags are configured', () => {
      expect(evaluateTagCondition(['a'], makeNode('has_tag', []))).toBe(true);
      expect(evaluateTagCondition(['a'], makeNode('has_all_tags', []))).toBe(true);
      expect(evaluateTagCondition(['a'], makeNode('not_has_tag', []))).toBe(true);
    });
  });
});

describe('evaluateTagSplitSwitch', () => {
  describe('Legacy fallback', () => {
    it('routes to true/false when conditions are missing', () => {
      const node = makeNode('has_tag', ['vip']);
      expect(evaluateTagSplitSwitch(['vip'], node)).toEqual(['true']);
      expect(evaluateTagSplitSwitch(['other'], node)).toEqual(['false']);
    });
  });

  describe('First-Match Wins (Default)', () => {
    it('routes to the first matching condition branch', () => {
      const node = makeSwitchNode([
        { id: 'cond_1', tagId: 'tag_a' },
        { id: 'cond_2', tagId: 'tag_b' }
      ]);
      expect(evaluateTagSplitSwitch(['tag_a'], node)).toEqual(['cond_1']);
      expect(evaluateTagSplitSwitch(['tag_b'], node)).toEqual(['cond_2']);
      expect(evaluateTagSplitSwitch(['tag_a', 'tag_b'], node)).toEqual(['cond_1']);
    });

    it('routes to none when no tags match', () => {
      const node = makeSwitchNode([
        { id: 'cond_1', tagId: 'tag_a' }
      ]);
      expect(evaluateTagSplitSwitch(['other'], node)).toEqual(['none']);
    });
  });

  describe('All-Matches Trigger', () => {
    it('routes to all matching condition branches', () => {
      const node = makeSwitchNode([
        { id: 'cond_1', tagId: 'tag_a' },
        { id: 'cond_2', tagId: 'tag_b' }
      ], 'all_matches');
      expect(evaluateTagSplitSwitch(['tag_a'], node)).toEqual(['cond_1']);
      expect(evaluateTagSplitSwitch(['tag_a', 'tag_b'], node)).toEqual(['cond_1', 'cond_2']);
    });

    it('routes to none when no tags match', () => {
      const node = makeSwitchNode([
        { id: 'cond_1', tagId: 'tag_a' }
      ], 'all_matches');
      expect(evaluateTagSplitSwitch(['other'], node)).toEqual(['none']);
    });
  });
});

