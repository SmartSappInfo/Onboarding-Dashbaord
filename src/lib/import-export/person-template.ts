/**
 * Person Import/Export Template
 * 
 * Defines CSV schema for importing and exporting person entities.
 * Required fields are listed first and marked with * in the header.
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
  lifecycleStatus?: string;
  contactName?: string;
}

/** Required columns come first, marked with * */
export const PERSON_REQUIRED_COLUMNS = [
  'firstName*',
] as const;

/** Optional columns follow required ones */
export const PERSON_OPTIONAL_COLUMNS = [
  'lastName',
  'phone',
  'email',
  'contactName',
  'company',
  'jobTitle',
  'leadSource',
  'lifecycleStatus',
] as const;

/** All columns (required first, then optional) */
export const PERSON_CSV_COLUMNS = [
  ...PERSON_REQUIRED_COLUMNS,
  ...PERSON_OPTIONAL_COLUMNS,
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
  'Onboarding',
].join(',');

/** Field-level instructions for the import instructions panel */
export const PERSON_FIELD_INSTRUCTIONS = [
  { field: 'firstName*', description: 'First name of the person (required)' },
  { field: 'lastName', description: 'Last name / surname' },
  { field: 'phone', description: 'Phone number (required per policy)' },
  { field: 'email', description: 'Email address (required per policy)' },
  { field: 'contactName', description: 'Full contact name (auto-derived if blank)' },
  { field: 'company', description: 'Company or organization name' },
  { field: 'jobTitle', description: 'Job title or role' },
  { field: 'leadSource', description: 'How the lead was acquired' },
  { field: 'lifecycleStatus', description: 'Lead status, e.g. Onboarding, Active' },
];
