/**
 * @fileOverview Data Egress Policy & Exfiltration Scanner Contracts (Phase 5 Milestone 3 Task 5)
 *
 * Implements Rule 4 (Zero any/any[]), Rule 9 (Cloud Run Payload Limits), Rule 10 (Inline Architectural Docs),
 * Rule 13 (Never Trust the Model), Rule 23 (Bounded Depth & Traversal), Rule 32 (Cross-Domain Data Exfiltration),
 * Rule 33 (Egress Channel Control), Rule 40 (Append-Only Audit Logging), and Rule 48 (Sanitize Tool Errors).
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. 7-Tier Sensitivity Hierarchy:
 *    Ordered strictly by exposure risk:
 *    `public` (0) < `internal` (1) < `confidential` (2) < `restricted` (3) < `personal` (4) < `financial` (5) < `credential` (6).
 * 2. Unconditional Credential Egress Ban:
 *    `credential` payloads (JWTs, API keys, private keys) are strictly prohibited from crossing
 *    into external channels (`external_email`, `external_webhook`, `external_mcp_tool`, `public_portal`).
 * 3. Channel Boundary Ceilings:
 *    - `public_portal`: only `public` allowed.
 *    - `external_email`, `external_webhook`, `external_mcp_tool`: `public` and `internal` permitted;
 *      `confidential`, `restricted`, `personal`, `financial`, `credential` blocked by default.
 *    - `internal_database`, `internal_memory`: permitted up to `credential`.
 * 4. Bounded Traversal Ceiling (Rule 23):
 *    Payload traversal enforces `maxDepth = 10` and `maxPayloadSizeBytes = 100KB` to prevent ReDoS
 *    or memory exhaustion on Cloud Run serverless instances.
 */

import { z } from 'zod';

export const SENSITIVITY_LEVELS = [
  'public',
  'internal',
  'confidential',
  'restricted',
  'personal',
  'financial',
  'credential',
] as const;

export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number];

export const SENSITIVITY_WEIGHTS: Record<SensitivityLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
  personal: 4,
  financial: 5,
  credential: 6,
};

export const EGRESS_DESTINATIONS = [
  'internal_database',
  'internal_memory',
  'external_email',
  'external_webhook',
  'external_mcp_tool',
  'public_portal',
] as const;

export type EgressDestination = (typeof EGRESS_DESTINATIONS)[number];

export const EGRESS_ERROR_CODES = {
  DATA_EXFILTRATION_DETECTED: 'DATA_EXFILTRATION_DETECTED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  MAX_DEPTH_EXCEEDED: 'MAX_DEPTH_EXCEEDED',
  UNSUPPORTED_DESTINATION: 'UNSUPPORTED_DESTINATION',
} as const;

export type EgressErrorCode = (typeof EGRESS_ERROR_CODES)[keyof typeof EGRESS_ERROR_CODES];

export interface DetectedSensitivity {
  category: SensitivityLevel;
  patternName: string;
  path: string;
  snippet?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface EgressEvaluationOptions {
  maxDepth?: number;
  maxPayloadSizeBytes?: number;
  redactionMode?: boolean;
  allowedSensitivityCeiling?: SensitivityLevel;
}

export interface EgressEvaluationResult {
  allowed: boolean;
  destination: EgressDestination;
  highestSensitivity: SensitivityLevel;
  violations: DetectedSensitivity[];
  reason?: string;
  sanitizedPayload?: unknown;
}

export const EgressDestinationSchema = z.enum(EGRESS_DESTINATIONS);
export const SensitivityLevelSchema = z.enum(SENSITIVITY_LEVELS);

export const DetectedSensitivitySchema = z.object({
  category: SensitivityLevelSchema,
  patternName: z.string(),
  path: z.string(),
  snippet: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const EgressEvaluationResultSchema = z.object({
  allowed: z.boolean(),
  destination: EgressDestinationSchema,
  highestSensitivity: SensitivityLevelSchema,
  violations: z.array(DetectedSensitivitySchema),
  reason: z.string().optional(),
  sanitizedPayload: z.unknown().optional(),
});

/**
 * Returns true if a given sensitivity level exceeds the allowed ceiling.
 */
export function isSensitivityAboveCeiling(
  candidate: SensitivityLevel,
  ceiling: SensitivityLevel
): boolean {
  return SENSITIVITY_WEIGHTS[candidate] > SENSITIVITY_WEIGHTS[ceiling];
}

/**
 * Returns the default maximum allowed sensitivity for an egress destination.
 */
export function getDefaultChannelCeiling(destination: EgressDestination): SensitivityLevel {
  switch (destination) {
    case 'public_portal':
      return 'public';
    case 'external_email':
    case 'external_webhook':
    case 'external_mcp_tool':
      return 'internal';
    case 'internal_database':
    case 'internal_memory':
    default:
      return 'credential';
  }
}
