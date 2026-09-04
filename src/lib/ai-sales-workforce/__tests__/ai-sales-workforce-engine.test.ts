import { describe, it, expect } from 'vitest';
import {
  evaluateAgentAutonomyDecision,
  computeNextBestActionPriority,
  detectCrmHygieneAnomalies,
  evaluateAiApprovalDecision,
  calculateAiFleetMetrics,
  type DealHygieneContext,
  type ContactHygieneContext,
} from '../ai-sales-workforce-engine';
import type {
  AiAgentProfile,
  AiWorkforceGovernancePolicy,
  AiSalesApproval,
  AiExecutionAuditDoc,
  AiSalesRecommendation,
} from '../types';

const mockGovernance: AiWorkforceGovernancePolicy = {
  id: 'gov_1',
  workspaceId: 'ws_test',
  organizationId: 'org_test',
  emergencyKillSwitch: false,
  maxCascadeDepth: 3,
  defaultAutonomyLevels: {
    prioritization: 2,
    deal_intelligence: 2,
    coaching: 1,
    conversation: 1,
    crm_hygiene: 3,
    workload: 1,
    forecast: 2,
    manager: 1,
  },
  minConfidenceForAutonomous: 85,
  minConfidenceForPrepare: 60,
  sensitiveActionsRequireApproval: true,
  tokenMonthlyBudget: 1000000,
  tokensConsumedThisMonth: 150000,
  updatedAt: new Date().toISOString(),
};

const mockAgent: AiAgentProfile = {
  id: 'agent_prioritization',
  workspaceId: 'ws_test',
  organizationId: 'org_test',
  type: 'prioritization',
  name: 'Sapphire Prioritizer',
  roleTitle: 'Chief Prioritization Agent',
  avatar: 'Bot',
  description: 'Ranks high-impact actions',
  status: 'active',
  currentAutonomyLevel: 2,
  defaultModel: 'googleai/gemini-1.5-flash',
  accuracyScore: 94,
  totalExecutions: 142,
};

describe('AI Sales Workforce Engine (Phase 9)', () => {
  describe('evaluateAgentAutonomyDecision', () => {
    it('suppresses low-confidence recommendations (< 60%) to prevent noise', () => {
      const res = evaluateAgentAutonomyDecision({
        agentProfile: { ...mockAgent, currentAutonomyLevel: 4 },
        governance: mockGovernance,
        proposedAction: {
          actionType: 'task_creation',
          confidenceScore: 54, // Below 60%
        },
      });

      expect(res.decision).toBe('suppress');
      expect(res.effectiveAutonomyLevel).toBe(0);
      expect(res.reason).toContain('below minimum preparation threshold');
    });

    it('freezes autonomous execution when Emergency Kill Switch is active', () => {
      const res = evaluateAgentAutonomyDecision({
        agentProfile: { ...mockAgent, currentAutonomyLevel: 4 },
        governance: { ...mockGovernance, emergencyKillSwitch: true },
        proposedAction: {
          actionType: 'stage_advance',
          confidenceScore: 95,
        },
      });

      expect(res.decision).toBe('recommend');
      expect(res.effectiveAutonomyLevel).toBe(1);
      expect(res.reason).toContain('Emergency Kill Switch is active');
    });

    it('forces Level 3 Human Approval for sensitive commercial actions even at Level 4 Autonomy', () => {
      const res = evaluateAgentAutonomyDecision({
        agentProfile: { ...mockAgent, currentAutonomyLevel: 4 },
        governance: mockGovernance,
        proposedAction: {
          actionType: 'discount_override',
          isSensitive: true,
          confidenceScore: 98,
        },
      });

      expect(res.decision).toBe('request_approval');
      expect(res.effectiveAutonomyLevel).toBe(3);
      expect(res.reason).toContain('Sensitive commercial action detected');
    });

    it('returns recommend for Level 1 agent', () => {
      const res = evaluateAgentAutonomyDecision({
        agentProfile: { ...mockAgent, currentAutonomyLevel: 1 },
        governance: mockGovernance,
        proposedAction: {
          actionType: 'buyer_outreach',
          confidenceScore: 88,
        },
      });

      expect(res.decision).toBe('recommend');
      expect(res.effectiveAutonomyLevel).toBe(1);
    });

    it('returns prepare draft for Level 2 agent', () => {
      const res = evaluateAgentAutonomyDecision({
        agentProfile: { ...mockAgent, currentAutonomyLevel: 2 },
        governance: mockGovernance,
        proposedAction: {
          actionType: 'email_draft',
          confidenceScore: 82,
        },
      });

      expect(res.decision).toBe('prepare');
      expect(res.effectiveAutonomyLevel).toBe(2);
    });

    it('executes autonomously at Level 4 when confidence >= 85%', () => {
      const res = evaluateAgentAutonomyDecision({
        agentProfile: { ...mockAgent, currentAutonomyLevel: 4 },
        governance: mockGovernance,
        proposedAction: {
          actionType: 'schedule_followup',
          confidenceScore: 92,
        },
      });

      expect(res.decision).toBe('execute_autonomous');
      expect(res.effectiveAutonomyLevel).toBe(4);
    });

    it('falls back to prepare draft at Level 4 when confidence is between 60% and 84%', () => {
      const res = evaluateAgentAutonomyDecision({
        agentProfile: { ...mockAgent, currentAutonomyLevel: 4 },
        governance: mockGovernance,
        proposedAction: {
          actionType: 'schedule_followup',
          confidenceScore: 78,
        },
      });

      expect(res.decision).toBe('prepare');
      expect(res.effectiveAutonomyLevel).toBe(2);
      expect(res.reason).toContain('below autonomous threshold');
    });
  });

  describe('computeNextBestActionPriority', () => {
    it('scores high-intent enterprise deal with inactivity as critical priority', () => {
      const res = computeNextBestActionPriority({
        dealValue: 60000,
        buyerSignalStrength: 'high',
        daysSinceLastActivity: 12,
        confidenceScore: 90,
      });

      expect(res.priority).toBe('critical');
      expect(res.compositeScore).toBeGreaterThanOrEqual(75);
    });

    it('scores low-intent small deal as low priority', () => {
      const res = computeNextBestActionPriority({
        dealValue: 1500,
        buyerSignalStrength: 'low',
        daysSinceLastActivity: 1,
        confidenceScore: 65,
      });

      expect(res.priority).toBe('low');
      expect(res.compositeScore).toBeLessThan(35);
    });
  });

  describe('detectCrmHygieneAnomalies', () => {
    const fixedNow = new Date('2026-09-04T12:00:00Z');

    it('detects stale deals untouched for > 14 days', () => {
      const deals: DealHygieneContext[] = [
        {
          id: 'deal_stale',
          name: 'Acme Renewal',
          value: 25000,
          stage: 'Proposal',
          status: 'open',
          lastActivityAt: '2026-08-10T12:00:00Z', // 25 days ago
          nextStepDate: '2026-09-10T12:00:00Z',
          nextStepDescription: 'Follow up on MSA',
          stakeholderCount: 2,
        },
      ];

      const anomalies = detectCrmHygieneAnomalies({
        deals,
        contacts: [],
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        now: fixedNow,
      });

      const staleIssue = anomalies.find((a) => a.issueType === 'stale_deal');
      expect(staleIssue).toBeDefined();
      expect(staleIssue?.entityId).toBe('deal_stale');
    });

    it('detects missing next steps on active deals', () => {
      const deals: DealHygieneContext[] = [
        {
          id: 'deal_nostep',
          name: 'Beta Pilot',
          value: 12000,
          stage: 'Discovery',
          status: 'open',
          lastActivityAt: '2026-09-03T12:00:00Z',
          stakeholderCount: 2,
        },
      ];

      const anomalies = detectCrmHygieneAnomalies({
        deals,
        contacts: [],
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        now: fixedNow,
      });

      const stepIssue = anomalies.find((a) => a.issueType === 'missing_next_step');
      expect(stepIssue).toBeDefined();
      expect(stepIssue?.fieldName).toBe('nextStepDate');
    });

    it('flags high-value single-threaded deal ($10k+ with <= 1 stakeholder)', () => {
      const deals: DealHygieneContext[] = [
        {
          id: 'deal_single',
          name: 'Enterprise License',
          value: 75000,
          stage: 'Negotiation',
          status: 'open',
          lastActivityAt: '2026-09-02T12:00:00Z',
          nextStepDate: '2026-09-05T12:00:00Z',
          nextStepDescription: 'Review terms',
          stakeholderCount: 1, // High risk single-threaded
        },
      ];

      const anomalies = detectCrmHygieneAnomalies({
        deals,
        contacts: [],
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        now: fixedNow,
      });

      const threadIssue = anomalies.find((a) => a.issueType === 'single_threaded');
      expect(threadIssue).toBeDefined();
      expect(threadIssue?.severity).toBe('critical');
    });

    it('flags unassigned hot lead (score >= 70)', () => {
      const contacts: ContactHygieneContext[] = [
        {
          id: 'lead_hot',
          name: 'Dr. Jane Smith',
          email: 'jane@clinic.org',
          leadScore: 85,
          createdAt: '2026-09-04T08:00:00Z',
        },
      ];

      const anomalies = detectCrmHygieneAnomalies({
        deals: [],
        contacts,
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        now: fixedNow,
      });

      const leadIssue = anomalies.find((a) => a.issueType === 'unassigned_lead');
      expect(leadIssue).toBeDefined();
      expect(leadIssue?.entityName).toBe('Dr. Jane Smith');
    });
  });

  describe('evaluateAiApprovalDecision', () => {
    const pendingApproval: AiSalesApproval = {
      id: 'app_1',
      workspaceId: 'ws_test',
      organizationId: 'org_test',
      agentType: 'crm_hygiene',
      actionType: 'batch_stage_repair',
      entityType: 'deal',
      entityId: 'deal_1',
      entityName: 'Cloud Deal',
      originalState: { stage: 'Discovery' },
      proposedState: { stage: 'Proposal' },
      reason: 'Proposal document signed',
      confidenceScore: 92,
      requestedBy: 'CleanSweep',
      status: 'pending',
      createdAt: '2026-09-04T10:00:00Z',
    };

    it('approves a pending request successfully', () => {
      const res = evaluateAiApprovalDecision({
        approval: pendingApproval,
        decision: 'approved',
        reviewerId: 'manager_1',
        reviewNote: 'Approved stage advance',
      });

      expect(res.success).toBe(true);
      expect(res.updatedApproval?.status).toBe('approved');
      expect(res.updatedApproval?.reviewedBy).toBe('manager_1');
    });

    it('fails when attempting to re-evaluate an already resolved approval', () => {
      const resolved = { ...pendingApproval, status: 'approved' as const };
      const res = evaluateAiApprovalDecision({
        approval: resolved,
        decision: 'rejected',
        reviewerId: 'manager_1',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('already resolved');
    });
  });

  describe('calculateAiFleetMetrics', () => {
    it('accurately calculates fleet metrics, time saved, and health index', () => {
      const executions: AiExecutionAuditDoc[] = [
        {
          id: 'ex_1',
          workspaceId: 'ws_test',
          organizationId: 'org_test',
          agentType: 'prioritization',
          actionType: 'task',
          autonomyLevel: 4,
          confidenceScore: 92,
          durationMs: 450,
          modelUsed: 'gemini-1.5-flash',
          tokensUsed: 800,
          status: 'success',
          timestamp: '2026-09-04T10:00:00Z',
        },
        {
          id: 'ex_2',
          workspaceId: 'ws_test',
          organizationId: 'org_test',
          agentType: 'crm_hygiene',
          actionType: 'repair',
          autonomyLevel: 4,
          confidenceScore: 89,
          durationMs: 320,
          modelUsed: 'gemini-1.5-flash',
          tokensUsed: 650,
          status: 'success',
          timestamp: '2026-09-04T10:05:00Z',
        },
      ];

      const approvals: AiSalesApproval[] = [
        {
          id: 'app_1',
          workspaceId: 'ws_test',
          organizationId: 'org_test',
          agentType: 'deal_intelligence',
          actionType: 'discount',
          entityType: 'deal',
          entityId: 'deal_1',
          entityName: 'Big Deal',
          originalState: {},
          proposedState: {},
          reason: 'VIP',
          confidenceScore: 88,
          requestedBy: 'Argus',
          status: 'approved',
          createdAt: '2026-09-04T09:00:00Z',
        },
      ];

      const recommendations: AiSalesRecommendation[] = [
        {
          id: 'rec_1',
          workspaceId: 'ws_test',
          organizationId: 'org_test',
          agentType: 'prioritization',
          agentName: 'Sapphire',
          priority: 'high',
          confidenceScore: 88,
          title: 'Call Sunrise Academy',
          description: 'Proposal opened 4x',
          rationale: 'High intent spike',
          entityType: 'deal',
          entityId: 'deal_1',
          entityName: 'Sunrise Deal',
          suggestedAction: { actionType: 'call', label: 'Call Rep' },
          status: 'pending',
          createdAt: '2026-09-04T09:30:00Z',
        },
      ];

      const metrics = calculateAiFleetMetrics({
        agents: [mockAgent],
        executions,
        approvals,
        recommendations,
      });

      expect(metrics.autonomousActionsTotal).toBe(2);
      expect(metrics.hoursSavedEstimate).toBe(0.7); // 2 * 0.35
      expect(metrics.humanApprovalRate).toBe(100);
      expect(metrics.activeRecommendationsCount).toBe(1);
      expect(metrics.healthIndex).toBe(94);
      expect(metrics.activeAgentsCount).toBe(1);
    });
  });
});
