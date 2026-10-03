/**
 * @fileOverview Server Allowlist & Supply-Chain Security Types (Phase 5 Milestone 3 Task 3)
 *
 * Implements Rule 15 (Server Allowlisting & Supply-Chain Controls), Rule 4 (Zero any/any[]),
 * Rule 8 & 50 (Tenant Isolation), Rule 10 (Inline Architectural Docs), Rule 34 (SSRF Defense),
 * and Rule 36 (Capability Versioning).
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. 8-Stage Lifecycle State Machine:
 *    External MCP servers must progress through:
 *    DISCOVERED -> REVIEWED -> TESTED -> APPROVED -> CONNECTED -> MONITORED
 *    Any premature execution jump throws INVALID_LIFECYCLE_TRANSITION.
 * 2. Execution Authorization Gate:
 *    Only servers in `approved`, `connected`, or `monitored` status are permitted to execute tools.
 *    All others fail closed with MCP_SERVER_NOT_ALLOWED.
 * 3. Anti-IDOR Tenant Scope:
 *    Server registrations are strictly partitioned by `organizationId` and `workspaceId`.
 */

import { z } from 'zod/v4';

export const ALLOWLIST_ERROR_CODES = {
  SSRF_EGRESS_BLOCKED: 'SSRF_EGRESS_BLOCKED',
  INVALID_LIFECYCLE_TRANSITION: 'INVALID_LIFECYCLE_TRANSITION',
  MCP_SERVER_NOT_ALLOWED: 'MCP_SERVER_NOT_ALLOWED',
  MCP_SERVER_NOT_FOUND: 'MCP_SERVER_NOT_FOUND',
  MCP_SERVER_ALREADY_EXISTS: 'MCP_SERVER_ALREADY_EXISTS',
  UNAUTHORIZED_SERVER_OPERATION: 'UNAUTHORIZED_SERVER_OPERATION',
} as const;

export type AllowlistErrorCode =
  (typeof ALLOWLIST_ERROR_CODES)[keyof typeof ALLOWLIST_ERROR_CODES];

export const McpServerStatusSchema = z.enum([
  'discovered',
  'reviewed',
  'tested',
  'approved',
  'connected',
  'monitored',
  'suspended',
  'revoked',
]);

export type McpServerStatus = z.infer<typeof McpServerStatusSchema>;

export const McpTransportTypeSchema = z.enum(['http', 'sse']);
export type McpTransportType = z.infer<typeof McpTransportTypeSchema>;

export const ServerHealthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);
export type ServerHealthStatus = z.infer<typeof ServerHealthStatusSchema>;

export const ServerProvenanceSchema = z.object({
  vendor: z.string().optional(),
  repository: z.string().url().optional(),
  integrityHash: z.string().length(64).optional(),
});

export type ServerProvenance = z.infer<typeof ServerProvenanceSchema>;

export const McpServerRegistrationSchema = z.object({
  serverId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  serverUrl: z.string().url(),
  transportType: McpTransportTypeSchema.default('http'),
  status: McpServerStatusSchema.default('discovered'),
  pinnedVersion: z.string().optional(),
  allowedDomains: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default([]),
  provenance: ServerProvenanceSchema.optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  reviewNotes: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  healthStatus: ServerHealthStatusSchema.default('healthy'),
  lastHealthCheckAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type McpServerRegistration = z.infer<typeof McpServerRegistrationSchema>;

export const CreateServerRegistrationInputSchema = z.object({
  serverId: z.string().min(1),
  serverUrl: z.string().url(),
  transportType: McpTransportTypeSchema.default('http'),
  pinnedVersion: z.string().optional(),
  allowedDomains: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default([]),
  provenance: ServerProvenanceSchema.optional(),
});

export type CreateServerRegistrationInput = z.infer<typeof CreateServerRegistrationInputSchema>;

/**
 * Valid state transitions for the MCP server allowlist lifecycle.
 */
const LIFECYCLE_TRANSITIONS: Record<McpServerStatus, readonly McpServerStatus[]> = {
  discovered: ['reviewed', 'revoked'],
  reviewed: ['tested', 'discovered', 'revoked'],
  tested: ['approved', 'reviewed', 'revoked'],
  approved: ['connected', 'suspended', 'revoked'],
  connected: ['monitored', 'suspended', 'revoked'],
  monitored: ['connected', 'suspended', 'revoked'],
  suspended: ['connected', 'reviewed', 'revoked'],
  revoked: [], // Terminal state
};

/**
 * Evaluates whether transitioning from one lifecycle status to another is permitted.
 */
export function isValidLifecycleTransition(from: McpServerStatus, to: McpServerStatus): boolean {
  if (from === to) return true;
  const allowed = LIFECYCLE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Checks whether an MCP server's current status allows it to be invoked for tool execution.
 * Only servers that have successfully passed the security and testing lifecycle gates are permitted.
 */
export function isServerExecutionPermitted(status: McpServerStatus): boolean {
  return status === 'approved' || status === 'connected' || status === 'monitored';
}
