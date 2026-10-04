/**
 * @fileOverview Unit Tests: Autonomous Next-Best-Action (NBA) Engine (Phase 9 Milestone 4)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 12 (Risk Vocabulary: L0-L4),
 * Rule 19 (Deterministic Idempotency Keys), Rule 27 (Saga Compensation Binding),
 * Rule 40 (Domain Event Publication: crm.action.proposed), Rule 41 (Explainability Grid),
 * and Rule 42 (Shadow Mode / Dry-Run Simulation).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  CrmNextBestActionEngine,
  getCrmNextBestActionEngine,
} from '@/platform/agents/crm/actions/crm-next-best-action-engine';
import type { Account360Context } from '@/platform/agents/crm/context/account-context-types';
import { defaultEventBus } from '@/platform/events/event-bus';

describe('CrmNextBestActionEngine', () => {
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
      stageId: 'stage_proposal',
      stageName: 'Proposal',
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
      correlationId: 'corr_test_nba_123',
      isKnapsackCompressed: false,
    },
    ...overrides,
  });

  it('generates high-priority outreach and meeting action for stalled deals', async () => {
    const engine = new CrmNextBestActionEngine();
    const context = createBaseContext({
      deals: [
        {
          id: 'deal_stalled_101',
          title: 'Global Rollout Agreement',
          pipelineId: 'pipe_enterprise',
          stageId: 'stage_proposal',
          stageName: 'Proposal',
          value: 120000,
          currency: 'USD',
          probability: 70,
          ageInDays: 28,
          expectedCloseDate: '2026-09-30T00:00:00Z',
          isStalled: true,
        },
      ],
    });

    const actions = await engine.generateNextBestActions(context, undefined, { now: mockNow, dryRun: true });

    expect(actions.length).toBeGreaterThan(0);
    const stalledDealAction = actions.find((a) => a.actionType === 'UPDATE_STAGE' || a.actionType === 'SCHEDULE_MEETING');
    expect(stalledDealAction).toBeDefined();
    if (stalledDealAction) {
      expect(stalledDealAction.priority).toMatch(/URGENT|HIGH/);
      expect(stalledDealAction.explainability.what).toBeDefined();
      expect(stalledDealAction.explainability.why).toBeDefined();
      expect(stalledDealAction.explainability.impact).toBeDefined();
      expect(stalledDealAction.compensatingCapabilityId).toBeDefined();
      expect(stalledDealAction.idempotencyKey).toMatch(/^crm_action_ent_acme_corp_[a-f0-9]{16}$/);
    }
  });

  it('generates re-engagement outreach for dark / dormant accounts', async () => {
    const engine = new CrmNextBestActionEngine();
    const context = createBaseContext({
      meetings: [
        {
          id: 'meet_old_99',
          title: 'Initial Demo',
          startTime: '2026-07-15T10:00:00Z', // 81 days ago
          attendees: ['alice@acme.com'],
          summary: 'Initial intro demo.',
          sentiment: 'neutral',
        },
      ],
      notes: [],
    });

    const actions = await engine.generateNextBestActions(context, undefined, { now: mockNow, dryRun: true });

    const reengageAction = actions.find((a) => a.actionType === 'DRAFT_OUTREACH');
    expect(reengageAction).toBeDefined();
    if (reengageAction) {
      expect(reengageAction.priority).toMatch(/URGENT|HIGH/);
      expect(reengageAction.riskLevel).toBe('L1_INTERNAL_DRAFT');
      expect(reengageAction.targetCapabilityId).toBe('crm.outreach.draft_email');
      expect(reengageAction.compensatingCapabilityId).toBe('crm.outreach.discard_draft');
    }
  });

  it('generates urgent remediation tasks for overdue commitments', async () => {
    const engine = new CrmNextBestActionEngine();
    const context = createBaseContext({
      tasks: [
        {
          id: 'task_overdue_404',
          title: 'Deliver SOC2 Compliance Packet',
          status: 'pending',
          priority: 'urgent',
          dueDate: '2026-09-15T00:00:00Z',
          assignedToName: 'Sarah Connor',
          isOverdue: true,
        },
      ],
    });

    const actions = await engine.generateNextBestActions(context, undefined, { now: mockNow, dryRun: true });

    const taskAction = actions.find((a) => a.actionType === 'CREATE_TASK');
    expect(taskAction).toBeDefined();
    if (taskAction) {
      expect(taskAction.priority).toBe('URGENT');
      expect(taskAction.riskLevel).toBe('L2_STATE_MUTATION');
      expect(taskAction.targetCapabilityId).toBe('crm.task.create');
      expect(taskAction.compensatingCapabilityId).toBe('crm.task.delete');
      expect(taskAction.explainability.blastRadius.isReversible).toBe(true);
    }
  });

  it('generates lead enrichment recommendations for data hygiene defects', async () => {
    const engine = new CrmNextBestActionEngine();
    const context = createBaseContext({
      contacts: [
        {
          id: 'con_sparse',
          name: 'Anonymous User',
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

    const actions = await engine.generateNextBestActions(context, undefined, { now: mockNow, dryRun: true });

    const hygieneAction = actions.find((a) => a.actionType === 'ENRICH_LEAD' || a.actionType === 'ASSIGN_OWNER');
    expect(hygieneAction).toBeDefined();
    if (hygieneAction) {
      expect(hygieneAction.riskLevel).toBe('L2_STATE_MUTATION');
      expect(hygieneAction.compensatingCapabilityId).toBeDefined();
    }
  });

  it('publishes domain events crm.action.proposed when dryRun is false (Rule 40)', async () => {
    const engine = new CrmNextBestActionEngine();
    const context = createBaseContext({
      deals: [
        {
          id: 'deal_stalled_event',
          title: 'Renewal Deal',
          pipelineId: 'p1',
          stageId: 's1',
          stageName: 'Proposal',
          value: 50000,
          currency: 'USD',
          probability: 40,
          ageInDays: 30,
          expectedCloseDate: null,
          isStalled: true,
        },
      ],
    });

    const publishSpy = vi.spyOn(defaultEventBus, 'publish');

    const actions = await engine.generateNextBestActions(context, undefined, { now: mockNow, dryRun: false });

    expect(actions.length).toBeGreaterThan(0);
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'crm.action.proposed',
        organizationId: 'org_enterprise_1',
      })
    );
  });

  it('supports Shadow Mode simulation with Blast Radius Report (Rule 42)', async () => {
    const engine = getCrmNextBestActionEngine();
    const context = createBaseContext();

    const result = await engine.generateNextBestActionsWithBlastRadius(context, undefined, { now: mockNow });

    expect(result.actions).toBeDefined();
    expect(result.blastRadius).toBeDefined();
    expect(result.blastRadius.mode).toBe('SHADOW_SIMULATION');
    expect(result.blastRadius.totalActionsProposed).toBe(result.actions.length);
    expect(result.blastRadius.actionsRequiringApproval).toBeGreaterThanOrEqual(0);
  });
});
