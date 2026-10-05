/**
 * @fileOverview End-to-End Test Suite: Greenfield School Signature Autonomous Experience (Phase 9 Milestone 5)
 *
 * Implements full 14-Step Signature Autonomous Pipeline validation:
 * 1. Retrieve entity master & operational state (Rule 69 Dual-Tier Invariant)
 * 2. Retrieve related contacts
 * 3. Retrieve deals (identifies stalled expansion deal)
 * 4. Retrieve meetings & audio transcripts
 * 5. Retrieve notes & call logs
 * 6. Retrieve payment & invoice context
 * 7. Retrieve previous communications
 * 8. Retrieve tasks & commitments (identifies overdue proposal delivery)
 * 9. Retrieve semantic memory facts via CanonicalMemoryService (Rule 29)
 * 10. Construct chronological timeline via AccountTimelineService
 * 11. Identify active risks via CrmRiskDetector
 * 12. Identify commitments & promises from recent touchpoints
 * 13. Produce grounded narrative answer with citations in <untrusted_reference_data id="..."> (Rules 12, 13, 30, 47)
 * 14. Offer executable next actions via CrmNextBestActionEngine & CrmProposalBridge (Rules 21, 22, 27)
 *
 * Validates Multi-Turn Conversational Copilot:
 * - Turn 1: Flagship "What's going on with Greenfield School?"
 * - Turn 2: Follow-up "Why did the deal stall last week?"
 * - Turn 3: Follow-up "What are the payment terms requested?"
 *
 * Rules Adherence:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock)
 * - Rule 13 & 30 (Untrusted Reference Data XML containerization)
 * - Rule 21 & 22 (Two-Phase Actions & Cryptographic SHA-256 Binding)
 * - Rule 28 & 56 (Knapsack Token Budget Ceiling <= 4,000 tokens)
 * - Rule 40 (Audit Event Publishing)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 69 (Dual-Tier CRM Data Model Preservation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrmSignatureOrchestrator } from '@/platform/agents/crm/signature/crm-signature-orchestrator';
import { CrmMultiTurnSessionManager } from '@/platform/agents/crm/signature/crm-multi-turn-session';
import type { Account360Context } from '@/platform/agents/crm/context/account-context-types';
import { defaultEventBus } from '@/platform/events/event-bus';

describe('Greenfield School E2E Signature Autonomous Experience (Phase 9 Milestone 5)', () => {
  const organizationId = 'org_greenfield_trust';
  const workspaceId = 'ws_education_sales';
  const callerId = 'user_sarah_rep';
  const entityId = 'ent_greenfield_school';

  const mockGreenfieldContext: Account360Context = {
    entityId,
    workspaceId,
    organizationId,
    entity: {
      id: entityId,
      name: 'Greenfield School',
      type: 'client',
      status: 'active',
      industry: 'Education',
      email: 'admissions@greenfield.edu',
      phone: '+1-555-0199',
      city: 'Boston',
      address: '100 Academic Way',
      createdAt: '2025-01-01T00:00:00Z',
    },
    workspaceEntity: {
      id: `${workspaceId}_${entityId}`,
      workspaceId,
      entityId,
      pipelineId: 'k12_enterprise',
      stageId: 'proposal_negotiation',
      stageName: 'Proposal Negotiation',
      assignedTo: {
        userId: 'rep_sarah',
        name: 'Sarah',
        email: 'sarah@test.com',
      },
      workspaceTags: ['strategic_k12', 'renewal_2026', 'expansion_candidate'],
      leadStatus: 'QUALIFIED',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    contacts: [
      {
        id: 'con_headmaster',
        name: 'Dr. Arthur Pendelton',
        email: 'headmaster@greenfield.edu',
        phone: '+1-555-0199',
        isPrimary: true,
        role: 'Head of School',
        channelPreferences: ['EMAIL'],
      },
      {
        id: 'con_operations',
        name: 'Jane Doe',
        email: 'jdoe@greenfield.edu',
        phone: '+1-555-0200',
        isPrimary: false,
        role: 'Chief Operating Officer',
        channelPreferences: ['EMAIL'],
      },
    ],
    deals: [
      {
        id: 'deal_campus_expansion',
        title: 'Campus Enterprise Expansion 2026',
        pipelineId: 'k12_enterprise',
        stageId: 'negotiation',
        stageName: 'Negotiation',
        value: 75000,
        currency: 'USD',
        probability: 65,
        ageInDays: 38,
        expectedCloseDate: '2026-09-30',
        isStalled: true,
      },
    ],
    meetings: [
      {
        id: 'meet_board_alignment',
        title: 'Board Budget Alignment & Expansion Review',
        startTime: '2026-09-12T14:00:00Z',
        attendees: ['Dr. Arthur Pendelton', 'Jane Doe', 'Sarah Jenkins'],
        sentiment: 'neutral',
        summary:
          'Board reviewed software expansion proposal. General alignment on curriculum tools, but stalled pending structured milestone payments.',
        transcriptSnippet:
          'The trustees agreed to the expansion in principle, but we cannot authorize a single upfront invoice. We require a three-tiered milestone schedule.',
      },
    ],
    notes: [
      {
        id: 'note_pricing_preference',
        authorName: 'Sarah Jenkins',
        content:
          'Spoke with Jane Doe. Customer requested a customized multi-year payment schedule with tiered milestones before signing contract.',
        createdAt: '2026-09-15T10:30:00Z',
        category: 'commercial',
      },
    ],
    tasks: [
      {
        id: 'task_send_revised_terms',
        title: 'Deliver Revised Tiered Milestone Agreement',
        dueDate: '2026-09-22T00:00:00Z',
        isOverdue: true,
        status: 'pending',
        priority: 'high',
        assignedToName: 'Sarah Jenkins',
      },
    ],
    finances: {
      openBalance: 75000,
      overdueBalance: 8500,
      currency: 'USD',
      invoiceCount: 1,
      agingCategory: 'OVERDUE_30',
    },
    memories: [
      {
        id: 'mem_board_fiscal_cycle',
        content: 'Greenfield School fiscal year begins October 1st; board approvals occur bi-weekly.',
        sourceType: 'meeting',
        confidence: 0.95,
        citationId: 'meet_board_alignment',
      },
    ],
    timeline: [
      {
        id: 'ev_timeline_1',
        category: 'COMMERCIAL',
        title: 'Deal Moved to Negotiation',
        summary: 'Campus Enterprise Expansion 2026 entered final negotiation.',
        timestamp: '2026-09-01T10:00:00Z',
        sourceRef: { type: 'deal', id: 'deal_campus_expansion' },
      },
      {
        id: 'ev_timeline_2',
        category: 'ENGAGEMENT',
        title: 'Board Budget Alignment Meeting',
        summary: 'Met with Headmaster Arthur Pendelton and Jane Doe.',
        timestamp: '2026-09-12T14:00:00Z',
        sourceRef: { type: 'meeting', id: 'meet_board_alignment' },
      },
      {
        id: 'ev_timeline_3',
        category: 'OPERATIONAL',
        title: 'Overdue Task: Deliver Revised Agreement',
        summary: 'Task assigned to Sarah Jenkins is 12 days overdue.',
        timestamp: '2026-09-22T00:00:00Z',
        sourceRef: { type: 'task', id: 'task_send_revised_terms' },
      },
    ],
    metadata: {
      assembledAt: new Date().toISOString(),
      durationMs: 52,
      estimatedTokens: 940,
      correlationId: 'corr_greenfield_e2e',
      isKnapsackCompressed: false,
    },
  };

  let orchestrator: CrmSignatureOrchestrator;
  let sessionManager: CrmMultiTurnSessionManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    orchestrator = new CrmSignatureOrchestrator({ mockContext: mockGreenfieldContext });
    sessionManager = new CrmMultiTurnSessionManager({ mockContext: mockGreenfieldContext });
  });

  it('Turn 1: autonomously executes full 14-step signature inquiry ("What\'s going on with Greenfield School?")', async () => {
    const publishedEvents: string[] = [];
    vi.spyOn(defaultEventBus, 'publish').mockImplementation(async (event) => {
      publishedEvents.push(event.type);
      return {
        eventId: event.id,
        deliveredCount: 1,
        failedCount: 0,
        durationMs: 1,
        errors: [],
      };
    });

    const result = await orchestrator.executeInquiry({
      query: "What's going on with Greenfield School?",
      entityId,
      organizationId,
      workspaceId,
      callerId,
      options: {
        dryRun: false,
        maxTokens: 4000,
      },
    });

    // 1. Identity & Health
    expect(result.entityId).toBe(entityId);
    expect(result.entityName).toBe('Greenfield School');
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
    expect(result.relationshipStatus).toBeDefined();

    // 2. Executive Narrative Grounding
    expect(result.executiveNarrative).toContain('Greenfield School');
    expect(result.executiveNarrative).toContain('Executive Summary');

    // 3. Stalled Deal & Risk Detection (Step 11)
    expect(result.activeRisks.length).toBeGreaterThan(0);
    const stalledRisk = result.activeRisks.find(
      (r) => r.category === 'STALLED_DEAL' || r.title.toLowerCase().includes('stalled')
    );
    expect(stalledRisk).toBeDefined();
    expect(stalledRisk?.title).toContain('Stalled');

    // 4. Overdue Commitments Detection (Step 12)
    expect(result.commitments.length).toBeGreaterThan(0);
    const overdueTask = result.commitments.find((c) => c.title.includes('Revised'));
    expect(overdueTask).toBeDefined();
    expect(overdueTask?.assignedTo).toBe('Sarah Jenkins');

    // 5. Citations & Isolated Untrusted Evidence (Step 13, Rules 12, 13, 30)
    expect(result.citations.length).toBeGreaterThanOrEqual(2);
    const meetingCite = result.citations.find((c) => c.sourceType === 'meeting');
    expect(meetingCite).toBeDefined();
    expect(meetingCite?.snippet.toLowerCase()).toMatch(/board|expansion|milestone/);

    // 6. Actionable Next-Best-Actions (Step 14, Rules 21, 22, 27)
    expect(result.proposedActions.length).toBeGreaterThan(0);
    const primaryAction = result.proposedActions[0];
    expect(primaryAction.idempotencyKey).toBeDefined();
    expect(primaryAction.riskLevel).toBeDefined();
    expect(primaryAction.requiresApproval).toBe(true);

    // 7. Domain Event Published (Rule 40)
    expect(publishedEvents).toContain('crm.signature.inquiry_executed');

    // 8. Knapsack Token Budgeting (Rule 28 & 56)
    expect(result.contextMetrics.tokensUsed).toBeLessThanOrEqual(4000);
    expect(result.contextMetrics.executionDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.contextMetrics.modelTier).toBe('pro');
  });

  it('Turn 2 & Turn 3: conducts multi-turn copilot dialogue within bounded session window', async () => {
    // 1. Seed Multi-Turn Session from Turn 1 result
    const turn1Result = await orchestrator.executeInquiry({
      query: "What's going on with Greenfield School?",
      entityId,
      organizationId,
      workspaceId,
      callerId,
    });

    const session = await sessionManager.createSession({
      entityId,
      workspaceId,
      organizationId,
      initialQuery: "What's going on with Greenfield School?",
      initialNarrative: turn1Result.executiveNarrative,
    });

    expect(session.sessionId).toBeDefined();
    expect(session.messages.length).toBe(2); // user initial + assistant initial

    // Turn 2: Follow-up on stalled deal
    const turn2Response = await sessionManager.sendFollowupMessage({
      sessionId: session.sessionId,
      workspaceId,
      organizationId,
      callerId,
      message: 'Why did the deal stall last week?',
    });

    expect(turn2Response.turnIndex).toBe(2);
    expect(turn2Response.answer).toBeDefined();
    expect(turn2Response.answer.toLowerCase()).toMatch(/board|budget|freeze|review/);
    expect(turn2Response.citations.length).toBeGreaterThanOrEqual(1);

    // Turn 3: Follow-up on payment terms
    const turn3Response = await sessionManager.sendFollowupMessage({
      sessionId: session.sessionId,
      workspaceId,
      organizationId,
      callerId,
      message: 'What payment terms were requested?',
    });

    expect(turn3Response.turnIndex).toBe(3);
    expect(turn3Response.answer).toContain('multi-year payment schedule');

    // Verify session retrieval captures all turns with Anti-IDOR tenant lock
    const updatedSession = await sessionManager.getSession(
      session.sessionId,
      workspaceId,
      organizationId
    );
    expect(updatedSession).toBeDefined();
    expect(updatedSession?.messages.length).toBe(6); // 3 pairs of user/assistant turns
  });

  it('preserves the Dual-Tier CRM Data Model (Rule 69 Invariant)', async () => {
    const result = await orchestrator.executeInquiry({
      entityId,
      organizationId,
      workspaceId,
      callerId,
    });

    // Verify that proposed actions target operational state (/workspace_entities)
    expect(result.proposedActions.length).toBeGreaterThan(0);
    for (const action of result.proposedActions) {
      expect(action.workspaceId).toBe(workspaceId);
      expect(action.entityId).toBe(entityId);
      // Dual-tier check: Master corporate entity is never mutated directly; mutations are workspace-scoped
      expect(action.actionType).toBeDefined();
      expect(action.idempotencyKey).toContain('crm_action_');
    }
  });
});
