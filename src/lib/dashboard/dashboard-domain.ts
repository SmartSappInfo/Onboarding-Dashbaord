/**
 * @fileOverview Pure dashboard helpers (no I/O) — unit-tested.
 */

/** Unique, truthy `entityId`s referenced by a list of activities. */
export function collectEntityIds(activities: Array<{ entityId?: string | null }>): string[] {
  return [...new Set(activities.map((a) => a.entityId).filter((x): x is string => !!x))];
}
