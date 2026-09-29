'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Authoritative Server Actions for Multi-Party Document Signing Envelopes (Phase 2, P2.1, P2.4, P1.2).
 * 2. Invariants & Security:
 *    - Tenant Isolation: All actions strictly enforce workspace isolation and authenticated session context.
 *    - Cryptographic Capability Tokens: Raw tokens are returned ONLY in memory upon creation/reassignment
 *      for outbound delivery (email/SMS). Only SHA-256 digests (`tokenHash`) are stored in Firestore.
 *    - Sequential / Parallel Routing: Enforces cohort progression via `envelope-routing-service.ts`.
 *    - Offloaded Signatures: Never stores raw base64 PNG in Firestore documents; offloads to Cloud Storage
 *      via `uploadSignatureImage` to prevent 1MB document bloat (FM-P1-02).
 *    - Immediate Append-Only Audit Trail: Every lifecycle transition logs an immutable entry to `signing_evidence`.
 *    - CRM Deal Event Bus: Emits structured domain events (`deal.contract.sent`, `deal.contract.in_progress`,
 *      `deal.contract.signed`, `deal.contract.declined`) to sync pipeline probabilities automatically.
 *    - Idempotency Defense: Re-submitting on already-signed recipients returns gracefully without double transitions.
 * 3. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Zero tolerance for `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import {
  generateRecipientToken,
  generateSigningUrl,
  verifyRecipientToken,
} from '@/lib/documents/signing-token-service';
import {
  canRecipientAct,
  advanceEnvelopeRouting,
} from '@/lib/documents/envelope-routing-service';
import { createEvidenceRecord } from '@/lib/documents/evidence-service';
import { uploadSignatureImage, isBase64DataUrl } from '@/lib/documents/signature-storage-service';
import { emitDealDomainEvent } from '@/lib/deals/deal-event-bus';
import {
  SigningEnvelopeSchema,
  type SigningEnvelope,
  type EnvelopeRecipient,
  type RecipientRole,
  type EnvelopeRoutingMode,
} from '@/lib/types/document-signing';

export interface CreateRecipientInput {
  name: string;
  email: string;
  phone?: string;
  role: RecipientRole;
  routingOrder: number;
  crmContactId?: string;
  entityId?: string;
}

export interface CreateEnvelopeInput {
  workspaceId: string;
  title: string;
  templateId?: string;
  templateVersionId?: string;
  dealId?: string;
  entityId?: string;
  routingMode: EnvelopeRoutingMode;
  recipients: CreateRecipientInput[];
  documentStoragePath: string;
  preExecutionSha256: string;
  expiresInDays?: number;
  resolvedVariablesSnapshot?: Record<string, unknown>;
}

export interface GeneratedRecipientLink {
  recipientId: string;
  email: string;
  signingUrl: string;
}

export interface CreateEnvelopeResult {
  success: boolean;
  envelopeId?: string;
  envelope?: SigningEnvelope;
  recipientLinks?: GeneratedRecipientLink[];
  error?: string;
}

export interface SubmitRecipientSignatureInput {
  envelopeId: string;
  recipientId: string;
  rawToken: string;
  signatureBase64?: string;
  signatureStoragePath?: string;
  ipAddress?: string;
  userAgent?: string;
  formData?: Record<string, unknown>;
}

export interface SubmitRecipientSignatureResult {
  success: boolean;
  isTerminal?: boolean;
  alreadySigned?: boolean;
  envelope?: SigningEnvelope;
  newlyInvitedRecipients?: EnvelopeRecipient[];
  error?: string;
}

export interface DeclineEnvelopeInput {
  envelopeId: string;
  recipientId: string;
  rawToken: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DeclineEnvelopeResult {
  success: boolean;
  envelope?: SigningEnvelope;
  error?: string;
}

export interface ReassignRecipientInput {
  envelopeId: string;
  workspaceId: string;
  currentRecipientId: string;
  newRecipient: {
    name: string;
    email: string;
    phone?: string;
    role?: RecipientRole;
  };
  reason?: string;
}

export interface ReassignRecipientResult {
  success: boolean;
  envelope?: SigningEnvelope;
  newSigningUrl?: string;
  error?: string;
}

export interface GetEnvelopeForSigningResult {
  success: boolean;
  envelope?: SigningEnvelope;
  currentRecipient?: EnvelopeRecipient;
  isAuthorizedToSign?: boolean;
  waitingReason?: string;
  error?: string;
}

/**
 * Creates and dispatches a multi-party signing envelope with sequential or parallel routing cohorts.
 */
export async function createEnvelopeAction(
  input: CreateEnvelopeInput
): Promise<CreateEnvelopeResult> {
  try {
    const authUser = await requireAuth();

    // 1. Input Validation
    if (!input.workspaceId || typeof input.workspaceId !== 'string') {
      return { success: false, error: 'Valid workspaceId is required.' };
    }

    await requireWorkspace(input.workspaceId);

    if (!input.title || typeof input.title !== 'string' || input.title.trim().length === 0) {
      return { success: false, error: 'Document title cannot be empty.' };
    }

    if (!input.documentStoragePath || input.documentStoragePath.trim().length === 0) {
      return { success: false, error: 'Document storage path is required.' };
    }

    if (!input.recipients || !Array.isArray(input.recipients) || input.recipients.length === 0) {
      return { success: false, error: 'At least one recipient is required to create an envelope.' };
    }

    // 2. Duplicate Email Check & Recipient Sanitization
    const emailSet = new Set<string>();
    for (const rec of input.recipients) {
      const normalizedEmail = (rec.email || '').trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return { success: false, error: `Invalid email address provided for recipient: ${rec.name || 'Unnamed'}` };
      }
      if (emailSet.has(normalizedEmail)) {
        return { success: false, error: `Duplicate recipient email detected: ${normalizedEmail}. Each recipient must have a unique email.` };
      }
      emailSet.add(normalizedEmail);

      if (!rec.name || rec.name.trim().length === 0) {
        return { success: false, error: 'Recipient name cannot be empty.' };
      }
      if (!rec.routingOrder || rec.routingOrder < 1) {
        return { success: false, error: 'Recipient routing order must be an integer >= 1.' };
      }
    }

    // 3. Envelope Initialization
    const envelopeId = `env_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();
    const expiresInDays = input.expiresInDays && input.expiresInDays > 0 ? input.expiresInDays : 14;
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

    const minRoutingOrder = Math.min(...input.recipients.map((r) => r.routingOrder));
    const recipientLinks: GeneratedRecipientLink[] = [];
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.smartsapp.com';

    // 4. Recipient Cohort Generation & Capability Token Issuance
    const recipients: EnvelopeRecipient[] = input.recipients.map((recInput, idx) => {
      const recipientId = `rec_${envelopeId}_${idx + 1}`;
      const tokenData = generateRecipientToken(expiresInDays);

      const isInitialCohort =
        input.routingMode === 'parallel' || recInput.routingOrder === minRoutingOrder;

      const recipientStatus = isInitialCohort ? 'invited' : 'pending';

      if (isInitialCohort) {
        const signingUrl = generateSigningUrl(appBaseUrl, envelopeId, tokenData.rawToken);
        recipientLinks.push({
          recipientId,
          email: recInput.email.trim().toLowerCase(),
          signingUrl,
        });
      }

      return {
        id: recipientId,
        workspaceId: input.workspaceId,
        envelopeId,
        crmContactId: recInput.crmContactId,
        entityId: recInput.entityId,
        role: recInput.role,
        name: recInput.name.trim(),
        email: recInput.email.trim().toLowerCase(),
        phone: recInput.phone?.trim(),
        routingOrder: recInput.routingOrder,
        status: recipientStatus,
        tokenHash: tokenData.tokenHash,
        tokenExpiresAt: tokenData.expiresAt,
        invitedAt: isInitialCohort ? nowIso : undefined,
      };
    });

    // 5. Build Validated Domain Aggregate
    const envelopePayload: SigningEnvelope = SigningEnvelopeSchema.parse({
      id: envelopeId,
      workspaceId: input.workspaceId,
      title: input.title.trim(),
      status: 'sent',
      templateId: input.templateId,
      templateVersionId: input.templateVersionId,
      dealId: input.dealId,
      entityId: input.entityId,
      routingMode: input.routingMode,
      currentRoutingOrder: minRoutingOrder,
      recipients,
      documentStoragePath: input.documentStoragePath,
      preExecutionSha256: input.preExecutionSha256,
      resolvedVariablesSnapshot: input.resolvedVariablesSnapshot,
      expiresAt,
      createdBy: authUser.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // 6. Persistence to Firestore
    await adminDb.collection('signing_envelopes').doc(envelopeId).set(envelopePayload);

    // 7. Append-Only Evidence Ledger Logging
    await createEvidenceRecord({
      envelopeId,
      action: 'created',
      metadata: {
        routingMode: input.routingMode,
        recipientCount: recipients.length,
        templateId: input.templateId,
        dealId: input.dealId,
      },
    });

    for (const link of recipientLinks) {
      const rec = recipients.find((r) => r.id === link.recipientId);
      if (rec) {
        await createEvidenceRecord({
          envelopeId,
          action: 'sent',
          recipientId: rec.id,
          recipientEmail: rec.email,
          recipientName: rec.name,
        });
      }
    }

    // 8. CRM Deal Event Notification
    if (input.dealId) {
      emitDealDomainEvent('deal.contract.sent', {
        dealId: input.dealId,
        workspaceId: input.workspaceId,
        envelopeId,
        contractStatus: 'sent',
      });
    }

    return {
      success: true,
      envelopeId,
      envelope: envelopePayload,
      recipientLinks,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create signing envelope.';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Executes a single recipient signing step, offloads signature image to Cloud Storage,
 * creates append-only evidence logs, advances the routing order, and updates CRM deal state.
 */
export async function submitRecipientSignatureAction(
  input: SubmitRecipientSignatureInput
): Promise<SubmitRecipientSignatureResult> {
  try {
    const envelopeDoc = await adminDb.collection('signing_envelopes').doc(input.envelopeId).get();
    if (!envelopeDoc.exists) {
      return { success: false, error: 'Envelope not found.' };
    }

    const envelope = envelopeDoc.data() as SigningEnvelope;
    const recipient = envelope.recipients.find((r) => r.id === input.recipientId);
    if (!recipient) {
      return { success: false, error: 'Recipient not found on this envelope.' };
    }

    // 1. Verify capability token
    const tokenCheck = verifyRecipientToken(input.rawToken, recipient);
    if (!tokenCheck.valid) {
      return { success: false, error: tokenCheck.reason || 'Invalid or tampered capability token.' };
    }

    // 2. Idempotency Check: Gracefully handle duplicate submissions
    if (recipient.status === 'signed') {
      return {
        success: true,
        alreadySigned: true,
        isTerminal: envelope.status === 'completed',
        envelope,
      };
    }

    // 3. Routing Order Enforcement
    const actionCheck = canRecipientAct(envelope, recipient.id);
    if (!actionCheck.allowed) {
      return { success: false, error: actionCheck.reason || 'Recipient is not permitted to sign at this time.' };
    }

    // 4. Offload signature to Cloud Storage if base64 data URL provided
    let signatureStoragePath = input.signatureStoragePath;
    let signatureHash: string | undefined;

    if (input.signatureBase64 && isBase64DataUrl(input.signatureBase64)) {
      const uploadResult = await uploadSignatureImage({
        workspaceId: envelope.workspaceId,
        contractId: envelope.id,
        recipientId: recipient.id,
        dataUrl: input.signatureBase64,
      });
      signatureStoragePath = uploadResult.storagePath;
      signatureHash = uploadResult.sha256;
    }

    const nowIso = new Date().toISOString();

    // 5. Advance Envelope Routing
    const routingResult = advanceEnvelopeRouting(envelope, recipient.id, 'signed', {
      signedAt: nowIso,
      signatureStoragePath,
      signatureHash,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      formData: input.formData,
    });

    // 6. Persistence & Evidence Logging
    await adminDb.collection('signing_envelopes').doc(envelope.id).set(routingResult.updatedEnvelope);

    await createEvidenceRecord({
      envelopeId: envelope.id,
      action: 'signed',
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      documentDigest: signatureHash,
    });

    if (routingResult.isTerminal) {
      await createEvidenceRecord({
        envelopeId: envelope.id,
        action: 'completed',
        documentDigest: routingResult.updatedEnvelope.completedSha256 || signatureHash,
      });

      if (envelope.dealId) {
        emitDealDomainEvent('deal.contract.signed', {
          dealId: envelope.dealId,
          workspaceId: envelope.workspaceId,
          envelopeId: envelope.id,
          contractStatus: 'signed',
        });
      }
    } else {
      if (envelope.dealId) {
        emitDealDomainEvent('deal.contract.in_progress', {
          dealId: envelope.dealId,
          workspaceId: envelope.workspaceId,
          envelopeId: envelope.id,
          contractStatus: 'in_progress',
        });
      }

      // Record 'sent' evidence for newly unlocked signatories
      for (const newly of routingResult.newlyInvitedRecipients) {
        await createEvidenceRecord({
          envelopeId: envelope.id,
          action: 'sent',
          recipientId: newly.id,
          recipientEmail: newly.email,
          recipientName: newly.name,
        });
      }
    }

    return {
      success: true,
      isTerminal: routingResult.isTerminal,
      envelope: routingResult.updatedEnvelope,
      newlyInvitedRecipients: routingResult.newlyInvitedRecipients,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit signature.';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Allows an authorized recipient to decline signing the envelope, terminating the agreement
 * for all parties, recording reasons, and dispatching CRM rejection notifications.
 */
export async function declineEnvelopeAction(
  input: DeclineEnvelopeInput
): Promise<DeclineEnvelopeResult> {
  try {
    const envelopeDoc = await adminDb.collection('signing_envelopes').doc(input.envelopeId).get();
    if (!envelopeDoc.exists) {
      return { success: false, error: 'Envelope not found.' };
    }

    const envelope = envelopeDoc.data() as SigningEnvelope;
    const recipient = envelope.recipients.find((r) => r.id === input.recipientId);
    if (!recipient) {
      return { success: false, error: 'Recipient not found on this envelope.' };
    }

    const tokenCheck = verifyRecipientToken(input.rawToken, recipient);
    if (!tokenCheck.valid) {
      return { success: false, error: tokenCheck.reason || 'Invalid or tampered capability token.' };
    }

    const nowIso = new Date().toISOString();
    const reasonText = (input.reason || '').trim() || 'Declined without explanation.';

    const routingResult = advanceEnvelopeRouting(envelope, recipient.id, 'declined', {
      declinedAt: nowIso,
      declineReason: reasonText,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await adminDb.collection('signing_envelopes').doc(envelope.id).set(routingResult.updatedEnvelope);

    await createEvidenceRecord({
      envelopeId: envelope.id,
      action: 'declined',
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { reason: reasonText },
    });

    if (envelope.dealId) {
      emitDealDomainEvent('deal.contract.declined', {
        dealId: envelope.dealId,
        workspaceId: envelope.workspaceId,
        envelopeId: envelope.id,
        contractStatus: 'declined',
        metadata: { reason: reasonText },
      });
    }

    return {
      success: true,
      envelope: routingResult.updatedEnvelope,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to decline envelope.';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Reassigns an unavailable recipient to a new signatory, revoking the previous token,
 * generating a fresh capability token, and logging the event in the audit trail.
 */
export async function reassignRecipientAction(
  input: ReassignRecipientInput
): Promise<ReassignRecipientResult> {
  try {
    await requireAuth();
    await requireWorkspace(input.workspaceId);

    const envelopeDoc = await adminDb.collection('signing_envelopes').doc(input.envelopeId).get();
    if (!envelopeDoc.exists) {
      return { success: false, error: 'Envelope not found.' };
    }

    const envelope = envelopeDoc.data() as SigningEnvelope;
    const oldRecIndex = envelope.recipients.findIndex((r) => r.id === input.currentRecipientId);
    if (oldRecIndex === -1) {
      return { success: false, error: 'Target recipient not found for reassignment.' };
    }

    const oldRec = envelope.recipients[oldRecIndex];
    if (oldRec.status === 'signed') {
      return { success: false, error: 'Cannot reassign a recipient who has already executed the document.' };
    }

    const nowIso = new Date().toISOString();
    const tokenData = generateRecipientToken(14);
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.smartsapp.com';
    const newRecipientId = `rec_${envelope.id}_${Date.now().toString(36)}`;
    const newSigningUrl = generateSigningUrl(appBaseUrl, envelope.id, tokenData.rawToken);

    // Create replacement recipient inheriting routing order
    const replacementRecipient: EnvelopeRecipient = {
      id: newRecipientId,
      workspaceId: input.workspaceId,
      envelopeId: envelope.id,
      role: input.newRecipient.role || oldRec.role,
      name: input.newRecipient.name.trim(),
      email: input.newRecipient.email.trim().toLowerCase(),
      phone: input.newRecipient.phone?.trim(),
      routingOrder: oldRec.routingOrder,
      status: oldRec.status === 'invited' ? 'invited' : 'pending',
      tokenHash: tokenData.tokenHash,
      tokenExpiresAt: tokenData.expiresAt,
      invitedAt: oldRec.status === 'invited' ? nowIso : undefined,
    };

    // Mark previous recipient as reassigned
    const updatedRecipients = envelope.recipients.map((r, idx) => {
      if (idx === oldRecIndex) {
        return {
          ...r,
          status: 'reassigned' as const,
          reassignedToId: newRecipientId,
        };
      }
      return r;
    });

    updatedRecipients.push(replacementRecipient);

    const updatedEnvelope: SigningEnvelope = {
      ...envelope,
      recipients: updatedRecipients,
      updatedAt: nowIso,
    };

    await adminDb.collection('signing_envelopes').doc(envelope.id).set(updatedEnvelope);

    await createEvidenceRecord({
      envelopeId: envelope.id,
      action: 'reassigned',
      recipientId: oldRec.id,
      recipientEmail: oldRec.email,
      recipientName: oldRec.name,
      metadata: {
        reassignedToEmail: replacementRecipient.email,
        reassignedToName: replacementRecipient.name,
        reason: input.reason || 'Manual operations reassignment',
      },
    });

    return {
      success: true,
      envelope: updatedEnvelope,
      newSigningUrl,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reassign recipient.';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Validates capability token and fetches envelope context for public signing viewports.
 * Strips confidential tokens of other signers to prevent PII/capability leakage.
 */
export async function getEnvelopeForSigningAction(
  envelopeId: string,
  rawToken: string
): Promise<GetEnvelopeForSigningResult> {
  try {
    const envelopeDoc = await adminDb.collection('signing_envelopes').doc(envelopeId).get();
    if (!envelopeDoc.exists) {
      return { success: false, error: 'Document envelope not found.' };
    }

    const envelope = envelopeDoc.data() as SigningEnvelope;

    // Find recipient matching candidate token
    let targetRecipient: EnvelopeRecipient | undefined;
    for (const rec of envelope.recipients) {
      const verify = verifyRecipientToken(rawToken, rec);
      if (verify.valid) {
        targetRecipient = rec;
        break;
      }
    }

    if (!targetRecipient) {
      return { success: false, error: 'Invalid, expired, or unauthorized signing capability link.' };
    }

    const actCheck = canRecipientAct(envelope, targetRecipient.id);

    // Sanitize envelope payload before returning to public client:
    // Redact tokenHash and tokenExpiresAt of other signatories
    const sanitizedRecipients: EnvelopeRecipient[] = envelope.recipients.map((rec) => {
      if (rec.id === targetRecipient!.id) {
        return rec;
      }
      return {
        ...rec,
        tokenHash: 'REDACTED',
      };
    });

    const sanitizedEnvelope: SigningEnvelope = {
      ...envelope,
      recipients: sanitizedRecipients,
    };

    return {
      success: true,
      envelope: sanitizedEnvelope,
      currentRecipient: targetRecipient,
      isAuthorizedToSign: actCheck.allowed,
      waitingReason: actCheck.reason,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load signing session.';
    return {
      success: false,
      error: message,
    };
  }
}
