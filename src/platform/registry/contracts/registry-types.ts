/**
 * @fileOverview Canonical Registry Contracts, Schemas & Governance Matrices (Phase 15 Milestone 4)
 *
 * Implements Rules 1, 2, 4, 8, 12, 14, 16, 17, 19, 23, 27, 48, 60, 67, 68, 69, 1940-1953, 1974.
 * Defines canonical schemas for Capability Catalog, Agent Persona Catalog, Progressive Discovery,
 * Platform Auto-Documentation Generator, Error Taxonomy, and the 4 Governance Matrices.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod';
import { RISK_LEVELS, type RiskLevel } from '../../capabilities/contracts/risk-levels';

// ============================================================================
// 1. CAPABILITY CATALOG SCHEMAS (Roadmap §22)
// ============================================================================

export const ToolDriftStatusSchema = z.enum([
  'APPROVED',
  'DRIFTED',
  'LOCKED',
  'UNMONITORED',
  'REVOKED',
]);
export type ToolDriftStatus = z.infer<typeof ToolDriftStatusSchema>;

export const CapabilityCatalogItemSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  version: z.string().min(1),
  description: z.string(),
  riskLevel: z.enum(RISK_LEVELS),
  requiresApproval: z.boolean(),
  permissions: z.array(z.string()),
  isDelegable: z.boolean(),
  driftStatus: ToolDriftStatusSchema,
  lastVerifiedAt: z.string().optional(),
  inputSchemaJson: z.string().optional(),
  outputSchemaJson: z.string().optional(),
});
export type CapabilityCatalogItem = z.infer<typeof CapabilityCatalogItemSchema>;

// ============================================================================
// 2. AGENT PERSONA REGISTRY SCHEMAS (Roadmap §23)
// ============================================================================

export const AgentPersonaSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  role: z.string().min(1),
  description: z.string().optional(),
  maxAutonomousRiskLevel: z.enum(RISK_LEVELS),
  allowedDomains: z.array(z.string()),
  maxDurationMs: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  maxToolCalls: z.number().int().positive(),
  isConfigurable: z.boolean().default(false),
});
export type AgentPersonaSummary = z.infer<typeof AgentPersonaSummarySchema>;

// ============================================================================
// 3. PROGRESSIVE DISCOVERY SCHEMAS (Roadmap §21 & Rule 28)
// ============================================================================

export const ProgressiveDiscoveryQuerySchema = z.object({
  intent: z.string().min(1),
  domain: z.string().optional(),
  limit: z.number().int().positive().max(50).default(10),
  maxTokens: z.number().int().positive().max(2000).default(500),
  allowedRiskCeiling: z.enum(RISK_LEVELS).optional(),
});
export type ProgressiveDiscoveryQuery = z.infer<typeof ProgressiveDiscoveryQuerySchema>;

export const DiscoveryStubSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().min(1),
  riskLevel: z.enum(RISK_LEVELS),
  estimatedTokens: z.number().int().positive().max(45), // Clamped strictly to <= 45 tokens per stub
});
export type DiscoveryStub = z.infer<typeof DiscoveryStubSchema>;

export const ProgressiveDiscoveryResultSchema = z.object({
  stubs: z.array(DiscoveryStubSchema),
  totalTokenEstimate: z.number().int().nonnegative(),
  matchedIntent: z.string(),
  hasMore: z.boolean(),
});
export type ProgressiveDiscoveryResult = z.infer<typeof ProgressiveDiscoveryResultSchema>;

// ============================================================================
// 4. PLATFORM AUTO-DOCUMENTATION SCHEMAS (Roadmap §25)
// ============================================================================

export const DocumentationExportFormatSchema = z.enum([
  'OPENAPI_3_1',
  'MCP_MANIFEST',
  'MARKDOWN_DOSSIER',
]);
export type DocumentationExportFormat = z.infer<typeof DocumentationExportFormatSchema>;

export const GenerateDocumentationInputSchema = z.object({
  format: DocumentationExportFormatSchema,
  domain: z.string().optional(),
  capabilityId: z.string().optional(),
  includeExamples: z.boolean().default(true),
});
export type GenerateDocumentationInput = z.infer<typeof GenerateDocumentationInputSchema>;

// ============================================================================
// 5. STRUCTURED ERROR TAXONOMY (Rules 2, 48)
// ============================================================================

export const REGISTRY_ERROR_CODES = {
  CAPABILITY_NOT_FOUND: 'REGISTRY_CAPABILITY_NOT_FOUND',
  PERSONA_NOT_FOUND: 'REGISTRY_PERSONA_NOT_FOUND',
  UNAUTHORIZED_MUTATION: 'REGISTRY_UNAUTHORIZED_MUTATION',
  DEAD_MAN_PAUSED: 'REGISTRY_DEAD_MAN_PAUSED',
  IDOR_VIOLATION: 'REGISTRY_IDOR_VIOLATION',
  INVALID_QUERY: 'REGISTRY_INVALID_QUERY',
  TOKEN_BUDGET_EXCEEDED: 'REGISTRY_TOKEN_BUDGET_EXCEEDED',
  DOC_GENERATION_FAILED: 'REGISTRY_DOC_GENERATION_FAILED',
} as const;

export type RegistryErrorCode = (typeof REGISTRY_ERROR_CODES)[keyof typeof REGISTRY_ERROR_CODES];

export class RegistryDomainError extends Error {
  readonly code: RegistryErrorCode;
  readonly httpStatus: number;

  constructor(code: RegistryErrorCode, message: string, httpStatus = 500) {
    super(message);
    this.name = 'RegistryDomainError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ============================================================================
// 6. THE 4 MANDATORY GOVERNANCE MATRICES (Rules 1940-1953)
// ============================================================================

/**
 * 6.1 REGISTRY_PERMISSION_MATRIX (Rules 8, 16, 17)
 * Strictly separates agent discovery privileges from human admin configuration privileges.
 */
export const REGISTRY_PERMISSION_MATRIX: Readonly<Record<string, readonly string[]>> = {
  all_agent_personas: ['registry:read', 'discovery:search', 'workspace:read'],
  supervisor: ['registry:read', 'discovery:search', 'workspace:read'],
  admin_user: ['registry:read', 'discovery:search', 'registry:manage', 'persona:configure', 'workspace:read'],
};

/**
 * 6.2 REGISTRY_TOOL_MATRIX (Rules 12, 14, 17)
 * Inventory of registry & progressive discovery capabilities with risk levels and delegation rules.
 */
export const REGISTRY_TOOL_MATRIX: Readonly<
  Record<
    string,
    {
      readonly level: RiskLevel;
      readonly isDelegable: boolean;
      readonly isIdempotent: boolean;
      readonly auditRequired: boolean;
      readonly description: string;
    }
  >
> = {
  'discovery.search_capabilities': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: false,
    auditRequired: false,
    description: 'Searches capability catalog using hierarchical intent filtering and returns minimal stubs.',
  },
  'discovery.get_capability_details': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: false,
    auditRequired: false,
    description: 'Retrieves full schema, policy, and drift metadata for a specific capability ID.',
  },
  'registry.generate_documentation': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: false,
    auditRequired: true,
    description: 'Compiles runtime capability definitions into OpenAPI 3.1.0 or Markdown reference guides.',
  },
  'registry.export_mcp_manifest': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: false,
    auditRequired: true,
    description: 'Exports runtime capabilities as an MCP 2026-07-28 compliant tools manifest.',
  },
  'registry.update_agent_persona_config': {
    level: 'L2_STATE_MUTATION',
    isDelegable: false,
    isIdempotent: true,
    auditRequired: true,
    description: 'Updates configuration, budget, or allowed domains of an agent persona (Non-Delegable, human admin only).',
  },
};

/**
 * 6.3 REGISTRY_FAILURE_MATRIX (Rules 2, 24, 48)
 * Deterministic recovery mappings for registry operations.
 */
export const REGISTRY_FAILURE_MATRIX: Readonly<
  Record<
    string,
    {
      readonly httpStatus: number;
      readonly recoveryStrategy: 'FAIL_CLOSED' | 'FAIL_GRACEFULLY' | 'FALLBACK_TO_DEFAULT';
      readonly description: string;
    }
  >
> = {
  REGISTRY_CAPABILITY_NOT_FOUND: {
    httpStatus: 404,
    recoveryStrategy: 'FAIL_GRACEFULLY',
    description: 'Target capability was not found in registry; return empty set.',
  },
  REGISTRY_PERSONA_NOT_FOUND: {
    httpStatus: 404,
    recoveryStrategy: 'FALLBACK_TO_DEFAULT',
    description: 'Target persona was not found; fallback to default built-in definition.',
  },
  REGISTRY_UNAUTHORIZED_MUTATION: {
    httpStatus: 403,
    recoveryStrategy: 'FAIL_CLOSED',
    description: 'Autonomous mutation rejected under Rule 17 Non-Delegable Decider policy.',
  },
  REGISTRY_DEAD_MAN_PAUSED: {
    httpStatus: 503,
    recoveryStrategy: 'FAIL_CLOSED',
    description: 'Registry modifications halted due to active emergency governance kill switch.',
  },
  REGISTRY_IDOR_VIOLATION: {
    httpStatus: 403,
    recoveryStrategy: 'FAIL_CLOSED',
    description: 'Cross-tenant IDOR access probe detected and blocked.',
  },
  REGISTRY_INVALID_QUERY: {
    httpStatus: 400,
    recoveryStrategy: 'FAIL_CLOSED',
    description: 'Malformed discovery or documentation query input rejected.',
  },
  REGISTRY_TOKEN_BUDGET_EXCEEDED: {
    httpStatus: 422,
    recoveryStrategy: 'FAIL_GRACEFULLY',
    description: 'Discovery response exceeded token budget; pruned output returned.',
  },
  REGISTRY_DOC_GENERATION_FAILED: {
    httpStatus: 500,
    recoveryStrategy: 'FAIL_CLOSED',
    description: 'Failed to compile AST into requested documentation format.',
  },
};

/**
 * 6.4 REGISTRY_ROLLBACK_MATRIX (Rule 27)
 * Reverse-LIFO Saga compensating capability mappings.
 */
export const REGISTRY_ROLLBACK_MATRIX: Readonly<Record<string, string | null>> = {
  'registry.update_agent_persona_config': 'registry.restore_agent_persona_config',
  'discovery.search_capabilities': null,
  'discovery.get_capability_details': null,
  'registry.generate_documentation': null,
  'registry.export_mcp_manifest': null,
};
