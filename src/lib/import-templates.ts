/**
 * CSV Import Templates for scope-specific contact imports
 * 
 * Requirements: 20.1, 20.7, 20.8, 20.9
 * 
 * Provides three distinct import templates:
 * - Institution: for school/organization contacts
 * - Family: for family/guardian/child contacts
 * - Person: for individual CRM contacts
 */

import { EntityType } from './types';

/**
 * Institution import template columns (Requirement 20.7)
 */
export const INSTITUTION_TEMPLATE_COLUMNS = [
  'name',
  'nominalRoll',
  'billingAddress',
  'currency',
  'subscriptionPackageId',
  'focalPerson_name',
  'focalPerson_phone',
  'focalPerson_email',
  'focalPerson_type',
] as const;

/**
 * Family import template columns (Requirement 20.8)
 */
export const FAMILY_TEMPLATE_COLUMNS = [
  'familyName',
  'guardian1_name',
  'guardian1_phone',
  'guardian1_email',
  'guardian1_relationship',
  'child1_firstName',
  'child1_lastName',
  'child1_gradeLevel',
] as const;

/**
 * Person import template columns (Requirement 20.9)
 */
export const PERSON_TEMPLATE_COLUMNS = [
  'firstName',
  'lastName',
  'company',
  'jobTitle',
  'leadSource',
  'phone',
  'email',
] as const;

/**
 * Required fields for each entity type
 */
export const REQUIRED_FIELDS: Record<EntityType, string[]> = {
  institution: ['name'],
  family: ['familyName'],
  person: ['firstName', 'lastName'],
};

/**
 * Field descriptions for template documentation
 */
export const FIELD_DESCRIPTIONS: Record<string, string> = {
  // Institution fields
  name: 'Institution name (required)',
  nominalRoll: 'Number of students enrolled',
  billingAddress: 'Billing address for invoices',
  currency: 'Currency code (e.g., USD, GBP, ZAR)',
  subscriptionPackageId: 'Subscription package identifier',
  focalPerson_name: 'Primary contact person name',
  focalPerson_phone: 'Primary contact phone number',
  focalPerson_email: 'Primary contact email address',
  focalPerson_type: 'Contact type (Champion, Principal, Administrator, etc.)',
  
  // Family fields
  familyName: 'Family surname (required)',
  guardian1_name: 'First guardian full name',
  guardian1_phone: 'First guardian phone number',
  guardian1_email: 'First guardian email address',
  guardian1_relationship: 'Relationship to children (Father, Mother, Legal Guardian)',
  child1_firstName: 'First child first name',
  child1_lastName: 'First child last name',
  child1_gradeLevel: 'First child grade level',
  
  // Person fields
  firstName: 'First name (required)',
  lastName: 'Last name (required)',
  company: 'Company or organization',
  jobTitle: 'Job title or position',
  leadSource: 'How this lead was acquired',
  phone: 'Phone number',
  email: 'Email address',
};

/**
 * Generates a CSV template for the specified entity type
 * 
 * @param entityType - The type of entity to generate a template for
 * @returns CSV string with headers and example row
 */
export function generateImportTemplate(entityType: EntityType): string {
  let columns: readonly string[];
  let exampleRow: string[];

  switch (entityType) {
    case 'institution':
      columns = INSTITUTION_TEMPLATE_COLUMNS;
      exampleRow = [
        'Example School',
        '250',
        '123 Main St, City, Country',
        'USD',
        'pkg_standard',
        'John Smith',
        '+1234567890',
        'john@example.com',
        'Principal',
      ];
      break;

    case 'family':
      columns = FAMILY_TEMPLATE_COLUMNS;
      exampleRow = [
        'Smith',
        'Jane Smith',
        '+1234567890',
        'jane@example.com',
        'Mother',
        'Emma',
        'Smith',
        'Grade 5',
      ];
      break;

    case 'person':
      columns = PERSON_TEMPLATE_COLUMNS;
      exampleRow = [
        'John',
        'Doe',
        'Acme Corp',
        'Sales Manager',
        'Website',
        '+1234567890',
        'john.doe@example.com',
      ];
      break;

    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }

  // Generate CSV with headers and example row
  const headers = columns.join(',');
  const example = exampleRow.map(escapeCSVValue).join(',');
  
  return `${headers}\n${example}`;
}

/**
 * Escapes a CSV value (handles commas, quotes, newlines)
 */
function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Gets the template columns for a given entity type
 */
export function getTemplateColumns(entityType: EntityType): readonly string[] {
  switch (entityType) {
    case 'institution':
      return INSTITUTION_TEMPLATE_COLUMNS;
    case 'family':
      return FAMILY_TEMPLATE_COLUMNS;
    case 'person':
      return PERSON_TEMPLATE_COLUMNS;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Validates that a CSV row has all required fields for the entity type
 */
export function validateRequiredFields(
  row: Record<string, any>,
  entityType: EntityType
): { valid: boolean; missingFields: string[] } {
  const required = REQUIRED_FIELDS[entityType];
  const missingFields = required.filter(field => !row[field] || row[field].trim() === '');

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
