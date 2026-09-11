import { describe, it, expect } from 'vitest';
import { isArchivedEntity, excludeArchivedEntities } from '../archived-entity';

/**
 * Archived means soft-deleted. Every entity picker in the app — message composer,
 * tag assignment, call-centre campaigns, contracts, deals — must exclude them, or an
 * operator can message, tag or bill a record someone deliberately retired.
 *
 * Regression origin: the message composer's Target Audience listed an archived
 * contact ("frank" / minex) as selectable, because `useEntitySearch` filtered only on
 * workspaceId.
 */
describe('isArchivedEntity', () => {
  it('treats an explicitly archived entity as archived', () => {
    expect(isArchivedEntity({ status: 'archived' })).toBe(true);
  });

  // `SchoolStatusState` in types.ts carries BOTH 'Archived' and 'archived'. A
  // case-sensitive check would silently let capitalised rows through.
  it('matches regardless of casing', () => {
    expect(isArchivedEntity({ status: 'Archived' })).toBe(true);
    expect(isArchivedEntity({ status: 'ARCHIVED' })).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(isArchivedEntity({ status: '  archived  ' })).toBe(true);
  });

  it('treats an active entity as not archived', () => {
    expect(isArchivedEntity({ status: 'active' })).toBe(false);
  });

  // CRITICAL: `status` is optional on WorkspaceEntity, so legacy rows have none.
  // Treating "missing" as archived would hide real contacts from every picker —
  // which is also why this cannot be a Firestore `!=` query, since those drop
  // documents that lack the field.
  it('treats a missing status as NOT archived', () => {
    expect(isArchivedEntity({})).toBe(false);
    expect(isArchivedEntity({ status: undefined })).toBe(false);
    expect(isArchivedEntity({ status: null })).toBe(false);
    expect(isArchivedEntity({ status: '' })).toBe(false);
  });
});

describe('excludeArchivedEntities', () => {
  it('drops archived rows and keeps everything else', () => {
    const rows = [
      { id: 'a', status: 'active' },
      { id: 'b', status: 'archived' },
      { id: 'c' },
      { id: 'd', status: 'Archived' },
    ];
    expect(excludeArchivedEntities(rows).map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('returns an empty array unchanged', () => {
    expect(excludeArchivedEntities([])).toEqual([]);
  });

  it('keeps every row when none are archived', () => {
    const rows = [{ id: 'a', status: 'active' }, { id: 'b' }];
    expect(excludeArchivedEntities(rows)).toHaveLength(2);
  });

  it('preserves the incoming order', () => {
    const rows = [
      { id: 'a' },
      { id: 'b', status: 'archived' },
      { id: 'c', status: 'active' },
      { id: 'd' },
    ];
    expect(excludeArchivedEntities(rows).map((r) => r.id)).toEqual(['a', 'c', 'd']);
  });
});
