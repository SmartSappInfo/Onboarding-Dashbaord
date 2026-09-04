/**
 * @fileoverview Idempotent FER Migration Protocol & Seeder for AI Sales Workforce (Phase 9).
 *
 * ARCHITECTURAL POINTER:
 * Pre-seeds the 8 Specialized AI Agents, default workspace-wide governance policies,
 * initial recommendations, and data hygiene scanner records into Firestore.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Must remain fully idempotent using deterministic document IDs.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  AiAgentProfile,
  AiWorkforceGovernancePolicy,
  AiSalesRecommendation,
  AiCrmHygieneIssue,
  AiSalesApproval,
} from './types';

export const STANDARD_AI_AGENTS: Omit<AiAgentProfile, 'workspaceId' | 'organizationId'>[] = [
  {
    id: 'agent_prioritization',
    type: 'prioritization',
    name: 'Sapphire Prioritizer',
    roleTitle: 'Chief Sales Prioritization Agent',
    avatar: 'Sparkles',
    description: 'Ranks seller actions by buyer intent, deal value, and SLA urgency.',
    status: 'active',
    currentAutonomyLevel: 2, // Prepare
    defaultModel: 'googleai/gemini-1.5-flash',
    accuracyScore: 94,
    totalExecutions: 215,
  },
  {
    id: 'agent_deal_intelligence',
    type: 'deal_intelligence',
    name: 'Argus Deal Sentinel',
    roleTitle: 'Deal Risk & Win Probability Agent',
    avatar: 'Compass',
    description: 'Diagnoses stalled deals, champion gaps, and multi-threading risks.',
    status: 'active',
    currentAutonomyLevel: 2, // Prepare
    defaultModel: 'googleai/gemini-1.5-pro',
    accuracyScore: 92,
    totalExecutions: 168,
  },
  {
    id: 'agent_coaching',
    type: 'coaching',
    name: 'Mentor Coaching Guide',
    roleTitle: 'Real-Time Coaching & Practice Agent',
    avatar: 'GraduationCap',
    description: 'Detects skill deficiencies and automatically assigns practice drills.',
    status: 'active',
    currentAutonomyLevel: 1, // Recommend
    defaultModel: 'anthropic/claude-3-5-sonnet-20241022',
    accuracyScore: 95,
    totalExecutions: 94,
  },
  {
    id: 'agent_conversation',
    type: 'conversation',
    name: 'Echo Conversation Listener',
    roleTitle: 'Speech Dynamics & Intent Analyzer',
    avatar: 'MessageSquare',
    description: 'Extracts buyer intent, objection patterns, and next steps from call transcripts.',
    status: 'active',
    currentAutonomyLevel: 1, // Recommend
    defaultModel: 'googleai/gemini-1.5-flash',
    accuracyScore: 91,
    totalExecutions: 310,
  },
  {
    id: 'agent_crm_hygiene',
    type: 'crm_hygiene',
    name: 'CleanSweep CRM Custodian',
    roleTitle: 'Data Quality & Auto-Repair Custodian',
    avatar: 'ShieldCheck',
    description: 'Detects stale opportunities, missing fields, and executes governed repairs.',
    status: 'active',
    currentAutonomyLevel: 3, // Approve
    defaultModel: 'googleai/gemini-1.5-flash',
    accuracyScore: 96,
    totalExecutions: 182,
  },
  {
    id: 'agent_workload',
    type: 'workload',
    name: 'Atlas Workload Balancer',
    roleTitle: 'Capacity & Queue Rebalancer',
    avatar: 'Users',
    description: 'Monitors rep utilization, task queues, and suggests capacity rebalancing.',
    status: 'active',
    currentAutonomyLevel: 1, // Recommend
    defaultModel: 'googleai/gemini-1.5-flash',
    accuracyScore: 89,
    totalExecutions: 76,
  },
  {
    id: 'agent_forecast',
    type: 'forecast',
    name: 'Oracle Forecast Predictor',
    roleTitle: 'Predictive Revenue & Slippage Forecaster',
    avatar: 'TrendingUp',
    description: 'Calculates Monte Carlo close probabilities and predicts quarter-end attainment.',
    status: 'active',
    currentAutonomyLevel: 2, // Prepare
    defaultModel: 'googleai/gemini-1.5-pro',
    accuracyScore: 93,
    totalExecutions: 145,
  },
  {
    id: 'agent_manager',
    type: 'manager',
    name: 'Command Manager Advisor',
    roleTitle: 'Executive Leadership Copilot',
    avatar: 'ShieldAlert',
    description: 'Prepares 1:1 dossiers and highlights high-leverage management interventions.',
    status: 'active',
    currentAutonomyLevel: 1, // Recommend
    defaultModel: 'anthropic/claude-3-5-sonnet-20241022',
    accuracyScore: 94,
    totalExecutions: 112,
  },
];

export async function seedAiWorkforceWorkspace(
  workspaceId: string,
  organizationId: string
): Promise<{ success: boolean; seededAgents: number; error?: string }> {
  try {
    const now = new Date().toISOString();
    const batch = adminDb.batch();

    // 1. Seed Governance Policy
    const govRef = adminDb.collection('aiSalesGovernance').doc(workspaceId);
    const govDoc: AiWorkforceGovernancePolicy = {
      id: workspaceId,
      workspaceId,
      organizationId,
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
      tokenMonthlyBudget: 2500000,
      tokensConsumedThisMonth: 185000,
      updatedAt: now,
      updatedBy: 'system_migration_fer',
    };
    batch.set(govRef, govDoc, { merge: true });

    // 2. Seed 8 Specialized Agents
    let count = 0;
    for (const agent of STANDARD_AI_AGENTS) {
      const docId = `${workspaceId}_${agent.id}`;
      const agentRef = adminDb.collection('aiSalesAgents').doc(docId);
      const agentData: AiAgentProfile = {
        ...agent,
        id: docId,
        workspaceId,
        organizationId,
        lastActiveAt: now,
      };
      batch.set(agentRef, agentData, { merge: true });
      count++;
    }

    // 3. Seed Sample Next-Best-Action Recommendations
    const sampleRecs: AiSalesRecommendation[] = [
      {
        id: `rec_${workspaceId}_1`,
        workspaceId,
        organizationId,
        agentType: 'prioritization',
        agentName: 'Sapphire Prioritizer',
        priority: 'critical',
        confidenceScore: 92,
        title: 'Call Sunrise Academy (Proposal Viewed 4x)',
        description: 'Customer opened commercial proposal 4 times this morning and shared with CFO.',
        rationale: 'High buying signal spike indicates pricing evaluation. Immediate follow-up closes 68% faster.',
        entityType: 'deal',
        entityId: 'deal_sunrise',
        entityName: 'Sunrise Academy Expansion',
        suggestedAction: {
          actionType: 'phone_call',
          label: 'Call Head of School',
          isSensitive: false,
        },
        status: 'pending',
        createdAt: now,
      },
      {
        id: `rec_${workspaceId}_2`,
        workspaceId,
        organizationId,
        agentType: 'deal_intelligence',
        agentName: 'Argus Deal Sentinel',
        priority: 'high',
        confidenceScore: 86,
        title: 'Map Economic Buyer on HealthTech Renewal',
        description: 'Opportunity value exceeds $45,000 but only 1 technical contact is associated.',
        rationale: 'Deals above $30k with only one stakeholder experience an 82% slip rate during procurement.',
        entityType: 'deal',
        entityId: 'deal_healthtech',
        entityName: 'HealthTech Ghana Annual Renewal',
        suggestedAction: {
          actionType: 'task_creation',
          label: 'Create Stakeholder Mapping Task',
          isSensitive: false,
        },
        status: 'pending',
        createdAt: now,
      },
      {
        id: `rec_${workspaceId}_3`,
        workspaceId,
        organizationId,
        agentType: 'forecast',
        agentName: 'Oracle Forecast Predictor',
        priority: 'medium',
        confidenceScore: 78,
        title: 'Re-align Close Date for Stalled Logistics Pilot',
        description: 'Close date has slipped 2 consecutive months. Current win probability dropped to 38%.',
        rationale: 'Adjusting forecast category to Upside protects quarterly committed accuracy.',
        entityType: 'deal',
        entityId: 'deal_logistics',
        entityName: 'OmniLogistics Fleet Pilot',
        suggestedAction: {
          actionType: 'stage_advance',
          label: 'Review Forecast Category',
          isSensitive: false,
        },
        status: 'pending',
        createdAt: now,
      },
    ];

    for (const rec of sampleRecs) {
      const recRef = adminDb.collection('aiSalesRecommendations').doc(rec.id);
      batch.set(recRef, rec, { merge: true });
    }

    // 4. Seed Sample CRM Hygiene Anomalies
    const sampleHygiene: AiCrmHygieneIssue[] = [
      {
        id: `hygiene_${workspaceId}_1`,
        workspaceId,
        organizationId,
        issueType: 'stale_deal',
        severity: 'high',
        entityType: 'deal',
        entityId: 'deal_stale_1',
        entityName: 'Apex Financial Services Contract',
        fieldName: 'lastActivityAt',
        currentValue: new Date(Date.now() - 18 * 86400 * 1000).toISOString(),
        suggestedValue: 'Schedule Account Re-engagement',
        repairRationale: 'Deal untouched for 18 days in Proposal stage. Inactivity increases churn probability.',
        status: 'detected',
        detectedAt: now,
      },
      {
        id: `hygiene_${workspaceId}_2`,
        workspaceId,
        organizationId,
        issueType: 'unassigned_lead',
        severity: 'critical',
        entityType: 'lead',
        entityId: 'lead_hot_1',
        entityName: 'Kofi Mensah (FinTech Lead)',
        fieldName: 'assignedTo',
        currentValue: null,
        suggestedValue: 'Auto-Assign via Capacity Routing',
        repairRationale: 'Inbound lead score 88 untouched for 45 minutes. Response SLA breached.',
        status: 'detected',
        detectedAt: now,
      },
    ];

    for (const h of sampleHygiene) {
      const hRef = adminDb.collection('aiCrmHygieneIssues').doc(h.id);
      batch.set(hRef, h, { merge: true });
    }

    // 5. Seed Sample Sensitive Approval Item
    const sampleApproval: AiSalesApproval = {
      id: `app_${workspaceId}_1`,
      workspaceId,
      organizationId,
      agentType: 'deal_intelligence',
      actionType: 'discount_override',
      entityType: 'deal',
      entityId: 'deal_apex',
      entityName: 'Apex Financial Services Contract',
      originalState: { discountPct: 10, totalValue: 54000 },
      proposedState: { discountPct: 20, totalValue: 48000 },
      reason: 'AI competitive defense recommendation: Client considering rival proposal.',
      confidenceScore: 89,
      requestedBy: 'Argus Deal Sentinel',
      status: 'pending',
      createdAt: now,
    };
    const appRef = adminDb.collection('aiSalesApprovals').doc(sampleApproval.id);
    batch.set(appRef, sampleApproval, { merge: true });

    await batch.commit();
    return { success: true, seededAgents: count };
  } catch (error) {
    console.error('seedAiWorkforceWorkspace error:', error);
    return {
      success: false,
      seededAgents: 0,
      error: error instanceof Error ? error.message : 'Failed to seed AI workforce',
    };
  }
}
