/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Pure CRM Entity Recipient Extraction & Normalization Service (Phase 9 Extension):
 * 1. Purpose & Standards:
 *    Transforms Workspace CRM entities (from `<UnifiedEntitySelector>`) into strictly typed
 *    bulk campaign recipient preview records. Resolves signatory roles and maps standard
 *    entity variables into template placeholders.
 * 2. Pure Isomorphic Architecture (Client & Server Safe):
 *    Contains ZERO Node.js built-ins (`fs`, `child_process`) or `firebase-admin` dependencies.
 *    Can safely be imported by both Client Component wizards and Server Action dispatchers.
 * 3. Security Defense (FM-P9-07 - Formula Injection / DDE Attack):
 *    All dynamic entity variable values starting with formula trigger operators (`=`, `+`,
 *    `-`, `@`, `|`, `\t`, `\r`) are sanitized by prepending a single quote (`'`).
 * 4. Resilient Fallbacks (FM-CRM-01, FM-CRM-02):
 *    Handles empty `entityContacts` arrays by falling back to root entity contact fields.
 *    Deterministically resolves designated signatories without ambiguity.
 * 5. Strict Typing (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`. Output adheres to BulkCsvMergePreviewResultSchema.
 */

import type { SearchedEntity } from '@/hooks/use-entity-search';
import type {
  BulkCsvMergePreviewResult,
  BulkCsvMergePreviewItem,
} from '@/lib/types/document-signing';
import type { EntityContact } from '@/lib/types';

export interface CrmRecipientExtractionOptions {
  contactRole?: 'signatory' | 'primary' | 'all';
  templateVariables?: string[];
  extraVariables?: Record<string, string>;
}

const FORMULA_INJECTION_PREFIXES = ['=', '+', '-', '@', '|', '\t', '\r'];

/**
 * Sanitizes variable values to neutralize CSV/DDE formula injection attacks (FM-P9-07).
 */
export function sanitizeEntityVariableValue(val: string): string {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (FORMULA_INJECTION_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return `'${trimmed}`;
  }
  return trimmed;
}

interface TargetContact {
  id?: string;
  name: string;
  email: string;
  phone?: string;
}

/**
 * Resolves target contacts for an entity based on the requested signatory role.
 */
function resolveContactsForEntity(
  entity: SearchedEntity,
  role: 'signatory' | 'primary' | 'all'
): TargetContact[] {
  const contacts: EntityContact[] = Array.isArray(entity.entityContacts)
    ? entity.entityContacts
    : [];

  if (role === 'all') {
    const validContacts = contacts.filter(
      (c) => typeof c.email === 'string' && c.email.trim().length > 0
    );

    if (validContacts.length > 0) {
      return validContacts.map((c) => ({
        id: c.id,
        name: c.name || entity.displayName,
        email: c.email!.trim(),
        phone: c.phone || entity.primaryPhone,
      }));
    }

    // Fallback to entity root if entityContacts is empty
    if (entity.primaryEmail && entity.primaryEmail.trim().length > 0) {
      return [
        {
          name: entity.primaryContactName || entity.displayName,
          email: entity.primaryEmail.trim(),
          phone: entity.primaryPhone,
        },
      ];
    }

    return [];
  }

  if (role === 'signatory') {
    // 1. Check for designated signatory contact
    const signatory = contacts.find(
      (c) => c.isSignatory && typeof c.email === 'string' && c.email.trim().length > 0
    );
    if (signatory) {
      return [
        {
          id: signatory.id,
          name: signatory.name || entity.displayName,
          email: signatory.email!.trim(),
          phone: signatory.phone || entity.primaryPhone,
        },
      ];
    }

    // 2. Fallback to primary contact
    const primary = contacts.find(
      (c) => c.isPrimary && typeof c.email === 'string' && c.email.trim().length > 0
    );
    if (primary) {
      return [
        {
          id: primary.id,
          name: primary.name || entity.displayName,
          email: primary.email!.trim(),
          phone: primary.phone || entity.primaryPhone,
        },
      ];
    }
  } else if (role === 'primary') {
    // 1. Check for primary contact
    const primary = contacts.find(
      (c) => c.isPrimary && typeof c.email === 'string' && c.email.trim().length > 0
    );
    if (primary) {
      return [
        {
          id: primary.id,
          name: primary.name || entity.displayName,
          email: primary.email!.trim(),
          phone: primary.phone || entity.primaryPhone,
        },
      ];
    }

    // 2. Fallback to signatory contact
    const signatory = contacts.find(
      (c) => c.isSignatory && typeof c.email === 'string' && c.email.trim().length > 0
    );
    if (signatory) {
      return [
        {
          id: signatory.id,
          name: signatory.name || entity.displayName,
          email: signatory.email!.trim(),
          phone: signatory.phone || entity.primaryPhone,
        },
      ];
    }
  }

  // 3. Fallback to first contact with email
  const firstContact = contacts.find(
    (c) => typeof c.email === 'string' && c.email.trim().length > 0
  );
  if (firstContact) {
    return [
      {
        id: firstContact.id,
        name: firstContact.name || entity.displayName,
        email: firstContact.email!.trim(),
        phone: firstContact.phone || entity.primaryPhone,
      },
    ];
  }

  // 4. Fallback to entity root contact (FM-CRM-01)
  if (entity.primaryEmail && entity.primaryEmail.trim().length > 0) {
    return [
      {
        name: entity.primaryContactName || entity.displayName,
        email: entity.primaryEmail.trim(),
        phone: entity.primaryPhone,
      },
    ];
  }

  return [];
}

/**
 * Extracts and maps bulk campaign recipients from selected CRM entities.
 */
export function extractRecipientsFromEntities(
  entities: SearchedEntity[],
  options: CrmRecipientExtractionOptions = {}
): BulkCsvMergePreviewResult {
  const contactRole = options.contactRole || 'signatory';
  const templateVariables = options.templateVariables || [];
  const extraVariables = options.extraVariables || {};

  const detectedColumns = [
    'name',
    'email',
    'phone',
    'company',
    'entity_name',
    'location',
    'status',
  ];

  const previewItems: BulkCsvMergePreviewItem[] = [];
  let rowIndex = 1;

  for (const entity of entities) {
    const targetContacts = resolveContactsForEntity(entity, contactRole);
    const entityId = entity.entityId || entity.id;

    if (targetContacts.length === 0) {
      // Entity has no valid contact email anywhere
      previewItems.push({
        rowIndex: rowIndex++,
        recipientName: entity.displayName || 'Unknown Entity',
        recipientEmail: '',
        phone: entity.primaryPhone,
        entityId,
        sourceType: 'crm',
        mappedVariables: {
          name: sanitizeEntityVariableValue(entity.displayName || ''),
          entity_name: sanitizeEntityVariableValue(entity.displayName || ''),
          company: sanitizeEntityVariableValue(entity.displayName || ''),
        },
        missingVariables: templateVariables.filter(
          (v) => !['name', 'entity_name', 'company'].includes(v)
        ),
        isValid: false,
        errors: ['Entity lacks a valid contact email address.'],
      });
      continue;
    }

    for (const contact of targetContacts) {
      const mappedVariables: Record<string, string> = {
        name: sanitizeEntityVariableValue(contact.name),
        email: sanitizeEntityVariableValue(contact.email),
        phone: sanitizeEntityVariableValue(contact.phone || ''),
        company: sanitizeEntityVariableValue(entity.displayName || ''),
        entity_name: sanitizeEntityVariableValue(entity.displayName || ''),
        location: sanitizeEntityVariableValue(entity.locationString || ''),
        status: sanitizeEntityVariableValue(entity.status || 'active'),
        ...extraVariables,
      };

      const errors: string[] = [];
      const missingVariables: string[] = [];

      // Validate email presence and basic format
      if (!contact.email || !contact.email.includes('@')) {
        errors.push(`Invalid email address: '${contact.email}'`);
      }

      // Pre-flight linting for template variables (FM-P9-04)
      for (const tVar of templateVariables) {
        const val = mappedVariables[tVar];
        if (val === undefined || val === null || val.trim().length === 0) {
          missingVariables.push(tVar);
          errors.push(`Missing mandatory template variable: ${tVar}`);
        }
      }

      previewItems.push({
        rowIndex: rowIndex++,
        recipientName: contact.name,
        recipientEmail: contact.email,
        phone: contact.phone,
        entityId,
        contactId: contact.id,
        sourceType: 'crm',
        mappedVariables,
        missingVariables,
        isValid: errors.length === 0,
        errors,
      });
    }
  }

  const validRows = previewItems.filter((item) => item.isValid).length;
  const invalidRows = previewItems.filter((item) => !item.isValid).length;

  // Compute unmapped template variables across the batch
  const unmappedVariables = templateVariables.filter((tVar) =>
    previewItems.some((item) => item.missingVariables.includes(tVar))
  );

  return {
    totalRows: previewItems.length,
    validRows,
    invalidRows,
    detectedColumns,
    templateVariables,
    unmappedVariables,
    previewSample: previewItems,
  };
}
