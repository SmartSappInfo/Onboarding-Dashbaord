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
 * Generates VariableDefinition entries for all entity creation/editing
 * form fields. These correspond to the fields available in the
 * entity creation and editing pages, making them all available as
 * template variables.
 *
 * Groups:
 * - Core Identity (name, initials, slogan, status)
 * - Location & Geography (zone, country, region, district, locationString)
 * - Financial & Billing (currency, subscription, arrears, credit, discount)
 * - Narrative & Context (currentNeeds, currentChallenges, interests)
 * - Person Fields (firstName, lastName, company, jobTitle, leadSource)
 * - Online Presence (website, digital address)
 * - Operational (capacity, leadScore)
 *
 * @param entityTerminology  User-facing term for the entity type (e.g. 'Campus', 'Client')
 */
export function generateEntityFieldVariables(
  entityTerminology = 'Entity'
): VariableDefinition[] {
  const t = entityTerminology;
  const src = 'entity_fields';
  const srcName = `${t} Fields`;

  return [
    // ── Core Identity ──
    { id: 'ef_slogan',   key: 'entity_slogan',   label: `${t} Slogan`,   category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'slogan',   type: 'string' },
    { id: 'ef_status',   key: 'entity_status',   label: `${t} Status`,   category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'status',   type: 'string' },

    // ── Location & Geography ──
    { id: 'ef_zone',     key: 'entity_zone',     label: `${t} Zone`,     category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'zone.name',              type: 'string' },
    { id: 'ef_country',  key: 'entity_country',  label: `${t} Country`,  category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'location.country.name',   type: 'string' },
    { id: 'ef_region',   key: 'entity_region',   label: `${t} Region`,   category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'location.region.name',    type: 'string' },
    { id: 'ef_district', key: 'entity_district', label: `${t} District`, category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'location.district.name',  type: 'string' },

    // ── Financial & Billing ──
    { id: 'ef_billing_addr',  key: 'entity_billing_address',  label: `Billing Address`,       category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'billingAddress',      type: 'string' },
    { id: 'ef_currency',      key: 'entity_currency',         label: `Currency`,              category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'currency',            type: 'string' },
    { id: 'ef_sub_rate',      key: 'entity_subscription_rate',label: `Subscription Rate`,     category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'subscriptionRate',    type: 'number' },
    { id: 'ef_discount',      key: 'entity_discount',         label: `Discount Percentage`,   category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'discountPercentage',  type: 'number' },
    { id: 'ef_arrears',       key: 'entity_arrears',          label: `Arrears Balance`,       category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'arrearsBalance',      type: 'number' },
    { id: 'ef_credit',        key: 'entity_credit',           label: `Credit Balance`,        category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'creditBalance',       type: 'number' },

    // ── Narrative & Context ──
    { id: 'ef_needs',       key: 'entity_current_needs',      label: `Current Needs`,       category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'currentNeeds',      type: 'string' },
    { id: 'ef_challenges',  key: 'entity_current_challenges', label: `Current Challenges`,  category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'currentChallenges', type: 'string' },
    { id: 'ef_interests',   key: 'entity_interests',          label: `Interests`,           category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'interests',         type: 'string' },

    // ── Person Fields ──
    { id: 'ef_first_name',  key: 'entity_first_name',   label: `First Name`,    category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'firstName',   type: 'string' },
    { id: 'ef_last_name',   key: 'entity_last_name',    label: `Last Name`,     category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'lastName',    type: 'string' },
    { id: 'ef_company',     key: 'entity_company',       label: `Company`,       category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'company',     type: 'string' },
    { id: 'ef_job_title',   key: 'entity_job_title',     label: `Job Title`,     category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'jobTitle',    type: 'string' },
    { id: 'ef_lead_source', key: 'entity_lead_source',   label: `Lead Source`,   category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'leadSource',  type: 'string' },

    // ── Online Presence ──
    { id: 'ef_website',         key: 'entity_website',         label: `Website`,         category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'op_website',        type: 'url' },
    { id: 'ef_digital_address', key: 'entity_digital_address', label: `Digital Address`, category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'op_digitalAddress', type: 'string' },

    // ── Operational ──
    { id: 'ef_capacity',    key: 'entity_capacity',    label: `${t} Capacity`,   category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'capacity',   type: 'number' },
    { id: 'ef_lead_score',  key: 'entity_lead_score',  label: `Lead Score`,      category: 'general', source: src, sourceName: srcName, entity: 'Entity', path: 'leadScore',  type: 'number' },
  ];
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
