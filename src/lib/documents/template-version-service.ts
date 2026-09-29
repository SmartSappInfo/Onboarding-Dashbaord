/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Immutable Template Versioning Engine (Phase 3 Task 2):
 *    Provides monotonic version control for Document Templates (`v1.0`, `v2.0`).
 *    Enforces the core security invariant that published template versions
 *    are strictly immutable. Any modification requires branching a new incremental
 *    draft version (`vNext-draft`) without mutating historical records.
 * 2. Visual Diff & Publication Preflight:
 *    `diffTemplateVersions` computes exact geometric and metadata diffs between
 *    template revisions to power the backoffice pre-publication inspection drawer.
 * 3. Strict Typing & Zero-`any` (Rule 4):
 *    All payloads, diff structures, and version transitions strictly conform to
 *    `TemplateVersion` and `DocumentFieldDefinition` schemas.
 */

import {
  TemplateVersionSchema,
  type TemplateVersion,
  type DocumentFieldDefinition,
} from '@/lib/types/document-signing';

export interface CreateDraftVersionParams {
  workspaceId: string;
  templateId: string;
  currentVersions: TemplateVersion[];
  baseVersionId?: string;
  createdBy: string;
  storagePath?: string;
  sha256?: string;
  fields?: DocumentFieldDefinition[];
  changeSummary?: string;
}

export interface PublishTemplateVersionParams {
  versionToPublish: TemplateVersion;
  allVersions: TemplateVersion[];
  publishedBy: string;
  changeSummary?: string;
}

export interface PublishTemplateVersionResult {
  publishedVersion: TemplateVersion;
  supersededVersions: TemplateVersion[];
  currentPublishedVersionId: string;
}

export interface ImmutabilityValidationResult {
  allowed: boolean;
  reason?: string;
}

export interface FieldPropertyDiff {
  property: string;
  from: unknown;
  to: unknown;
}

export interface ModifiedFieldDiff {
  fieldId: string;
  fieldKey: string;
  changes: FieldPropertyDiff[];
}

export interface TemplateVersionDiff {
  versionFrom: number;
  versionTo: number;
  hasDocumentChanged: boolean;
  addedFields: DocumentFieldDefinition[];
  removedFields: DocumentFieldDefinition[];
  modifiedFields: ModifiedFieldDiff[];
}

/**
 * Creates a new incremental draft version for a template.
 * Invariant: Only one active draft is permitted per template at any time.
 */
export function createDraftVersion(params: CreateDraftVersionParams): TemplateVersion {
  const {
    workspaceId,
    templateId,
    currentVersions,
    baseVersionId,
    createdBy,
    storagePath,
    sha256,
    fields,
    changeSummary,
  } = params;

  // Check if a draft already exists
  const existingDraft = currentVersions.find((v) => v.status === 'draft');
  if (existingDraft) {
    throw new Error(
      `An active draft version (v${existingDraft.versionNumber}) already exists for this template.`
    );
  }

  // Calculate next monotonic version number
  const maxVersion = currentVersions.reduce(
    (max, v) => Math.max(max, v.versionNumber),
    0
  );
  const nextVersionNumber = maxVersion + 1;

  // Base version resolution
  const baseVersion = baseVersionId
    ? currentVersions.find((v) => v.id === baseVersionId)
    : currentVersions.find((v) => v.status === 'published') || currentVersions[currentVersions.length - 1];

  const resolvedStoragePath =
    storagePath ?? baseVersion?.contentSnapshot.storagePath ?? '';
  const resolvedSha256 =
    sha256 ?? baseVersion?.contentSnapshot.sha256 ?? '';
  const resolvedFields =
    fields ??
    (baseVersion ? JSON.parse(JSON.stringify(baseVersion.fields)) : []);

  const now = new Date().toISOString();
  const newVersionId = `ver_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

  const rawVersion: TemplateVersion = {
    id: newVersionId,
    workspaceId,
    templateId,
    versionNumber: nextVersionNumber,
    status: 'draft',
    contentSnapshot: {
      storagePath: resolvedStoragePath,
      sha256: resolvedSha256,
    },
    fields: resolvedFields,
    variableSchemaVersion: '1.0',
    changeSummary: changeSummary ?? (baseVersion ? `Draft branched from v${baseVersion.versionNumber}` : 'Initial draft version'),
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  return TemplateVersionSchema.parse(rawVersion);
}

/**
 * Publishes a draft version and supersedes any currently published versions.
 */
export function publishTemplateVersion(
  params: PublishTemplateVersionParams
): PublishTemplateVersionResult {
  const { versionToPublish, allVersions, publishedBy, changeSummary } = params;

  if (versionToPublish.status !== 'draft') {
    throw new Error(
      `Cannot publish version with status "${versionToPublish.status}". Only draft versions can be published.`
    );
  }

  const now = new Date().toISOString();

  // Promote target draft to published
  const publishedVersion: TemplateVersion = TemplateVersionSchema.parse({
    ...versionToPublish,
    status: 'published',
    publishedAt: now,
    updatedAt: now,
    createdBy: publishedBy || versionToPublish.createdBy,
    ...(changeSummary ? { changeSummary } : {}),
  });

  // Supersede existing published versions
  const supersededVersions: TemplateVersion[] = allVersions
    .filter((v) => v.id !== versionToPublish.id && v.status === 'published')
    .map((v) =>
      TemplateVersionSchema.parse({
        ...v,
        status: 'superseded',
        updatedAt: now,
      })
    );

  return {
    publishedVersion,
    supersededVersions,
    currentPublishedVersionId: publishedVersion.id,
  };
}

/**
 * Validates immutability constraints.
 * Published and superseded versions cannot have their content or fields modified.
 */
export function validateTemplateVersionImmutability(
  version: TemplateVersion,
  _attemptedUpdate: Partial<TemplateVersion>
): ImmutabilityValidationResult {
  if (version.status === 'published') {
    return {
      allowed: false,
      reason: 'Published template versions are immutable and cannot be modified. Create a new draft version instead.',
    };
  }

  if (version.status === 'superseded') {
    return {
      allowed: false,
      reason: 'Superseded template versions are immutable and archived for historical compliance.',
    };
  }

  return { allowed: true };
}

/**
 * Computes the granular structural difference between two template versions.
 */
export function diffTemplateVersions(
  vOld: TemplateVersion,
  vNew: TemplateVersion
): TemplateVersionDiff {
  const hasDocumentChanged =
    vOld.contentSnapshot.storagePath !== vNew.contentSnapshot.storagePath ||
    vOld.contentSnapshot.sha256 !== vNew.contentSnapshot.sha256;

  const oldFieldsMap = new Map<string, DocumentFieldDefinition>(
    vOld.fields.map((f) => [f.id, f])
  );
  const newFieldsMap = new Map<string, DocumentFieldDefinition>(
    vNew.fields.map((f) => [f.id, f])
  );

  const addedFields: DocumentFieldDefinition[] = [];
  const removedFields: DocumentFieldDefinition[] = [];
  const modifiedFields: ModifiedFieldDiff[] = [];

  // Identify added or modified fields
  for (const [id, newField] of newFieldsMap.entries()) {
    const oldField = oldFieldsMap.get(id);
    if (!oldField) {
      addedFields.push(newField);
    } else {
      const changes: FieldPropertyDiff[] = [];
      const keysToCompare: Array<keyof DocumentFieldDefinition> = [
        'key',
        'label',
        'type',
        'page',
        'x',
        'y',
        'width',
        'height',
        'required',
        'assignedRole',
        'variableKey',
      ];

      for (const prop of keysToCompare) {
        if (oldField[prop] !== newField[prop]) {
          changes.push({
            property: String(prop),
            from: oldField[prop],
            to: newField[prop],
          });
        }
      }

      if (changes.length > 0) {
        modifiedFields.push({
          fieldId: id,
          fieldKey: newField.key,
          changes,
        });
      }
    }
  }

  // Identify removed fields
  for (const [id, oldField] of oldFieldsMap.entries()) {
    if (!newFieldsMap.has(id)) {
      removedFields.push(oldField);
    }
  }

  return {
    versionFrom: vOld.versionNumber,
    versionTo: vNew.versionNumber,
    hasDocumentChanged,
    addedFields,
    removedFields,
    modifiedFields,
  };
}
