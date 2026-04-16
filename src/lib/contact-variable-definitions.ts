/**
 * Contact Variable Definitions (FER-02)
 *
 * Dynamically generates VariableDefinition[] objects from the contact type
 * template system so that UI pickers (TemplateWorkshop, QuickTemplateDialog,
 * ComposerWizard) can display and insert contact-based variables without
 * requiring manual Firestore seeding.
 *
 * This module drives the "Contextual Registry → Entity Contacts" section
 * in the variable sidebar.
 */

import type { VariableDefinition, ContactTypeEntry, EntityType } from './types';
import { getSystemContactTypes } from './contact-type-defaults';

// ─── Variable Definition Builders ─────────────────────────────────────

/**
 * Builds VariableDefinition entries for a single contact type key.
 * Generates: name, email, phone, role for the given key.
 */
function buildTypeVariables(
  typeKey: string,
  typeLabel: string,
  idPrefix: string
): VariableDefinition[] {
  const fields = [
    { suffix: 'name',  label: `${typeLabel} — Name`,  path: 'entityContacts[].name' },
    { suffix: 'email', label: `${typeLabel} — Email`, path: 'entityContacts[].email' },
    { suffix: 'phone', label: `${typeLabel} — Phone`, path: 'entityContacts[].phone' },
    { suffix: 'role',  label: `${typeLabel} — Role`,  path: 'entityContacts[].typeLabel' },
  ];

  return fields.map((f, i) => ({
    id: `${idPrefix}_${typeKey}_${f.suffix}`,
    key: `contact_${f.suffix}_${typeKey}`,
    label: f.label,
    category: 'general',
    source: 'entity_contacts',
    sourceName: 'Entity Contacts',
    entity: 'Entity',
    path: f.path,
    type: 'string',
  }));
}

/**
 * Generates the full set of dynamic contact variable definitions.
 *
 * Groups:
 * 1. Primary Contact — contact_name_primary, contact_email_primary, etc.
 * 2. Signatory Contact — contact_name_signatory, contact_email_signatory, etc.
 * 3. Role-based Contacts — contact_name_manager, contact_email_accountant, etc.
 *    (derived from system defaults + optional overrides)
 *
 * @param entityType  Determines which system defaults to load (institution/family/person)
 * @param orgOverrides  Optional org-level contact type overrides
 * @param wsOverrides   Optional workspace-level contact type overrides
 */
export function generateContactVariableDefinitions(
  entityType: EntityType = 'institution',
  orgOverrides?: ContactTypeEntry[],
  wsOverrides?: ContactTypeEntry[]
): VariableDefinition[] {
  const defs: VariableDefinition[] = [];

  // ── Group 1: Primary Contact ──
  const primaryFields = [
    { suffix: 'name',  label: 'Primary Contact — Name' },
    { suffix: 'email', label: 'Primary Contact — Email' },
    { suffix: 'phone', label: 'Primary Contact — Phone' },
    { suffix: 'role',  label: 'Primary Contact — Role' },
  ];
  primaryFields.forEach(f => {
    defs.push({
      id: `ec_primary_${f.suffix}`,
      key: `contact_${f.suffix}_primary`,
      label: f.label,
      category: 'general',
      source: 'entity_contacts',
      sourceName: 'Primary Contact',
      entity: 'Entity',
      path: `entityContacts[isPrimary].${f.suffix}`,
      type: 'string',
    });
  });

  // ── Group 2: Signatory Contact ──
  const signatoryFields = [
    { suffix: 'name',  label: 'Signatory — Name' },
    { suffix: 'email', label: 'Signatory — Email' },
    { suffix: 'phone', label: 'Signatory — Phone' },
    { suffix: 'role',  label: 'Signatory — Role' },
  ];
  signatoryFields.forEach(f => {
    defs.push({
      id: `ec_signatory_${f.suffix}`,
      key: `contact_${f.suffix}_signatory`,
      label: f.label,
      category: 'general',
      source: 'entity_contacts',
      sourceName: 'Signatory Contact',
      entity: 'Entity',
      path: `entityContacts[isSignatory].${f.suffix}`,
      type: 'string',
    });
  });

  // ── Group 3: Role-Based Contacts ──
  // Start with system defaults, merge overrides
  const merged = new Map<string, ContactTypeEntry>();
  for (const entry of getSystemContactTypes(entityType)) {
    merged.set(entry.key, { ...entry });
  }
  if (orgOverrides) {
    for (const entry of orgOverrides) {
      merged.set(entry.key, { ...entry });
    }
  }
  if (wsOverrides) {
    for (const entry of wsOverrides) {
      merged.set(entry.key, { ...entry });
    }
  }

  const activeTypes = Array.from(merged.values())
    .filter(e => e.active)
    .sort((a, b) => a.order - b.order);

  for (const ct of activeTypes) {
    defs.push(...buildTypeVariables(ct.key, ct.label, 'ec_role'));
  }

  return defs;
}

/**
 * Segments contact variable definitions into UI-ready groups for the
 * variable sidebar panels.
 */
export function groupContactVariableDefinitions(
  defs: VariableDefinition[]
): {
  primary: VariableDefinition[];
  signatory: VariableDefinition[];
  roles: VariableDefinition[];
} {
  return {
    primary: defs.filter(d => d.sourceName === 'Primary Contact'),
    signatory: defs.filter(d => d.sourceName === 'Signatory Contact'),
    roles: defs.filter(d => d.sourceName === 'Entity Contacts'),
  };
}
