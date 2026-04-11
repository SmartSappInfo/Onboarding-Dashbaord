/**
 * Entity Helper Utilities
 * 
 * Provides polymorphic accessors for Entity and WorkspaceEntity models.
 * Unified naming convention for the Modern Architecture.
 */

import type { School, WorkspaceEntity } from './types';

/**
 * Gets the primary contact information for an entity.
 * Polymorphic: Handles both legacy School and modern WorkspaceEntity.
 */
export function getPrimaryContact(entity: School | WorkspaceEntity): { name: string; email?: string; phone?: string; isSignatory?: boolean } | undefined {
  if ('entityId' in entity) {
    // WorkspaceEntity branch
    return {
      name: entity.primaryContactName || '',
      email: entity.primaryEmail,
      phone: entity.primaryPhone,
      isSignatory: true 
    };
  }

  // Legacy School branch
  if (!(entity as School).focalPersons || (entity as School).focalPersons.length === 0) {
    return undefined;
  }
  
  const signatory = (entity as School).focalPersons.find(fp => fp.isSignatory);
  return signatory || (entity as School).focalPersons[0];
}

/**
 * Gets the primary email address.
 */
export function getEntityEmail(entity: School | WorkspaceEntity): string | undefined {
  if ('entityId' in entity) return entity.primaryEmail;
  const primary = getPrimaryContact(entity);
  return primary?.email;
}

/**
 * Gets the primary phone number.
 */
export function getEntityPhone(entity: School | WorkspaceEntity): string | undefined {
  if ('entityId' in entity) return entity.primaryPhone;
  const primary = getPrimaryContact(entity);
  return primary?.phone;
}

/**
 * Gets the primary contact person's name.
 */
export function getContactPerson(entity: School | WorkspaceEntity): string | undefined {
  if ('entityId' in entity) return entity.primaryContactName;
  const primary = getPrimaryContact(entity);
  return primary?.name;
}

/**
 * Gets all email addresses for a record.
 */
export function getAllEntityEmails(entity: School | WorkspaceEntity): string[] {
  if ('entityId' in entity) {
    return entity.primaryEmail ? [entity.primaryEmail] : [];
  }
  if (!(entity as School).focalPersons) return [];
  return (entity as School).focalPersons
    .map(fp => fp.email)
    .filter((email): email is string => !!email);
}

/**
 * Checks if a record has a valid primary contact.
 */
export function hasValidContact(entity: School | WorkspaceEntity): boolean {
  if ('entityId' in entity) return !!(entity.primaryEmail || entity.primaryPhone);
  const primary = getPrimaryContact(entity);
  return !!(primary && primary.email);
}

/**
 * Formats contact information for display.
 */
export function formatEntityContact(entity: School | WorkspaceEntity): string {
  const primary = getPrimaryContact(entity);
  if (!primary) return 'No contact information';
  
  const parts = [primary.name];
  if (primary.email) parts.push(primary.email);
  if (primary.phone) parts.push(primary.phone);
  
  return parts.join(' • ');
}

/**
 * Gets the primary signatory for an entity.
 * Alias for getPrimaryContact to support legacy messaging logic.
 */
export function getSignatory(entity: School | WorkspaceEntity) {
  return getPrimaryContact(entity);
}
