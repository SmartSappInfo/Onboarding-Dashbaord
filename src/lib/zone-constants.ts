/**
 * Geographic zone constants and pure utility helpers.
 *
 * UNASSIGNED_ZONE is a VIRTUAL sentinel for entities that have not been
 * assigned to a geographic zone. It is intentionally NOT a Firestore document:
 * the `zones` collection is shared across organizations (distinguished by an
 * `organizationId` field with random doc IDs), so a single fixed doc ID would
 * collide and one org's write would clobber another's. Instead, entities store
 * the constant {id,name} directly, and display surfaces that enumerate zones
 * inject the sentinel via withUnassignedZone().
 *
 * Rules:
 * - Never write null to zone fields — use zoneOrUnassigned().
 * - Never render "Unassigned" inside message templates — use zoneDisplayName().
 * - Surfaces that list zones for selection/aggregation — use withUnassignedZone().
 */

export const UNASSIGNED_ZONE = {
  id: 'sys-unassigned',
  name: 'Unassigned',
} as const;

export type ZoneRef = {
  id: string;
  name: string;
};

/**
 * Returns the zone if it has a valid id, otherwise returns UNASSIGNED_ZONE.
 * Use this at every write path to guarantee zone is never null.
 */
export function zoneOrUnassigned(zone: ZoneRef | null | undefined): ZoneRef {
  if (zone?.id && zone.id.trim() !== '') return zone;
  return UNASSIGNED_ZONE;
}

/**
 * Returns true if the zone is the "Unassigned" sentinel, null, or undefined.
 */
export function isUnassignedZone(zone: ZoneRef | null | undefined): boolean {
  return !zone?.id || zone.id.trim() === '' || zone.id === UNASSIGNED_ZONE.id;
}

/**
 * Safe display name for use in message template variables ({{zone_name}}).
 * Returns empty string for "Unassigned" so templates don't render the word
 * "Unassigned" in outbound SMS/email messages.
 */
export function zoneDisplayName(zone: ZoneRef | null | undefined): string {
  if (isUnassignedZone(zone)) return '';
  return zone!.name;
}

/**
 * Prepends the virtual "Unassigned" sentinel to a list of real (Firestore)
 * zones, so selection dropdowns and aggregation surfaces can present and bucket
 * unassigned entities. Idempotent — if an Unassigned entry already exists
 * (by id), the original list is returned unchanged.
 *
 * Generic over the zone shape so callers can pass their own Zone type without
 * widening to `any`. Constrained to ZoneRef so every element is guaranteed to
 * have both `id` and `name` (the union falls back to ZoneRef when inference is
 * imprecise, e.g. for an empty input list).
 */
export function withUnassignedZone<T extends ZoneRef>(
  zones: readonly T[] | null | undefined,
): Array<T | ZoneRef> {
  const list = zones ?? [];
  if (list.some((z) => z.id === UNASSIGNED_ZONE.id)) return [...list];
  return [UNASSIGNED_ZONE, ...list];
}
