import type { MigrationStatus, ResolvedContact } from './types';

/**
 * @fileOverview Migration Status Utility Functions
 * 
 * Helper functions for checking and describing migration status of school records.
 * These functions help determine whether to read from the legacy schools collection
 * or the new entities + workspace_entities model.
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
 * Helper function to get primary contact email from resolved contact
 */
export function getContactEmail(contact: ResolvedContact): string | undefined {
  if (contact.contacts && contact.contacts.length > 0) {
    return contact.contacts[0].email;
  }
  return undefined;
}

/**
 * Helper function to get primary contact phone from resolved contact
 */
export function getContactPhone(contact: ResolvedContact): string | undefined {
  if (contact.contacts && contact.contacts.length > 0) {
    return contact.contacts[0].phone;
  }
  return undefined;
}

/**
 * Helper function to get signatory from resolved contact
 */
export function getContactSignatory(contact: ResolvedContact) {
  if (contact.contacts && contact.contacts.length > 0) {
    return contact.contacts.find(c => c.isSignatory) || contact.contacts[0];
  }
  return null;
}
