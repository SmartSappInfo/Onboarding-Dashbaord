/**
 * @fileoverview Type definitions and strict schema contracts for AI Sales Workforce (Phase 9).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 9 / Phase 9:
 * 1. Specialized AI Sales Agent Fleet (8 specialized agents: Prioritization, Deal, Coaching, Conversation, CRM Hygiene, Workload, Forecast, Manager).
 * 2. 5-Level Autonomy Maturity Model: Level 0 (Observe) -> Level 1 (Recommend) -> Level 2 (Prepare) -> Level 3 (Approve) -> Level 4 (Autonomous Execute).
 * 3. Three-Tier Confidence Gating (<60% suppress, 60-85% prepare/recommend, >=85% autonomous candidate).
 * 4. Human-in-the-Loop Sensitive Action Gate (Discounts >15%, cancellations, stage skips strictly Level 3).
 * 5. CRM Data Hygiene Anomaly Scanner and Atomic Batch Repair.
 * 6. Multi-Tenant Telemetry & Execution Audit Ledger.
 * 7. No-Code Backoffice Fleet Governance Control Plane (Kill Switch, Model Assignment, Budget Quotas).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - All timestamps must be ISO 8601 strings.
 * - Max cascade depth bounded (MAX_CASCADE_DEPTH = 3) to prevent infinite agent feedback loops.
 *
 * @testability Pure data structures designed for deterministic unit testing in Vitest.
 */

export type AiAgentType =
  | 'prioritization'
  | 'deal_intelligence'
  | 'coaching'
  | 'conversation'
  | 'crm_hygiene'
  | 'workload'
  | 'forecast'
  | 'manager';

export type AiAutonomyLevel = 0 | 1 | 2 | 3 | 4;

export type AiAgentStatus = 'active' | 'standby' | 'paused';

export type AiRecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export type AiRecommendationStatus =
  | 'pending'
  | 'accepted'
  | 'dismissed'
  | 'executed'
  | 'expired';

export type AiApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';

export type AiCrmHygieneSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AiCrmHygieneIssueType =
  | 'stale_deal'
  | 'missing_next_step'
  | 'single_threaded'
  | 'unassigned_lead'
  | 'missing_email';

export interface AiAgentProfile {
  id: string;
  workspaceId: string;
  organizationId: string;
  type: AiAgentType;
  name: string;
  roleTitle: string;
  avatar: string;
  description: string;
  status: AiAgentStatus;
  currentAutonomyLevel: AiAutonomyLevel;
  defaultModel: string;
  accuracyScore: number; // 0 - 100
  totalExecutions: number;
  lastActiveAt?: string;
}

export interface AiSuggestedAction {
  actionType: string;
  label: string;
  payload?: Record<string, string | number | boolean>;
  isSensitive?: boolean;
}

export interface AiSalesRecommendation {
  id: string;
  workspaceId: string;
  organizationId: string;
  agentType: AiAgentType;
  agentName: string;
  priority: AiRecommendationPriority;
  confidenceScore: number; // 0 - 100
  title: string;
  description: string;
  rationale: string;
  entityType: 'deal' | 'lead' | 'contact' | 'meeting' | 'rep';
  entityId: string;
  entityName: string;
  suggestedAction: AiSuggestedAction;
  status: AiRecommendationStatus;
  assignedRepId?: string;
  createdAt: string;
  expiresAt?: string;
  executedAt?: string;
}

export interface AiSalesApproval {
  id: string;
  workspaceId: string;
  organizationId: string;
  agentType: AiAgentType;
  actionType: string;
  entityType: 'deal' | 'lead' | 'contact';
  entityId: string;
  entityName: string;
  originalState: Record<string, string | number | boolean>;
  proposedState: Record<string, string | number | boolean>;
  reason: string;
  confidenceScore: number;
  requestedBy: string;
  status: AiApprovalStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
}

export interface AiCrmHygieneIssue {
  id: string;
  workspaceId: string;
  organizationId: string;
  issueType: AiCrmHygieneIssueType;
  severity: AiCrmHygieneSeverity;
  entityType: 'deal' | 'lead' | 'contact';
  entityId: string;
  entityName: string;
  fieldName: string;
  currentValue?: string | number | null;
  suggestedValue: string | number;
  repairRationale: string;
  status: 'detected' | 'repaired' | 'ignored';
  detectedAt: string;
  repairedAt?: string;
}

export interface AiExecutionAuditDoc {
  id: string;
  workspaceId: string;
  organizationId: string;
  agentType: AiAgentType;
  actionType: string;
  autonomyLevel: AiAutonomyLevel;
  confidenceScore: number;
  durationMs: number;
  modelUsed: string;
  tokensUsed: number;
  status: 'success' | 'failed' | 'rejected';
  entityId?: string;
  entityName?: string;
  error?: string;
  timestamp: string;
}

export interface AiWorkforceGovernancePolicy {
  id: string;
  workspaceId: string;
  organizationId: string;
  emergencyKillSwitch: boolean;
  maxCascadeDepth: number; // default 3
  defaultAutonomyLevels: Record<AiAgentType, AiAutonomyLevel>;
  minConfidenceForAutonomous: number; // default 85
  minConfidenceForPrepare: number; // default 60
  sensitiveActionsRequireApproval: boolean; // default true
  tokenMonthlyBudget: number;
  tokensConsumedThisMonth: number;
  updatedAt: string;
  updatedBy?: string;
}

export interface AiFleetMetrics {
  autonomousActionsTotal: number;
  hoursSavedEstimate: number;
  humanApprovalRate: number;
  activeRecommendationsCount: number;
  healthIndex: number;
  activeAgentsCount: number;
}
