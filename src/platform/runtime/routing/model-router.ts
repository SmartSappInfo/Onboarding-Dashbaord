/**
 * @fileOverview Tiered Model Router & 5-State Circuit Breakers (Rule 58 & Rule 24)
 *
 * Implements the core multi-model gateway for the SmartSapp Autonomous Agent Runtime:
 * - Directs light tasks to Flash (gemini-2.5-flash) and heavy tasks to Pro (gemini-2.5-pro).
 * - Enforces 5-state circuit breakers per model endpoint with automatic fallback.
 * - Provides full OpenTelemetry and token usage telemetry.
 *
 * Governing Rules:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 24: 5-State Circuit Breaker (healthy -> degraded -> open -> half-open -> recovered).
 * - Rule 43 & 44: Deterministic simulation and mock provider for hermetic testing.
 * - Rule 46: Model fingerprinting & prompt versioning telemetry.
 * - Rule 47: Never trust the model (validates structured outputs against Zod schemas).
 * - Rule 58: Tiered Model Routing Policy.
 * - Rule 69: Strangler Fig Pattern SSOT & HMR preservation.
 */

import { z } from 'zod/v4';
import {
  type ModelTier,
  type TaskRoutingCategory,
  type CircuitBreakerConfig,
  type CircuitBreakerSnapshot,
  type CircuitBreakerState,
  type ModelTelemetry,
  type ModelRoutingOptions,
  type ModelGenerationResult,
  type ModelProvider,
  CircuitBreakerConfigSchema,
  DEFAULT_MODEL_NAMES,
} from './model-router-types';
import { AgentRuntimeError } from '../agent-run-types';

// ============================================================================
// 1. 5-STATE CIRCUIT BREAKER IMPLEMENTATION (Rule 24)
// ============================================================================

export class CircuitBreaker {
  private state: CircuitBreakerState = 'healthy';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureAt?: string;
  private lastSuccessAt?: string;
  private openedAt?: number;
  private readonly config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = CircuitBreakerConfigSchema.parse(config || {});
  }

  canExecute(): boolean {
    const now = Date.now();

    if (this.state === 'open') {
      if (this.openedAt && now - this.openedAt >= this.config.resetTimeoutMs) {
        // Cooldown expired, transition to half-open to probe recovery
        this.state = 'half_open';
        this.consecutiveSuccesses = 0;
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess(): void {
    const nowIso = new Date().toISOString();
    this.lastSuccessAt = nowIso;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses += 1;

    if (this.state === 'half_open') {
      if (this.consecutiveSuccesses >= this.config.recoveryThreshold) {
        this.state = 'healthy';
        this.openedAt = undefined;
      }
    } else if (this.state === 'degraded') {
      this.state = 'healthy';
    }
  }

  recordFailure(): void {
    const now = Date.now();
    const nowIso = new Date().toISOString();
    this.lastFailureAt = nowIso;
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures += 1;

    if (this.state === 'half_open') {
      // Immediate trip back to open if probe fails
      this.state = 'open';
      this.openedAt = now;
    } else if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = 'open';
      this.openedAt = now;
    } else if (this.consecutiveFailures >= this.config.degradedThreshold) {
      this.state = 'degraded';
    }
  }

  getStatus(): CircuitBreakerSnapshot {
    // Check if open state has cooled down into half_open
    if (this.state === 'open' && this.openedAt && Date.now() - this.openedAt >= this.config.resetTimeoutMs) {
      this.state = 'half_open';
    }

    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : undefined,
    };
  }

  forceState(state: CircuitBreakerState): void {
    this.state = state;
    if (state === 'open') {
      this.openedAt = Date.now();
    } else {
      this.openedAt = undefined;
      this.consecutiveFailures = 0;
    }
  }
}

// ============================================================================
// 2. DETERMINISTIC MOCK MODEL PROVIDER (Rules 43 & 44)
// ============================================================================

export class DeterministicMockModelProvider implements ModelProvider {
  readonly name: string;
  readonly tier: ModelTier;
  public callCount = 0;
  public invocations: Array<{ prompt: string; options?: ModelRoutingOptions }> = [];
  private queuedResponses: string[] = [];
  private queuedErrors: Error[] = [];

  constructor(name: string, tier: ModelTier) {
    this.name = name;
    this.tier = tier;
  }

  enqueueResponse(response: string): void {
    this.queuedResponses.push(response);
  }

  enqueueError(error: Error): void {
    this.queuedErrors.push(error);
  }

  async generateText(
    prompt: string,
    options?: ModelRoutingOptions
  ): Promise<ModelGenerationResult<string>> {
    this.callCount += 1;
    this.invocations.push({ prompt, options });

    if (this.queuedErrors.length > 0) {
      const err = this.queuedErrors.shift()!;
      throw err;
    }

    const text =
      this.queuedResponses.length > 0
        ? this.queuedResponses.shift()!
        : `Mock response for prompt: ${prompt.slice(0, 30)}...`;

    const promptTokens = Math.max(1, Math.ceil(prompt.length / 4));
    const completionTokens = Math.max(1, Math.ceil(text.length / 4));

    const telemetry: ModelTelemetry = {
      modelId: DEFAULT_MODEL_NAMES[this.tier],
      tier: this.tier,
      isDegradedFallback: false,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      latencyMs: 15,
      temperature: options?.temperature,
      promptVersion: options?.promptVersion,
      traceId: options?.traceId,
      spanId: options?.spanId,
      timestamp: new Date().toISOString(),
    };

    return { data: text, telemetry };
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: ModelRoutingOptions
  ): Promise<ModelGenerationResult<T>> {
    const textResult = await this.generateText(prompt, options);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(textResult.data);
    } catch {
      throw new AgentRuntimeError({
        code: 'PLANNING_FAILED',
        message: `Failed to parse structured model response as JSON: ${textResult.data.slice(0, 100)}`,
        details: { rawResponse: textResult.data },
      });
    }

    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new AgentRuntimeError({
        code: 'PLANNING_FAILED',
        message: `Structured output validation failed: ${parsed.error.message}`,
        details: { issues: parsed.error.issues, rawResponse: textResult.data },
      });
    }

    return {
      data: parsed.data,
      telemetry: textResult.telemetry,
    };
  }
}

// ============================================================================
// 3. TIERED MODEL ROUTER ENGINE (Rule 58 & Rule 24)
// ============================================================================

export interface TieredModelRouterOptions {
  providers?: Partial<Record<ModelTier, ModelProvider>>;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
}

export type GenerateOptions = ModelRoutingOptions & {
  enableFallback?: boolean;
};

export class TieredModelRouter {
  private readonly providers: Record<ModelTier, ModelProvider>;
  private readonly circuitBreakers: Record<ModelTier, CircuitBreaker>;

  constructor(options?: TieredModelRouterOptions) {
    const config = options?.circuitBreakerConfig;
    this.circuitBreakers = {
      flash: new CircuitBreaker(config),
      pro: new CircuitBreaker(config),
    };

    this.providers = {
      flash: options?.providers?.flash || new DeterministicMockModelProvider('default-flash', 'flash'),
      pro: options?.providers?.pro || new DeterministicMockModelProvider('default-pro', 'pro'),
    };
  }

  /**
   * Resolves the target model tier based on task category or explicit preference (Rule 58).
   */
  resolveTier(options?: ModelRoutingOptions): ModelTier {
    if (options?.preferredTier) {
      return options.preferredTier;
    }

    if (options?.taskCategory) {
      const proCategories: TaskRoutingCategory[] = [
        'dag_planning',
        'dynamic_replanning',
        'deep_reasoning',
        'critique',
        'cross_domain_synthesis',
      ];
      if (proCategories.includes(options.taskCategory)) {
        return 'pro';
      }
    }

    return 'flash';
  }

  getCircuitBreakerStatus(tier: ModelTier): CircuitBreakerSnapshot {
    return this.circuitBreakers[tier].getStatus();
  }

  /**
   * Generates freeform text with tiered routing and circuit breaker fallback (Rule 58 & 24).
   */
  async generateText(
    prompt: string,
    rawOptions?: GenerateOptions
  ): Promise<ModelGenerationResult<string>> {
    const targetTier = this.resolveTier(rawOptions);
    const enableFallback = rawOptions?.enableFallback !== false;

    const { provider, tier, isFallback } = this.selectExecutableProvider(targetTier, enableFallback);

    const startTime = Date.now();
    try {
      const result = await provider.generateText(prompt, rawOptions);
      this.circuitBreakers[tier].recordSuccess();

      return {
        data: result.data,
        telemetry: {
          ...result.telemetry,
          isDegradedFallback: isFallback,
          latencyMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.circuitBreakers[tier].recordFailure();

      // If pro failed during execution and fallback is permitted, attempt fallback to flash
      if (tier === 'pro' && enableFallback && this.circuitBreakers.flash.canExecute()) {
        const fallbackStartTime = Date.now();
        try {
          const fallbackResult = await this.providers.flash.generateText(prompt, rawOptions);
          this.circuitBreakers.flash.recordSuccess();

          return {
            data: fallbackResult.data,
            telemetry: {
              ...fallbackResult.telemetry,
              isDegradedFallback: true,
              latencyMs: Date.now() - fallbackStartTime,
            },
          };
        } catch (fallbackError) {
          this.circuitBreakers.flash.recordFailure();
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  /**
   * Generates strictly validated structured output against a Zod schema (Rule 47).
   */
  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    rawOptions?: GenerateOptions
  ): Promise<ModelGenerationResult<T>> {
    const targetTier = this.resolveTier(rawOptions);
    const enableFallback = rawOptions?.enableFallback !== false;

    const { provider, tier, isFallback } = this.selectExecutableProvider(targetTier, enableFallback);

    const startTime = Date.now();
    try {
      const result = await provider.generateStructured(prompt, schema, rawOptions);
      this.circuitBreakers[tier].recordSuccess();

      return {
        data: result.data,
        telemetry: {
          ...result.telemetry,
          isDegradedFallback: isFallback,
          latencyMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.circuitBreakers[tier].recordFailure();

      if (tier === 'pro' && enableFallback && this.circuitBreakers.flash.canExecute()) {
        const fallbackStartTime = Date.now();
        try {
          const fallbackResult = await this.providers.flash.generateStructured(prompt, schema, rawOptions);
          this.circuitBreakers.flash.recordSuccess();

          return {
            data: fallbackResult.data,
            telemetry: {
              ...fallbackResult.telemetry,
              isDegradedFallback: true,
              latencyMs: Date.now() - fallbackStartTime,
            },
          };
        } catch (fallbackError) {
          this.circuitBreakers.flash.recordFailure();
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  private selectExecutableProvider(
    targetTier: ModelTier,
    enableFallback: boolean
  ): { provider: ModelProvider; tier: ModelTier; isFallback: boolean } {
    const targetBreaker = this.circuitBreakers[targetTier];

    if (targetBreaker.canExecute()) {
      return {
        provider: this.providers[targetTier],
        tier: targetTier,
        isFallback: false,
      };
    }

    // Target tier is open. Attempt downgrade fallback if Pro was requested
    if (targetTier === 'pro' && enableFallback && this.circuitBreakers.flash.canExecute()) {
      return {
        provider: this.providers.flash,
        tier: 'flash',
        isFallback: true,
      };
    }

    // Both requested tier and fallback are unavailable
    throw new AgentRuntimeError({
      code: 'CIRCUIT_BREAKER_OPEN',
      message: `Model tier '${targetTier}' circuit breaker is OPEN and no fallback provider is available.`,
      details: {
        proStatus: this.circuitBreakers.pro.getStatus(),
        flashStatus: this.circuitBreakers.flash.getStatus(),
      },
    });
  }
}

// ============================================================================
// 4. HMR-SAFE SINGLETON (Rule 69)
// ============================================================================

declare global {
  var __smartsappModelRouter: TieredModelRouter | undefined;
}

export function getModelRouter(options?: TieredModelRouterOptions): TieredModelRouter {
  if (process.env.NODE_ENV === 'test') {
    return new TieredModelRouter(options);
  }

  if (!globalThis.__smartsappModelRouter) {
    globalThis.__smartsappModelRouter = new TieredModelRouter(options);
  }

  return globalThis.__smartsappModelRouter;
}
