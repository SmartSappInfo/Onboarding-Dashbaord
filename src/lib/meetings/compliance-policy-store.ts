import 'server-only';

/**
 * @fileOverview Workspace compliance policy: read/write with history (Phase 11 M1 · T0, finding G2).
 *
 * WHY
 * `saveWorkspaceCompliancePolicyAction` let ANY signed-in user overwrite ANY workspace's policy
 * (consent enforcement, retention), replacing the whole document. The write now:
 * - accepts only the fields the Compliance page edits (Zod), and MERGES them, so fields owned by
 *   other flows (auto-purge flags, retention mode in M1 · T6) are never wiped by a page save;
 * - optionally refuses a stale edit (`expectedUpdatedAt`, Rule 18);
 * - appends a before/after record to `meeting_compliance_policies/{ws}/history` in the SAME
 *   transaction (Rule 40: who changed what, never edited afterwards).
 *
 * CAUTION: authorization happens in the caller (`requireMeetingsPermission(..., 'meetings_manage')`).
 * This module assumes the caller is allowed and only guarantees integrity + history.
 *
 * Tests: src/lib/__tests__/meetings/meeting-actions-security.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { CompliancePolicy } from './types/compliance';

const COLLECTION = 'meeting_compliance_policies';

const DomainList = z.array(z.string().trim().min(1).max(253)).max(200);

/** Fields a user may set from the Compliance page. */
export const CompliancePolicyUpdateSchema = z.object({
  workspaceId: z.string().trim().min(1).max(200).regex(/^[^/]+$/),
  allowedEmailDomains: DomainList.optional(),
  blockedEmailDomains: DomainList.optional(),
  retentionPeriodDays: z.number().int().min(0).max(36500).optional(),
  autoPurgeTranscripts: z.boolean().optional(),
  autoPurgeRecordings: z.boolean().optional(),
  requireMeetingPasscode: z.boolean().optional(),
  enforceHostConsentForAI: z.boolean().optional(),
});
export type CompliancePolicyUpdate = z.infer<typeof CompliancePolicyUpdateSchema>;

/** Read model; unknown future fields are kept (passthrough) so readers never drop them. */
export const CompliancePolicyRecordSchema = CompliancePolicyUpdateSchema.extend({
  updatedAt: z.string().catch(''),
  updatedBy: z.string().optional(),
}).passthrough();

export function defaultCompliancePolicy(workspaceId: string, nowIso: string): CompliancePolicy {
  return {
    workspaceId,
    retentionPeriodDays: 0, // Indefinite by default
    requireMeetingPasscode: false,
    enforceHostConsentForAI: false,
    updatedAt: nowIso,
  };
}

export class StalePolicyError extends Error {
  readonly code = 'CONFLICT';
  constructor() {
    super('Someone else changed these settings. Reload and try again.');
    this.name = 'StalePolicyError';
  }
}

export async function readCompliancePolicy(db: Firestore, workspaceId: string, nowIso: string): Promise<CompliancePolicy> {
  const snap = await db.collection(COLLECTION).doc(workspaceId).get();
  if (!snap.exists) return defaultCompliancePolicy(workspaceId, nowIso);
  const parsed = CompliancePolicyRecordSchema.safeParse(snap.data());
  // CAUTION: a malformed stored policy reads as the safe default rather than crashing the page.
  if (!parsed.success) return defaultCompliancePolicy(workspaceId, nowIso);
  return { ...parsed.data, workspaceId };
}

export interface UpdateCompliancePolicyParams {
  update: CompliancePolicyUpdate;
  actorUid: string;
  nowIso: string;
  /** When given, the write is refused if the stored policy changed since it was read. */
  expectedUpdatedAt?: string;
}

/** Merges the update and appends history atomically. Returns before/after for auditing. */
export async function updateCompliancePolicy(
  db: Firestore,
  params: UpdateCompliancePolicyParams
): Promise<{ before: Record<string, unknown> | null; after: Record<string, unknown> }> {
  const { update, actorUid, nowIso, expectedUpdatedAt } = params;
  const ref = db.collection(COLLECTION).doc(update.workspaceId);
  const historyRef = ref.collection('history').doc();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.exists ? (snap.data() ?? null) : null;
    const storedUpdatedAt = before && typeof before.updatedAt === 'string' ? before.updatedAt : '';
    if (expectedUpdatedAt !== undefined && snap.exists && storedUpdatedAt !== expectedUpdatedAt) {
      throw new StalePolicyError();
    }

    const after: Record<string, unknown> = { ...(before ?? {}), ...update, updatedAt: nowIso, updatedBy: actorUid };
    tx.set(ref, after);
    tx.set(historyRef, { workspaceId: update.workspaceId, actorUid, at: nowIso, before, after });
    return { before, after };
  });
}
