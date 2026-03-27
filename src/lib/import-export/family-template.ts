/**
 * Family Import/Export Template
 * 
 * Defines CSV schema for importing and exporting family entities.
 * Requirements: 20, 27
 */

export interface FamilyImportRow {
  familyName: string;
  guardian1_name?: string;
  guardian1_phone?: string;
  guardian1_email?: string;
  guardian1_relationship?: string;
  child1_firstName?: string;
  child1_lastName?: string;
  child1_gradeLevel?: string;
}

export const FAMILY_CSV_COLUMNS = [
  'familyName',
  'guardian1_name',
  'guardian1_phone',
  'guardian1_email',
  'guardian1_relationship',
  'child1_firstName',
  'child1_lastName',
  'child1_gradeLevel',
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
].join(',');
