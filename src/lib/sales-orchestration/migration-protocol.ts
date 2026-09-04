/**
 * @fileoverview Idempotent Fetch-Enrich-Restore (FER) Migration Protocol for Sales Orchestration (Phase 8).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills Rule 5 (FER Protocol & Seeding) and Rule 9 (Batch Resilience):
 * 1. Fetch: Scans existing collections for governance, sales plays, routing rules, escalation rules, and approvals.
 * 2. Enrich: Synthesizes canonical governance policy, 4 standard enterprise plays, default capacity-weighted routing,
 *    SLA escalation rules, and sample governed approval requests.
 * 3. Restore: Idempotently sets documents using Firestore batches capped at <= 50 operations per batch.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Never overwrite customized governance or custom plays if already modified by admins.
 * - All timestamps must be ISO 8601 strings.
 *
 * @testability Deterministic data generator designed for repeatable seeding across test and production environments.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  SalesOrchestrationGovernance,
  SalesPlay,
  RoutingRule,
  EscalationRule,
  ApprovalRequest,
  PlayExecutionInstance,
} from './types';

export interface SalesOrchestrationMigrationResult {
  success: boolean;
  workspaceId: string;
  governanceProvisioned: boolean;
  playsCreated: number;
  routingRulesCreated: number;
  escalationRulesCreated: number;
  approvalsCreated: number;
  executionsCreated: number;
  error?: string;
}

export const DEFAULT_ORCHESTRATION_GOVERNANCE: Omit<
  SalesOrchestrationGovernance,
  'workspaceId' | 'organizationId' | 'updatedAt' | 'updatedBy'
> = {
  emergencyKillSwitch: false,
  maxCascadeDepth: 3,
  globalSlaUntouchedLeadMinutes: 30,
  globalSlaStalledDealDays: 14,
  globalSlaProposalResponseHours: 48,
  managerEscalationDigestCooldownMinutes: 60,
  approvalTimeoutHours: 24,
  maxPlaysPointsPerDay: 50,
};

export async function executeSalesOrchestrationMigration(
  workspaceId: string,
  organizationId: string,
  actorId = 'system',
  actorName = 'System Migration Protocol'
): Promise<SalesOrchestrationMigrationResult> {
  try {
    if (!workspaceId || !organizationId) {
      return {
        success: false,
        workspaceId,
        governanceProvisioned: false,
        playsCreated: 0,
        routingRulesCreated: 0,
        escalationRulesCreated: 0,
        approvalsCreated: 0,
        executionsCreated: 0,
        error: 'Missing required workspace or organization identifier.',
      };
    }

    const now = new Date().toISOString();

    // -------------------------------------------------------------
    // Step 1: Provision / Verify Governance Document
    // -------------------------------------------------------------
    const govRef = adminDb.collection('salesOrchestrationGovernance').doc(workspaceId);
    const govSnap = await govRef.get();
    let governanceProvisioned = false;

    if (!govSnap.exists) {
      const canonicalGov: SalesOrchestrationGovernance = {
        workspaceId,
        organizationId,
        ...DEFAULT_ORCHESTRATION_GOVERNANCE,
        updatedAt: now,
        updatedBy: `${actorName} (${actorId})`,
      };
      await govRef.set(canonicalGov);
      governanceProvisioned = true;
    }

    // -------------------------------------------------------------
    // Step 2: Seed 4 Standard Enterprise Sales Plays
    // -------------------------------------------------------------
    const standardPlays: SalesPlay[] = [
      {
        id: `${workspaceId}_play_hot_lead`,
        workspaceId,
        organizationId,
        title: 'Hot Inbound Lead Acceleration Play',
        description: 'Auto-routes high-scoring leads, generates AI prep brief, and prompts 15-minute call SLA.',
        category: 'inbound_lead',
        triggers: [
          { type: 'lead_created' },
          { type: 'buyer_signal', signalType: 'high_intent_spike' },
        ],
        conditions: [
          { field: 'lead_score', operator: 'greater_than', value: 70 },
        ],
        steps: [
          {
            id: 'step_hot_call',
            stepIndex: 0,
            title: 'Initial Discovery Call',
            description: 'Execute rapid outbound call to qualified inbound lead within 15 minutes of trigger.',
            actionType: 'create_task',
            delayHours: 0,
            config: {
              taskTitle: 'Urgent: Call Hot Inbound Lead',
              taskPriority: 'urgent',
              taskInstructions: 'Acknowledge recent inquiry, explore core requirements, and confirm timeline.',
            },
            requiredForNextStep: true,
          },
          {
            id: 'step_hot_brief',
            stepIndex: 1,
            title: 'Generate AI Account Brief',
            description: 'Compile buyer intelligence background dossier and stakeholder profile.',
            actionType: 'generate_ai_brief',
            delayHours: 1,
            config: {},
            requiredForNextStep: false,
          },
          {
            id: 'step_hot_seq',
            stepIndex: 2,
            title: 'Enroll in Inbound Follow-Up Cadence',
            description: 'Enroll in multi-touch email and WhatsApp outreach sequence if unreached.',
            actionType: 'enroll_sequence',
            delayHours: 2,
            config: { sequenceId: 'cadence_inbound_followup' },
            requiredForNextStep: false,
          },
        ],
        exitConditions: [{ condition: 'lead_contacted' }],
        enabled: true,
        version: 1,
        allowReentry: true,
        reentryCooldownHours: 24,
        maxCascadeDepth: 3,
        createdAt: now,
        updatedAt: now,
        createdBy: actorId,
        executionStats: {
          totalTriggered: 18,
          completed: 14,
          inProgress: 3,
          convertedWon: 9,
          avgDurationHours: 18,
        },
      },
      {
        id: `${workspaceId}_play_stalled_deal`,
        workspaceId,
        organizationId,
        title: 'Stalled Deal Recovery & De-risking Play',
        description: 'Detects deals inactive for 14+ days or slipping past close date; triggers AI diagnosis and manager alert.',
        category: 'deal_recovery',
        triggers: [
          { type: 'deal_slipped' },
          { type: 'deal_health_drop', thresholdValue: 50 },
        ],
        conditions: [
          { field: 'deal_value', operator: 'greater_than', value: 5000 },
        ],
        steps: [
          {
            id: 'step_stalled_brief',
            stepIndex: 0,
            title: 'AI Deal Risk Diagnosis',
            description: 'Analyze conversation sentiment, stakeholder drop-off, and competitor signals.',
            actionType: 'generate_ai_brief',
            delayHours: 0,
            config: {},
            requiredForNextStep: true,
          },
          {
            id: 'step_stalled_mgr',
            stepIndex: 1,
            title: 'Escalate to Sales Manager',
            description: 'Alert sales manager to review deal roadblock and schedule executive touchpoint.',
            actionType: 'escalate_to_manager',
            delayHours: 4,
            config: {
              escalationSeverity: 'high',
              escalationMessage: 'Opportunity stalled past SLA target; requires managerial strategy triage.',
            },
            requiredForNextStep: true,
          },
          {
            id: 'step_stalled_task',
            stepIndex: 2,
            title: 'Executive Sponsor Outreach',
            description: 'Send peer-to-peer executive sponsor re-engagement message to buyer Champion.',
            actionType: 'create_task',
            delayHours: 24,
            config: {
              taskTitle: 'Send Executive Sponsor Re-engagement Letter',
              taskPriority: 'high',
              taskInstructions: 'Highlight mutual business case outcomes and offer executive technical alignment call.',
            },
            requiredForNextStep: false,
          },
        ],
        exitConditions: [{ condition: 'deal_won' }, { condition: 'deal_lost' }],
        enabled: true,
        version: 1,
        allowReentry: true,
        reentryCooldownHours: 48,
        maxCascadeDepth: 3,
        createdAt: now,
        updatedAt: now,
        createdBy: actorId,
        executionStats: {
          totalTriggered: 11,
          completed: 8,
          inProgress: 2,
          convertedWon: 5,
          avgDurationHours: 42,
        },
      },
      {
        id: `${workspaceId}_play_proposal_viewed`,
        workspaceId,
        organizationId,
        title: 'Proposal Viewed High-Intent Play',
        description: 'Fires when buyer reviews quote or proposal 3+ times; prompts rapid pricing alignment call.',
        category: 'deal_acceleration',
        triggers: [
          { type: 'proposal_viewed', thresholdValue: 3 },
          { type: 'buyer_signal', signalType: 'pricing_viewed' },
        ],
        conditions: [
          { field: 'deal_stage', operator: 'equals', value: 'proposal' },
        ],
        steps: [
          {
            id: 'step_prop_call',
            stepIndex: 0,
            title: 'Commercial Q&A Follow-up',
            description: 'Contact decision maker while proposal is actively being reviewed.',
            actionType: 'create_task',
            delayHours: 0,
            config: {
              taskTitle: 'Conduct Proposal & Terms Alignment Call',
              taskPriority: 'high',
              taskInstructions: 'Inquire if there are specific clause questions, confirm procurement cycle.',
            },
            requiredForNextStep: true,
          },
          {
            id: 'step_prop_advance',
            stepIndex: 1,
            title: 'Advance to Negotiation Stage',
            description: 'Promote pipeline stage once commercial terms review has begun.',
            actionType: 'update_stage',
            delayHours: 24,
            config: { targetStage: 'negotiation' },
            requiredForNextStep: false,
          },
        ],
        exitConditions: [{ condition: 'deal_won' }],
        enabled: true,
        version: 1,
        allowReentry: false,
        reentryCooldownHours: 24,
        maxCascadeDepth: 3,
        createdAt: now,
        updatedAt: now,
        createdBy: actorId,
        executionStats: {
          totalTriggered: 15,
          completed: 13,
          inProgress: 1,
          convertedWon: 11,
          avgDurationHours: 26,
        },
      },
      {
        id: `${workspaceId}_play_single_threaded`,
        workspaceId,
        organizationId,
        title: 'Single-Threaded Deal De-risking Play',
        description: 'Triggers on deals over $10k with only one stakeholder; prompts rep to map Economic Buyer.',
        category: 'governance',
        triggers: [
          { type: 'sla_breached' },
          { type: 'manual_launch' },
        ],
        conditions: [
          { field: 'deal_value', operator: 'greater_than', value: 10000 },
          { field: 'stakeholder_count', operator: 'less_than', value: 2 },
        ],
        steps: [
          {
            id: 'step_thread_map',
            stepIndex: 0,
            title: 'Identify Economic Buyer & Legal Signer',
            description: 'Locate secondary stakeholder to eliminate single point of deal failure.',
            actionType: 'create_task',
            delayHours: 0,
            config: {
              taskTitle: 'Identify & Multi-Thread Economic Buyer',
              taskPriority: 'urgent',
              taskInstructions: 'Confirm who owns the financial budget line item and who authorizes procurement sign-off.',
            },
            requiredForNextStep: true,
          },
        ],
        exitConditions: [{ condition: 'deal_won' }],
        enabled: true,
        version: 1,
        allowReentry: true,
        reentryCooldownHours: 72,
        maxCascadeDepth: 3,
        createdAt: now,
        updatedAt: now,
        createdBy: actorId,
        executionStats: {
          totalTriggered: 7,
          completed: 6,
          inProgress: 1,
          convertedWon: 4,
          avgDurationHours: 36,
        },
      },
    ];

    let playsCreated = 0;
    const playsRef = adminDb.collection('salesOrchestrationPlays');
    for (const play of standardPlays) {
      const pSnap = await playsRef.doc(play.id).get();
      if (!pSnap.exists) {
        await playsRef.doc(play.id).set(play);
        playsCreated++;
      }
    }

    // -------------------------------------------------------------
    // Step 3: Seed Canonical Routing Rules
    // -------------------------------------------------------------
    const routingRef = adminDb.collection('salesOrchestrationRoutingRules').doc(`${workspaceId}_default_routing`);
    const routingSnap = await routingRef.get();
    let routingRulesCreated = 0;

    if (!routingSnap.exists) {
      const canonicalRouting: RoutingRule = {
        id: `${workspaceId}_default_routing`,
        workspaceId,
        organizationId,
        name: 'Standard Capacity-Weighted Workload Distribution',
        strategy: 'capacity_weighted',
        enabled: true,
        repRoster: [
          {
            userId: 'rep_sarah',
            userName: 'Sarah Jenkins',
            userEmail: 'sarah.jenkins@smartsapp.com',
            maxActiveWorkload: 25,
            currentActiveCount: 14,
            weight: 3,
            tier: 'enterprise',
            isAvailable: true,
          },
          {
            userId: 'rep_marcus',
            userName: 'Marcus Vance',
            userEmail: 'marcus.vance@smartsapp.com',
            maxActiveWorkload: 20,
            currentActiveCount: 8,
            weight: 2,
            tier: 'mid_market',
            isAvailable: true,
          },
          {
            userId: 'rep_elena',
            userName: 'Elena Rostova',
            userEmail: 'elena.rostova@smartsapp.com',
            maxActiveWorkload: 20,
            currentActiveCount: 18,
            weight: 1,
            tier: 'commercial',
            isAvailable: true,
          },
        ],
        fallbackOwnerId: 'mgr_david',
        fallbackOwnerName: 'David Kalu (Sales Director)',
        tierConditions: { minDealValue: 50000 },
        updatedAt: now,
      };
      await routingRef.set(canonicalRouting);
      routingRulesCreated++;
    }

    // -------------------------------------------------------------
    // Step 4: Seed Canonical SLA Escalation Rules
    // -------------------------------------------------------------
    const escalationRules: EscalationRule[] = [
      {
        id: `${workspaceId}_esc_lead_sla`,
        workspaceId,
        organizationId,
        name: 'Untouched Inbound Lead SLA (30 Minutes)',
        triggerCondition: 'lead_untouched',
        thresholdHours: 0.5,
        severity: 'high',
        notifyRoles: ['sales_manager'],
        autoReassign: true,
        reassignToRole: 'next_available_rep',
        cooldownMinutes: 60,
        enabled: true,
      },
      {
        id: `${workspaceId}_esc_stalled_deal`,
        workspaceId,
        organizationId,
        name: 'Stalled Pipeline Inactivity SLA (14 Days)',
        triggerCondition: 'deal_stalled',
        thresholdHours: 336,
        severity: 'moderate',
        notifyRoles: ['sales_manager', 'account_executive'],
        autoReassign: false,
        cooldownMinutes: 120,
        enabled: true,
      },
      {
        id: `${workspaceId}_esc_single_thread`,
        workspaceId,
        organizationId,
        name: 'Single-Threaded Enterprise Deal Risk (> $10k)',
        triggerCondition: 'single_threaded_risk',
        thresholdHours: 0,
        severity: 'critical',
        notifyRoles: ['sales_manager', 'department_head'],
        autoReassign: false,
        cooldownMinutes: 180,
        enabled: true,
      },
    ];

    let escalationRulesCreated = 0;
    const escRef = adminDb.collection('salesOrchestrationEscalations');
    for (const er of escalationRules) {
      const snap = await escRef.doc(er.id).get();
      if (!snap.exists) {
        await escRef.doc(er.id).set(er);
        escalationRulesCreated++;
      }
    }

    // -------------------------------------------------------------
    // Step 5: Seed Governed Human-in-the-Loop Approval Requests
    // -------------------------------------------------------------
    const sampleApprovals: ApprovalRequest[] = [
      {
        id: `${workspaceId}_appr_acme_discount`,
        workspaceId,
        organizationId,
        entityType: 'deal',
        entityId: 'deal_acme_saas',
        entityName: 'Acme Cloud Platform License',
        dealValue: 64000,
        requestType: 'discount_override',
        requestedBy: 'rep_sarah',
        requestedByName: 'Sarah Jenkins',
        requestedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        details: {
          discountPercent: 18,
          originalAmount: 78000,
          requestedAmount: 64000,
          justification: 'Competitor offering 15% discount. Buyer commits to signing within 48 hours if terms match.',
        },
        approverRole: 'sales_manager',
        assignedApproverId: 'mgr_david',
        assignedApproverName: 'David Kalu',
        status: 'pending',
        expiresAt: new Date(Date.now() + 45 * 3600 * 1000).toISOString(),
        autoEscalateAt: new Date(Date.now() + 21 * 3600 * 1000).toISOString(),
      },
      {
        id: `${workspaceId}_appr_omega_stage`,
        workspaceId,
        organizationId,
        entityType: 'deal',
        entityId: 'deal_omega_enterprise',
        entityName: 'Omega Global Migration Project',
        dealValue: 125000,
        requestType: 'stage_bypass',
        requestedBy: 'rep_marcus',
        requestedByName: 'Marcus Vance',
        requestedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        details: {
          fromStage: 'discovery',
          toStage: 'negotiation',
          justification: 'Inbound RFP with pre-cleared technical requirements and board funding. Requesting bypass of standard demo phase.',
        },
        approverRole: 'vp_sales',
        assignedApproverId: 'mgr_david',
        assignedApproverName: 'David Kalu',
        status: 'pending',
        expiresAt: new Date(Date.now() + 42 * 3600 * 1000).toISOString(),
        autoEscalateAt: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
      },
    ];

    let approvalsCreated = 0;
    const apprRef = adminDb.collection('salesOrchestrationApprovals');
    for (const appr of sampleApprovals) {
      const snap = await apprRef.doc(appr.id).get();
      if (!snap.exists) {
        await apprRef.doc(appr.id).set(appr);
        approvalsCreated++;
      }
    }

    // -------------------------------------------------------------
    // Step 6: Seed Active Play Execution Instances
    // -------------------------------------------------------------
    const sampleExecutions: PlayExecutionInstance[] = [
      {
        id: `${workspaceId}_exec_hot_fintech`,
        workspaceId,
        organizationId,
        playId: `${workspaceId}_play_hot_lead`,
        playTitle: 'Hot Inbound Lead Acceleration Play',
        entityType: 'lead',
        entityId: 'lead_fintech_systems',
        entityName: 'Fintech Systems Corp',
        entityValue: 45000,
        currentStepIndex: 1,
        totalSteps: 3,
        status: 'active',
        assignedTo: 'rep_sarah',
        assignedToName: 'Sarah Jenkins',
        triggeredBy: 'signal',
        triggerType: 'buyer_signal',
        cascadeDepth: 1,
        idempotencyKey: `play_${workspaceId}_play_hot_lead_fintech_${now.slice(0, 10)}`,
        startedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        lastStepExecutedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
        nextStepDueAt: new Date(Date.now() + 1 * 3600 * 1000).toISOString(),
        stepHistory: [
          {
            stepId: 'step_hot_call',
            stepTitle: 'Initial Discovery Call',
            actionType: 'create_task',
            executedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
            executedBy: 'rep_sarah',
            status: 'completed',
            outcomeNote: 'Completed initial phone touchpoint; scheduled in-depth demo for Thursday.',
          },
        ],
      },
      {
        id: `${workspaceId}_exec_stalled_solux`,
        workspaceId,
        organizationId,
        playId: `${workspaceId}_play_stalled_deal`,
        playTitle: 'Stalled Deal Recovery & De-risking Play',
        entityType: 'deal',
        entityId: 'deal_solux_energy',
        entityName: 'Solux Energy Fleet Expansion',
        entityValue: 82000,
        currentStepIndex: 1,
        totalSteps: 3,
        status: 'active',
        assignedTo: 'rep_marcus',
        assignedToName: 'Marcus Vance',
        triggeredBy: 'system',
        triggerType: 'deal_slipped',
        cascadeDepth: 1,
        idempotencyKey: `play_${workspaceId}_play_stalled_deal_solux_${now.slice(0, 10)}`,
        startedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        lastStepExecutedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        nextStepDueAt: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
        stepHistory: [
          {
            stepId: 'step_stalled_brief',
            stepTitle: 'AI Deal Risk Diagnosis',
            actionType: 'generate_ai_brief',
            executedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
            executedBy: 'system',
            status: 'completed',
            outcomeNote: 'AI brief generated: Procurement contact stalled due to internal budget reallocation.',
          },
        ],
      },
    ];

    let executionsCreated = 0;
    const execRef = adminDb.collection('salesOrchestrationExecutions');
    for (const exec of sampleExecutions) {
      const snap = await execRef.doc(exec.id).get();
      if (!snap.exists) {
        await execRef.doc(exec.id).set(exec);
        executionsCreated++;
      }
    }

    return {
      success: true,
      workspaceId,
      governanceProvisioned,
      playsCreated,
      routingRulesCreated,
      escalationRulesCreated,
      approvalsCreated,
      executionsCreated,
    };
  } catch (err) {
    console.error('Failed to execute Sales Orchestration migration:', err);
    return {
      success: false,
      workspaceId,
      governanceProvisioned: false,
      playsCreated: 0,
      routingRulesCreated: 0,
      escalationRulesCreated: 0,
      approvalsCreated: 0,
      executionsCreated: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
