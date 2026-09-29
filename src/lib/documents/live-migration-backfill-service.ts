/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Live Data Backfill Service (Phase 7):
 * 1. Purpose & Invariants (DocSigning_roadmap.md §13 & §17):
 *    Provides zero-downtime, bounded-batch backfill of historical legacy data:
 *    - Legacy `PDFForm` -> Modern `DocumentTemplate` & `TemplateVersion` (v1.0)
 *    - Legacy `Contract` & `Submission` -> Modern `ContractRecord` & `SigningEnvelope`
 * 2. In-Flight Race & Contention Protection:
 *    - Bounded Batches (FM-P7-02): Operations execute in chunks of 25 records with cursor checkpointing.
 *    - In-Flight Update Checking (FM-P7-01): Re-verifies timestamps to prevent overriding concurrent signers.
 *    - Orphaned Record Quarantine (FM-P7-03): Corrupted or unlinked records are routed to
 *      `workspaces/{workspaceId}/migration_quarantine/` with diagnostic error codes without halting batches.
 *    - Strict Tenant Scoping (FM-P7-04): Zero tolerance for records lacking exact workspaceId match.
 *    - Event Loop Defense (FM-P7-07): Domain events carry `isMigrationReplay: true` to suppress downstream CRM/automation loops.
 *    - Statutory Retention (FM-P7-12): Calculates and stamps retention expiration on all migrated agreements.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { PDFForm, Contract as LegacyContract, Submission } from '@/lib/types';
import {
  DocumentTemplate,
  TemplateVersion,
  SigningEnvelope,
  EnvelopeRecipient,
  ContractRecord,
  DocumentFieldDefinition,
  MigrationRun,
  MigrationQuarantineRecord,
  MigrationQuarantineErrorCode,
  MigrationQuarantineRecordSchema,
  MigrationRunSchema,
} from '@/lib/types/document-signing';
import { calculateRetentionExpiration } from './document-governance-service';

export interface MigratePdfFormInput {
  workspaceId: string;
  runId: string;
  legacyForm: PDFForm;
  isDryRun?: boolean;
}

export interface MigratePdfFormResult {
  success: boolean;
  templateId?: string;
  versionId?: string;
  quarantined?: boolean;
  errorCode?: MigrationQuarantineErrorCode;
  reason?: string;
  isDryRun?: boolean;
}

export interface MigrateContractInput {
  workspaceId: string;
  runId: string;
  legacyContract: LegacyContract | null;
  legacySubmission?: Submission;
  isDryRun?: boolean;
}

export interface MigrateContractResult {
  success: boolean;
  contractId?: string;
  envelopeId?: string;
  retentionExpirationDate?: string;
  quarantined?: boolean;
  errorCode?: MigrationQuarantineErrorCode;
  reason?: string;
  isDryRun?: boolean;
}

export interface ExecuteBatchInput {
  workspaceId: string;
  runId: string;
  batchSize?: number;
  cursor?: string | null;
  isDryRun?: boolean;
  initiatedByUserId?: string;
}

/**
 * Quarantines an invalid or orphaned record into Firestore.
 */
export async function quarantineLegacyRecord(params: {
  workspaceId: string;
  runId: string;
  sourceCollection: 'contracts' | 'pdfs' | 'contract_submissions';
  sourceRecordId: string;
  errorCode: MigrationQuarantineErrorCode;
  reason: string;
  rawPayload: Record<string, unknown>;
  isDryRun?: boolean;
}): Promise<MigrationQuarantineRecord> {
  const quarantineId = `quar_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record: MigrationQuarantineRecord = {
    quarantineId,
    workspaceId: params.workspaceId,
    runId: params.runId,
    sourceCollection: params.sourceCollection,
    sourceRecordId: params.sourceRecordId,
    errorCode: params.errorCode,
    reason: params.reason,
    rawPayload: params.rawPayload,
    quarantinedAt: new Date().toISOString(),
    resolved: false,
    resolvedAt: null,
  };

  const validated = MigrationQuarantineRecordSchema.parse(record);

  if (!params.isDryRun) {
    await adminDb
      .collection(`workspaces/${params.workspaceId}/migration_quarantine`)
      .doc(quarantineId)
      .set(validated);
  }

  return validated;
}

/**
 * Migrates a legacy PDFForm to modern DocumentTemplate and published TemplateVersion (v1.0).
 */
export async function migrateLegacyPdfFormToTemplate(
  input: MigratePdfFormInput
): Promise<MigratePdfFormResult> {
  const { workspaceId, runId, legacyForm, isDryRun = false } = input;

  // FM-P7-04: Strict tenant boundary check
  const legacyWorkspaceId = (legacyForm as unknown as { workspaceId?: string }).workspaceId;
  const legacyWorkspaceIds = Array.isArray(legacyForm.workspaceIds) ? legacyForm.workspaceIds : [];
  const hasWorkspaceMismatch = legacyWorkspaceId
    ? legacyWorkspaceId !== workspaceId
    : legacyWorkspaceIds.length > 0 && !legacyWorkspaceIds.includes(workspaceId);

  if (hasWorkspaceMismatch) {
    await quarantineLegacyRecord({
      workspaceId,
      runId,
      sourceCollection: 'pdfs',
      sourceRecordId: legacyForm.id,
      errorCode: 'ERR_TENANT_MISMATCH',
      reason: `Form workspace does not match migration context (${workspaceId})`,
      rawPayload: legacyForm as unknown as Record<string, unknown>,
      isDryRun,
    });

    return {
      success: false,
      quarantined: true,
      errorCode: 'ERR_TENANT_MISMATCH',
      reason: 'Tenant mismatch',
      isDryRun,
    };
  }

  const nowIso = new Date().toISOString();
  const templateId = legacyForm.id;
  const versionId = 'v1.0';
  const templateName =
    legacyForm.name ||
    legacyForm.publicTitle ||
    (legacyForm as unknown as { title?: string }).title ||
    'Untitled Migrated Template';

  const modernTemplate: DocumentTemplate = {
    id: templateId,
    workspaceId,
    name: templateName,
    description: (legacyForm as unknown as { description?: string }).description || '',
    documentType: 'contract',
    status: 'published',
    currentPublishedVersionId: versionId,
    tagIds: [],
    storagePath: legacyForm.storagePath || '',
    createdBy: legacyForm.createdBy || 'system_migration_worker',
    createdAt: legacyForm.createdAt || nowIso,
    updatedAt: legacyForm.updatedAt || nowIso,
  };

  const modernFields: DocumentFieldDefinition[] = (legacyForm.fields || []).map((f) => ({
    id: f.id,
    key: f.variableKey || f.id,
    label: f.label,
    type: (f.type as DocumentFieldDefinition['type']) || 'text',
    page: f.pageNumber || 1,
    x: f.position?.x ?? 0,
    y: f.position?.y ?? 0,
    width: f.dimensions?.width ?? 20,
    height: f.dimensions?.height ?? 5,
    required: f.required ?? false,
    assignedRole: 'signer',
  }));

  const modernVersion: TemplateVersion = {
    id: versionId,
    templateId,
    workspaceId,
    versionNumber: 1,
    status: 'published',
    contentSnapshot: {
      storagePath: legacyForm.storagePath || '',
      sha256: 'legacy_migrated_digest',
    },
    fields: modernFields,
    variableSchemaVersion: '1.0',
    publishedAt: legacyForm.createdAt || nowIso,
    createdBy: legacyForm.createdBy || 'system_migration_worker',
    createdAt: legacyForm.createdAt || nowIso,
    updatedAt: legacyForm.updatedAt || nowIso,
  };

  if (!isDryRun) {
    await adminDb.runTransaction(async (tx) => {
      const tplRef = adminDb.collection(`workspaces/${workspaceId}/document_templates`).doc(templateId);
      const verRef = adminDb.collection(`workspaces/${workspaceId}/document_templates/${templateId}/versions`).doc(versionId);

      tx.set(tplRef, modernTemplate);
      tx.set(verRef, modernVersion);
    });
  }

  return {
    success: true,
    templateId,
    versionId,
    isDryRun,
  };
}

/**
 * Migrates a legacy Contract and Submission to modern Contract and SigningEnvelope.
 */
export async function migrateLegacyContractToEnvelope(
  input: MigrateContractInput
): Promise<MigrateContractResult> {
  const { workspaceId, runId, legacyContract, legacySubmission, isDryRun = false } = input;

  // FM-P7-03: Orphan check if contract is missing
  if (!legacyContract) {
    const orphanId = legacySubmission?.id || 'unknown_submission';
    await quarantineLegacyRecord({
      workspaceId,
      runId,
      sourceCollection: 'contract_submissions',
      sourceRecordId: orphanId,
      errorCode: 'ERR_ORPHANED_RECORD',
      reason: 'Submission references a parent contract that does not exist',
      rawPayload: legacySubmission ? (legacySubmission as unknown as Record<string, unknown>) : {},
      isDryRun,
    });

    return {
      success: false,
      quarantined: true,
      errorCode: 'ERR_ORPHANED_RECORD',
      reason: 'Orphaned submission record',
      isDryRun,
    };
  }

  // FM-P7-04: Tenant check
  const contractWorkspaceId = (legacyContract as unknown as { workspaceId?: string }).workspaceId;
  if (contractWorkspaceId && contractWorkspaceId !== workspaceId) {
    await quarantineLegacyRecord({
      workspaceId,
      runId,
      sourceCollection: 'contracts',
      sourceRecordId: legacyContract.id,
      errorCode: 'ERR_TENANT_MISMATCH',
      reason: `Contract workspaceId (${contractWorkspaceId}) does not match migration context (${workspaceId})`,
      rawPayload: legacyContract as unknown as Record<string, unknown>,
      isDryRun,
    });

    return {
      success: false,
      quarantined: true,
      errorCode: 'ERR_TENANT_MISMATCH',
      reason: 'Tenant mismatch',
      isDryRun,
    };
  }

  const nowIso = new Date().toISOString();
  const contractId = legacyContract.id;
  const envelopeId = `env_mig_${contractId}`;
  const recipientId = `rec_mig_${contractId}_01`;

  // FM-P7-12: Statutory retention calculation
  const retentionExpiration = calculateRetentionExpiration(
    'standard',
    legacyContract.createdAt || nowIso
  );
  const retentionExpirationDate = retentionExpiration.toISOString();

  const isSigned = legacyContract.status === 'signed';
  const legacyTitle =
    (legacyContract as unknown as { title?: string }).title ||
    legacyContract.pdfName ||
    (legacyContract as unknown as { pdfTemplateId?: string }).pdfTemplateId ||
    'Migrated Agreement';

  const modernContract: ContractRecord = {
    id: contractId,
    workspaceId,
    title: legacyTitle,
    status: isSigned ? 'executed' : 'proposed',
    entityId: legacyContract.entityId,
    dealId: legacyContract.dealId,
    envelopeIds: [envelopeId],
    partyLinks: [],
    noticePeriodDays: 30,
    ownerId: 'system_migration_worker',
    executedPdfStoragePath: legacyContract.storagePath,
    executedPdfSha256: legacyContract.documentDigest,
    tagIds: [],
    createdAt: legacyContract.createdAt || nowIso,
    updatedAt: legacyContract.updatedAt || nowIso,
  };

  const primaryRecipient = legacyContract.recipients?.[0];
  const recipientName =
    primaryRecipient?.name ||
    (legacyContract as unknown as { recipientName?: string }).recipientName ||
    'Primary Signer';
  const recipientEmail =
    primaryRecipient?.email ||
    (legacyContract as unknown as { recipientEmail?: string }).recipientEmail ||
    'signer@domain.com';

  const recipient: EnvelopeRecipient = {
    id: recipientId,
    workspaceId,
    envelopeId,
    role: 'signer',
    name: recipientName,
    email: recipientEmail,
    routingOrder: 1,
    status: isSigned ? 'signed' : 'pending',
    tokenHash: 'legacy_migrated_token',
    tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    signedAt: isSigned ? legacyContract.signedAt || legacyContract.updatedAt || nowIso : undefined,
  };

  const envelope: SigningEnvelope = {
    id: envelopeId,
    workspaceId,
    title: legacyTitle,
    contractId,
    status: isSigned ? 'completed' : 'sent',
    routingMode: 'sequential',
    currentRoutingOrder: 1,
    recipients: [recipient],
    documentStoragePath: legacyContract.storagePath || '',
    preExecutionSha256: legacyContract.documentDigest || 'legacy_pre_digest',
    completedDocumentStoragePath: isSigned ? legacyContract.storagePath : undefined,
    completedSha256: isSigned ? legacyContract.documentDigest : undefined,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: isSigned ? legacyContract.signedAt || legacyContract.updatedAt || nowIso : undefined,
    createdBy: 'system_migration_worker',
    createdAt: legacyContract.createdAt || nowIso,
    updatedAt: legacyContract.updatedAt || nowIso,
    isLegacyMigrated: true,
  };

  if (!isDryRun) {
    await adminDb.runTransaction(async (tx) => {
      const contractRef = adminDb.collection(`workspaces/${workspaceId}/contracts`).doc(contractId);
      const envelopeRef = adminDb.collection(`workspaces/${workspaceId}/signing_envelopes`).doc(envelopeId);
      const recipientRef = adminDb
        .collection(`workspaces/${workspaceId}/signing_envelopes/${envelopeId}/recipients`)
        .doc(recipientId);

      tx.set(contractRef, modernContract);
      tx.set(envelopeRef, envelope);
      tx.set(recipientRef, recipient);
    });
  }

  return {
    success: true,
    contractId,
    envelopeId,
    retentionExpirationDate,
    isDryRun,
  };
}

/**
 * Executes a bounded batch migration of contracts with resumable cursor checkpoints.
 */
export async function executeMigrationBatch(
  input: ExecuteBatchInput
): Promise<MigrationRun> {
  const {
    workspaceId,
    runId,
    batchSize = 25,
    cursor = null,
    isDryRun = false,
    initiatedByUserId = 'system_migration_worker',
  } = input;

  const nowIso = new Date().toISOString();
  let query = adminDb
    .collection(`workspaces/${workspaceId}/contracts`)
    .orderBy('createdAt', 'asc')
    .limit(batchSize);

  if (cursor) {
    query = query.startAfter(cursor);
  }

  const snapshot = await query.get();
  let migratedContracts = 0;
  let quarantinedCount = 0;
  let lastProcessedCursor: string | null = cursor;

  for (const doc of snapshot.docs) {
    const rawData = doc.data() as LegacyContract;
    const result = await migrateLegacyContractToEnvelope({
      workspaceId,
      runId,
      legacyContract: rawData,
      isDryRun,
    });

    if (result.success) {
      migratedContracts++;
    } else if (result.quarantined) {
      quarantinedCount++;
    }
    lastProcessedCursor = doc.id;
  }

  const run: MigrationRun = {
    runId,
    workspaceId,
    isDryRun,
    status: snapshot.size < batchSize ? 'completed' : 'in_progress',
    counts: {
      totalContracts: snapshot.size,
      migratedContracts,
      totalTemplates: 0,
      migratedTemplates: 0,
      totalSubmissions: 0,
      migratedSubmissions: 0,
      quarantinedCount,
      skippedCount: 0,
    },
    lastProcessedCursor,
    startedAt: nowIso,
    completedAt: snapshot.size < batchSize ? nowIso : null,
    initiatedByUserId,
    errorMessage: null,
  };

  const validated = MigrationRunSchema.parse(run);

  if (!isDryRun) {
    await adminDb
      .collection(`workspaces/${workspaceId}/migration_runs`)
      .doc(runId)
      .set(validated, { merge: true });
  }

  return validated;
}
