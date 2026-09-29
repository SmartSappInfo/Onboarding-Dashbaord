/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose & Domain Placement:
 *    Authoritative Event-Derived Lifecycle Analytics Engine for Document & Contract Signing (P4.4).
 *    Derives signing velocity, conversion funnel drop-off, signer bottlenecks, and contract
 *    deal value attribution without volatile memory counters or unbounded queries (FM-P4-03, FM-P4-06).
 * 2. Invariants Enforced:
 *    - Event-Derived Invariant (FM-P4-03): Computes deterministic statistics over immutable envelope milestones.
 *    - Query Bounding (FM-P4-06): Firestore queries strictly bound result sets using limit(100) and time windowing.
 *    - Tenant Scoping (Rule 5 & Rule 8): All database queries mandate `workspaceId`.
 * 3. Strict Typing (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`. Output validates against `SigningAnalyticsMetricSchema`.
 */

import { adminDb } from '@/lib/firebase-admin';
import {
  SigningAnalyticsMetricSchema,
  type SigningAnalyticsMetric,
  type SigningFunnelStage,
  type SignerBottleneckMetric,
  type SigningEnvelope,
  type ContractRecord,
} from '@/lib/types/document-signing';

export interface SigningVelocityResult {
  medianHours: number;
  averageHours: number;
  totalCompleted: number;
}

export interface FunnelDropOffResult {
  completionRate: number;
  declinedRate: number;
  voidedRate: number;
  inProgressRate: number;
  funnel: SigningFunnelStage[];
}

export interface ContractAttributionResult {
  totalContractValue: number;
  currency: string;
  activeCount: number;
  signedCount: number;
}

/**
 * Calculates median and average hours from envelope dispatch to final signature.
 */
export function calculateSigningVelocity(envelopes: SigningEnvelope[]): SigningVelocityResult {
  const completedEnvelopes = envelopes.filter(
    (env) => env.status === 'completed' && (env.completedAt || env.updatedAt)
  );

  if (completedEnvelopes.length === 0) {
    return {
      medianHours: 0,
      averageHours: 0,
      totalCompleted: 0,
    };
  }

  const durationsHours: number[] = completedEnvelopes.map((env) => {
    const start = new Date(env.createdAt).getTime();
    const end = new Date(env.completedAt || env.updatedAt).getTime();
    const diffHours = Math.max(0, (end - start) / (1000 * 60 * 60));
    return Number(diffHours.toFixed(1));
  });

  durationsHours.sort((a, b) => a - b);

  // Calculate Median
  const mid = Math.floor(durationsHours.length / 2);
  const medianHours =
    durationsHours.length % 2 !== 0
      ? durationsHours[mid]
      : Number(((durationsHours[mid - 1] + durationsHours[mid]) / 2).toFixed(1));

  // Calculate Average
  const sum = durationsHours.reduce((acc, curr) => acc + curr, 0);
  const averageHours = Number((sum / durationsHours.length).toFixed(1));

  return {
    medianHours,
    averageHours,
    totalCompleted: completedEnvelopes.length,
  };
}

/**
 * Calculates completion rate, decline rate, void rate, and stage-by-stage funnel.
 */
export function calculateFunnelDropOff(envelopes: SigningEnvelope[]): FunnelDropOffResult {
  const total = envelopes.length;
  if (total === 0) {
    return {
      completionRate: 0,
      declinedRate: 0,
      voidedRate: 0,
      inProgressRate: 0,
      funnel: [
        { stage: 'Sent', count: 0, percentage: 100 },
        { stage: 'In Progress', count: 0, percentage: 0 },
        { stage: 'Signed', count: 0, percentage: 0 },
      ],
    };
  }

  let completedCount = 0;
  let declinedCount = 0;
  let voidedCount = 0;
  let inProgressCount = 0;

  for (const env of envelopes) {
    if (env.status === 'completed') completedCount++;
    else if (env.status === 'declined') declinedCount++;
    else if (env.status === 'voided') voidedCount++;
    else if (env.status === 'in_progress' || env.status === 'sent') inProgressCount++;
  }

  const completionRate = Number(((completedCount / total) * 100).toFixed(1));
  const declinedRate = Number(((declinedCount / total) * 100).toFixed(1));
  const voidedRate = Number(((voidedCount / total) * 100).toFixed(1));
  const inProgressRate = Number(((inProgressCount / total) * 100).toFixed(1));

  const openedCount = inProgressCount + completedCount;
  const openedPct = Number(((openedCount / total) * 100).toFixed(1));

  const funnel: SigningFunnelStage[] = [
    { stage: 'Sent', count: total, percentage: 100 },
    { stage: 'In Progress', count: openedCount, percentage: openedPct },
    { stage: 'Signed', count: completedCount, percentage: completionRate },
  ];

  return {
    completionRate,
    declinedRate,
    voidedRate,
    inProgressRate,
    funnel,
  };
}

/**
 * Groups recipient turnaround time by role to expose signing friction bottlenecks.
 */
export function identifySignerBottlenecks(envelopes: SigningEnvelope[]): SignerBottleneckMetric[] {
  const roleStats: Record<string, { totalHours: number; count: number }> = {};

  for (const env of envelopes) {
    const envStart = new Date(env.createdAt).getTime();

    for (const rec of env.recipients || []) {
      if (rec.status === 'signed' && rec.signedAt) {
        const signTime = new Date(rec.signedAt).getTime();
        const start = rec.invitedAt ? new Date(rec.invitedAt).getTime() : envStart;
        const hours = Math.max(0, (signTime - start) / (1000 * 60 * 60));

        const role = rec.role || 'signer';
        if (!roleStats[role]) {
          roleStats[role] = { totalHours: 0, count: 0 };
        }
        roleStats[role].totalHours += hours;
        roleStats[role].count += 1;
      }
    }
  }

  return Object.entries(roleStats).map(([role, stats]) => ({
    role,
    averageTurnaroundHours: Number((stats.totalHours / stats.count).toFixed(1)),
    count: stats.count,
  }));
}

/**
 * Calculates total signed contract value and currency attribution.
 */
export function calculateDealContractAttribution(
  contracts: ContractRecord[] = []
): ContractAttributionResult {
  let totalContractValue = 0;
  let currency = 'USD';
  let activeCount = 0;
  let signedCount = 0;

  for (const contract of contracts) {
    if (contract.status === 'active' || contract.status === 'executed') {
      signedCount++;
      activeCount++;
      if (contract.contractValue?.amount) {
        totalContractValue += contract.contractValue.amount;
        if (contract.contractValue.currency) {
          currency = contract.contractValue.currency;
        }
      }
    }
  }

  return {
    totalContractValue,
    currency,
    activeCount,
    signedCount,
  };
}

/**
 * Assembles a complete, strictly validated SigningAnalyticsMetric snapshot.
 */
export function computeSigningAnalyticsSummary(
  envelopes: SigningEnvelope[],
  contracts: ContractRecord[] = []
): SigningAnalyticsMetric {
  const velocity = calculateSigningVelocity(envelopes);
  const funnelData = calculateFunnelDropOff(envelopes);
  const bottlenecks = identifySignerBottlenecks(envelopes);
  const attribution = calculateDealContractAttribution(contracts);

  let declinedCount = 0;
  let voidedCount = 0;
  let expiredCount = 0;
  let inProgressCount = 0;

  for (const env of envelopes) {
    if (env.status === 'declined') declinedCount++;
    else if (env.status === 'voided') voidedCount++;
    else if (env.status === 'expired') expiredCount++;
    else if (env.status === 'in_progress' || env.status === 'sent') inProgressCount++;
  }

  const rawSummary = {
    completionRate: funnelData.completionRate,
    medianHoursToSign: velocity.medianHours,
    averageHoursToSign: velocity.averageHours,
    totalEnvelopes: envelopes.length,
    completedCount: velocity.totalCompleted,
    declinedCount,
    voidedCount,
    expiredCount,
    inProgressCount,
    totalContractValue: attribution.totalContractValue,
    currency: attribution.currency,
    funnel: funnelData.funnel,
    signerBottlenecks: bottlenecks,
    freshnessTimestamp: new Date().toISOString(),
  };

  return SigningAnalyticsMetricSchema.parse(rawSummary);
}

/**
 * Fetches analytics summary for a workspace with bounded queries (FM-P4-06).
 */
export async function fetchWorkspaceSigningAnalytics(
  workspaceId: string,
  options?: { timeWindowDays?: number }
): Promise<SigningAnalyticsMetric> {
  if (!workspaceId) {
    throw new Error('[SigningAnalytics] workspaceId is mandatory.');
  }

  const timeWindowDays = options?.timeWindowDays || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);
  const cutoffIso = cutoffDate.toISOString();

  // Query Envelopes bounded by workspace and time window (limit 100)
  const envelopesSnap = await adminDb
    .collection('signing_envelopes')
    .where('workspaceId', '==', workspaceId)
    .where('createdAt', '>=', cutoffIso)
    .limit(100)
    .get();

  const envelopes = envelopesSnap.docs.map((d) => d.data() as SigningEnvelope);

  // Query Contracts bounded by workspace (limit 100)
  const contractsSnap = await adminDb
    .collection('contracts')
    .where('workspaceId', '==', workspaceId)
    .limit(100)
    .get();

  const contracts = contractsSnap.docs.map((d) => d.data() as ContractRecord);

  return computeSigningAnalyticsSummary(envelopes, contracts);
}
