import { describe, it, expect } from 'vitest';
import { collectEntityIds } from '../dashboard-domain';

describe('collectEntityIds', () => {
  it('returns the unique, truthy entity ids referenced by activities', () => {
    const activities = [
      { entityId: 'a' },
      { entityId: 'b' },
      { entityId: 'a' }, // duplicate
      { entityId: undefined },
      { entityId: null },
      {}, // missing
    ];
    expect(collectEntityIds(activities).sort()).toEqual(['a', 'b']);
  });

  it('returns an empty array when nothing is referenced', () => {
    expect(collectEntityIds([])).toEqual([]);
    expect(collectEntityIds([{ entityId: null }, {}])).toEqual([]);
  });
});
