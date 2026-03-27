/**
 * Person Import/Export Template
 * 
 * Defines CSV schema for importing and exporting person entities.
 * Requirements: 20, 27
 */

export interface PersonImportRow {
  firstName: string;
  lastName: string;
  company?: string;
  jobTitle?: string;
  leadSource?: string;
  phone?: string;
  email?: string;
}

export const PERSON_CSV_COLUMNS = [
  'firstName',
  'lastName',
  'company',
  'jobTitle',
  'leadSource',
  'phone',
  'email',
] as const;

export const PERSON_TEMPLATE_HEADER = PERSON_CSV_COLUMNS.join(',');

export const PERSON_SAMPLE_ROW = [
  'John',
  'Doe',
  'Acme Corp',
  'Sales Manager',
  'Website',
  '+1234567890',
  'john.doe@example.com',
].join(',');
