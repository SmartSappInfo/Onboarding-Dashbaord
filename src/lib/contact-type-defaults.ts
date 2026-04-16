/**
 * Contact Type Defaults (FER-01)
 *
 * System-level default contact types per entity type.
 * Supports a 3-level override hierarchy:
 *   1. System defaults (base, shipped with app)
 *   2. Organization overrides (superadmin customization)
 *   3. Workspace overrides (workspace/org admin refinement)
 *
 * Merge behavior: start with system defaults, overlay org overrides, overlay workspace overrides.
 */

import type { ContactTypeEntry, EntityType } from './types';

// ─── System Defaults ──────────────────────────────────────────────────

const INSTITUTION_CONTACT_TYPES: ContactTypeEntry[] = [
  { key: 'manager', label: 'Manager', active: true, order: 1 },
  { key: 'accountant', label: 'Accountant', active: true, order: 2 },
  { key: 'owner', label: 'Owner', active: true, order: 3 },
  { key: 'administrator', label: 'Administrator', active: true, order: 4 },
  { key: 'billing_officer', label: 'Billing Officer', active: true, order: 5 },
  { key: 'principal', label: 'Principal', active: true, order: 6 },
  { key: 'champion', label: 'Champion', active: true, order: 7 },
];

const FAMILY_CONTACT_TYPES: ContactTypeEntry[] = [
  { key: 'father', label: 'Father', active: true, order: 1 },
  { key: 'mother', label: 'Mother', active: true, order: 2 },
  { key: 'guardian', label: 'Guardian', active: true, order: 3 },
  { key: 'emergency_contact', label: 'Emergency Contact', active: true, order: 4 },
];

const PERSON_CONTACT_TYPES: ContactTypeEntry[] = [
  { key: 'personal', label: 'Personal', active: true, order: 1 },
  { key: 'home', label: 'Home', active: true, order: 2 },
  { key: 'office', label: 'Office', active: true, order: 3 },
  { key: 'assistant', label: 'Assistant', active: true, order: 4 },
];

/**
 * Returns the system-level default contact types for a given entity type.
 */
export function getSystemContactTypes(entityType: EntityType): ContactTypeEntry[] {
  switch (entityType) {
    case 'institution':
      return [...INSTITUTION_CONTACT_TYPES];
    case 'family':
      return [...FAMILY_CONTACT_TYPES];
    case 'person':
      return [...PERSON_CONTACT_TYPES];
    default:
      return [...PERSON_CONTACT_TYPES];
  }
}

/**
 * Resolves the effective contact types by merging system defaults
 * with optional organization and workspace overrides.
 *
 * Merge strategy:
 * - New keys from overrides are appended
 * - Existing keys from overrides replace the base entry
 * - Inactive types in overrides are excluded from the final set
 * - Final list is sorted by order
 */
export function resolveContactTypes(
  entityType: EntityType,
  orgOverrides?: ContactTypeEntry[],
  wsOverrides?: ContactTypeEntry[]
): ContactTypeEntry[] {
  // 1. Start with system defaults
  const merged = new Map<string, ContactTypeEntry>();
  for (const entry of getSystemContactTypes(entityType)) {
    merged.set(entry.key, { ...entry });
  }

  // 2. Apply organization overrides
  if (orgOverrides) {
    for (const entry of orgOverrides) {
      merged.set(entry.key, { ...entry });
    }
  }

  // 3. Apply workspace overrides
  if (wsOverrides) {
    for (const entry of wsOverrides) {
      merged.set(entry.key, { ...entry });
    }
  }

  // 4. Filter active, sort by order
  return Array.from(merged.values())
    .filter((e) => e.active)
    .sort((a, b) => a.order - b.order);
}

/**
 * Returns the Firestore document ID pattern for contact type templates.
 */
export function getContactTypeTemplateId(
  scopeType: 'system' | 'organization' | 'workspace',
  entityType: EntityType,
  scopeId?: string
): string {
  if (scopeType === 'system') {
    return `system_${entityType}`;
  }
  if (scopeType === 'organization' && scopeId) {
    return `org_${scopeId}_${entityType}`;
  }
  if (scopeType === 'workspace' && scopeId) {
    return `ws_${scopeId}_${entityType}`;
  }
  return `system_${entityType}`;
}
