/**
 * Export Service
 * 
 * Serializes entities and workspace_entities to CSV format.
 * Requirements: 27
 */

import { stringify } from 'csv-stringify/sync';
import type { Entity, WorkspaceEntity } from '../types';
import {
  INSTITUTION_CSV_COLUMNS,
  type InstitutionImportRow,
} from './institution-template';
import { FAMILY_CSV_COLUMNS, type FamilyImportRow } from './family-template';
import { PERSON_CSV_COLUMNS, type PersonImportRow } from './person-template';

/**
 * Export institution entity to CSV row
 */
export function serializeInstitutionEntity(
  entity: Entity,
  workspaceEntity?: WorkspaceEntity
): InstitutionImportRow {
  const contacts = entity.entityContacts || [];
  const focalPerson = contacts[0];

  return {
    name: entity.name,
    nominalRoll: entity.institutionData?.nominalRoll?.toString(),
    billingAddress: entity.institutionData?.billingAddress,
    currency: entity.institutionData?.currency,
    subscriptionPackageId: entity.institutionData?.subscriptionPackageId,
    focalPerson_name: focalPerson?.name,
    focalPerson_phone: focalPerson?.phone,
    focalPerson_email: focalPerson?.email,
    focalPerson_type: focalPerson?.typeLabel || focalPerson?.typeKey || 'Contact',
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
    guardian1_name: guardian?.name,
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

  let rows: any[];
  let columns: readonly string[];

  switch (entityType) {
    case 'institution':
      rows = entities.map((e) =>
        serializeInstitutionEntity(e, workspaceEntities?.get(e.id))
      );
      columns = INSTITUTION_CSV_COLUMNS;
      break;
    case 'family':
      rows = entities.map((e) =>
        serializeFamilyEntity(e, workspaceEntities?.get(e.id))
      );
      columns = FAMILY_CSV_COLUMNS;
      break;
    case 'person':
      rows = entities.map((e) =>
        serializePersonEntity(e, workspaceEntities?.get(e.id))
      );
      columns = PERSON_CSV_COLUMNS;
      break;
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }

  return stringify(rows, {
    header: true,
    columns: columns as string[],
  });
}
