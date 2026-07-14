import { describe, it, expect } from 'vitest';
import { resolveTextWithMap } from '../variable-replacer';

describe('resolveTextWithMap fallback priority matching', () => {
  it('resolves directly to valuesMap variable value if present', () => {
    const valuesMap = new Map<string, unknown>();
    valuesMap.set('contact_name', 'Alice');
    valuesMap.set('__fallback__contact_name', 'there');
    
    const text = 'Hello {{contact_name | Guest}}!';
    const result = resolveTextWithMap(text, valuesMap);
    expect(result).toBe('Hello Alice!');
  });

  it('resolves to pre-defined registry fallback if valuesMap is missing but registry fallback exists', () => {
    const valuesMap = new Map<string, unknown>();
    valuesMap.set('__fallback__contact_name', 'there');

    const text = 'Hello {{contact_name | Guest}}!';
    const result = resolveTextWithMap(text, valuesMap);
    expect(result).toBe('Hello there!');
  });

  it('resolves to user-defined fallback if both valuesMap value and pre-defined registry fallback are missing', () => {
    const valuesMap = new Map<string, unknown>();

    const text = 'Hello {{contact_name | Guest}}!';
    const result = resolveTextWithMap(text, valuesMap);
    expect(result).toBe('Hello Guest!');
  });

  it('keeps matching token unchanged if no fallbacks are defined and keepMissing is true', () => {
    const valuesMap = new Map<string, unknown>();

    const text = 'Hello {{contact_name}}!';
    const result = resolveTextWithMap(text, valuesMap, true);
    expect(result).toBe('Hello {{contact_name}}!');
  });

  it('removes matching token if no fallbacks are defined and keepMissing is false', () => {
    const valuesMap = new Map<string, unknown>();

    const text = 'Hello {{contact_name}}!';
    const result = resolveTextWithMap(text, valuesMap, false);
    expect(result).toBe('Hello !');
  });
});
