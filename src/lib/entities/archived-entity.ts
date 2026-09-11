/**
 * @fileOverview Archived-entity predicate shared by every entity picker.
 *
 * WHY THIS EXISTS:
 * `status: 'archived'` is a SOFT DELETE. An archived contact must not be selectable
 * anywhere an operator acts on a record — message composer, tag assignment, call-centre
 * campaigns, contracts, deals. The message composer's Target Audience was listing them,
 * because `useEntitySearch` constrained only on `workspaceId`.
 *
 * WHY THE FILTER IS CLIENT-SIDE, NOT A FIRESTORE CONSTRAINT:
 * `WorkspaceEntity.status` is OPTIONAL, so legacy rows carry no status at all. Both
 * Firestore options break on those rows:
 *   - `where('status', '==', 'active')` drops every entity that has no status.
 *   - `where('status', '!=', 'archived')` ALSO drops them — Firestore inequality
 *     filters exclude documents where the field is absent.
 * Either would hide real, active contacts from every picker in the app. Filtering after
 * the fetch is the only option that treats "no status" as "not archived", which is what
 * the data actually means.
 *
 * CAUTION: this trims the page AFTER Firestore returns it, so a page of 50 can render as
 * fewer than 50 rows. That is intended — `hasMore`/`loadMore` still page correctly, and
 * archived records are a small minority. Do not "fix" it by moving the filter into the
 * query; re-read the paragraph above first.
 *
 * @testability src/lib/entities/__tests__/archived-entity.test.ts
 */

/** The soft-delete marker, compared case-insensitively. */
const ARCHIVED_STATUS = 'archived';

/** Minimal shape this module reads — structural so any row type can be passed. */
export interface ArchivableRecord {
  status?: string | null;
}

/**
 * Whether a record has been archived (soft-deleted).
 *
 * A missing, null or empty status is NOT archived: the field is optional, and absence
 * means "never categorised", not "retired".
 *
 * Casing is normalised because `SchoolStatusState` in `types.ts` carries both
 * `'Archived'` and `'archived'`, so a case-sensitive comparison would leak rows.
 */
export function isArchivedEntity(record: ArchivableRecord): boolean {
  const status = record.status;
  if (!status) return false;
  return status.trim().toLowerCase() === ARCHIVED_STATUS;
}

/**
 * Returns the records that are not archived, in their original order.
 */
export function excludeArchivedEntities<T extends ArchivableRecord>(records: T[]): T[] {
  return records.filter((record) => !isArchivedEntity(record));
}
