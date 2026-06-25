import { describe, it, expect } from 'vitest';
import {
  dedupeIds,
  chunkIds,
  buildEntityMaps,
  toSearchKey,
  withEntitySearchFields,
} from '../entity-cache-domain';

describe('toSearchKey', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(toSearchKey('  Green  Valley   School ')).toBe('green valley school');
    expect(toSearchKey('ACME Inc.')).toBe('acme inc.');
  });
  it('handles null/undefined/empty', () => {
    expect(toSearchKey(null)).toBe('');
    expect(toSearchKey(undefined)).toBe('');
    expect(toSearchKey('   ')).toBe('');
  });
});

describe('withEntitySearchFields', () => {
  it('derives displayNameLower from displayName', () => {
    const out = withEntitySearchFields({ displayName: '  Green Valley  School ', status: 'active' });
    expect(out.displayNameLower).toBe('green valley school');
    expect(out.status).toBe('active'); // preserves the rest of the doc
  });
  it('matches the key the search query uses (round-trip)', () => {
    const name = 'ACME Inc.';
    expect(withEntitySearchFields({ displayName: name }).displayNameLower).toBe(toSearchKey(name));
  });
  it('falls back to empty string for missing displayName', () => {
    expect(withEntitySearchFields({}).displayNameLower).toBe('');
    expect(withEntitySearchFields({ displayName: null }).displayNameLower).toBe('');
  });
  it('does not mutate the input', () => {
    const input = { displayName: 'A' };
    withEntitySearchFields(input);
    expect(input).not.toHaveProperty('displayNameLower');
  });
});

describe('dedupeIds', () => {
  it('removes duplicates and falsy values, preserving first-seen order', () => {
    expect(dedupeIds(['a', 'b', 'a', '', undefined, null, 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });
  it('returns [] for empty/all-falsy input', () => {
    expect(dedupeIds([])).toEqual([]);
    expect(dedupeIds([undefined, '', null])).toEqual([]);
  });
});

describe('chunkIds', () => {
  it('splits into chunks of the given size (default 30)', () => {
    expect(chunkIds(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });
  it('dedupes before chunking', () => {
    expect(chunkIds(['a', 'a', 'b'], 30)).toEqual([['a', 'b']]);
  });
  it('returns [] when nothing to chunk', () => {
    expect(chunkIds([], 30)).toEqual([]);
  });
});

describe('buildEntityMaps', () => {
  it('indexes by doc id and by entityId', () => {
    const entities = [
      { id: 'doc1', entityId: 'ent1', displayName: 'A' },
      { id: 'doc2', entityId: 'ent2', displayName: 'B' },
      { id: 'doc3', displayName: 'C' }, // no entityId
    ];
    const { byId, byEntityId } = buildEntityMaps(entities);
    expect(byId.get('doc1')?.displayName).toBe('A');
    expect(byEntityId.get('ent1')?.displayName).toBe('A');
    expect(byEntityId.get('ent2')?.id).toBe('doc2');
    expect(byEntityId.has('doc3')).toBe(false); // not indexed by entityId when absent
  });
});
