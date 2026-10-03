/**
 * @fileOverview Tiered Model Router Contracts & Circuit Breaker Schemas
 *
 * Implements the type contracts and Zod schemas for the multi-model reasoning tier
 * of the SmartSapp Autonomous Agent Runtime.
 *
 * Governing Rules:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 24: 5-State Circuit Breakers (healthy -> degraded -> open -> half-open -> recovered).
 * - Rule 39: OpenTelemetry tracing propagation (`traceId`, `spanId`).
 * - Rule 43 & 44: Deterministic simulation & replay support.
 * - Rule 46: Model fingerprinting & prompt versioning telemetry.
 * - Rule 58: Tiered Model Routing (Flash for extraction/triage, Pro for DAG planning/replanning).
 */

import { z } from 'zod/v4';

// ============================================================================
// 1. MODEL TIERS & TASK ROUTING CATEGORIES (Rule 58)
// ============================================================================

export const MODEL_TIERS = ['flash', 'pro'] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export const TASK_ROUTING_CATEGORIES = [
  // Fast / Flash Tier (< 1.5s latency target)
  'classification',
  'extraction',
  'summarization',
  'triage',
  'single_step_tool',
  // Deep Reasoning / Pro Tier (Complex cognition)
  'dag_planning',
  'dynamic_replanning',
  'deep_reasoning',
  'critique',
  'cross_domain_synthesis',
] as const;

export type TaskRoutingCategory = (typeof TASK_ROUTING_CATEGORIES)[number];

export const DEFAULT_MODEL_NAMES: Record<ModelTier, string> = {
  flash: 'gemini-2.5-flash',
  pro: 'gemini-2.5-pro',
};

// ============================================================================
// 2. 5-STATE CIRCUIT BREAKER CONTRACTS (Rule 24)
// ============================================================================

export const CIRCUIT_BREAKER_STATES = [
  'healthy',
  'degraded',
  'open',
  'half_open',
  'recovered',
] as const;

export type CircuitBreakerState = (typeof CIRCUIT_BREAKER_STATES)[number];

export const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().int().min(1).max(20).default(3),
  recoveryThreshold: z.number().int().min(1).max(10).default(2),
  resetTimeoutMs: z.number().int().min(10).max(300000).default(30000), // min 10ms (tests), default 30s
  degradedThreshold: z.number().int().min(1).max(10).default(2),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

export interface CircuitBreakerSnapshot {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
  openedAt?: string;
}

// ============================================================================
// 3. MODEL TELEMETRY & ROUTING OPTIONS (Rules 39, 46, 58)
// ============================================================================

export const ModelTelemetrySchema = z.object({
  modelId: z.string().min(1),
  tier: z.enum(MODEL_TIERS),
  isDegradedFallback: z.boolean().default(false),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  latencyMs: z.number().int().min(0),
  temperature: z.number().min(0).max(2).optional(),
  promptVersion: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type ModelTelemetry = z.infer<typeof ModelTelemetrySchema>;

export const ModelRoutingOptionsSchema = z.object({
  taskCategory: z.enum(TASK_ROUTING_CATEGORIES).optional(),
  preferredTier: z.enum(MODEL_TIERS).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  correlationId: z.string().optional(),
  promptVersion: z.string().optional(),
  systemInstruction: z.string().optional(),
  abortSignal: z.custom<AbortSignal>().optional(),
});

export type ModelRoutingOptions = z.infer<typeof ModelRoutingOptionsSchema>;

// ============================================================================
// 4. MODEL PROVIDER CONTRACTS (Rule 43 & Rule 44)
// ============================================================================

export interface ModelGenerationResult<T = string> {
  data: T;
  telemetry: ModelTelemetry;
}

export interface ModelProvider {
  readonly name: string;
  generateText(
    prompt: string,
    options?: ModelRoutingOptions
  ): Promise<ModelGenerationResult<string>>;
  generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: ModelRoutingOptions
  ): Promise<ModelGenerationResult<T>>;
}
