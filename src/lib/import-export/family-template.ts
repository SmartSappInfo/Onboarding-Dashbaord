/**
 * Family Import/Export Template
 * 
 * Defines CSV schema for importing and exporting family entities.
 * Required fields are listed first and marked with * in the header.
 * Requirements: 20, 27
 */

export interface FamilyImportRow {
  familyName: string;
  guardian1_name: string;
  guardian1_phone?: string;
  guardian1_email?: string;
  guardian1_relationship?: string;
  child1_firstName?: string;
  child1_lastName?: string;
  child1_gradeLevel?: string;
  lifecycleStatus?: string;
  leadSource?: string;
}

/** Required columns come first, marked with * */
export const FAMILY_REQUIRED_COLUMNS = [
  'familyName*',
  'guardian1_name*',
] as const;

/** Optional columns follow required ones */
export const FAMILY_OPTIONAL_COLUMNS = [
  'guardian1_phone',
  'guardian1_email',
  'guardian1_relationship',
  'child1_firstName',
  'child1_lastName',
  'child1_gradeLevel',
  'lifecycleStatus',
  'leadSource',
] as const;

/** All columns (required first, then optional) */
export const FAMILY_CSV_COLUMNS = [
  ...FAMILY_REQUIRED_COLUMNS,
  ...FAMILY_OPTIONAL_COLUMNS,
] as const;

export const FAMILY_TEMPLATE_HEADER = FAMILY_CSV_COLUMNS.join(',');

export const FAMILY_SAMPLE_ROW = [
  'Smith Family',
  'Jane Smith',
  '+1234567890',
  'jane@example.com',
  'Mother',
  'Emma',
  'Smith',
  'Grade 5',
  'Onboarding',
  'Referral',
].join(',');

/** Field-level instructions for the import instructions panel */
export const FAMILY_FIELD_INSTRUCTIONS = [
  { field: 'familyName*', description: 'Family/household name (required)' },
  { field: 'guardian1_name*', description: 'Primary guardian full name (required)' },
  { field: 'guardian1_phone', description: 'Guardian phone number (required per policy)' },
  { field: 'guardian1_email', description: 'Guardian email address (required per policy)' },
  { field: 'guardian1_relationship', description: 'Relationship, e.g. Mother, Father' },
  { field: 'child1_firstName', description: 'First child first name' },
  { field: 'child1_lastName', description: 'First child last name' },
  { field: 'child1_gradeLevel', description: 'First child grade level' },
  { field: 'lifecycleStatus', description: 'Lead status, e.g. Onboarding, Active' },
  { field: 'leadSource', description: 'How the family was acquired' },
];
