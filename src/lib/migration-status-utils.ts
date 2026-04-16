import type { MigrationStatus, ResolvedContact, EntityContact } from './types';
import {
  getPrimaryContact,
  getSignatoryContact,
  resolveEntityContacts,
} from './entity-contact-helpers';

/**
 * @fileOverview Migration Status Utility Functions
 * 
 * Helper functions for checking and describing migration status of school records.
 * These functions help determine whether to read from the legacy schools collection
 * or the new entities + workspace_entities model.
 * 
 * FER-01: Contact resolution now uses entityContacts first, falling back to legacy contacts.
 * 
 * Requirements: 18 (Backward Compatibility)
 */

/**
 * Helper function to check if a school/contact is fully migrated
 * 
 * @param migrationStatus - The migration status to check
 * @returns true if the record is fully migrated to entities + workspace_entities
 */
export function isMigrated(migrationStatus?: MigrationStatus): boolean {
  return migrationStatus === 'migrated';
}

/**
 * Helper function to check if a school/contact is in legacy mode
 * 
 * @param migrationStatus - The migration status to check
 * @returns true if the record is still using the legacy schools collection
 */
export function isLegacy(migrationStatus?: MigrationStatus): boolean {
  return !migrationStatus || migrationStatus === 'legacy';
}

/**
 * Helper function to check if a school/contact is in dual-write mode
 * 
 * @param migrationStatus - The migration status to check
 * @returns true if the record is in transitional dual-write state
 */
export function isDualWrite(migrationStatus?: MigrationStatus): boolean {
  return migrationStatus === 'dual-write';
}

/**
 * Helper function to get a human-readable description of the migration status
 * 
 * @param migrationStatus - The migration status to describe
 * @returns A human-readable description of the migration status
 */
export function getMigrationStatusDescription(migrationStatus?: MigrationStatus): string {
  switch (migrationStatus) {
    case 'migrated':
      return 'Fully migrated to new entities model';
    case 'dual-write':
      return 'Transitional state - writes go to both old and new models';
    case 'legacy':
    default:
      return 'Using legacy schools collection';
  }
}

/**
 * Helper function to get primary contact email from resolved contact.
 * FER-01: Resolves from entityContacts first via isPrimary flag.
 */
export function getContactEmail(contact: ResolvedContact): string | undefined {
  // Try entityContacts first (new model)
  if (contact.entityContacts && contact.entityContacts.length > 0) {
    const primary = contact.entityContacts.find(c => c.isPrimary) || contact.entityContacts[0];
    return primary.email;
  }
  // Fallback to legacy contacts
  if (contact.contacts && contact.contacts.length > 0) {
    return contact.contacts[0].email;
  }
  return undefined;
}

/**
 * Helper function to get primary contact phone from resolved contact.
 * FER-01: Resolves from entityContacts first via isPrimary flag.
 */
export function getContactPhone(contact: ResolvedContact): string | undefined {
  if (contact.entityContacts && contact.entityContacts.length > 0) {
    const primary = contact.entityContacts.find(c => c.isPrimary) || contact.entityContacts[0];
    return primary.phone;
  }
  if (contact.contacts && contact.contacts.length > 0) {
    return contact.contacts[0].phone;
  }
  return undefined;
}

/**
 * Helper function to get signatory from resolved contact.
 * FER-01: Resolves from entityContacts first via isSignatory flag.
 */
export function getContactSignatory(contact: ResolvedContact): EntityContact | { name: string; email: string; phone: string; type: string; isSignatory: boolean } | null {
  if (contact.entityContacts && contact.entityContacts.length > 0) {
    return contact.entityContacts.find(c => c.isSignatory) || contact.entityContacts[0];
  }
  if (contact.contacts && contact.contacts.length > 0) {
    return contact.contacts.find(c => c.isSignatory) || contact.contacts[0];
  }
  return null;
}

/**
 * Helper function to get the specific contact person matching a recipient string.
 * Used for independent variable resolution (Requirement 35.3).
 * FER-01: Checks entityContacts first.
 */
export function getRecipientContact(contact: ResolvedContact, recipient?: string) {
  // Try entityContacts first
  if (contact.entityContacts && contact.entityContacts.length > 0) {
    if (!recipient) return getContactSignatory(contact);
    const target = recipient.toLowerCase().trim();
    const match = contact.entityContacts.find(c =>
      (c.email && c.email.toLowerCase().trim() === target) ||
      (c.phone && c.phone.trim() === target)
    );
    return match || getContactSignatory(contact);
  }

  // Fallback to legacy contacts
  if (!contact.contacts || contact.contacts.length === 0) return null;
  if (!recipient) return getContactSignatory(contact);

  const target = recipient.toLowerCase().trim();
  const match = contact.contacts.find(c => 
    (c.email && c.email.toLowerCase().trim() === target) ||
    (c.phone && c.phone.trim() === target)
  );

  return match || getContactSignatory(contact);
}

