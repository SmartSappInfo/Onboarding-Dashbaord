/**
 * School Helper Utilities
 * 
 * Provides backward-compatible accessors for School model migration.
 * Created during Phase 2.1 of TypeScript error resolution.
 * 
 * Migration Context:
 * - Old model: school.phone, school.email, school.contactPerson (direct fields)
 * - New model: school.focalPersons[] (array of FocalPerson objects)
 */

import type { School, FocalPerson } from './types';

/**
 * Gets the primary contact person for a school.
 * Priority: First signatory, then first focal person.
 * 
 * @param school - The school object
 * @returns The primary focal person or undefined if none exist
 * 
 * @example
 * const primary = getPrimaryContact(school);
 * if (primary) {
 *   console.log(primary.name, primary.email);
 * }
 */
export function getPrimaryContact(school: School): FocalPerson | undefined {
  if (!school.focalPersons || school.focalPersons.length === 0) {
    return undefined;
  }
  
  const signatory = school.focalPersons.find(fp => fp.isSignatory);
  return signatory || school.focalPersons[0];
}

/**
 * Gets the primary email address for a school.
 * 
 * @param school - The school object
 * @returns The primary email or undefined
 * 
 * @example
 * const email = getSchoolEmail(school);
 * if (email) {
 *   await sendEmail(email, subject, body);
 * }
 */
export function getSchoolEmail(school: School): string | undefined {
  const primary = getPrimaryContact(school);
  return primary?.email;
}

/**
 * Gets the primary phone number for a school.
 * 
 * @param school - The school object
 * @returns The primary phone or undefined
 * 
 * @example
 * const phone = getSchoolPhone(school);
 * if (phone) {
 *   await sendSMS(phone, message);
 * }
 */
export function getSchoolPhone(school: School): string | undefined {
  const primary = getPrimaryContact(school);
  return primary?.phone;
}

/**
 * Gets the primary contact person's name.
 * 
 * @param school - The school object
 * @returns The contact person's name or undefined
 * 
 * @example
 * const name = getContactPerson(school);
 * console.log(`Contact: ${name || 'Not specified'}`);
 */
export function getContactPerson(school: School): string | undefined {
  const primary = getPrimaryContact(school);
  return primary?.name;
}

/**
 * Gets all email addresses for a school (all focal persons).
 * 
 * @param school - The school object
 * @returns Array of email addresses
 * 
 * @example
 * const emails = getAllSchoolEmails(school);
 * await sendBulkEmail(emails, subject, body);
 */
export function getAllSchoolEmails(school: School): string[] {
  if (!school.focalPersons) return [];
  return school.focalPersons
    .map(fp => fp.email)
    .filter((email): email is string => !!email);
}

/**
 * Gets all phone numbers for a school (all focal persons).
 * 
 * @param school - The school object
 * @returns Array of phone numbers
 * 
 * @example
 * const phones = getAllSchoolPhones(school);
 * await sendBulkSMS(phones, message);
 */
export function getAllSchoolPhones(school: School): string[] {
  if (!school.focalPersons) return [];
  return school.focalPersons
    .map(fp => fp.phone)
    .filter((phone): phone is string => !!phone);
}

/**
 * Gets the signatory focal person (for contracts).
 * 
 * @param school - The school object
 * @returns The signatory focal person or undefined
 * 
 * @example
 * const signatory = getSignatory(school);
 * if (signatory) {
 *   await generateContract(school, signatory);
 * }
 */
export function getSignatory(school: School): FocalPerson | undefined {
  if (!school.focalPersons) return undefined;
  return school.focalPersons.find(fp => fp.isSignatory);
}

/**
 * Checks if a school has a valid primary contact.
 * 
 * @param school - The school object
 * @returns True if school has at least one focal person with email
 * 
 * @example
 * if (hasValidContact(school)) {
 *   await sendWelcomeEmail(school);
 * }
 */
export function hasValidContact(school: School): boolean {
  const primary = getPrimaryContact(school);
  return !!(primary && primary.email);
}

/**
 * Formats a school's contact information for display.
 * 
 * @param school - The school object
 * @returns Formatted contact string
 * 
 * @example
 * const contact = formatSchoolContact(school);
 * // Returns: "John Doe (john@school.com, +233123456789)"
 */
export function formatSchoolContact(school: School): string {
  const primary = getPrimaryContact(school);
  if (!primary) return 'No contact information';
  
  const parts = [primary.name];
  if (primary.email) parts.push(primary.email);
  if (primary.phone) parts.push(primary.phone);
  
  return parts.join(' • ');
}
