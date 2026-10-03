/**
 * @fileOverview Native In-Process Genkit Adapter Types & Error Taxonomy (Phase 5 Milestone 5 Task 1)
 *
 * Implements Rule 1 & Rule 4 (Zero any/any[] Strict Typing Policy), Rule 8 & 47 (Multi-Tenancy & Anti-IDOR),
 * Rule 10 (Inline Architectural Documentation), Rule 12 (Annotations Are Hints), Rule 13 (Never Trust the Model),
 * Rule 14 (Rug-Pull Defense), Rule 16 (Agent Identity as Principal), Rule 17 (Non-Delegable Action Stripping),
 * Rule 20 & 39 (Distributed Tracing & Correlation IDs), Rule 21 & 22 (Human Approval Binding & SHA-256 Hashes),
 * Rule 32 & 33 (Data Egress Policy & Exfiltration Defense), Rule 40 (Append-Only Audit Logging),
 * Rule 42 (Shadow Mode / Dry Run), and Rule 60 (Emergency Dead-Man Controls).
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. Native In-Process Execution:
 *    Executes canonical SmartSapp capabilities directly in-memory within the active Node.js / Cloud Run
 *    process without HTTP serialization or network overhead, reducing tool call latency to < 1ms.
 * 2. Complete Security Pipeline Equivalence:
 *    The in-process adapter executes the EXACT same security gate pipeline as the remote MCP transport:
 *    Dead-Man Switch -> Tenant Isolation -> Principal Scopes & Personas -> Non-Delegable Action Check ->
 *    Cryptographic Tool Fingerprint Drift -> Schema Parsing -> Handler Execution ->
 *    Data Egress Policy Exfiltration Scan -> Append-Only Audit Logging.
 * 3. Fail-Closed Invariant:
 *    Any policy violation, dead-man trip, schema divergence, or sensitive data leak immediately halts
 *    execution and throws structured errors adhering to GENKIT_ADAPTER_ERROR_CODES.
 */

import { z } from 'zod/v4';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
  VerifiedApproval,
} from '../../capabilities/contracts/capability-definition';
import type { TenantContext, ToolFingerprintService, EgressDataPolicyEngine, EgressDestination } from '../security';
import type { EventBus } from '../../events/event-bus';
import type { McpDomain } from '../transport/transport-types';

/**
 * Standardized Error Taxonomy for Native In-Process Genkit Execution.
 */
export const GENKIT_ADAPTER_ERROR_CODES = {
  DEAD_MAN_PAUSED: 'MCP_DEAD_MAN_PAUSED',
  FINGERPRINT_DRIFT: 'TOOL_FINGERPRINT_DRIFT',
  PRINCIPAL_UNAUTHORIZED: 'PRINCIPAL_UNAUTHORIZED',
  NON_DELEGABLE_ACTION: 'NON_DELEGABLE_ACTION',
  DATA_EXFILTRATION_BLOCKED: 'DATA_EXFILTRATION_BLOCKED',
  EXECUTION_FAILED: 'CAPABILITY_EXECUTION_FAILED',
  TENANT_SCOPE_REQUIRED: 'TENANT_SCOPE_REQUIRED',
  TENANT_ISOLATION_VIOLATION: 'TENANT_ISOLATION_VIOLATION',
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVAL_INVALID: 'APPROVAL_INVALID',
} as const;

export type GenkitAdapterErrorCode =
  (typeof GENKIT_ADAPTER_ERROR_CODES)[keyof typeof GENKIT_ADAPTER_ERROR_CODES];

/**
 * Configuration Options for In-Process Capability Adaptation.
 */
export interface GenkitToolAdapterOptions {
  /** The authenticated agent or user principal executing the tool. */
  principal: AgentPrincipal;

  /**
   * Explicit tenant context. If omitted, automatically derived from
   * `principal.organizationId` and `principal.workspaceId`.
   */
  tenant?: TenantContext;

  /** Custom correlation ID for distributed tracing (Rule 20 & 39). */
  correlationId?: string;

  /** Causation ID linking this invocation to a preceding event or trigger. */
  causationId?: string;

  /** TOCTOU Idempotency Key (Rule 18). */
  idempotencyKey?: string;

  /** TOCTOU Optimistic Concurrency version (Rule 18). */
  expectedVersion?: string | number;

  /** Whether to execute in shadow-mode dry-run without persistent mutations (Rule 42). */
  dryRun?: boolean;

  /**
   * Verified human approval for high-risk (L3/L4) capabilities (Rule 21 & 22).
   * Must be issued by an authorized human operator via ApprovalVerifier.
   */
  verifiedApproval?: VerifiedApproval;

  /** Cryptographic SHA-256 payload hash bound to the verified approval. */
  payloadHash?: string;

  /** Fingerprint service for supply-chain integrity checks (Rule 14). */
  fingerprintService?: ToolFingerprintService;

  /**
   * If true, fails closed if no approved fingerprint exists in the store.
   * If false, verifies against approved fingerprint if present, but allows novel execution if absent.
   */
  enforceFingerprints?: boolean;

  /** Data Egress Policy Engine for exfiltration scanning (Rule 32 & 33). */
  egressPolicyEngine?: EgressDataPolicyEngine;

  /** Whether to enforce data egress exfiltration scanning (defaults to true). */
  enforceEgressPolicy?: boolean;

  /** Destination channel classification for egress policy (defaults to 'internal_memory'). */
  egressDestination?: EgressDestination;

  /** If true, redacts sensitive egress tokens instead of blocking execution. */
  redactEgressSensitiveData?: boolean;

  /** If true, bypasses the egress data policy check (use with caution in internal pipelines). */
  bypassEgressScan?: boolean;

  /** Event bus for publishing `mcp.tool.invoked` append-only audit events (Rule 40). */
  eventBus?: EventBus;
}

/**
 * Configuration Options for Domain-Level Genkit Tool Construction.
 */
export interface CreateGenkitDomainToolsOptions extends GenkitToolAdapterOptions {
  /** Target MCP domain partition. */
  domain: McpDomain;

  /** Custom capability pool (defaults to canonical registry list). */
  capabilities?: AnyCapabilityDefinition[];

  /** Surface check callback for system domain surface isolation (Rule 61). */
  checkSurface?: () => boolean;
}

/**
 * Configuration Options for Multi-Domain Agent Tool Construction.
 */
export interface CreateGenkitAgentToolsOptions extends Omit<GenkitToolAdapterOptions, 'principal'> {
  /** Target MCP domain partitions. */
  domains?: McpDomain[];

  /** Custom capability pool (defaults to canonical registry list). */
  capabilities?: AnyCapabilityDefinition[];
}

/**
 * Structured Execution Result from In-Process Capability Invocations.
 */
export interface GenkitToolExecutionResult<TOutput = unknown> {
  success: boolean;
  data?: TOutput;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: unknown;
  };
  executionId: string;
  durationMs: number;
  correlationId: string;
  dryRun?: boolean;
  resourceVersion?: string | number;
}

/**
 * Schema for validating Genkit tool execution options at runtime.
 */
export const GenkitToolOptionsSchema = z.object({
  dryRun: z.boolean().optional(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  expectedVersion: z.union([z.string(), z.number()]).optional(),
});
