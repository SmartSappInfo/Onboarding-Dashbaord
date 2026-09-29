'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Authoritative Server Actions for Contract Lifecycles, Immutable Template
 *    Versioning, and Post-Execution Obligations (Phase 3, P3.1, P3.3, P3.4).
 * 2. Invariants & Security:
 *    - Strict Tenant Isolation: All actions require authenticated user context
 *      (`requireAuth()`) and workspace membership (`requireWorkspace(workspaceId)`).
 *    - Atomic Firestore Transactions: Multi-document mutations (e.g. publishing
 *      a version and superseding previous versions, or creating linked amendments)
 *      are wrapped in `adminDb.runTransaction()`.
 *    - Strict Typing & Zero-`any` (Rule 4): All domain payloads and responses
 *      strictly conform to Zod schemas.
 *    - Task Core Integration: Contract obligations automatically spawn tracked
 *      tasks via `createTaskCore` and reflect completions synchronously.
 */

import { adminDb } from '@/lib/firebase-admin';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import {
  publishTemplateVersion,
} from '@/lib/documents/template-version-service';
import {
  transitionContractStatus,
  createContractAmendment,
  createContractRenewal,
} from '@/lib/documents/contract-lifecycle-service';
import {
  createContractObligation,
  fulfillObligation,
} from '@/lib/documents/contract-obligation-service';
import {
  ContractRecordSchema,
  DocumentTemplateSchema,
  TemplateVersionSchema,
  ContractObligationSchema,
  type ContractRecord,
  type DocumentTemplate,
  type TemplateVersion,
  type ContractObligation,
  type ContractRelationship,
  type ContractLifecycleStatus,
  type ObligationType,
} from '@/lib/types/document-signing';

// ==========================================
// 1. Template Versioning Server Actions
// ==========================================

export interface PublishTemplateVersionActionInput {
  workspaceId: string;
  templateId: string;
  versionId: string;
  changeSummary?: string;
}

export interface PublishTemplateVersionActionResult {
  success: boolean;
  publishedVersion?: TemplateVersion;
  template?: DocumentTemplate;
  error?: string;
}

export async function publishTemplateVersionAction(
  input: PublishTemplateVersionActionInput
): Promise<PublishTemplateVersionActionResult> {
  try {
    const authUser = await requireAuth();
    const { workspaceId, templateId, versionId, changeSummary } = input;

    if (!workspaceId || !templateId || !versionId) {
      return { success: false, error: 'workspaceId, templateId, and versionId are required.' };
    }

    await requireWorkspace(workspaceId);

    const templateRef = adminDb.collection('document_templates').doc(templateId);

    // Read all versions for this template to determine superseding set
    const versionsSnap = await adminDb
      .collection('template_versions')
      .where('templateId', '==', templateId)
      .where('workspaceId', '==', workspaceId)
      .get();

    const allVersions: TemplateVersion[] = versionsSnap.docs
      .map((d) => TemplateVersionSchema.safeParse(d.data()))
      .filter((res): res is { success: true; data: TemplateVersion } => res.success)
      .map((res) => res.data);

    const versionToPublish = allVersions.find((v) => v.id === versionId);
    if (!versionToPublish) {
      return { success: false, error: `Template version "${versionId}" not found.` };
    }

    const { publishedVersion, supersededVersions, currentPublishedVersionId } =
      publishTemplateVersion({
        versionToPublish,
        allVersions,
        publishedBy: authUser.uid,
        changeSummary,
      });

    // Execute atomic transaction
    await adminDb.runTransaction(async (tx) => {
      const templateDoc = await tx.get(templateRef);
      if (!templateDoc.exists) {
        throw new Error(`Template "${templateId}" does not exist.`);
      }

      const existingTemplate = DocumentTemplateSchema.parse(templateDoc.data());
      if (existingTemplate.workspaceId !== workspaceId) {
        throw new Error('Tenant isolation violation: Workspace mismatch.');
      }

      // Write updated published version
      const pubVersionRef = adminDb.collection('template_versions').doc(publishedVersion.id);
      tx.set(pubVersionRef, publishedVersion);

      // Write superseded versions
      for (const sup of supersededVersions) {
        const supRef = adminDb.collection('template_versions').doc(sup.id);
        tx.set(supRef, sup);
      }

      // Update parent template pointer
      tx.update(templateRef, {
        currentPublishedVersionId,
        status: 'published',
        updatedAt: new Date().toISOString(),
      });
    });

    return {
      success: true,
      publishedVersion,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to publish template version.';
    return { success: false, error: message };
  }
}

// ==========================================
// 2. Contract Record Server Actions
// ==========================================

export interface CreateContractRecordActionInput {
  workspaceId: string;
  title: string;
  templateId?: string;
  templateVersionId?: string;
  dealId?: string;
  entityId?: string;
  partyLinks?: Array<{
    entityId?: string;
    contactId?: string;
    name: string;
    email?: string;
    role: string;
  }>;
  contractValue?: {
    amount: number;
    currency: string;
    cadence?: 'one_off' | 'monthly' | 'quarterly' | 'annually';
  };
  effectiveAt?: string;
  expiresAt?: string;
  renewalAt?: string;
  noticePeriodDays?: number;
  parentContractId?: string;
  tagIds?: string[];
}

export interface CreateContractRecordActionResult {
  success: boolean;
  contract?: ContractRecord;
  error?: string;
}

export async function createContractRecordAction(
  input: CreateContractRecordActionInput
): Promise<CreateContractRecordActionResult> {
  try {
    const authUser = await requireAuth();
    const { workspaceId, title, ...rest } = input;

    if (!workspaceId || !title) {
      return { success: false, error: 'workspaceId and title are required.' };
    }

    await requireWorkspace(workspaceId);

    const now = new Date().toISOString();
    const contractId = `cnt_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    const rawContract: ContractRecord = {
      id: contractId,
      workspaceId,
      title,
      status: 'proposed',
      templateId: rest.templateId,
      templateVersionId: rest.templateVersionId,
      envelopeIds: [],
      dealId: rest.dealId,
      entityId: rest.entityId,
      partyLinks: rest.partyLinks ?? [],
      contractValue: rest.contractValue
        ? {
            amount: rest.contractValue.amount,
            currency: rest.contractValue.currency || 'USD',
            cadence: rest.contractValue.cadence ?? ('one_off' as const),
          }
        : undefined,
      effectiveAt: rest.effectiveAt,
      expiresAt: rest.expiresAt,
      renewalAt: rest.renewalAt,
      noticePeriodDays: rest.noticePeriodDays ?? 30,
      parentContractId: rest.parentContractId,
      ownerId: authUser.uid,
      tagIds: rest.tagIds ?? [],
      createdAt: now,
      updatedAt: now,
    };

    const contract = ContractRecordSchema.parse(rawContract);
    await adminDb.collection('contracts').doc(contractId).set(contract);

    return {
      success: true,
      contract,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create contract record.';
    return { success: false, error: message };
  }
}

// ==========================================
// 3. Amendment & Renewal Server Actions
// ==========================================

export interface CreateContractAmendmentActionInput {
  workspaceId: string;
  parentContractId: string;
  amendmentTitle: string;
  description?: string;
  customContractValue?: {
    amount: number;
    currency: string;
    cadence?: 'one_off' | 'monthly' | 'quarterly' | 'annually';
  };
}

export interface CreateContractAmendmentActionResult {
  success: boolean;
  amendmentContract?: ContractRecord;
  updatedParentContract?: ContractRecord;
  relationship?: ContractRelationship;
  error?: string;
}

export async function createContractAmendmentAction(
  input: CreateContractAmendmentActionInput
): Promise<CreateContractAmendmentActionResult> {
  try {
    const authUser = await requireAuth();
    const { workspaceId, parentContractId, amendmentTitle, description, customContractValue } = input;

    if (!workspaceId || !parentContractId || !amendmentTitle) {
      return { success: false, error: 'workspaceId, parentContractId, and amendmentTitle are required.' };
    }

    await requireWorkspace(workspaceId);

    const parentRef = adminDb.collection('contracts').doc(parentContractId);

    let resultAmendment: ContractRecord | undefined;
    let resultParent: ContractRecord | undefined;
    let resultRelationship: ContractRelationship | undefined;

    await adminDb.runTransaction(async (tx) => {
      const parentDoc = await tx.get(parentRef);
      if (!parentDoc.exists) {
        throw new Error(`Parent contract "${parentContractId}" not found.`);
      }

      const parentContract = ContractRecordSchema.parse(parentDoc.data());
      if (parentContract.workspaceId !== workspaceId) {
        throw new Error('Tenant isolation violation: Workspace mismatch.');
      }

      const { amendmentContract, updatedParentContract, relationship } = createContractAmendment({
        parentContract,
        amendmentTitle,
        description,
        createdBy: authUser.uid,
        customContractValue,
      });

      const amendRef = adminDb.collection('contracts').doc(amendmentContract.id);
      const relRef = adminDb.collection('contract_relationships').doc(relationship.id);

      tx.set(amendRef, amendmentContract);
      tx.set(relRef, relationship);
      tx.update(parentRef, {
        status: updatedParentContract.status,
        updatedAt: updatedParentContract.updatedAt,
      });

      resultAmendment = amendmentContract;
      resultParent = updatedParentContract;
      resultRelationship = relationship;
    });

    return {
      success: true,
      amendmentContract: resultAmendment,
      updatedParentContract: resultParent,
      relationship: resultRelationship,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create contract amendment.';
    return { success: false, error: message };
  }
}

export interface CreateContractRenewalActionInput {
  workspaceId: string;
  parentContractId: string;
  renewalTitle: string;
  newEffectiveAt: string;
  newExpiresAt: string;
  newRenewalAt?: string;
}

export interface CreateContractRenewalActionResult {
  success: boolean;
  renewalContract?: ContractRecord;
  updatedParentContract?: ContractRecord;
  relationship?: ContractRelationship;
  error?: string;
}

export async function createContractRenewalAction(
  input: CreateContractRenewalActionInput
): Promise<CreateContractRenewalActionResult> {
  try {
    const authUser = await requireAuth();
    const { workspaceId, parentContractId, renewalTitle, newEffectiveAt, newExpiresAt, newRenewalAt } = input;

    if (!workspaceId || !parentContractId || !renewalTitle || !newEffectiveAt || !newExpiresAt) {
      return { success: false, error: 'Required fields missing for renewal.' };
    }

    await requireWorkspace(workspaceId);

    const parentRef = adminDb.collection('contracts').doc(parentContractId);

    let resultRenewal: ContractRecord | undefined;
    let resultParent: ContractRecord | undefined;
    let resultRelationship: ContractRelationship | undefined;

    await adminDb.runTransaction(async (tx) => {
      const parentDoc = await tx.get(parentRef);
      if (!parentDoc.exists) {
        throw new Error(`Parent contract "${parentContractId}" not found.`);
      }

      const parentContract = ContractRecordSchema.parse(parentDoc.data());
      if (parentContract.workspaceId !== workspaceId) {
        throw new Error('Tenant isolation violation: Workspace mismatch.');
      }

      const { renewalContract, updatedParentContract, relationship } = createContractRenewal({
        parentContract,
        renewalTitle,
        newEffectiveAt,
        newExpiresAt,
        newRenewalAt,
        createdBy: authUser.uid,
      });

      const renewRef = adminDb.collection('contracts').doc(renewalContract.id);
      const relRef = adminDb.collection('contract_relationships').doc(relationship.id);

      tx.set(renewRef, renewalContract);
      tx.set(relRef, relationship);
      tx.update(parentRef, {
        status: updatedParentContract.status,
        updatedAt: updatedParentContract.updatedAt,
      });

      resultRenewal = renewalContract;
      resultParent = updatedParentContract;
      resultRelationship = relationship;
    });

    return {
      success: true,
      renewalContract: resultRenewal,
      updatedParentContract: resultParent,
      relationship: resultRelationship,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create contract renewal.';
    return { success: false, error: message };
  }
}

// ==========================================
// 4. Contract Obligations Server Actions
// ==========================================

export interface CreateContractObligationActionInput {
  workspaceId: string;
  contractId: string;
  title: string;
  description?: string;
  type?: ObligationType;
  dueDate: string;
  responsibleParty?: 'internal' | 'counterparty' | 'mutual';
  assignedUserId?: string;
  counterpartyContactId?: string;
  reminderDaysBefore?: number[];
  syncToTasks?: boolean;
}

export interface CreateContractObligationActionResult {
  success: boolean;
  obligation?: ContractObligation;
  error?: string;
}

export async function createContractObligationAction(
  input: CreateContractObligationActionInput
): Promise<CreateContractObligationActionResult> {
  try {
    await requireAuth();
    const { workspaceId, contractId, title, dueDate } = input;

    if (!workspaceId || !contractId || !title || !dueDate) {
      return { success: false, error: 'workspaceId, contractId, title, and dueDate are required.' };
    }

    await requireWorkspace(workspaceId);

    const contractSnap = await adminDb.collection('contracts').doc(contractId).get();
    if (!contractSnap.exists) {
      return { success: false, error: `Contract "${contractId}" not found.` };
    }

    const { obligation } = await createContractObligation(input);

    await adminDb.collection('contract_obligations').doc(obligation.id).set(obligation);

    return {
      success: true,
      obligation,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create contract obligation.';
    return { success: false, error: message };
  }
}

export interface FulfillContractObligationActionInput {
  workspaceId: string;
  obligationId: string;
  notes?: string;
}

export interface FulfillContractObligationActionResult {
  success: boolean;
  obligation?: ContractObligation;
  wasAlreadyFulfilled?: boolean;
  error?: string;
}

export async function fulfillContractObligationAction(
  input: FulfillContractObligationActionInput
): Promise<FulfillContractObligationActionResult> {
  try {
    const authUser = await requireAuth();
    const { workspaceId, obligationId, notes } = input;

    if (!workspaceId || !obligationId) {
      return { success: false, error: 'workspaceId and obligationId are required.' };
    }

    await requireWorkspace(workspaceId);

    const obRef = adminDb.collection('contract_obligations').doc(obligationId);
    const obSnap = await obRef.get();
    if (!obSnap.exists) {
      return { success: false, error: `Obligation "${obligationId}" not found.` };
    }

    const obligation = ContractObligationSchema.parse(obSnap.data());
    if (obligation.workspaceId !== workspaceId) {
      return { success: false, error: 'Tenant isolation violation.' };
    }

    const { obligation: updatedObligation, wasAlreadyFulfilled } = await fulfillObligation({
      obligation,
      fulfilledBy: authUser.uid,
      notes,
    });

    if (!wasAlreadyFulfilled) {
      await obRef.update({
        status: updatedObligation.status,
        fulfilledAt: updatedObligation.fulfilledAt,
        fulfilledBy: updatedObligation.fulfilledBy,
        updatedAt: updatedObligation.updatedAt,
      });
    }

    return {
      success: true,
      obligation: updatedObligation,
      wasAlreadyFulfilled,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fulfill contract obligation.';
    return { success: false, error: message };
  }
}

// ==========================================
// 5. Contract Status Transition Action
// ==========================================

export interface TransitionContractStatusActionInput {
  workspaceId: string;
  contractId: string;
  nextStatus: ContractLifecycleStatus;
  reason?: string;
}

export interface TransitionContractStatusActionResult {
  success: boolean;
  contract?: ContractRecord;
  error?: string;
}

export async function transitionContractStatusAction(
  input: TransitionContractStatusActionInput
): Promise<TransitionContractStatusActionResult> {
  try {
    const authUser = await requireAuth();
    const { workspaceId, contractId, nextStatus, reason } = input;

    if (!workspaceId || !contractId || !nextStatus) {
      return { success: false, error: 'workspaceId, contractId, and nextStatus are required.' };
    }

    await requireWorkspace(workspaceId);

    const contractRef = adminDb.collection('contracts').doc(contractId);
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) {
      return { success: false, error: `Contract "${contractId}" not found.` };
    }

    const contract = ContractRecordSchema.parse(contractSnap.data());
    if (contract.workspaceId !== workspaceId) {
      return { success: false, error: 'Tenant isolation violation.' };
    }

    const updatedContract = transitionContractStatus(contract, nextStatus, {
      reason,
      updatedBy: authUser.uid,
    });

    await contractRef.update({
      status: updatedContract.status,
      updatedAt: updatedContract.updatedAt,
    });

    return {
      success: true,
      contract: updatedContract,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to transition contract status.';
    return { success: false, error: message };
  }
}
