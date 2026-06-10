/**
 * @fileOverview Pure helpers for the deal edit form's Select option lists.
 *
 * Edit forms must guarantee the *current* value is selectable even when it
 * falls outside the filtered option list (e.g. a pipeline that was un-shared
 * from the workspace, or persisted under a legacy field). `mergeById` unions
 * the list with the directly-fetched current document, de-duplicated by id.
 */

interface HasId {
  id: string;
}

/**
 * Returns `list` with `current` guaranteed present (appended if missing),
 * de-duplicated by `id`. `current` may be null/undefined (e.g. still loading
 * or no value), in which case `list` is returned unchanged.
 *
 * Order: existing list order is preserved; a missing `current` is appended
 * last so the dropdown's primary ordering is unaffected.
 */
export function mergeById<T extends HasId>(
  list: T[] | null | undefined,
  current: T | null | undefined
): T[] {
  const base = list ?? [];
  if (!current) return base;
  return base.some(item => item.id === current.id) ? base : [...base, current];
}
