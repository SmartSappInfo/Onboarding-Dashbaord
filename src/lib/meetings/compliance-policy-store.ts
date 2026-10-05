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
import { z } from 'zod/v4';
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
  /** M1 · T6: 'shadow' previews deletions only; 'enforced' deletes (bound to a reviewed preview). */
  retentionMode: z.enum(['shadow', 'enforced']).optional(),
});
export type CompliancePolicyUpdate = z.infer<typeof CompliancePolicyUpdateSchema>;

/** Read model; unknown future fields are kept (passthrough) so readers never drop them. */
export const CompliancePolicyRecordSchema = CompliancePolicyUpdateSchema.extend({
  updatedAt: z.string().catch(''),
  updatedBy: z.string().optional(),
  retentionEnabled: z.boolean().optional(),
  retentionLastRunAt: z.string().optional(),
}).loose();

/** Derived: does the retention sweep need to look at this workspace at all? */
export function isRetentionEnabled(p: { retentionPeriodDays?: unknown; autoPurgeTranscripts?: unknown; autoPurgeRecordings?: unknown }): boolean {
  const days = typeof p.retentionPeriodDays === 'number' ? p.retentionPeriodDays : 0;
  return days > 0 && (p.autoPurgeTranscripts === true || p.autoPurgeRecordings === true);
}

/**
 * True when a change can delete MORE data than before: entering enforced mode, or (while enforced)
 * shortening the period, turning on a purge type, or going from "forever" to a period.
 * Such changes must be bound to a reviewed preview (Rules 21, 22).
 */
export function isRetentionTightening(before: Record<string, unknown> | null, after: Record<string, unknown>): boolean {
  if (after.retentionMode !== 'enforced' || !isRetentionEnabled(after)) return false;
  const b = before ?? {};
  if (b.retentionMode !== 'enforced' || !isRetentionEnabled(b)) return true;
  const bd = typeof b.retentionPeriodDays === 'number' ? b.retentionPeriodDays : 0;
  const ad = typeof after.retentionPeriodDays === 'number' ? after.retentionPeriodDays : 0;
  if (bd <= 0 || ad < bd) return true;
  if (after.autoPurgeTranscripts === true && b.autoPurgeTranscripts !== true) return true;
  return after.autoPurgeRecordings === true && b.autoPurgeRecordings !== true;
}

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
  /**
   * Called (inside the transaction, before writing) when the change can delete more data. Must
   * throw unless the person confirmed the exact current impact preview.
   */
  assertImpactConfirmed?: (after: Record<string, unknown>) => Promise<void>;
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

    const merged: Record<string, unknown> = { ...(before ?? {}), ...update, updatedAt: nowIso, updatedBy: actorUid };
    // Derived fields for the retention sweep query (retentionEnabled + retentionLastRunAt ordering;
    // Firestore drops docs missing an orderBy field, so a first-time value is required).
    const after: Record<string, unknown> = {
      ...merged,
      retentionEnabled: isRetentionEnabled(merged),
      retentionLastRunAt: typeof merged.retentionLastRunAt === 'string' ? merged.retentionLastRunAt : '',
    };
    if (params.assertImpactConfirmed && isRetentionTightening(before, after)) {
      await params.assertImpactConfirmed(after);
    }
    tx.set(ref, after);
    tx.set(historyRef, { workspaceId: update.workspaceId, actorUid, at: nowIso, before, after });
    return { before, after };
  });
}
