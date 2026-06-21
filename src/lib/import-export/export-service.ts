/**
 * Export Service
 * 
 * Serializes entities and workspace_entities to CSV format.
 * Requirements: 27
 */

import type { Entity, WorkspaceEntity } from '../types';
import {
  INSTITUTION_CSV_COLUMNS,
  type InstitutionImportRow,
} from './institution-template';
import { FAMILY_CSV_COLUMNS, type FamilyImportRow } from './family-template';
import { PERSON_CSV_COLUMNS, type PersonImportRow } from './person-template';

/**
 * Escapes a field value for CSV format (RFC 4180)
 */
function escapeCSVValue(val: unknown): string {
  if (val === undefined || val === null) {
    return '""';
  }
  const str = String(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}


/**
 * Export institution entity to CSV row
 */
export function serializeInstitutionEntity(
  entity: Entity,
  workspaceEntity?: WorkspaceEntity
): InstitutionImportRow {
  const contacts = entity.entityContacts || [];
  const primaryContact = contacts[0];

  return {
    name: entity.name,
    nominalRoll: (entity.industryData as any)?.capacity?.toString() || (entity as any).institutionData?.nominalRoll?.toString(),
    billingAddress: entity.financeData?.billingAddress || (entity as any).institutionData?.billingAddress,
    currency: entity.financeData?.currency || (entity as any).institutionData?.currency,
    subscriptionPackageId: entity.financeData?.planType || (entity as any).institutionData?.subscriptionPackageId,
    contact_name: primaryContact?.name,
    contact_phone: primaryContact?.phone,
    contact_email: primaryContact?.email,
    contact_role: primaryContact?.typeLabel || primaryContact?.typeKey || 'Contact',
  };
}

/**
 * Export family entity to CSV row
 */
export function serializeFamilyEntity(
  entity: Entity,
  workspaceEntity?: WorkspaceEntity
): FamilyImportRow {
  const guardian = entity.familyData?.guardians[0];
  const child = entity.familyData?.children[0];

  return {
    familyName: entity.name,
    guardian1_name: guardian?.name || '',
    guardian1_phone: guardian?.phone,
    guardian1_email: guardian?.email,
    guardian1_relationship: guardian?.relationship,
    child1_firstName: child?.firstName,
    child1_lastName: child?.lastName,
    child1_gradeLevel: child?.gradeLevel,
  };
}

/**
 * Export person entity to CSV row
 */
export function serializePersonEntity(
  entity: Entity,
  workspaceEntity?: WorkspaceEntity
): PersonImportRow {
  const contacts = entity.entityContacts || [];
  const contact = contacts[0];

  return {
    firstName: entity.personData?.firstName || '',
    lastName: entity.personData?.lastName || '',
    company: entity.personData?.company,
    jobTitle: entity.personData?.jobTitle,
    leadSource: entity.personData?.leadSource,
    phone: contact?.phone,
    email: contact?.email,
  };
}

interface ExtendedEntity extends Entity {
  currentNeeds?: string;
  currentChallenges?: string;
}

interface ExtendedWorkspaceEntity extends WorkspaceEntity {
  currentNeeds?: string;
  currentChallenges?: string;
}

/**
 * Serialize an entity to a flat record for JSON/NTT export
 */
export function serializeEntityToImportRow(
  entity: Entity,
  workspaceEntity?: WorkspaceEntity
): Record<string, string> {
  const entityType = entity.entityType;
  const row: Record<string, string> = {
    _entityType: entityType,
  };

  const extEntity = entity as ExtendedEntity;
  const extWorkspaceEntity = workspaceEntity as ExtendedWorkspaceEntity;

  if (entityType === 'person') {
    const contacts = entity.entityContacts || [];
    const contact = contacts[0];
    
    row.firstName = entity.personData?.firstName || '';
    row.lastName = entity.personData?.lastName || '';
    row.phone = contact?.phone || '';
    row.email = contact?.email || '';
    row.contactName = entity.name || '';
    row.company = entity.personData?.company || '';
    row.jobTitle = entity.personData?.jobTitle || '';
    row.leadSource = entity.personData?.leadSource || '';
  } else if (entityType === 'family') {
    const guardians = entity.familyData?.guardians || [];
    const guardian = guardians[0];
    const children = entity.familyData?.children || [];
    const child = children[0];

    row.familyName = entity.name || '';
    row.guardian1_name = guardian?.name || '';
    row.guardian1_phone = guardian?.phone || '';
    row.guardian1_email = guardian?.email || '';
    row.guardian1_relationship = guardian?.relationship || '';
    row.child1_firstName = child?.firstName || '';
    row.child1_lastName = child?.lastName || '';
    row.child1_gradeLevel = child?.gradeLevel || '';
    row.leadSource = (entity.familyData as Record<string, unknown> | undefined)?.leadSource as string || '';
  } else if (entityType === 'institution') {
    const contacts = entity.entityContacts || [];
    const contact = contacts[0];

    row.name = entity.name || '';
    row.contact_name = contact?.name || '';
    row.contact_phone = contact?.phone || '';
    row.contact_email = contact?.email || '';
    row.contact_role = contact?.typeLabel || contact?.typeKey || '';
    row.nominalRoll = (entity.industryData as unknown as Record<string, unknown>)?.capacity?.toString() || '';
    row.billingAddress = entity.financeData?.billingAddress || '';
    row.currency = entity.financeData?.currency || '';
    row.subscriptionPackageId = entity.financeData?.planType || '';
    row.locationString = entity.location?.locationString || '';
    row.leadSource = '';
  } else {
    throw new Error(`Unsupported entity type: ${entityType}`);
  }

  // Common fields
  row.workspaceTags = extWorkspaceEntity?.workspaceTags?.join(',') || '';
  row.status = extWorkspaceEntity?.status || 'active';
  row.currentNeeds = extWorkspaceEntity?.currentNeeds || extEntity?.currentNeeds || '';
  row.currentChallenges = extWorkspaceEntity?.currentChallenges || extEntity?.currentChallenges || '';
  row.interests = entity.interests?.join(',') || '';

  return row;
}

/**
 * Export entities to CSV string
 * Requirement 27: Round-trip safe serialization
 */
export function exportEntitiesToCSV(
  entities: Entity[],
  workspaceEntities?: Map<string, WorkspaceEntity>
): string {
  if (entities.length === 0) {
    return '';
  }

  const entityType = entities[0].entityType;

  let rows: Record<string, string | number | undefined>[];
  let columns: readonly string[];

  switch (entityType) {
    case 'institution':
      rows = entities.map((e) =>
        serializeInstitutionEntity(e, workspaceEntities?.get(e.id)) as unknown as Record<string, string | number | undefined>
      );
      columns = INSTITUTION_CSV_COLUMNS;
      break;
    case 'family':
      rows = entities.map((e) =>
        serializeFamilyEntity(e, workspaceEntities?.get(e.id)) as unknown as Record<string, string | number | undefined>
      );
      columns = FAMILY_CSV_COLUMNS;
      break;
    case 'person':
      rows = entities.map((e) =>
        serializePersonEntity(e, workspaceEntities?.get(e.id)) as unknown as Record<string, string | number | undefined>
      );
      columns = PERSON_CSV_COLUMNS;
      break;
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }

  const headerLine = columns.map(escapeCSVValue).join(',');
  const rowLines = rows.map((row) =>
    columns.map((col) => escapeCSVValue(row[col])).join(',')
  );

  return [headerLine, ...rowLines].join('\n') + '\n';
}
