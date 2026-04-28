/**
 * Institution Import/Export Template
 * 
 * Defines CSV schema for importing and exporting institution entities.
 * Required fields are listed first.
 * Requirements: 20, 27
 */

export interface InstitutionImportRow {
  name: string;
  focalPerson_name: string;
  focalPerson_phone?: string;
  focalPerson_email?: string;
  focalPerson_type?: string;
  nominalRoll?: string;
  billingAddress?: string;
  currency?: string;
  subscriptionPackageId?: string;
  locationString?: string;
  lifecycleStatus?: string;
  leadSource?: string;
}

/** Required field keys (for UI indicators) */
export const INSTITUTION_REQUIRED_FIELDS = ['name', 'focalPerson_name'];

/** All CSV columns — required first, then optional */
export const INSTITUTION_CSV_COLUMNS = [
  'name',
  'focalPerson_name',
  'focalPerson_phone',
  'focalPerson_email',
  'focalPerson_type',
  'nominalRoll',
  'billingAddress',
  'currency',
  'subscriptionPackageId',
  'locationString',
  'lifecycleStatus',
  'leadSource',
] as const;

export const INSTITUTION_TEMPLATE_HEADER = INSTITUTION_CSV_COLUMNS.join(',');

export const INSTITUTION_SAMPLE_ROW = [
  'Example School',
  'John Doe',
  '+1234567890',
  'john@example.com',
  'Principal',
  '500',
  '123 Main St',
  'USD',
  'premium',
  'Accra Ghana',
  'Onboarding',
  'Website',
].join(',');

/** Field-level instructions for the import instructions panel */
export const INSTITUTION_FIELD_INSTRUCTIONS = [
  { field: 'name', description: 'Institution/School name (required)', required: true },
  { field: 'focalPerson_name', description: 'Primary contact person name (required)', required: true },
  { field: 'focalPerson_phone', description: 'Contact phone number (required per policy)' },
  { field: 'focalPerson_email', description: 'Contact email address (required per policy)' },
  { field: 'focalPerson_type', description: 'Contact role, e.g. Principal, Admin' },
  { field: 'nominalRoll', description: 'Number of students/users' },
  { field: 'billingAddress', description: 'Billing address for invoices' },
  { field: 'currency', description: 'Currency code, e.g. GHS, USD' },
  { field: 'subscriptionPackageId', description: 'Package ID for subscription' },
  { field: 'locationString', description: 'Physical location description' },
  { field: 'lifecycleStatus', description: 'Lead status, e.g. Onboarding, Active' },
  { field: 'leadSource', description: 'How the lead was acquired' },
];
