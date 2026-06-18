import { describe, it, expect } from 'vitest';
import { classifyTraversal } from '../interactive-traversal';

describe('classifyTraversal', () => {
  const live = { hasOutcomeHandler: true, hasActionHandler: true };
  const preview = { hasOutcomeHandler: false, hasActionHandler: false };

  it('triggers outcomes in live mode', () => {
    expect(classifyTraversal('outcome', live)).toBe('trigger-outcome');
  });

  it('triggers actions in live mode', () => {
    expect(classifyTraversal('action', live)).toBe('trigger-action');
  });

  it('navigates for ordinary nodes', () => {
    expect(classifyTraversal('script_block', live)).toBe('navigate');
    expect(classifyTraversal('question', live)).toBe('navigate');
    expect(classifyTraversal('start', live)).toBe('navigate');
  });

  it('navigates (no trigger) in preview mode without handlers', () => {
    expect(classifyTraversal('outcome', preview)).toBe('navigate');
    expect(classifyTraversal('action', preview)).toBe('navigate');
  });

  it('respects handlers independently', () => {
    expect(classifyTraversal('outcome', { hasOutcomeHandler: true, hasActionHandler: false })).toBe('trigger-outcome');
    expect(classifyTraversal('action', { hasOutcomeHandler: true, hasActionHandler: false })).toBe('navigate');
  });
});
