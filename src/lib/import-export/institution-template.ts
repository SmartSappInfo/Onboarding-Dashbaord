/**
 * Institution Import/Export Template
 * 
 * Defines CSV schema for importing and exporting institution entities.
 * Requirements: 20, 27
 */

export interface InstitutionImportRow {
  name: string;
  nominalRoll?: string;
  billingAddress?: string;
  currency?: string;
  subscriptionPackageId?: string;
  focalPerson_name?: string;
  focalPerson_phone?: string;
  focalPerson_email?: string;
  focalPerson_type?: string;
}

export const INSTITUTION_CSV_COLUMNS = [
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

export const INSTITUTION_TEMPLATE_HEADER = INSTITUTION_CSV_COLUMNS.join(',');

export const INSTITUTION_SAMPLE_ROW = [
  'Example School',
  '500',
  '123 Main St, City, Country',
  'USD',
  'premium',
  'John Doe',
  '+1234567890',
  'john@example.com',
  'Principal',
].join(',');
