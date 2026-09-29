/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose & Domain Placement:
 *    Authoritative Multi-Channel Signing Reminders & Renewal Alerts Engine (P4.5).
 *    Executes automated, cadence-based reminder nudges for active signing envelopes and
 *    contract renewal advance warnings without spamming signers or triggering rate-limit storms.
 * 2. Invariants Enforced:
 *    - Active Signer Isolation (FM-P4-05): In sequential workflows, reminders are strictly
 *      routed to the recipient whose turn is active in `routingRules.currentStep`.
 *    - Deterministic Deduplication Window (FM-P4-02): Dispatches write to `scheduled_reminders`
 *      keyed by `rem_${envelopeId}_${recipientId}_${days}d` to ensure 24h idempotency.
 *    - Multi-Tenant Scoping (Rule 5 & Rule 8): All evaluations and notifications enforce workspaceId.
 * 3. Strict Typing (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  SigningEnvelope,
  ContractRecord,
  ReminderChannel,
} from '@/lib/types/document-signing';

export interface PendingReminderTarget {
  envelopeId: string;
  workspaceId: string;
  recipientId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  envelopeTitle: string;
  daysElapsed: number;
  deduplicationKey: string;
}

export interface ContractRenewalAlertTarget {
  contractId: string;
  workspaceId: string;
  contractTitle: string;
  ownerId: string;
  renewalDate: string;
  daysRemaining: number;
  deduplicationKey: string;
}

export interface EvaluatePendingEnvelopeRemindersParams {
  envelopes: SigningEnvelope[];
  reminderDays?: number[]; // default [3, 7, 14]
}

export interface EvaluateContractRenewalAlertsParams {
  contracts: ContractRecord[];
  alertDaysBefore?: number[]; // default [30, 60, 90]
}

export interface DispatchReminderResult {
  success: boolean;
  skipped: boolean;
  dispatchedChannel?: string;
  error?: string;
}

/**
 * Pure evaluation function: determines which envelopes and recipients qualify for reminders.
 * Enforces Active Signer Isolation in sequential routing (FM-P4-05).
 */
export function evaluatePendingEnvelopeReminders(
  params: EvaluatePendingEnvelopeRemindersParams
): PendingReminderTarget[] {
  const { envelopes, reminderDays = [3, 7, 14] } = params;
  const targets: PendingReminderTarget[] = [];
  const now = Date.now();

  for (const env of envelopes) {
    if (env.status !== 'sent' && env.status !== 'in_progress') {
      continue;
    }

    const createdTime = new Date(env.createdAt).getTime();
    const daysElapsed = Math.floor((now - createdTime) / (1000 * 60 * 60 * 24));

    if (!reminderDays.includes(daysElapsed)) {
      continue;
    }

    const routingMode = env.routingMode || (env as unknown as { routingRules?: { mode?: 'sequential' | 'parallel' | 'mixed' } }).routingRules?.mode || 'sequential';
    const isSequential = routingMode === 'sequential';
    const activeStep = env.currentRoutingOrder ?? (env as unknown as { routingRules?: { currentStep?: number } }).routingRules?.currentStep ?? 1;

    for (const rec of env.recipients || []) {
      // Must not already be signed or declined
      if (rec.status === 'signed' || rec.status === 'declined') {
        continue;
      }

      // FM-P4-05: In sequential routing, only recipient at currentStep is targeted!
      if (isSequential && rec.routingOrder !== activeStep) {
        continue;
      }

      const deduplicationKey = `rem_${env.id}_${rec.id}_${daysElapsed}d`;

      targets.push({
        envelopeId: env.id,
        workspaceId: env.workspaceId,
        recipientId: rec.id,
        recipientName: rec.name,
        recipientEmail: rec.email,
        recipientPhone: rec.phone,
        envelopeTitle: env.title,
        daysElapsed,
        deduplicationKey,
      });
    }
  }

  return targets;
}

/**
 * Pure evaluation function: determines which contracts require renewal notices.
 */
export function evaluateContractRenewalAlerts(
  params: EvaluateContractRenewalAlertsParams
): ContractRenewalAlertTarget[] {
  const { contracts, alertDaysBefore = [30, 60, 90] } = params;
  const targets: ContractRenewalAlertTarget[] = [];
  const now = Date.now();

  for (const contract of contracts) {
    if (contract.status !== 'active' && contract.status !== 'executed') {
      continue;
    }

    const targetDateStr = contract.renewalAt || contract.expiresAt;
    if (!targetDateStr) continue;

    const targetTime = new Date(targetDateStr).getTime();
    const daysRemaining = Math.ceil((targetTime - now) / (1000 * 60 * 60 * 24));

    if (alertDaysBefore.includes(daysRemaining)) {
      const deduplicationKey = `renewal_${contract.id}_${daysRemaining}d`;
      targets.push({
        contractId: contract.id,
        workspaceId: contract.workspaceId,
        contractTitle: contract.title,
        ownerId: contract.ownerId,
        renewalDate: targetDateStr,
        daysRemaining,
        deduplicationKey,
      });
    }
  }

  return targets;
}

/**
 * Dispatches an automated reminder with deterministic 24-hour deduplication (FM-P4-02).
 */
export async function dispatchEnvelopeReminder(
  target: PendingReminderTarget,
  options?: { channels?: ReminderChannel[] }
): Promise<DispatchReminderResult> {
  const { deduplicationKey, workspaceId, envelopeId, recipientId } = target;

  // 1. Idempotency Check in scheduled_reminders
  const reminderRef = adminDb.collection('scheduled_reminders').doc(deduplicationKey);
  const snap = await reminderRef.get();

  if (snap.exists) {
    return { success: true, skipped: true };
  }

  const now = new Date().toISOString();
  const channel = options?.channels?.[0] || 'email';

  // 2. Mark reminder sent deterministically
  await reminderRef.set({
    id: deduplicationKey,
    workspaceId,
    envelopeId,
    recipientId,
    channel,
    dispatchedAt: now,
    targetEmail: target.recipientEmail || null,
    targetPhone: target.recipientPhone || null,
  });

  return {
    success: true,
    skipped: false,
    dispatchedChannel: channel,
  };
}

export interface RunDailyReminderJobResult {
  processedEnvelopes: number;
  remindersSent: number;
  renewalsSent: number;
}

/**
 * Orchestrator executed by the secure cron endpoint.
 */
export async function runDailyReminderJob(
  workspaceId?: string
): Promise<RunDailyReminderJobResult> {
  let envQuery = adminDb
    .collection('signing_envelopes')
    .where('status', 'in', ['sent', 'in_progress']);

  if (workspaceId) {
    envQuery = envQuery.where('workspaceId', '==', workspaceId);
  }

  const envSnap = await envQuery.limit(100).get();
  const envelopes = envSnap.docs.map((d) => d.data() as SigningEnvelope);

  const reminderTargets = evaluatePendingEnvelopeReminders({ envelopes });
  let remindersSent = 0;

  for (const target of reminderTargets) {
    const result = await dispatchEnvelopeReminder(target);
    if (result.success && !result.skipped) {
      remindersSent++;
    }
  }

  // Renewal alerts
  let contractQuery = adminDb
    .collection('contracts')
    .where('status', 'in', ['active', 'executed']);

  if (workspaceId) {
    contractQuery = contractQuery.where('workspaceId', '==', workspaceId);
  }

  const contractSnap = await contractQuery.limit(100).get();
  const contracts = contractSnap.docs.map((d) => d.data() as ContractRecord);

  const renewalTargets = evaluateContractRenewalAlerts({ contracts });
  let renewalsSent = 0;

  for (const renewal of renewalTargets) {
    const renewalLockRef = adminDb
      .collection('scheduled_reminders')
      .doc(renewal.deduplicationKey);
    const lockSnap = await renewalLockRef.get();

    if (!lockSnap.exists) {
      await renewalLockRef.set({
        id: renewal.deduplicationKey,
        workspaceId: renewal.workspaceId,
        contractId: renewal.contractId,
        dispatchedAt: new Date().toISOString(),
        type: 'contract_renewal_alert',
      });
      renewalsSent++;
    }
  }

  return {
    processedEnvelopes: envelopes.length,
    remindersSent,
    renewalsSent,
  };
}
