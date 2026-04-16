'use server';

/**
 * Import Service - Handles CSV import with validation and idempotency
 * 
 * Requirements: 20.3, 20.6, 20.7
 * 
 * Key features:
 * - ScopeGuard enforcement
 * - Idempotent imports (match by name + organizationId)
 * - Error reporting without aborting
 */

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import { validateScopeMatch } from './scope-guard';
import { parseCSV, inferEntityType } from './csv-parser';
import { validateRequiredFields } from './import-templates';
import type {
  Entity,
  InstitutionData,
  FamilyData,
  PersonData,
  EntityType,
  ContactScope,
} from './types';
import type {
  ImportResult,
  ImportValidationError,
  InstitutionImportRow,
  FamilyImportRow,
  PersonImportRow,
} from './import-export-types';

interface ImportContactsInput {
  organizationId: string;
  workspaceId: string;
  workspaceContactScope: ContactScope;
  csvContent: string;
  userId: string;
  pipelineId?: string;
  stageId?: string;
}

/**
 * Imports contacts from CSV with validation and idempotency
 * 
 * Requirements: 20.3, 20.4, 20.6, 20.7
 * 
 * @param input - Import parameters
 * @returns Import result with success/error counts
 */
export async function importContactsAction(input: ImportContactsInput): Promise<ImportResult> {
  const timestamp = new Date().toISOString();
  const errors: ImportValidationError[] = [];
  const createdEntityIds: string[] = [];
  const duplicateEntityIds: string[] = [];

  try {
    // 1. Parse CSV
    const rows = parseCSV(input.csvContent);

    if (rows.length === 0) {
      return {
        success: false,
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        skippedCount: 0,
        errors: [{ row: 0, reason: 'CSV file is empty or has no data rows' }],
        createdEntityIds: [],
        duplicateEntityIds: [],
      };
    }

    // 2. Infer and validate entity type
    const headers = Object.keys(rows[0]);
    const detectedScope = inferEntityType(headers);

    if (!detectedScope) {
      return {
        success: false,
        totalRows: rows.length,
        successCount: 0,
        errorCount: 1,
        skippedCount: 0,
        errors: [{ row: 0, reason: 'Could not determine entity type from CSV headers' }],
        createdEntityIds: [],
        duplicateEntityIds: [],
      };
    }

    // 3. Enforce ScopeGuard (Requirement 20.3)
    const scopeValidation = validateScopeMatch(detectedScope, input.workspaceContactScope);
    if (!scopeValidation.valid) {
      return {
        success: false,
        totalRows: rows.length,
        successCount: 0,
        errorCount: 1,
        skippedCount: 0,
        errors: [{ row: 0, reason: scopeValidation.error.message }],
        createdEntityIds: [],
        duplicateEntityIds: [],
      };
    }

    // 4. Process each row (Requirement 20.4 - don't abort on errors)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because row 1 is headers

      try {
        // Validate required fields
        const fieldValidation = validateRequiredFields(row, detectedScope);
        if (!fieldValidation.valid) {
          errors.push({
            row: rowNumber,
            reason: `Missing required fields: ${fieldValidation.missingFields.join(', ')}`,
          });
          continue;
        }

        // Check for duplicate (Requirement 20.6 - idempotent import)
        const entityName = getEntityName(row, detectedScope);
        const existingEntity = await findExistingEntity(
          input.organizationId,
          entityName,
          detectedScope
        );

        if (existingEntity) {
          duplicateEntityIds.push(existingEntity.id);
          continue; // Skip duplicate
        }

        // Create entity
        const entityId = await createEntityFromRow(
          row,
          detectedScope,
          input.organizationId,
          timestamp
        );

        createdEntityIds.push(entityId);

        // Link to workspace if pipelineId and stageId provided
        if (input.pipelineId && input.stageId) {
          await linkEntityToWorkspace(
            entityId,
            input.workspaceId,
            input.organizationId,
            detectedScope,
            entityName,
            input.pipelineId,
            input.stageId,
            timestamp
          );
        }

      } catch (error: any) {
        errors.push({
          row: rowNumber,
          reason: error.message || 'Unknown error during import',
        });
      }
    }

    // 5. Log import activity
    await logActivity({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: 'contacts_imported',
      source: 'user_action',
      description: `Imported ${createdEntityIds.length} ${detectedScope} contacts from CSV`,
      metadata: {
        totalRows: rows.length,
        successCount: createdEntityIds.length,
        errorCount: errors.length,
        skippedCount: duplicateEntityIds.length,
        entityType: detectedScope,
      },
    });

    return {
      success: errors.length === 0,
      totalRows: rows.length,
      successCount: createdEntityIds.length,
      errorCount: errors.length,
      skippedCount: duplicateEntityIds.length,
      errors,
      createdEntityIds,
      duplicateEntityIds,
    };

  } catch (error: any) {
    console.error('>>> [IMPORT] Failed:', error.message);
    return {
      success: false,
      totalRows: 0,
      successCount: 0,
      errorCount: 1,
      skippedCount: 0,
      errors: [{ row: 0, reason: error.message }],
      createdEntityIds: [],
      duplicateEntityIds: [],
    };
  }
}

/**
 * Extracts entity name from CSV row based on entity type
 */
function getEntityName(row: Record<string, string>, entityType: EntityType): string {
  switch (entityType) {
    case 'institution':
      return row.name;
    case 'family':
      return row.familyName;
    case 'person':
      return `${row.firstName} ${row.lastName}`;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Finds existing entity by name and organization (for idempotency)
 * 
 * Requirement 20.6: Match by name + organizationId
 */
async function findExistingEntity(
  organizationId: string,
  name: string,
  entityType: EntityType
): Promise<Entity | null> {
  const snapshot = await adminDb
    .collection('entities')
    .where('organizationId', '==', organizationId)
    .where('entityType', '==', entityType)
    .where('name', '==', name)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Entity;
}

/**
 * Creates an entity from a CSV row
 */
async function createEntityFromRow(
  row: Record<string, string>,
  entityType: EntityType,
  organizationId: string,
  timestamp: string
): Promise<string> {
  const entityName = getEntityName(row, entityType);

  const entityData: Omit<Entity, 'id'> = {
    organizationId,
    entityType,
    name: entityName,
    entityContacts: [],
    contacts: [],
    globalTags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    relatedEntityIds: [],
  };

  // Add scope-specific data
  switch (entityType) {
    case 'institution':
      entityData.institutionData = buildInstitutionData(row as unknown as InstitutionImportRow);
      entityData.contacts = buildInstitutionContacts(row as unknown as InstitutionImportRow);
      break;

    case 'family':
      entityData.familyData = buildFamilyData(row as unknown as FamilyImportRow);
      break;

    case 'person':
      entityData.personData = buildPersonData(row as unknown as PersonImportRow);
      entityData.contacts = buildPersonContacts(row as unknown as PersonImportRow);
      break;
  }

  const entityRef = await adminDb.collection('entities').add(entityData);
  return entityRef.id;
}

/**
 * Builds institution data from CSV row
 */
function buildInstitutionData(row: InstitutionImportRow): InstitutionData {
  const data: InstitutionData = {};

  if (row.nominalRoll) {
    const nominalRoll = parseInt(row.nominalRoll, 10);
    if (!isNaN(nominalRoll)) {
      data.nominalRoll = nominalRoll;
    }
  }

  if (row.billingAddress) {
    data.billingAddress = row.billingAddress;
  }

  if (row.currency) {
    data.currency = row.currency;
  }

  if (row.subscriptionPackageId) {
    data.subscriptionPackageId = row.subscriptionPackageId;
  }

  return data;
}

/**
 * Builds institution contacts from CSV row
 */
function buildInstitutionContacts(row: InstitutionImportRow) {
  const contacts = [];

  if (row.focalPerson_name) {
    contacts.push({
      name: row.focalPerson_name,
      phone: row.focalPerson_phone || '',
      email: row.focalPerson_email || '',
      type: row.focalPerson_type || 'Contact',
      isSignatory: false,
    });
  }

  return contacts;
}

/**
 * Builds family data from CSV row
 */
function buildFamilyData(row: FamilyImportRow): FamilyData {
  const guardians = [];
  const children = [];

  // Add guardian if provided
  if (row.guardian1_name) {
    guardians.push({
      name: row.guardian1_name,
      phone: row.guardian1_phone || '',
      email: row.guardian1_email || '',
      relationship: row.guardian1_relationship || 'Guardian',
      isPrimary: true,
    });
  }

  // Add child if provided
  if (row.child1_firstName && row.child1_lastName) {
    children.push({
      firstName: row.child1_firstName,
      lastName: row.child1_lastName,
      dateOfBirth: '', // Not in template
      gradeLevel: row.child1_gradeLevel,
    });
  }

  return {
    guardians,
    children,
  };
}

/**
 * Builds person data from CSV row
 */
function buildPersonData(row: PersonImportRow): PersonData {
  return {
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    jobTitle: row.jobTitle,
    leadSource: row.leadSource,
  };
}

/**
 * Builds person contacts from CSV row
 */
function buildPersonContacts(row: PersonImportRow) {
  const contacts = [];

  if (row.phone || row.email) {
    contacts.push({
      name: `${row.firstName} ${row.lastName}`,
      phone: row.phone || '',
      email: row.email || '',
      type: 'Primary',
      isSignatory: false,
    });
  }

  return contacts;
}

/**
 * Links an entity to a workspace after import
 */
async function linkEntityToWorkspace(
  entityId: string,
  workspaceId: string,
  organizationId: string,
  entityType: EntityType,
  displayName: string,
  pipelineId: string,
  stageId: string,
  timestamp: string
): Promise<void> {
  const workspaceEntityData = {
    organizationId,
    workspaceId,
    entityId,
    entityType,
    pipelineId,
    stageId,
    status: 'active',
    workspaceTags: [],
    addedAt: timestamp,
    updatedAt: timestamp,
    displayName,
    entityContacts: [],
  };

  await adminDb.collection('workspace_entities').add(workspaceEntityData);
}
