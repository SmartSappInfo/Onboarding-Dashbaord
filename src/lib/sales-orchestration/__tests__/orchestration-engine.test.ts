import { describe, it, expect } from 'vitest';
import {
  evaluatePlayTriggers,
  createPlayExecutionInstance,
  advancePlayExecution,
  evaluateRoutingAssignment,
  detectSlaBreaches,
  evaluateApprovalStatus,
  MAX_CASCADE_DEPTH,
} from '../orchestration-engine';
import type {
  SalesPlay,
  PlayExecutionInstance,
  RoutingRule,
  RepRoutingConfig,
  EscalationRule,
  ApprovalRequest,
  SalesOrchestrationGovernance,
} from '../types';

const mockGovernance: SalesOrchestrationGovernance = {
  workspaceId: 'ws-100',
  organizationId: 'org-100',
  emergencyKillSwitch: false,
  maxCascadeDepth: 3,
  globalSlaUntouchedLeadMinutes: 30,
  globalSlaStalledDealDays: 14,
  globalSlaProposalResponseHours: 48,
  managerEscalationDigestCooldownMinutes: 60,
  approvalTimeoutHours: 24,
  maxPlaysPointsPerDay: 50,
  updatedAt: '2026-09-04T00:00:00.000Z',
  updatedBy: 'admin-1',
};

const mockHotLeadPlay: SalesPlay = {
  id: 'play_hot_lead',
  workspaceId: 'ws-100',
  organizationId: 'org-100',
  title: 'Hot Lead Acceleration Play',
  description: 'Instantly routes and engages high-intent inbound leads',
  category: 'inbound_lead',
  triggers: [{ type: 'lead_created' }],
  conditions: [{ field: 'lead_score', operator: 'greater_than', value: 75 }],
  steps: [
    {
      id: 'step_1',
      stepIndex: 0,
      title: 'Initial Discovery Call',
      description: 'Call prospect within 15 minutes of inbound trigger',
      actionType: 'create_task',
      delayHours: 0,
      config: { taskTitle: 'Call Hot Inbound Lead', taskPriority: 'urgent' },
      requiredForNextStep: true,
    },
    {
      id: 'step_2',
      stepIndex: 1,
      title: 'Prepare AI Account Brief',
      description: 'Generate background research dossier',
      actionType: 'generate_ai_brief',
      delayHours: 1,
      config: {},
      requiredForNextStep: false,
    },
  ],
  exitConditions: [{ condition: 'lead_contacted' }],
  enabled: true,
  version: 1,
  allowReentry: true,
  reentryCooldownHours: 24,
  maxCascadeDepth: 3,
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
  createdBy: 'system',
};

describe('Phase 8: Sales Orchestration Pure Engine', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');

  describe('evaluatePlayTriggers', () => {
    it('matches eligible play when trigger and conditions pass', () => {
      const entity = {
        id: 'lead-1',
        name: 'Acme Corp Lead',
        type: 'lead' as const,
        leadScore: 85,
      };

      const matched = evaluatePlayTriggers(
        { triggerType: 'lead_created', entityType: 'lead', entityId: 'lead-1' },
        [mockHotLeadPlay],
        entity,
        [],
        mockGovernance,
        now
      );

      expect(matched).toHaveLength(1);
      expect(matched[0].id).toBe('play_hot_lead');
    });

    it('rejects play if condition fails (lead score too low)', () => {
      const entity = {
        id: 'lead-low',
        name: 'Cold Lead',
        type: 'lead' as const,
        leadScore: 50,
      };

      const matched = evaluatePlayTriggers(
        { triggerType: 'lead_created', entityType: 'lead', entityId: 'lead-low' },
        [mockHotLeadPlay],
        entity,
        [],
        mockGovernance,
        now
      );

      expect(matched).toHaveLength(0);
    });

    it('enforces circuit breaker (emergency kill switch) immediately', () => {
      const entity = {
        id: 'lead-1',
        name: 'Acme Corp Lead',
        type: 'lead' as const,
        leadScore: 90,
      };

      const matched = evaluatePlayTriggers(
        { triggerType: 'lead_created', entityType: 'lead', entityId: 'lead-1' },
        [mockHotLeadPlay],
        entity,
        [],
        { ...mockGovernance, emergencyKillSwitch: true },
        now
      );

      expect(matched).toHaveLength(0);
    });

    it('enforces max cascade depth to prevent infinite feedback storms', () => {
      const entity = {
        id: 'lead-1',
        name: 'Acme Corp Lead',
        type: 'lead' as const,
        leadScore: 90,
      };

      const matched = evaluatePlayTriggers(
        {
          triggerType: 'lead_created',
          entityType: 'lead',
          entityId: 'lead-1',
          cascadeDepth: MAX_CASCADE_DEPTH,
        },
        [mockHotLeadPlay],
        entity,
        [],
        mockGovernance,
        now
      );

      expect(matched).toHaveLength(0);
    });

    it('enforces re-entry cooldown debounce within 24h', () => {
      const entity = {
        id: 'lead-1',
        name: 'Acme Corp Lead',
        type: 'lead' as const,
        leadScore: 90,
      };

      const existingInstance: PlayExecutionInstance = {
        id: 'exec-1',
        workspaceId: 'ws-100',
        organizationId: 'org-100',
        playId: 'play_hot_lead',
        playTitle: 'Hot Lead Acceleration Play',
        entityType: 'lead',
        entityId: 'lead-1',
        entityName: 'Acme Corp Lead',
        currentStepIndex: 0,
        totalSteps: 2,
        status: 'active',
        assignedTo: 'rep-1',
        assignedToName: 'Sarah Rep',
        triggeredBy: 'system',
        triggerType: 'lead_created',
        cascadeDepth: 0,
        idempotencyKey: 'idemp-1',
        startedAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
        stepHistory: [],
      };

      const matched = evaluatePlayTriggers(
        { triggerType: 'lead_created', entityType: 'lead', entityId: 'lead-1' },
        [mockHotLeadPlay],
        entity,
        [existingInstance],
        mockGovernance,
        now
      );

      // Blocked because 2 hours < 24 hours cooldown
      expect(matched).toHaveLength(0);
    });
  });

  describe('advancePlayExecution', () => {
    it('advances to next step on successful step completion', () => {
      const instance = createPlayExecutionInstance(
        mockHotLeadPlay,
        { id: 'lead-1', name: 'Acme', type: 'lead' },
        'system',
        'lead_created',
        0,
        now
      );

      expect(instance.currentStepIndex).toBe(0);
      expect(instance.status).toBe('active');

      const advanced = advancePlayExecution(
        instance,
        mockHotLeadPlay,
        {
          stepId: 'step_1',
          stepTitle: 'Initial Discovery Call',
          actionType: 'create_task',
          executedAt: now.toISOString(),
          executedBy: 'rep-1',
          status: 'completed',
        },
        now
      );

      expect(advanced.currentStepIndex).toBe(1);
      expect(advanced.status).toBe('active');
      expect(advanced.stepHistory).toHaveLength(1);
    });

    it('marks play completed when final step is finished', () => {
      const instance = createPlayExecutionInstance(
        mockHotLeadPlay,
        { id: 'lead-1', name: 'Acme', type: 'lead' },
        'system',
        'lead_created',
        0,
        now
      );

      // Step 1
      const step1Done = advancePlayExecution(
        instance,
        mockHotLeadPlay,
        {
          stepId: 'step_1',
          stepTitle: 'Step 1',
          actionType: 'create_task',
          executedAt: now.toISOString(),
          executedBy: 'rep-1',
          status: 'completed',
        },
        now
      );

      // Step 2 (Final)
      const finalDone = advancePlayExecution(
        step1Done,
        mockHotLeadPlay,
        {
          stepId: 'step_2',
          stepTitle: 'Step 2',
          actionType: 'generate_ai_brief',
          executedAt: now.toISOString(),
          executedBy: 'rep-1',
          status: 'completed',
        },
        now
      );

      expect(finalDone.status).toBe('completed');
      expect(finalDone.completedAt).toBeDefined();
    });

    it('halts play with failed status when required step fails', () => {
      const instance = createPlayExecutionInstance(
        mockHotLeadPlay,
        { id: 'lead-1', name: 'Acme', type: 'lead' },
        'system',
        'lead_created',
        0,
        now
      );

      const failed = advancePlayExecution(
        instance,
        mockHotLeadPlay,
        {
          stepId: 'step_1',
          stepTitle: 'Step 1',
          actionType: 'create_task',
          executedAt: now.toISOString(),
          executedBy: 'rep-1',
          status: 'failed',
          outcomeNote: 'Prospect phone number disconnected',
        },
        now
      );

      expect(failed.status).toBe('failed');
      expect(failed.completedAt).toBeDefined();
    });
  });

  describe('evaluateRoutingAssignment', () => {
    const mockReps: RepRoutingConfig[] = [
      {
        userId: 'rep-1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        maxActiveWorkload: 20,
        currentActiveCount: 15,
        weight: 1,
        tier: 'mid_market',
        isAvailable: true,
      },
      {
        userId: 'rep-2',
        userName: 'Bob',
        userEmail: 'bob@example.com',
        maxActiveWorkload: 20,
        currentActiveCount: 5,
        weight: 2,
        tier: 'enterprise',
        isAvailable: true,
      },
    ];

    const mockRule: RoutingRule = {
      id: 'rule-1',
      workspaceId: 'ws-100',
      organizationId: 'org-100',
      name: 'Default Deal Routing',
      strategy: 'capacity_weighted',
      enabled: true,
      repRoster: mockReps,
      fallbackOwnerId: 'mgr-1',
      fallbackOwnerName: 'Sales Manager',
      tierConditions: { minDealValue: 50000 },
      updatedAt: '2026-09-04T00:00:00.000Z',
    };

    it('assigns rep with highest remaining capacity in capacity_weighted strategy', () => {
      const result = evaluateRoutingAssignment(
        { id: 'deal-1', name: 'Big Deal', type: 'deal', value: 10000 },
        mockRule,
        mockReps
      );

      expect(result.isFallback).toBe(false);
      // Bob has remaining: (20 - 5) * 2 = 30. Alice has (20 - 15) * 1 = 5. Bob wins.
      expect(result.assignedRep?.userId).toBe('rep-2');
    });

    it('routes to enterprise tier rep for high-value deal under tier_territory', () => {
      const tierRule: RoutingRule = { ...mockRule, strategy: 'tier_territory' };
      const result = evaluateRoutingAssignment(
        { id: 'deal-enterprise', name: 'Mega Corp', type: 'deal', value: 75000 },
        tierRule,
        mockReps
      );

      expect(result.isFallback).toBe(false);
      expect(result.assignedRep?.tier).toBe('enterprise');
    });

    it('falls back to manager overflow when all reps are at 100% capacity', () => {
      const overloadedReps: RepRoutingConfig[] = [
        { ...mockReps[0], currentActiveCount: 20 },
        { ...mockReps[1], currentActiveCount: 20 },
      ];

      const result = evaluateRoutingAssignment(
        { id: 'deal-1', name: 'Deal', type: 'deal', value: 5000 },
        mockRule,
        overloadedReps
      );

      expect(result.isFallback).toBe(true);
      expect(result.assignedRep).toBeNull();
      expect(result.reason).toContain('maximum workload capacity');
    });
  });

  describe('detectSlaBreaches', () => {
    const mockEscalationRules: EscalationRule[] = [
      {
        id: 'rule-lead-sla',
        workspaceId: 'ws-100',
        organizationId: 'org-100',
        name: 'Untouched Lead SLA (30 min)',
        triggerCondition: 'lead_untouched',
        thresholdHours: 0.5, // 30 minutes
        severity: 'high',
        notifyRoles: ['sales_manager'],
        autoReassign: true,
        cooldownMinutes: 60,
        enabled: true,
      },
      {
        id: 'rule-stalled-deal',
        workspaceId: 'ws-100',
        organizationId: 'org-100',
        name: 'Stalled Deal SLA (14 days)',
        triggerCondition: 'deal_stalled',
        thresholdHours: 336, // 14 days
        severity: 'moderate',
        notifyRoles: ['sales_manager', 'account_executive'],
        autoReassign: false,
        cooldownMinutes: 60,
        enabled: true,
      },
      {
        id: 'rule-single-thread',
        workspaceId: 'ws-100',
        organizationId: 'org-100',
        name: 'Single Threaded Deal Risk',
        triggerCondition: 'single_threaded_risk',
        thresholdHours: 0,
        severity: 'critical',
        notifyRoles: ['sales_manager'],
        autoReassign: false,
        cooldownMinutes: 60,
        enabled: true,
      },
    ];

    it('flags untouched lead exceeding 30 minute threshold', () => {
      const created45mAgo = new Date(now.getTime() - 45 * 60 * 1000).toISOString();
      const lead = {
        id: 'lead-untouched',
        name: 'Untouched Lead',
        type: 'lead' as const,
        createdAt: created45mAgo,
      };

      const breaches = detectSlaBreaches(lead, mockEscalationRules, now);
      expect(breaches).toHaveLength(1);
      expect(breaches[0].ruleId).toBe('rule-lead-sla');
      expect(breaches[0].severity).toBe('high');
    });

    it('flags high-value deal with single stakeholder risk', () => {
      const deal = {
        id: 'deal-single-thread',
        name: 'Enterprise Contract',
        type: 'deal' as const,
        value: 25000,
        stakeholderCount: 1,
      };

      const breaches = detectSlaBreaches(deal, mockEscalationRules, now);
      expect(breaches).toHaveLength(1);
      expect(breaches[0].ruleId).toBe('rule-single-thread');
      expect(breaches[0].severity).toBe('critical');
    });
  });

  describe('evaluateApprovalStatus', () => {
    const mockApproval: ApprovalRequest = {
      id: 'appr-1',
      workspaceId: 'ws-100',
      organizationId: 'org-100',
      entityType: 'deal',
      entityId: 'deal-10',
      entityName: 'Mega Enterprise',
      dealValue: 100000,
      requestType: 'discount_override',
      requestedBy: 'rep-1',
      requestedByName: 'Alice Rep',
      requestedAt: now.toISOString(),
      details: {
        discountPercent: 25,
        originalAmount: 100000,
        requestedAmount: 75000,
        justification: 'Competitor offering 20% discount',
      },
      approverRole: 'sales_manager',
      status: 'pending',
      expiresAt: new Date(now.getTime() + 48 * 3600 * 1000).toISOString(),
      autoEscalateAt: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
    };

    it('allows manager to approve pending request with note', () => {
      const { updatedRequest, error } = evaluateApprovalStatus(
        mockApproval,
        'approve',
        'mgr-1',
        'Bob Manager',
        'sales_manager',
        'Approved discount for strategic account',
        now
      );

      expect(error).toBeUndefined();
      expect(updatedRequest.status).toBe('approved');
      expect(updatedRequest.decisionByName).toBe('Bob Manager');
    });

    it('rejects unauthorized role attempting to approve', () => {
      const { updatedRequest, error } = evaluateApprovalStatus(
        mockApproval,
        'approve',
        'rep-2',
        'Eve Rep',
        // @ts-expect-error testing unauthorized role
        'sales_rep',
        'I approve myself',
        now
      );

      expect(error).toContain('Unauthorized');
      expect(updatedRequest.status).toBe('pending');
    });

    it('escalates request to VP of Sales', () => {
      const { updatedRequest, error } = evaluateApprovalStatus(
        mockApproval,
        'escalate',
        'mgr-1',
        'Bob Manager',
        'sales_manager',
        'Discount exceeds manager threshold (>20%)',
        now
      );

      expect(error).toBeUndefined();
      expect(updatedRequest.status).toBe('escalated');
      expect(updatedRequest.approverRole).toBe('vp_sales');
    });
  });
});
