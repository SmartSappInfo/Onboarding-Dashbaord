import { describe, it, expect } from 'vitest';
import { resolveVariables, shouldShowBlock } from '../messaging-utils';
import type { MessageBlock } from '../types';

describe('resolveVariables', () => {
  it('replaces single variables correctly', () => {
    const text = 'Hello {{contact_name}}';
    const vars = { contact_name: 'Ama' };
    expect(resolveVariables(text, vars)).toBe('Hello Ama');
  });

  it('replaces multiple variables correctly', () => {
    const text = 'Welcome to {{school_name}}, {{contact_name}}!';
    const vars = { school_name: 'GIS', contact_name: 'Kofi' };
    expect(resolveVariables(text, vars)).toBe('Welcome to GIS, Kofi!');
  });

  it('leaves missing variables untouched', () => {
    const text = 'Score: {{score}}';
    expect(resolveVariables(text, {})).toBe('Score: {{score}}');
  });

  it('handles empty text gracefully', () => {
    expect(resolveVariables('', { name: 'test' })).toBe('');
  });
});

describe('shouldShowBlock', () => {
  const baseBlock: MessageBlock = {
    id: 'block_1',
    type: 'text',
    content: 'Hidden message'
  };

  it('returns true if no visibility logic is defined', () => {
    expect(shouldShowBlock(baseBlock, {})).toBe(true);
  });

  it('returns true when isEqualTo matches', () => {
    const block = {
      ...baseBlock,
      visibilityLogic: {
        matchType: 'all' as const,
        rules: [{ variableKey: 'status', operator: 'isEqualTo' as const, value: 'active' }]
      }
    };
    expect(shouldShowBlock(block, { status: 'active' })).toBe(true);
    expect(shouldShowBlock(block, { status: 'pending' })).toBe(false);
  });

  it('returns true when isGreaterThan matches', () => {
    const block = {
      ...baseBlock,
      visibilityLogic: {
        matchType: 'all' as const,
        rules: [{ variableKey: 'score', operator: 'isGreaterThan' as const, value: '50' }]
      }
    };
    expect(shouldShowBlock(block, { score: 60 })).toBe(true);
    expect(shouldShowBlock(block, { score: 40 })).toBe(false);
  });

  it('supports matchType "any"', () => {
    const block = {
      ...baseBlock,
      visibilityLogic: {
        matchType: 'any' as const,
        rules: [
          { variableKey: 'status', operator: 'isEqualTo' as const, value: 'premium' },
          { variableKey: 'score', operator: 'isGreaterThan' as const, value: '90' }
        ]
      }
    };
    expect(shouldShowBlock(block, { status: 'basic', score: 95 })).toBe(true);
    expect(shouldShowBlock(block, { status: 'premium', score: 10 })).toBe(true);
    expect(shouldShowBlock(block, { status: 'basic', score: 50 })).toBe(false);
  });
});
