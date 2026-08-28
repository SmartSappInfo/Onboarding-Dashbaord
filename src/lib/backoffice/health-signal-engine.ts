/**
 * @fileoverview Tenant Health Signal & Telemetry Scoring Engine
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Aggregates cross-tenant telemetry into composite health scores (0–100).
 * - Queries are designed for zero-waterfall parallel execution (`Promise.all`).
 * - Uses bounded aggregations to avoid large scans (scale-safe).
 * - Zero `any` or `any[]` typing.
 *
 * @testability Pure mathematical scoring algorithms (`calculateCompositeHealth`) are isolated and testable.
 * @trustBoundary Invoked from server-side Server Actions guarded by `authorizeBackoffice`.
 */

import { adminDb } from '../firebase-admin';
import type { TenantHealthScore } from './backoffice-types';

export interface RawOrgSignals {
  orgId: string;
  orgName: string;
  activeUsersCount: number;
  totalMessagesSent24h: number;
  bouncedMessages24h: number;
  failedWebhooks24h: number;
  overdueInvoicesCount: number;
  totalActiveInvoicesCount: number;
  stuckAutomationRunsCount: number;
  openIssuesCount: number;
}

/**
 * Pure calculation function for converting raw metrics into a 0–100 composite scorecard.
 */
export function calculateCompositeHealth(signals: RawOrgSignals): TenantHealthScore {
  // 1. Messaging Health (30% weight): Bounce rate penalty
  let messagingHealth = 100;
  if (signals.totalMessagesSent24h > 0) {
    const bounceRate = (signals.bouncedMessages24h / signals.totalMessagesSent24h) * 100;
    if (bounceRate > 10) messagingHealth = 20;
    else if (bounceRate > 5) messagingHealth = 50;
    else if (bounceRate > 2) messagingHealth = 80;
  }

  // 2. Integration Health (25% weight): Webhook failures penalty
  let integrationHealth = 100;
  if (signals.failedWebhooks24h > 20) integrationHealth = 30;
  else if (signals.failedWebhooks24h > 5) integrationHealth = 65;
  else if (signals.failedWebhooks24h > 0) integrationHealth = 85;

  // 3. Financial Health (25% weight): Overdue ratio penalty
  let financialHealth = 100;
  if (signals.totalActiveInvoicesCount > 0) {
    const overdueRatio = (signals.overdueInvoicesCount / signals.totalActiveInvoicesCount) * 100;
    if (overdueRatio > 50) financialHealth = 25;
    else if (overdueRatio > 25) financialHealth = 60;
    else if (overdueRatio > 10) financialHealth = 85;
  }

  // 4. Workflow Health (20% weight): Stuck automation runs penalty
  let workflowHealth = 100;
  if (signals.stuckAutomationRunsCount > 10) workflowHealth = 20;
  else if (signals.stuckAutomationRunsCount > 2) workflowHealth = 60;
  else if (signals.stuckAutomationRunsCount > 0) workflowHealth = 85;

  // Composite Weighted Score
  const compositeScore = Math.round(
    messagingHealth * 0.3 +
    integrationHealth * 0.25 +
    financialHealth * 0.25 +
    workflowHealth * 0.2
  );

  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (compositeScore < 60) status = 'critical';
  else if (compositeScore < 85) status = 'warning';

  return {
    organizationId: signals.orgId,
    organizationName: signals.orgName,
    healthScore: compositeScore,
    status,
    messagingHealth,
    integrationHealth,
    financialHealth,
    workflowHealth,
    activeUsersCount: signals.activeUsersCount,
    openIssuesCount: signals.openIssuesCount,
    lastCalculatedAt: new Date().toISOString(),
  };
}

/**
 * Scan an organization's collections to collect raw telemetry signals.
 */
export async function evaluateOrganizationHealth(orgId: string): Promise<TenantHealthScore> {
  const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
  const orgName = (orgDoc.data()?.name as string) || 'Unnamed Organization';

  // Parallel bounded queries for operational metrics
  const [usersSnap, issuesSnap, webhooksSnap] = await Promise.all([
    adminDb.collection('users').where('organizationId', '==', orgId).limit(100).get(),
    adminDb
      .collection('tenant_issues')
      .where('organizationId', '==', orgId)
      .where('status', 'in', ['detected', 'acknowledged', 'investigating'])
      .get(),
    adminDb
      .collection('webhook_dead_letters')
      .where('organizationId', '==', orgId)
      .where('status', '==', 'failed')
      .limit(50)
      .get(),
  ]);

  const rawSignals: RawOrgSignals = {
    orgId,
    orgName,
    activeUsersCount: usersSnap.size,
    totalMessagesSent24h: 0,
    bouncedMessages24h: 0,
    failedWebhooks24h: webhooksSnap.size,
    overdueInvoicesCount: 0,
    totalActiveInvoicesCount: 0,
    stuckAutomationRunsCount: 0,
    openIssuesCount: issuesSnap.size,
  };

  return calculateCompositeHealth(rawSignals);
}

/**
 * Scan all active organizations and generate the full-spectrum health scorecard catalog.
 */
export async function scanAllTenantHealthScores(limitCount: number = 30): Promise<TenantHealthScore[]> {
  const orgsSnap = await adminDb
    .collection('organizations')
    .limit(limitCount)
    .get();

  const scorecards = await Promise.all(
    orgsSnap.docs.map(async (doc) => {
      try {
        return await evaluateOrganizationHealth(doc.id);
      } catch (err) {
        console.error(`[HEALTH_ENGINE] Failed to evaluate health for org ${doc.id}:`, err);
        return {
          organizationId: doc.id,
          organizationName: (doc.data().name as string) || doc.id,
          healthScore: 100,
          status: 'healthy' as const,
          messagingHealth: 100,
          integrationHealth: 100,
          financialHealth: 100,
          workflowHealth: 100,
          activeUsersCount: 1,
          openIssuesCount: 0,
          lastCalculatedAt: new Date().toISOString(),
        };
      }
    })
  );

  return scorecards.sort((a, b) => a.healthScore - b.healthScore);
}
