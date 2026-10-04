/**
 * @fileOverview Unit Tests: Hybrid Account Risk Detector (Phase 9 Milestone 4)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 12 (Risk Vocabulary),
 * Rule 40 (Domain Event Publication: crm.account.risk_detected),
 * Rule 42 (Mandatory Shadow Mode / Dry-Run Support), and Rule 47 (Never Trust the Model).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  CrmRiskDetector,
  getCrmRiskDetector,
} from '@/platform/agents/crm/actions/crm-risk-detector';
import type { Account360Context } from '@/platform/agents/crm/context/account-context-types';
import { defaultEventBus } from '@/platform/events/event-bus';

describe('CrmRiskDetector', () => {
  const mockNow = new Date('2026-10-04T12:00:00Z');

  const createBaseContext = (overrides?: Partial<Account360Context>): Account360Context => ({
    organizationId: 'org_enterprise_1',
    workspaceId: 'ws_sales_alpha',
    entityId: 'ent_acme_corp',
    entity: {
      id: 'ent_acme_corp',
      name: 'Acme Corporation',
      type: 'client',
      status: 'active',
      industry: 'Enterprise Software',
      email: 'contact@acme.com',
      phone: '+14155552673',
      city: 'San Francisco',
      address: '100 Market St',
      createdAt: '2026-01-01T00:00:00Z',
    },
    workspaceEntity: {
      id: 'ws_sales_alpha_ent_acme_corp',
      entityId: 'ent_acme_corp',
      workspaceId: 'ws_sales_alpha',
      pipelineId: 'pipe_enterprise',
      stageId: 'stage_negotiation',
      stageName: 'Negotiation',
      assignedTo: {
        userId: 'usr_rep_1',
        name: 'Sarah Connor',
        email: 'sarah@smartsapp.com',
      },
      workspaceTags: ['strategic', 'tier-1'],
      leadStatus: 'qualified',
      updatedAt: '2026-10-01T10:00:00Z',
    },
    contacts: [
      {
        id: 'con_01',
        name: 'Alice Johnson',
        role: 'Chief Technology Officer',
        email: 'alice@acme.com',
        phone: '+14155550101',
        isPrimary: true,
        channelPreferences: ['email'],
      },
    ],
    deals: [],
    meetings: [
      {
        id: 'meet_01',
        title: 'Executive Sync',
        startTime: '2026-10-02T10:00:00Z',
        attendees: ['alice@acme.com'],
        summary: 'Productive review of integration roadmap.',
        sentiment: 'positive',
      },
    ],
    notes: [
      {
        id: 'note_01',
        content: 'Customer is happy with current trial results.',
        authorName: 'Sarah Connor',
        createdAt: '2026-10-02T12:00:00Z',
        category: 'feedback',
      },
    ],
    tasks: [],
    finances: {
      openBalance: 0,
      overdueBalance: 0,
      currency: 'USD',
      invoiceCount: 2,
      agingCategory: 'CLEAR',
    },
    memories: [],
    timeline: [],
    metadata: {
      assembledAt: '2026-10-04T12:00:00Z',
      durationMs: 45,
      estimatedTokens: 1200,
      correlationId: 'corr_test_123',
      isKnapsackCompressed: false,
    },
    ...overrides,
  });

  it('evaluates a healthy account as LOW risk', async () => {
    const detector = new CrmRiskDetector();
    const context = createBaseContext();

    const assessment = await detector.evaluateRisks(context, { now: mockNow, dryRun: true });

    expect(assessment.entityId).toBe('ent_acme_corp');
    expect(assessment.workspaceId).toBe('ws_sales_alpha');
    expect(assessment.riskLevel).toBe('LOW');
    expect(assessment.overallScore).toBeLessThan(30);
    expect(assessment.factors).toHaveLength(0);
    expect(assessment.stalledDeals).toHaveLength(0);
    expect(assessment.darkAccount.isDark).toBe(false);
  });

  it('detects stalled deals and elevates risk score', async () => {
    const detector = new CrmRiskDetector();
    const context = createBaseContext({
      deals: [
        {
          id: 'deal_stalled_1',
          title: 'Annual Enterprise Expansion',
          pipelineId: 'pipe_enterprise',
          stageId: 'stage_proposal',
          stageName: 'Proposal',
          value: 95000,
          currency: 'USD',
          probability: 60,
          ageInDays: 35,
          expectedCloseDate: '2026-09-15T00:00:00Z', // Past date
          isStalled: true,
        },
      ],
    });

    const assessment = await detector.evaluateRisks(context, { now: mockNow, dryRun: true });

    expect(assessment.stalledDeals).toHaveLength(1);
    expect(assessment.stalledDeals[0].dealId).toBe('deal_stalled_1');
    expect(assessment.factors.some((f) => f.category === 'STALLED_DEAL')).toBe(true);
    expect(assessment.overallScore).toBeGreaterThanOrEqual(25);
  });

  it('detects dark / dormant accounts when inactive past threshold', async () => {
    const detector = new CrmRiskDetector();
    const context = createBaseContext({
      meetings: [
        {
          id: 'meet_old',
          title: 'Intro Call',
          startTime: '2026-08-01T10:00:00Z', // > 60 days ago
          attendees: ['alice@acme.com'],
          summary: 'Initial intro.',
          sentiment: 'neutral',
        },
      ],
      notes: [],
    });

    const assessment = await detector.evaluateRisks(context, { now: mockNow, dryRun: true });

    expect(assessment.darkAccount.isDark).toBe(true);
    expect(assessment.darkAccount.daysInactive).toBeGreaterThanOrEqual(60);
    expect(assessment.factors.some((f) => f.category === 'DARK_ACCOUNT')).toBe(true);
  });

  it('detects overdue commitments and aging receivables', async () => {
    const detector = new CrmRiskDetector();
    const context = createBaseContext({
      tasks: [
        {
          id: 'task_overdue_1',
          title: 'Send Security Whitepaper',
          status: 'pending',
          priority: 'urgent',
          dueDate: '2026-09-20T00:00:00Z',
          assignedToName: 'Sarah Connor',
          isOverdue: true,
        },
      ],
      finances: {
        openBalance: 15000,
        overdueBalance: 15000,
        currency: 'USD',
        invoiceCount: 1,
        agingCategory: 'OVERDUE_60',
      },
    });

    const assessment = await detector.evaluateRisks(context, { now: mockNow, dryRun: true });

    expect(assessment.overdueCommitments).toHaveLength(1);
    expect(assessment.overdueCommitments[0].commitmentId).toBe('task_overdue_1');
    expect(assessment.agingReceivables.length).toBeGreaterThan(0);
    expect(assessment.factors.some((f) => f.category === 'OVERDUE_COMMITMENT')).toBe(true);
    expect(assessment.factors.some((f) => f.category === 'AGING_RECEIVABLE')).toBe(true);
    expect(assessment.overallScore).toBe(40);
    expect(assessment.riskLevel).toBe('MODERATE');
  });

  it('detects hygiene defects (missing decision maker & unassigned owner)', async () => {
    const detector = new CrmRiskDetector();
    const context = createBaseContext({
      contacts: [
        {
          id: 'con_unverified',
          name: 'Bob',
          role: null,
          email: null,
          phone: null,
          isPrimary: false,
          channelPreferences: [],
        },
      ],
      workspaceEntity: {
        id: 'ws_sales_alpha_ent_acme_corp',
        entityId: 'ent_acme_corp',
        workspaceId: 'ws_sales_alpha',
        assignedTo: null,
        workspaceTags: [],
        leadStatus: 'new',
        updatedAt: '2026-10-01T10:00:00Z',
      },
    });

    const assessment = await detector.evaluateRisks(context, { now: mockNow, dryRun: true });

    expect(assessment.hygieneDefects.length).toBeGreaterThanOrEqual(2);
    expect(assessment.hygieneDefects.some((d) => d.type === 'MISSING_DECISION_MAKER')).toBe(true);
    expect(assessment.hygieneDefects.some((d) => d.type === 'STALE_OWNER')).toBe(true);
  });

  it('detects sentiment degradation from negative interactions', async () => {
    const detector = new CrmRiskDetector();
    const context = createBaseContext({
      meetings: [
        {
          id: 'meet_neg',
          title: 'Escalation Review',
          startTime: '2026-10-03T10:00:00Z',
          attendees: ['alice@acme.com'],
          summary: 'Customer expressed intense frustration with onboarding delays.',
          sentiment: 'negative',
        },
      ],
    });

    const assessment = await detector.evaluateRisks(context, { now: mockNow, dryRun: true });

    expect(assessment.factors.some((f) => f.category === 'SENTIMENT_DEGRADATION')).toBe(true);
  });

  it('publishes domain event crm.account.risk_detected when dryRun is false (Rule 40)', async () => {
    const detector = new CrmRiskDetector();
    const context = createBaseContext({
      deals: [
        {
          id: 'deal_1',
          title: 'Stalled Deal',
          pipelineId: 'p1',
          stageId: 's1',
          stageName: 'Stage 1',
          value: 50000,
          currency: 'USD',
          probability: 30,
          ageInDays: 40,
          expectedCloseDate: null,
          isStalled: true,
        },
      ],
    });

    const publishSpy = vi.spyOn(defaultEventBus, 'publish');

    const assessment = await detector.evaluateRisks(context, { now: mockNow, dryRun: false });

    expect(assessment).toBeDefined();
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'crm.account.risk_detected',
        organizationId: 'org_enterprise_1',
      })
    );
  });

  it('supports Blast Radius Report in Shadow Mode simulation (Rule 42)', async () => {
    const detector = getCrmRiskDetector();
    const context = createBaseContext();

    const report = await detector.evaluateRisksWithBlastRadius(context, { now: mockNow });

    expect(report.assessment).toBeDefined();
    expect(report.blastRadius).toBeDefined();
    expect(report.blastRadius.mode).toBe('SHADOW_SIMULATION');
    expect(report.blastRadius.mutationsIntercepted).toBe(0);
    expect(report.blastRadius.overallRisk).toBe(report.assessment.riskLevel);
  });
});
