/**
 * @fileOverview Canonical Command Contracts & Taxonomy
 *
 * Implements the 5 canonical command intent types, classification input/output schemas,
 * contextual suggestion contracts, execution result models, and error taxonomy for the
 * Global AI Command Center and ⌘K Omni-Bar.
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]` typing policy.
 * - Rule 8 & 47: Strict multi-tenant isolation schemas (organizationId & workspaceId).
 * - Rule 10: Inline architectural documentation.
 * - Rule 19: Deterministic idempotency key derivation.
 * - Rule 68: "No Dead Ends" structured execution outcomes.
 */

import { z } from 'zod/v4';
import { createHash } from 'crypto';

/**
 * 5 Canonical Command Intent Types (Roadmap §PHASE 8 lines 1279-1288)
 */
export const COMMAND_INTENTS = [
  'SEARCH',
  'ANALYZE',
  'EXECUTE',
  'DELEGATE',
  'AUTOMATE',
] as const;

export const CommandIntentSchema = z.enum(COMMAND_INTENTS);
export type CommandIntent = z.infer<typeof CommandIntentSchema>;

/**
 * Command Classification Input Schema (Rule 4 & Rule 8)
 */
export const CommandClassificationInputSchema = z.object({
  prompt: z.string().min(1).max(1000),
  contextEntityId: z.string().optional(),
  contextEntityType: z.string().optional(),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
});
export type CommandClassificationInput = z.infer<typeof CommandClassificationInputSchema>;

/**
 * Target Entity Mention Schema
 */
export const TargetEntityMentionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  href: z.string().min(1),
});
export type TargetEntityMention = z.infer<typeof TargetEntityMentionSchema>;

/**
 * Suggested Action Blueprint Schema
 */
export const SuggestedActionBlueprintSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  intent: CommandIntentSchema,
  capabilityId: z.string().optional(),
  agentPersonaId: z.string().optional(),
  workflowTemplateId: z.string().optional(),
  estimatedRiskLevel: z.enum([
    'L0_READ',
    'L1_SESSION_WRITE',
    'L2_STATE_MUTATION',
    'L3_EXTERNAL_SIDE_EFFECT',
    'L4_PRIVILEGED_DESTRUCTIVE',
  ]),
  requiresApproval: z.boolean().default(false),
});
export type SuggestedActionBlueprint = z.infer<typeof SuggestedActionBlueprintSchema>;

/**
 * Command Classification Result Schema (Rule 47)
 */
export const CommandClassificationResultSchema = z.object({
  intent: CommandIntentSchema,
  confidence: z.number().min(0).max(1),
  targetDomain: z.string().optional(),
  targetEntities: z.array(TargetEntityMentionSchema).default([]),
  suggestedAction: SuggestedActionBlueprintSchema,
  suggestedPlan: z.array(z.string()).default([]),
  sanitizedPrompt: z.string(),
  latencyMs: z.number().nonnegative(),
});
export type CommandClassificationResult = z.infer<typeof CommandClassificationResultSchema>;

/**
 * Contextual Suggestion Item Schema
 */
export const CommandSuggestionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  prompt: z.string().min(1),
  intent: CommandIntentSchema,
  icon: z.string().optional(),
  badge: z.string().optional(),
});
export type CommandSuggestion = z.infer<typeof CommandSuggestionSchema>;

/**
 * Command Execution Input Schema (Rule 19)
 */
export const ExecuteCommandInputSchema = z.object({
  prompt: z.string().min(1).max(2000),
  intent: CommandIntentSchema,
  selectedActionId: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
});
export type ExecuteCommandInput = z.infer<typeof ExecuteCommandInputSchema>;

/**
 * Command Execution Outcome Schema (Rule 68 "No Dead Ends")
 */
export const CommandExecutionResultSchema = z.object({
  executionId: z.string().min(1),
  status: z.enum(['completed', 'started', 'waiting_for_approval', 'failed']),
  intent: CommandIntentSchema,
  summary: z.string().min(1),
  data: z.unknown().optional(),
  redirectUrl: z.string().optional(),
  runId: z.string().optional(),
  workflowId: z.string().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
  executedAt: z.string().datetime(),
});
export type CommandExecutionResult = z.infer<typeof CommandExecutionResultSchema>;

/**
 * Error Taxonomy & Typed Class (Rule 4)
 */
export const COMMAND_ERROR_CODES = {
  INVALID_INTENT: 'COMMAND_INVALID_INTENT',
  EXECUTION_FAILED: 'COMMAND_EXECUTION_FAILED',
  DEAD_MAN_PAUSED: 'COMMAND_DEAD_MAN_PAUSED',
  TENANT_REQUIRED: 'COMMAND_TENANT_REQUIRED',
  PROMPT_POISONED: 'COMMAND_PROMPT_POISONED',
  MODEL_UNAVAILABLE: 'COMMAND_MODEL_UNAVAILABLE',
  IDOR_VIOLATION: 'COMMAND_IDOR_VIOLATION',
  RATE_LIMITED: 'COMMAND_RATE_LIMITED',
} as const;

export type CommandErrorCode = (typeof COMMAND_ERROR_CODES)[keyof typeof COMMAND_ERROR_CODES];

export class CommandError extends Error {
  constructor(
    public readonly code: CommandErrorCode | string,
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

/**
 * Maps a CommandError or unknown exception to standard HTTP status code
 */
export function mapCommandErrorToHttpStatus(error: unknown): number {
  if (error instanceof CommandError) {
    return error.status;
  }
  return 500;
}

/**
 * Generates a deterministic idempotency key for command execution (Rule 19)
 * derived from prompt + orgId + userId + minute window.
 */
export function computeCommandIdempotencyKey(
  prompt: string,
  organizationId: string,
  callerId: string,
  windowMinutes: number = 1
): string {
  const currentWindow = Math.floor(Date.now() / (windowMinutes * 60 * 1000));
  const normalizedPrompt = prompt.trim().toLowerCase();
  const raw = `${organizationId}:${callerId}:${currentWindow}:${normalizedPrompt}`;
  return `cmd_idemp_${createHash('sha256').update(raw).digest('hex').substring(0, 24)}`;
}
