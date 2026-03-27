'use server';

/**
 * Export Service - Serializes entities to CSV format
 * 
 * Requirements: 20.7, 27
 * 
 * Exports entities from a workspace to CSV format matching import templates
 */

import { adminDb } from './firebase-admin';
import { getTemplateColumns } from './import-templates';
import type {
  Entity,
  WorkspaceEntity,
  EntityType,
  InstitutionData,
  FamilyData,
  PersonData,
} from './types';
import type { ExportOptions, ExportResult } from './import-export-types';

/**
 * Exports entities from a workspace to CSV
 * 
 * Requirements: 20.7, 27
 * 
 * @param options - Export options
 * @returns Export result with CSV content
 */
export async function exportContactsAction(options: ExportOptions): Promise<ExportResult> {
  try {
    // 1. Query workspace_entities for the workspace
    const workspaceEntitiesSnap = await adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', options.workspaceId)
      .where('entityType', '==', options.entityType)
      .where('status', '==', 'active')
      .get();

    if (workspaceEntitiesSnap.empty) {
      return {
        success: true,
        csvContent: generateEmptyCSV(options.entityType),
        filename: `${options.entityType}-export-${Date.now()}.csv`,
        rowCount: 0,
      };
    }

    // 2. Fetch entity details
    const entityIds = workspaceEntitiesSnap.docs.map(doc => {
      const data = doc.data() as WorkspaceEntity;
      return data.entityId;
    });

    const entities: Entity[] = [];
    for (const entityId of entityIds) {
      const entitySnap = await adminDb.collection('entities').doc(entityId).get();
      if (entitySnap.exists) {
        entities.push({ id: entitySnap.id, ...entitySnap.data() } as Entity);
      }
    }

    // 3. Generate CSV content
    const csvContent = generateCSV(entities, options.entityType);

    return {
      success: true,
      csvContent,
      filename: `${options.entityType}-export-${Date.now()}.csv`,
      rowCount: entities.length,
    };

  } catch (error: any) {
    console.error('>>> [EXPORT] Failed:', error.message);
    return {
      success: false,
      csvContent: '',
      filename: '',
      rowCount: 0,
    };
  }
}

/**
 * Generates CSV content from entities
 */
function generateCSV(entities: Entity[], entityType: EntityType): string {
  const columns = getTemplateColumns(entityType);
  const headers = columns.join(',');

  const rows = entities.map(entity => {
    const values = columns.map(column => {
      const value = extractFieldValue(entity, column, entityType);
      return escapeCSVValue(value);
    });
    return values.join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * Generates empty CSV with headers only
 */
function generateEmptyCSV(entityType: EntityType): string {
  const columns = getTemplateColumns(entityType);
  return columns.join(',');
}

/**
 * Extracts field value from entity based on column name
 */
function extractFieldValue(entity: Entity, column: string, entityType: EntityType): string {
  switch (entityType) {
    case 'institution':
      return extractInstitutionField(entity, column);
    case 'family':
      return extractFamilyField(entity, column);
    case 'person':
      return extractPersonField(entity, column);
    default:
      return '';
  }
}

/**
 * Extracts institution field value
 */
function extractInstitutionField(entity: Entity, column: string): string {
  const data = entity.institutionData || {};

  switch (column) {
    case 'name':
      return entity.name || '';
    case 'nominalRoll':
      return data.nominalRoll?.toString() || '';
    case 'billingAddress':
      return data.billingAddress || '';
    case 'currency':
      return data.currency || '';
    case 'subscriptionPackageId':
      return data.subscriptionPackageId || '';
    case 'focalPerson_name':
      return entity.contacts?.[0]?.name || '';
    case 'focalPerson_phone':
      return entity.contacts?.[0]?.phone || '';
    case 'focalPerson_email':
      return entity.contacts?.[0]?.email || '';
    case 'focalPerson_type':
      return entity.contacts?.[0]?.type || '';
    default:
      return '';
  }
}

/**
 * Extracts family field value
 */
function extractFamilyField(entity: Entity, column: string): string {
  const data = entity.familyData || { guardians: [], children: [] };

  switch (column) {
    case 'familyName':
      return entity.name || '';
    case 'guardian1_name':
      return data.guardians?.[0]?.name || '';
    case 'guardian1_phone':
      return data.guardians?.[0]?.phone || '';
    case 'guardian1_email':
      return data.guardians?.[0]?.email || '';
    case 'guardian1_relationship':
      return data.guardians?.[0]?.relationship || '';
    case 'child1_firstName':
      return data.children?.[0]?.firstName || '';
    case 'child1_lastName':
      return data.children?.[0]?.lastName || '';
    case 'child1_gradeLevel':
      return data.children?.[0]?.gradeLevel || '';
    default:
      return '';
  }
}

/**
 * Extracts person field value
 */
function extractPersonField(entity: Entity, column: string): string {
  const data = entity.personData || { firstName: '', lastName: '' };

  switch (column) {
    case 'firstName':
      return data.firstName || '';
    case 'lastName':
      return data.lastName || '';
    case 'company':
      return data.company || '';
    case 'jobTitle':
      return data.jobTitle || '';
    case 'leadSource':
      return data.leadSource || '';
    case 'phone':
      return entity.contacts?.[0]?.phone || '';
    case 'email':
      return entity.contacts?.[0]?.email || '';
    default:
      return '';
  }
}

/**
 * Escapes a CSV value (handles commas, quotes, newlines)
 */
function escapeCSVValue(value: string): string {
  if (!value) {
    return '';
  }

  const stringValue = String(value);
  
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}
