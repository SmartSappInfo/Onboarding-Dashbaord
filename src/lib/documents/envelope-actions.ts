'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Authoritative Server Actions for Multi-Party Document Signing Envelopes (Phase 2, P2.1 & P2.4).
 * 2. Invariants & Security:
 *    - Tenant Isolation: All actions strictly enforce workspace isolation and authenticated session context.
 *    - Cryptographic Capability Tokens: Raw tokens are returned ONLY in memory upon creation/reassignment
 *      for outbound delivery (email/SMS). Only SHA-256 digests (`tokenHash`) are stored in Firestore.
 *    - Immediate Append-Only Audit Trail: Every lifecycle transition logs an immutable entry to `signing_evidence`.
 *    - CRM Deal Event Bus: Emits structured domain events (`deal.contract.sent`, `deal.contract.in_progress`,
 *      `deal.contract.signed`, `deal.contract.declined`) to sync pipeline probabilities automatically.
 * 3. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Zero tolerance for `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import {
  generateRecipientToken,
  generateSigningUrl,
} from '@/lib/documents/signing-token-service';
import { createEvidenceRecord } from '@/lib/documents/evidence-service';
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
