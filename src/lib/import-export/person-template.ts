/**
 * Person Import/Export Template
 * 
 * Defines CSV schema for importing and exporting person entities.
 * Required fields are listed first.
 * Requirements: 20, 27
 */

export interface PersonImportRow {
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  leadSource?: string;
  contactName?: string;
}

/** Required field keys (for UI indicators) */
export const PERSON_REQUIRED_FIELDS = ['firstName'];

/** All CSV columns — required first, then optional */
export const PERSON_CSV_COLUMNS = [
  'firstName',
  'lastName',
  'phone',
  'email',
  'contactName',
  'company',
  'jobTitle',
  'leadSource',
] as const;

export const PERSON_TEMPLATE_HEADER = PERSON_CSV_COLUMNS.join(',');

export const PERSON_SAMPLE_ROW = [
  'John',
  'Doe',
  '+1234567890',
  'john.doe@example.com',
  '',
  'Acme Corp',
  'Sales Manager',
  'Website',
].join(',');

/** Field-level instructions for the import instructions panel */
export const PERSON_FIELD_INSTRUCTIONS = [
  { field: 'firstName', description: 'First name of the person (required)', required: true },
  { field: 'lastName', description: 'Last name / surname' },
  { field: 'phone', description: 'Phone number (required per policy)' },
  { field: 'email', description: 'Email address (required per policy)' },
  { field: 'contactName', description: 'Full contact name (auto-derived if blank)' },
  { field: 'company', description: 'Company or organization name' },
  { field: 'jobTitle', description: 'Job title or role' },
  { field: 'leadSource', description: 'How the lead was acquired' },
];
