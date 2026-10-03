/**
 * @fileOverview Cryptographic Tool Fingerprinting Types & Canonical Hashes (Phase 5 Milestone 3 Task 1)
 *
 * Implements Rule 14 (Tool Poisoning / Rug-Pull Defense), Rule 4 (Zero any/any[]),
 * Rule 8 & 50 (Tenant Isolation), Rule 10 (Inline Architectural Docs), Rule 12 (Annotations are hints),
 * Rule 22 (Cryptographic Hash Binding), Rule 31 (Description Engineering), and Rule 36 (Capability Versioning).
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Single Source of Truth for Tool Fingerprinting:
 *    A tool fingerprint binds:
 *    Fingerprint = SHA256(toolId || version || descriptionHash || schemaHash || permissionHash || riskHash)
 * 2. Determinism:
 *    Input and output schemas are converted to canonical JSON schemas before hashing, ensuring
 *    key ordering never causes artificial hash divergence.
 * 3. Fail Closed:
 *    Any discrepancy in schema, permissions, descriptions, or risk classification between the live
 *    capability definition and the approved fingerprint raises TOOL_FINGERPRINT_DRIFT.
 */

import { z } from 'zod/v4';
import { sha256Hex } from '../../capabilities/contracts/canonical-json';
import type {
  AnyCapabilityDefinition,
  SchemaParser,
} from '../../capabilities/contracts/capability-definition';
import type { RiskMetadata } from '../../capabilities/contracts/risk-levels';
import { toMcpToolSchema } from '../to-mcp-tool-schema';

export const FINGERPRINT_ERROR_CODES = {
  TOOL_FINGERPRINT_DRIFT: 'TOOL_FINGERPRINT_DRIFT',
  TOOL_FINGERPRINT_NOT_FOUND: 'TOOL_FINGERPRINT_NOT_FOUND',
  INVALID_FINGERPRINT_PAYLOAD: 'INVALID_FINGERPRINT_PAYLOAD',
  UNAUTHORIZED_FINGERPRINT_OPERATION: 'UNAUTHORIZED_FINGERPRINT_OPERATION',
} as const;

export type FingerprintErrorCode =
  (typeof FINGERPRINT_ERROR_CODES)[keyof typeof FINGERPRINT_ERROR_CODES];

export const ToolDriftTypeSchema = z.enum([
  'schema',
  'description',
  'permission',
  'risk',
  'version',
  'none',
]);

export type ToolDriftType = z.infer<typeof ToolDriftTypeSchema>;

export const ToolDriftSeveritySchema = z.enum([
  'none',
  'low',
  'medium',
  'high',
  'critical',
]);

export type ToolDriftSeverity = z.infer<typeof ToolDriftSeveritySchema>;

export const ToolFingerprintSchema = z.object({
  toolId: z.string().min(1),
  version: z.string().min(1),
  schemaHash: z.string().length(64),
  descriptionHash: z.string().length(64),
  permissionHash: z.string().length(64),
  riskHash: z.string().length(64),
  compositeHash: z.string().length(64),
  approvedAt: z.string().datetime(),
  approvedBy: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
});

export type ToolFingerprint = z.infer<typeof ToolFingerprintSchema>;

export const ToolDriftReportSchema = z.object({
  toolId: z.string(),
  version: z.string(),
  hasDrift: z.boolean(),
  driftTypes: z.array(ToolDriftTypeSchema),
  severity: ToolDriftSeveritySchema,
  reason: z.string().optional(),
  details: z.object({
    schemaChanged: z.boolean().optional(),
    descriptionChanged: z.boolean().optional(),
    permissionChanged: z.boolean().optional(),
    riskChanged: z.boolean().optional(),
    versionChanged: z.boolean().optional(),
    currentCompositeHash: z.string(),
    approvedCompositeHash: z.string().optional(),
  }),
});

export type ToolDriftReport = z.infer<typeof ToolDriftReportSchema>;

export interface TenantContext {
  organizationId: string;
  workspaceId: string;
}

/**
 * Extracts standard JSON Schema from input and output schemas and returns a deterministic SHA-256 hash.
 */
export function hashCapabilitySchemas(
  inputSchema: z.ZodType<unknown> | SchemaParser<unknown>,
  outputSchema: z.ZodType<unknown> | SchemaParser<unknown>
): string {
  const stdInput = toMcpToolSchema(inputSchema);
  const stdOutput = toMcpToolSchema(outputSchema);

  const inputJson = stdInput['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
  const outputJson = stdOutput['~standard'].jsonSchema.output({ target: 'draft-2020-12' });

  return sha256Hex({
    input: inputJson,
    output: outputJson,
  });
}

/**
 * Normalizes description text and returns its SHA-256 hash.
 */
export function hashToolDescription(description: string): string {
  const normalized = description.trim().replace(/\s+/g, ' ');
  return sha256Hex(normalized);
}

/**
 * Sorts and canonically hashes the required permissions array.
 */
export function hashToolPermissions(permissions: readonly string[]): string {
  const sorted = [...permissions].sort();
  return sha256Hex(sorted);
}

/**
 * Hashes risk metadata attributes relevant to governance and approval gating (Rule 12 & Rule 14).
 */
export function hashToolRisk(risk: RiskMetadata): string {
  return sha256Hex({
    level: risk.level,
    destructive: risk.destructive,
    idempotent: risk.idempotent,
    openWorld: risk.openWorld,
    requiresHumanApproval: risk.requiresHumanApproval,
    nonDelegable: risk.nonDelegable,
  });
}

/**
 * Computes the composite canonical tool fingerprint:
 * Fingerprint = SHA256(toolId || version || descriptionHash || schemaHash || permissionHash || riskHash)
 */
export function computeCompositeFingerprintHash(parts: {
  toolId: string;
  version: string;
  descriptionHash: string;
  schemaHash: string;
  permissionHash: string;
  riskHash: string;
}): string {
  const canonicalString = `${parts.toolId}:${parts.version}:${parts.descriptionHash}:${parts.schemaHash}:${parts.permissionHash}:${parts.riskHash}`;
  return sha256Hex(canonicalString);
}

/**
 * Computes a complete ToolFingerprint object for a given capability definition.
 */
export function computeToolFingerprint(
  capability: AnyCapabilityDefinition,
  tenant: TenantContext,
  approvedBy = 'system:unapproved',
  approvedAt?: string
): ToolFingerprint {
  const schemaHash = hashCapabilitySchemas(capability.inputSchema, capability.outputSchema);
  const descriptionHash = hashToolDescription(capability.description);
  const permissionHash = hashToolPermissions(capability.permissions);
  const riskHash = hashToolRisk(capability.risk);

  const compositeHash = computeCompositeFingerprintHash({
    toolId: capability.id,
    version: capability.version,
    descriptionHash,
    schemaHash,
    permissionHash,
    riskHash,
  });

  return {
    toolId: capability.id,
    version: capability.version,
    schemaHash,
    descriptionHash,
    permissionHash,
    riskHash,
    compositeHash,
    approvedAt: approvedAt || new Date().toISOString(),
    approvedBy,
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
  };
}

/**
 * Compares a live CapabilityDefinition against an approved ToolFingerprint, detecting any parameter,
 * description, permission, or risk classification drift.
 */
export function detectToolDrift(
  capability: AnyCapabilityDefinition,
  approvedFingerprint: ToolFingerprint
): ToolDriftReport {
  const currentFp = computeToolFingerprint(
    capability,
    {
      organizationId: approvedFingerprint.organizationId,
      workspaceId: approvedFingerprint.workspaceId,
    },
    approvedFingerprint.approvedBy,
    approvedFingerprint.approvedAt
  );

  const schemaChanged = currentFp.schemaHash !== approvedFingerprint.schemaHash;
  const descriptionChanged = currentFp.descriptionHash !== approvedFingerprint.descriptionHash;
  const permissionChanged = currentFp.permissionHash !== approvedFingerprint.permissionHash;
  const riskChanged = currentFp.riskHash !== approvedFingerprint.riskHash;
  const versionChanged = currentFp.version !== approvedFingerprint.version;

  const driftTypes: ToolDriftType[] = [];
  if (schemaChanged) driftTypes.push('schema');
  if (descriptionChanged) driftTypes.push('description');
  if (permissionChanged) driftTypes.push('permission');
  if (riskChanged) driftTypes.push('risk');
  if (versionChanged) driftTypes.push('version');

  const hasDrift = driftTypes.length > 0;

  // Determine severity:
  // - Permission or risk change = critical (potential privilege escalation or approval bypass)
  // - Schema change = high (payload tampering or rug-pull)
  // - Description change = medium/high (stealth prompt injection or intent alteration)
  // - Version bump = low
  let severity: ToolDriftSeverity = 'none';
  if (permissionChanged || riskChanged) {
    severity = 'critical';
  } else if (schemaChanged) {
    severity = 'high';
  } else if (descriptionChanged) {
    severity = 'high';
  } else if (versionChanged) {
    severity = 'low';
  }

  return {
    toolId: capability.id,
    version: capability.version,
    hasDrift,
    driftTypes,
    severity,
    reason: hasDrift ? `Drift detected in: ${driftTypes.join(', ')}` : undefined,
    details: {
      schemaChanged,
      descriptionChanged,
      permissionChanged,
      riskChanged,
      versionChanged,
      currentCompositeHash: currentFp.compositeHash,
      approvedCompositeHash: approvedFingerprint.compositeHash,
    },
  };
}
