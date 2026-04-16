/**
 * Entity Contact Helpers (FER-01)
 *
 * Central resolver module for the unified EntityContact model.
 * ALL code must read contact data through these helpers — never direct field access.
 *
 * Provides:
 * - Core resolvers (getPrimaryContact, getSignatoryContact, getContactByType)
 * - Variable generators (getContactVariables, normalizeContactType)
 * - Enforcement (ensureSinglePrimary, ensureSingleSignatory)
 * - Migration bridge (focalPersonToEntityContact, entityContactToFocalPerson)
 */

import type {
  Entity,
  EntityContact,
  FocalPerson,
  WorkspaceEntity,
  School,
} from './types';

// ─── Key Normalization ────────────────────────────────────────────────

/**
 * Normalizes a contact type label into a stable variable key.
 * "Billing Officer" → "billing_officer"
 * "School Owner"   → "school_owner"
 * "Father"         → "father"
 */
export function normalizeContactType(label: string): string {
  if (!label) return 'other';
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
}

// ─── Core Resolvers ───────────────────────────────────────────────────

/**
 * Resolves entityContacts from any entity-shaped object.
 * Falls back to legacy `contacts` / `focalPersons` if `entityContacts` is not populated.
 */
export function resolveEntityContacts(
  entity: Partial<Entity>
): EntityContact[] {
  // Prefer canonical entityContacts
  if (entity.entityContacts && entity.entityContacts.length > 0) {
    return entity.entityContacts;
  }

  return [];
}

/**
 * Gets the primary contact (isPrimary = true).
 * Falls back to first contact by order if no explicit primary.
 */
export function getPrimaryContact(
  entity: Partial<Entity>
): EntityContact | undefined {
  const contacts = resolveEntityContacts(entity);
  if (contacts.length === 0) return undefined;

  const primary = contacts.find((c) => c.isPrimary);
  if (primary) return primary;

  // Fallback: first by order
  return [...contacts].sort((a, b) => a.order - b.order)[0];
}

/**
 * Gets the signatory contact (isSignatory = true).
 * Falls back to primary contact if no explicit signatory.
 */
export function getSignatoryContact(
  entity: Partial<Entity>
): EntityContact | undefined {
  const contacts = resolveEntityContacts(entity);
  if (contacts.length === 0) return undefined;

  const signatory = contacts.find((c) => c.isSignatory);
  if (signatory) return signatory;

  // Fallback: primary contact
  return getPrimaryContact(entity);
}

/**
 * Gets the first contact matching a typeKey, sorted by order ascending.
 */
export function getContactByType(
  entity: Partial<Entity> & { contacts?: FocalPerson[]; entityContacts?: EntityContact[] },
  typeKey: string
): EntityContact | undefined {
  const contacts = resolveEntityContacts(entity);
  const normalizedKey = normalizeContactType(typeKey);
  const matching = contacts.filter((c) => c.typeKey === normalizedKey);
  if (matching.length === 0) return undefined;
  return [...matching].sort((a, b) => a.order - b.order)[0];
}

/**
 * Gets all contacts matching a typeKey, sorted by order ascending.
 */
export function getAllContactsByType(
  entity: Partial<Entity> & { contacts?: FocalPerson[]; entityContacts?: EntityContact[] },
  typeKey: string
): EntityContact[] {
  const contacts = resolveEntityContacts(entity);
  const normalizedKey = normalizeContactType(typeKey);
  return contacts
    .filter((c) => c.typeKey === normalizedKey)
    .sort((a, b) => a.order - b.order);
}

// ─── Variable Generation ──────────────────────────────────────────────

/**
 * Generates all contact variables for messaging, PDF templates, and campaigns.
 *
 * Output structure:
 * - Role/type-based:    contact_name_manager, contact_email_accountant
 * - Primary:            contact_name_primary, contact_email_primary
 * - Signatory:          contact_name_signatory, contact_email_signatory
 * - Legacy aliases:     school_phone, school_email, contact_name
 */
export function getContactVariables(
  entity: Partial<Entity> & { contacts?: FocalPerson[]; entityContacts?: EntityContact[] }
): Record<string, string> {
  const vars: Record<string, string> = {};
  const contacts = resolveEntityContacts(entity);

  // Track which type keys we've already seen (first-by-order wins)
  const seenTypes = new Set<string>();

  const sortedContacts = [...contacts].sort((a, b) => a.order - b.order);

  for (const contact of sortedContacts) {
    const typeKey = contact.typeKey || 'other';

    // Role/type-based variables (first matching by order wins)
    if (!seenTypes.has(typeKey)) {
      seenTypes.add(typeKey);
      vars[`contact_name_${typeKey}`] = contact.name || '';
      vars[`contact_email_${typeKey}`] = contact.email || '';
      vars[`contact_phone_${typeKey}`] = contact.phone || '';
      vars[`contact_role_${typeKey}`] = contact.typeLabel || contact.typeKey || '';
      vars[`contact_isSignatory_${typeKey}`] = String(contact.isSignatory);
      vars[`contact_isPrimary_${typeKey}`] = String(contact.isPrimary);
    }
  }

  // Primary contact variables
  const primary = contacts.find((c) => c.isPrimary) || sortedContacts[0];
  if (primary) {
    vars['contact_name_primary'] = primary.name || '';
    vars['contact_email_primary'] = primary.email || '';
    vars['contact_phone_primary'] = primary.phone || '';
    vars['contact_role_primary'] = primary.typeLabel || primary.typeKey || '';
  }

  // Signatory contact variables
  const signatory = contacts.find((c) => c.isSignatory) || primary;
  if (signatory) {
    vars['contact_name_signatory'] = signatory.name || '';
    vars['contact_email_signatory'] = signatory.email || '';
    vars['contact_phone_signatory'] = signatory.phone || '';
    vars['contact_role_signatory'] = signatory.typeLabel || signatory.typeKey || '';
  }

  // Legacy aliases for backward compatibility
  if (primary) {
    vars['school_phone'] = primary.phone || '';
    vars['school_email'] = primary.email || '';
    vars['contact_name'] = primary.name || '';
    vars['contact_email'] = primary.email || '';
    vars['contact_phone'] = primary.phone || '';
    vars['contact_position'] = primary.typeLabel || primary.typeKey || '';
    vars['name'] = primary.name || '';
    vars['email'] = primary.email || '';
    vars['phone'] = primary.phone || '';
    vars['first_name'] = (primary.name || '').split(' ')[0] || '';
  }

  return vars;
}

// ─── Enforcement ──────────────────────────────────────────────────────

/**
 * Ensures exactly one contact has isPrimary = true.
 * If none set, marks first contact by order.
 * If multiple set, keeps first by order, unsets others.
 */
export function ensureSinglePrimary(contacts: EntityContact[]): EntityContact[] {
  if (contacts.length === 0) return contacts;

  const sorted = [...contacts].sort((a, b) => a.order - b.order);
  const primaries = sorted.filter((c) => c.isPrimary);

  if (primaries.length === 1) return contacts;

  // Reset all, then set first
  const result = sorted.map((c) => ({ ...c, isPrimary: false }));
  if (primaries.length > 0) {
    // Keep the first existing primary
    const firstPrimaryIdx = result.findIndex((c) => c.id === primaries[0].id);
    if (firstPrimaryIdx >= 0) result[firstPrimaryIdx].isPrimary = true;
  } else {
    // No primary existed, set first by order
    result[0].isPrimary = true;
  }

  return result;
}

/**
 * Ensures exactly one contact has isSignatory = true.
 * If none set, marks first contact by order.
 * If multiple set, keeps first by order, unsets others.
 */
export function ensureSingleSignatory(contacts: EntityContact[]): EntityContact[] {
  if (contacts.length === 0) return contacts;

  const sorted = [...contacts].sort((a, b) => a.order - b.order);
  const signatories = sorted.filter((c) => c.isSignatory);

  if (signatories.length === 1) return contacts;

  const result = sorted.map((c) => ({ ...c, isSignatory: false }));
  if (signatories.length > 0) {
    const firstSignIdx = result.findIndex((c) => c.id === signatories[0].id);
    if (firstSignIdx >= 0) result[firstSignIdx].isSignatory = true;
  } else {
    result[0].isSignatory = true;
  }

  return result;
}

/**
 * Applies both primary and signatory enforcement in sequence.
 */
export function enforceContactConstraints(contacts: EntityContact[]): EntityContact[] {
  return ensureSingleSignatory(ensureSinglePrimary(contacts));
}

// ─── Migration Bridge ─────────────────────────────────────────────────

/**
 * Converts a legacy FocalPerson to an EntityContact.
 * Used during migration and for backward-compat reads.
 */
export function focalPersonToEntityContact(
  fp: FocalPerson,
  index: number
): EntityContact {
  const typeLabel = fp.type || 'Other';
  const typeKey = normalizeContactType(typeLabel);

  const contact: EntityContact = {
    id: `ec_migrated_${index}_${Date.now().toString(36)}`,
    name: fp.name || '',
    typeKey,
    typeLabel,
    isPrimary: index === 0, // First contact defaults to primary
    isSignatory: fp.isSignatory || false,
    order: index,
  };

  // Do not attach undefined values (rejected by Firestore admin SDK)
  if (fp.email) contact.email = fp.email;
  if (fp.phone) contact.phone = fp.phone;
  if (fp.notes !== undefined) contact.notes = fp.notes;
  if (fp.attachments !== undefined) contact.attachments = fp.attachments;

  return contact;
}

/**
 * Converts an EntityContact back to a FocalPerson.
 * Used for backward compatibility with legacy code paths.
 */
export function entityContactToFocalPerson(ec: EntityContact): FocalPerson {
  return {
    name: ec.name,
    phone: ec.phone || '',
    email: ec.email || '',
    type: ec.typeLabel || ec.typeKey || 'Other',
    isSignatory: ec.isSignatory,
    notes: ec.notes,
    attachments: ec.attachments,
  };
}

/**
 * Extracts denormalized primary contact fields from entityContacts.
 * Used for workspace_entities denormalization.
 */
export function extractPrimaryContactFields(
  entity: Partial<Entity> & { contacts?: FocalPerson[]; entityContacts?: EntityContact[] }
): { primaryContactName: string; primaryEmail: string; primaryPhone: string } {
  const primary = getPrimaryContact(entity);
  return {
    primaryContactName: primary?.name || '',
    primaryEmail: primary?.email || '',
    primaryPhone: primary?.phone || '',
  };
}
