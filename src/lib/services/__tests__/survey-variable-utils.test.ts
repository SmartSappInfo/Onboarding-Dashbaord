import { describe, it, expect } from 'vitest';
import { interpolateWithMap, interpolateManyWithMap } from '@/lib/survey-variable-utils';
import type { VariableValuesMap } from '@/lib/types/survey-variable-types';

describe('interpolateWithMap', () => {
  const values: VariableValuesMap = {
    contact_name: 'Alice',
    entity_name: 'Sunrise Academy',
    score: '87',
    max_score: '100',
    contact_email: 'alice@example.com',
  };

  it('replaces a single known token with its value', () => {
    expect(interpolateWithMap('Hello {{contact_name}}!', values)).toBe('Hello Alice!');
  });

  it('replaces multiple different tokens in one string', () => {
    expect(
      interpolateWithMap('{{contact_name}} attends {{entity_name}}', values)
    ).toBe('Alice attends Sunrise Academy');
  });

  it('replaces repeated occurrences of the same token', () => {
    expect(
      interpolateWithMap('{{contact_name}} is {{contact_name}}', values)
    ).toBe('Alice is Alice');
  });

  it('silently removes unknown tokens when keepMissing=false (default)', () => {
    expect(interpolateWithMap('Hello {{unknown_var}}!', values)).toBe('Hello !');
  });

  it('preserves unknown tokens when keepMissing=true', () => {
    expect(interpolateWithMap('Hello {{unknown_var}}!', values, true)).toBe(
      'Hello {{unknown_var}}!'
    );
  });

  it('handles null input — returns empty string', () => {
    expect(interpolateWithMap(null, values)).toBe('');
  });

  it('handles undefined input — returns empty string', () => {
    expect(interpolateWithMap(undefined, values)).toBe('');
  });

  it('handles empty string — returns empty string', () => {
    expect(interpolateWithMap('', values)).toBe('');
  });

  it('fast path: text with no {{ characters is returned unchanged', () => {
    const text = 'Plain text with no tokens at all.';
    expect(interpolateWithMap(text, values)).toBe(text);
  });

  it('fast path: empty valuesMap — strips all tokens', () => {
    expect(interpolateWithMap('Hello {{contact_name}}!', {})).toBe('Hello !');
  });

  it('fast path: empty valuesMap with keepMissing=true — preserves all tokens', () => {
    expect(interpolateWithMap('Hello {{contact_name}}!', {}, true)).toBe(
      'Hello {{contact_name}}!'
    );
  });

  it('handles whitespace around token keys: {{ contact_name }}', () => {
    expect(interpolateWithMap('Hello {{ contact_name }}!', values)).toBe('Hello Alice!');
  });

  it('handles HTML strings correctly — does not double-escape output', () => {
    const htmlMap: VariableValuesMap = { contact_name: 'Alice & Bob' };
    expect(interpolateWithMap('<strong>{{contact_name}}</strong>', htmlMap)).toBe(
      '<strong>Alice & Bob</strong>'
    );
  });

  it('does not mutate the input string', () => {
    const text = 'Hello {{contact_name}}!';
    interpolateWithMap(text, values);
    expect(text).toBe('Hello {{contact_name}}!');
  });

  it('handles a text with only a token and no surrounding text', () => {
    expect(interpolateWithMap('{{score}}', values)).toBe('87');
  });

  it('handles a text with empty-string value (valid — not the same as missing)', () => {
    const emptyMap: VariableValuesMap = { contact_name: '' };
    expect(interpolateWithMap('Hello {{contact_name}}!', emptyMap)).toBe('Hello !');
  });

  it('handles adjacent tokens with no separator', () => {
    expect(interpolateWithMap('{{score}}/{{max_score}}', values)).toBe('87/100');
  });

  it('is performant with a long string containing many tokens (no catastrophic backtracking)', () => {
    const bigMap: VariableValuesMap = { a: '1', b: '2', c: '3' };
    const bigText = Array.from({ length: 100 }, (_, i) => `Item ${i}: {{a}} {{b}} {{c}}`).join('\n');
    const start = Date.now();
    interpolateWithMap(bigText, bigMap);
    expect(Date.now() - start).toBeLessThan(50); // must complete well under 50ms
  });
});

describe('interpolateManyWithMap', () => {
  const values: VariableValuesMap = {
    contact_name: 'Bob',
    score: '95',
  };

  it('processes an array of strings with the same map', () => {
    const results = interpolateManyWithMap(
      ['Hello {{contact_name}}', 'Score: {{score}}'],
      values
    );
    expect(results).toEqual(['Hello Bob', 'Score: 95']);
  });

  it('returns empty string for null/undefined entries', () => {
    const results = interpolateManyWithMap([null, undefined, '{{contact_name}}'], values);
    expect(results).toEqual(['', '', 'Bob']);
  });

  it('returns same-length array as input', () => {
    const inputs = ['{{a}}', '{{b}}', '{{c}}', '{{d}}'];
    expect(interpolateManyWithMap(inputs, values)).toHaveLength(4);
  });

  it('handles keepMissing=true for the entire batch', () => {
    const results = interpolateManyWithMap(
      ['{{contact_name}}', '{{unknown}}'],
      values,
      true
    );
    expect(results).toEqual(['Bob', '{{unknown}}']);
  });

  it('fast path: empty map strips all tokens in all entries', () => {
    const results = interpolateManyWithMap(['{{contact_name}}', 'plain text'], {});
    expect(results).toEqual(['', 'plain text']);
  });
});
