/**
 * Institution Import/Export Template
 * 
 * Defines CSV schema for importing and exporting institution entities.
 * Required fields are listed first.
 * Requirements: 20, 27
 */

export interface InstitutionImportRow {
  name: string;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  contact_role?: string;
  nominalRoll?: string;
  billingAddress?: string;
  currency?: string;
  subscriptionPackageId?: string;
  locationString?: string;
  leadSource?: string;
}

/** Required field keys (for UI indicators) */
export const INSTITUTION_REQUIRED_FIELDS = ['name', 'contact_name'];

/** All CSV columns — required first, then optional */
export const INSTITUTION_CSV_COLUMNS = [
  'name',
  'contact_name',
  'contact_phone',
  'contact_email',
  'contact_role',
  'nominalRoll',
  'billingAddress',
  'currency',
  'subscriptionPackageId',
  'locationString',
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
  'Website',
].join(',');

/** Field-level instructions for the import instructions panel */
export const INSTITUTION_FIELD_INSTRUCTIONS = [
  { field: 'name', description: 'Institution/School name (required)', required: true },
  { field: 'contact_name', description: 'Primary contact person name (required)', required: true },
  { field: 'contact_phone', description: 'Contact phone number (required per policy)' },
  { field: 'contact_email', description: 'Contact email address (required per policy)' },
  { field: 'contact_role', description: 'Contact role, e.g. Principal, Admin' },
  { field: 'nominalRoll', description: 'Number of students/users' },
  { field: 'billingAddress', description: 'Billing address for invoices' },
  { field: 'currency', description: 'Currency code, e.g. GHS, USD' },
  { field: 'subscriptionPackageId', description: 'Package ID for subscription' },
  { field: 'locationString', description: 'Physical location description' },
  { field: 'leadSource', description: 'How the lead was acquired' },
];
