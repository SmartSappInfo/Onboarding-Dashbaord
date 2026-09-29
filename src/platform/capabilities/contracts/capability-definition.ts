/**
 * @fileOverview Canonical Capability Definition Interface (Phase 0 / Phase 1)
 *
 * Implements Rule 11, Rule 12, Rule 18, Rule 19, Rule 31, and Master Roadmap Section 4.
 * Every business operation in SmartSapp is registered behind a CapabilityDefinition contract.
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Inferred generic schemas only.
 */

import { z } from 'zod/v4';
import type { RiskMetadata } from './risk-levels';
import type { DomainEvent } from '../events/domain-event';

export const CAPABILITY_DOMAINS = [
  'identity_access',
  'crm_contacts',
  'deals_revenue',
  'knowledge_memory',
  'tasks_productivity',
  'meetings_conversations',
  'communication_messaging',
  'campaigns_marketing',
  'forms_surveys',
  'automation_workflows',
  'media_creative',
  'finance_subscriptions',
  'lead_intelligence',
  'analytics_reporting',
  'ai_governance',
  'platform_integrations',
  'experience_portal',
  'school_operations',
] as const;

export type CapabilityDomain = (typeof CAPABILITY_DOMAINS)[number];

export const CAPABILITY_OPERATIONS = [
  'read',
  'search',
  'analyze',
  'draft',
  'create',
  'update',
  'delete',
  'execute',
  'publish',
] as const;

export type CapabilityOperation = (typeof CAPABILITY_OPERATIONS)[number];

/**
 * A human approval that the approval verifier has ALREADY checked against the server-side
 * `capability_approvals` store and bound to one tool invocation (Rules 21, 22).
 * Never construct this from caller-supplied data: only `ApprovalVerifier` produces it.
 */
export interface VerifiedApproval {
  approvalId: string;
  approvedBy: string;
  organizationId: string;
  workspaceId: string;
  capabilityId: string;
  capabilityVersion: string;
  payloadHash: string;
  toolInvocationId: string;
  expiresAt: string;
}

/**
 * `user` = a human acting interactively in the SmartSapp UI. `agent` = anything non-interactive:
 * in-app agents, MCP clients, background steps, automations.
 */
export type PrincipalActorType = 'user' | 'agent';

/**
 * The authenticated actor. Carries identity and scopes only — approvals are verified separately
 * and passed to the evaluator as `VerifiedApproval`, so a caller cannot self-assert one.
 */
export interface AgentPrincipal {
  /**
   * Required on purpose: agent rules (approvals, non-delegable, no wildcard) must never be skipped
   * just because a caller forgot to set `agentId`. See `isAutomatedPrincipal`.
   */
  actorType: PrincipalActorType;
  userId: string;
  organizationId: string;
  workspaceId: string;
  agentId?: string;
  agentVersion?: string;
  delegationId?: string;
  runId?: string; // (Rule 16)
  policyVersion?: string; // (Rule 16)
  toolInvocationId?: string; // (Rule 16)
  grantedScopes: string[];
  effectiveRole: string;
}

/**
 * Agent rules apply unless the principal is explicitly an interactive user with no agent or
 * delegation identity. Fail closed: any agent marker makes it an agent.
 */
export function isAutomatedPrincipal(principal: Pick<AgentPrincipal, 'actorType' | 'agentId' | 'delegationId'>): boolean {
  return principal.actorType !== 'user' || Boolean(principal.agentId || principal.delegationId);
}

export interface CapabilityExecutionContext {
  principal: AgentPrincipal;
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
  expectedVersion?: string | number; // TOCTOU Optimistic Concurrency Guard (Rule 18)
  dryRun?: boolean;
  timestamp: string;
}

export interface CapabilityExecutionSuccess<TOutput> {
  success: true;
  data: TOutput;
  executionId: string;
  emittedEvents: DomainEvent[];
  resourceVersion?: string | number;
  durationMs: number;
}

export interface CapabilityExecutionFailure {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: unknown;
  };
  executionId: string;
  emittedEvents?: DomainEvent[];
  durationMs?: number;
}

export type CapabilityExecutionResult<TOutput> =
  | CapabilityExecutionSuccess<TOutput>
  | CapabilityExecutionFailure;

export interface CapabilityDefinition<TInput = unknown, TOutput = unknown> {
  id: string; // e.g. "portal.membership.create_plan", "crm.contact.update"
  version: string; // SemVer string
  name: string;
  description: string;
  domain: CapabilityDomain;
  operation: CapabilityOperation;

  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;

  permissions: string[];
  workspaceScoped: boolean;
  tenantScoped: boolean;

  risk: RiskMetadata;

  execution: {
    synchronous: boolean;
    maxDurationMs: number;
    supportsDryRun: boolean;
    supportsCancellation: boolean;
    supportsCompensation: boolean;
    /** Enforced payload ceiling (Cloud Run 32 MB ceiling, default 1 MB for normal ops) */
    maxPayloadSizeBytes: number;
    timeoutMs?: number;
    retryPolicy?: {
      maxRetries: number;
      backoffMs: number;
    };
  };

  /** Governance, Cost & Lifecycle Metadata (Roadmap §4 / Tools §4.1) */
  governance?: {
    costPerInvocationUsd?: number;
    emitsEvents?: string[];
    evidenceRequired?: boolean;
    dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
    breakingChangePolicy?: 'additive_only' | 'major_version_bump';
    implementationRef?: string;
  };

  /** TOCTOU and Idempotency Policies */
  policies: {
    requiresIdempotencyKey: boolean;
    requiresExpectedVersion: boolean;
    auditRequired: boolean;
  };

  /** The underlying canonical execution implementation */
  handler: (
    input: TInput,
    context: CapabilityExecutionContext
  ) => Promise<CapabilityExecutionResult<TOutput>>;
}

export type AnyCapabilityDefinition = Omit<
  CapabilityDefinition<never, unknown>,
  'inputSchema' | 'outputSchema' | 'handler'
> & {
  inputSchema: z.ZodType<unknown>;
  outputSchema: z.ZodType<unknown>;
  /**
   * Declared with method syntax on purpose: it lets any `CapabilityDefinition<TInput, TOutput>` be stored
   * here, while callers pass `unknown` input. Callers MUST pass the output of `inputSchema.safeParse`
   * (validated data), never raw arguments.
   */
  handler(input: unknown, ctx: CapabilityExecutionContext): Promise<CapabilityExecutionResult<unknown>>;
};

