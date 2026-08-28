/**
 * @fileoverview QA Unit Tests for Tenant Health Signal Scoring Engine
 */

import { describe, it, expect } from 'vitest';
import { calculateCompositeHealth, type RawOrgSignals } from '../health-signal-engine';

describe('Tenant Health Signal Engine QA Suite', () => {
  it('computes 100/100 healthy score for zero-incident organization', () => {
    const raw: RawOrgSignals = {
      orgId: 'org_healthy_1',
      orgName: 'Acme Corp',
      activeUsersCount: 25,
      totalMessagesSent24h: 1000,
      bouncedMessages24h: 0,
      failedWebhooks24h: 0,
      overdueInvoicesCount: 0,
      totalActiveInvoicesCount: 10,
      stuckAutomationRunsCount: 0,
      openIssuesCount: 0,
    };

    const score = calculateCompositeHealth(raw);
    expect(score.healthScore).toBe(100);
    expect(score.status).toBe('healthy');
    expect(score.messagingHealth).toBe(100);
    expect(score.integrationHealth).toBe(100);
    expect(score.financialHealth).toBe(100);
    expect(score.workflowHealth).toBe(100);
  });

  it('detects high bounce rate anomaly and lowers messaging pillar to 20', () => {
    const raw: RawOrgSignals = {
      orgId: 'org_bouncing',
      orgName: 'Bounce Heavy LLC',
      activeUsersCount: 5,
      totalMessagesSent24h: 100,
      bouncedMessages24h: 15, // 15% bounce rate (>10%)
      failedWebhooks24h: 0,
      overdueInvoicesCount: 0,
      totalActiveInvoicesCount: 5,
      stuckAutomationRunsCount: 0,
      openIssuesCount: 1,
    };

    const score = calculateCompositeHealth(raw);
    expect(score.messagingHealth).toBe(20);
    expect(score.healthScore).toBeLessThan(85);
    expect(score.status).toBe('warning');
  });

  it('detects multi-pillar critical condition (webhooks + overdue invoices + stuck automations)', () => {
    const raw: RawOrgSignals = {
      orgId: 'org_critical_1',
      orgName: 'Failing Enterprise',
      activeUsersCount: 12,
      totalMessagesSent24h: 200,
      bouncedMessages24h: 30, // High bounce -> 20
      failedWebhooks24h: 25,  // >20 webhooks -> 30
      overdueInvoicesCount: 8, // >50% overdue -> 25
      totalActiveInvoicesCount: 10,
      stuckAutomationRunsCount: 15, // >10 stuck -> 20
      openIssuesCount: 5,
    };

    const score = calculateCompositeHealth(raw);
    expect(score.healthScore).toBeLessThan(60);
    expect(score.status).toBe('critical');
    expect(score.integrationHealth).toBe(30);
    expect(score.financialHealth).toBe(25);
    expect(score.workflowHealth).toBe(20);
  });
});
