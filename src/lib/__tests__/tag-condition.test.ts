import { describe, it, expect } from 'vitest';
import { evaluateTagCondition } from '../tag-condition';
import type { TagConditionNode } from '../types';

function makeNode(
  logic: TagConditionNode['data']['logic'],
  tagIds: string[]
): TagConditionNode {
  return { id: 'test', type: 'tag_condition', data: { logic, tagIds } };
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
