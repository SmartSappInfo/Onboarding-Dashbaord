/**
 * @fileOverview Circuit Breaker Pattern for Event Sinks (Milestone 1)
 *
 * Implements Rule 24 (Circuit Breakers) and Rule 9 (Load & Concurrency Limits).
 *
 * Protects event dispatch workers from cascade failure when downstream external
 * sinks or subscribers become unresponsive or fail repeatedly.
 *
 * State Machine:
 *   CLOSED (Healthy)
 *     ↓ (failure)
 *   DEGRADED (Occasional errors, below threshold)
 *     ↓ (reaches failureThreshold)
 *   OPEN (Tripped, fast-failing)
 *     ↓ (after coolOffPeriodMs)
 *   HALF-OPEN (Probing recovery)
 *     ↓ (halfOpenSuccessThreshold consecutive successes)
 *   CLOSED (Recovered)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 *
 * @testability Covered in `src/platform/__tests__/events/circuit-breaker.test.ts`.
 */

export type CircuitState = 'CLOSED' | 'DEGRADED' | 'OPEN' | 'HALF-OPEN';

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Consecutive failures to trip (default 5)
  coolOffPeriodMs?: number; // Duration in ms before half-open probe (default 30000)
  halfOpenSuccessThreshold?: number; // Consecutive successes to close (default 2)
}

interface CircuitMetrics {
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  trippedAt?: number;
  lastFailureTime?: number;
}

export class CircuitBreakerOpenError extends Error {
  public readonly code = 'CIRCUIT_BREAKER_OPEN';
  public readonly key: string;
  public readonly coolOffRemainingMs: number;

  constructor(key: string, coolOffRemainingMs: number) {
    super(`Circuit breaker is OPEN for '${key}'. Cool-off remaining: ${coolOffRemainingMs}ms.`);
    this.name = 'CircuitBreakerOpenError';
    this.key = key;
    this.coolOffRemainingMs = coolOffRemainingMs;
  }
}

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly coolOffPeriodMs: number;
  private readonly halfOpenSuccessThreshold: number;
  private readonly circuits = new Map<string, CircuitMetrics>();

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.coolOffPeriodMs = config.coolOffPeriodMs ?? 30000;
    this.halfOpenSuccessThreshold = config.halfOpenSuccessThreshold ?? 2;
  }

  public getState(key: string): CircuitState {
    const metrics = this.getOrCreateMetrics(key);
    this.evaluateStateTransitions(metrics);
    return metrics.state;
  }

  public async execute<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const metrics = this.getOrCreateMetrics(key);
    this.evaluateStateTransitions(metrics);

    if (metrics.state === 'OPEN') {
      const elapsed = Date.now() - (metrics.trippedAt ?? 0);
      const remaining = Math.max(0, this.coolOffPeriodMs - elapsed);
      throw new CircuitBreakerOpenError(key, remaining);
    }

    try {
      const result = await operation();
      this.recordSuccess(metrics);
      return result;
    } catch (err) {
      this.recordFailure(metrics);
      throw err;
    }
  }

  public reset(key: string): void {
    this.circuits.delete(key);
  }

  private getOrCreateMetrics(key: string): CircuitMetrics {
    let metrics = this.circuits.get(key);
    if (!metrics) {
      metrics = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
      };
      this.circuits.set(key, metrics);
    }
    return metrics;
  }

  private evaluateStateTransitions(metrics: CircuitMetrics): void {
    if (metrics.state === 'OPEN') {
      const elapsed = Date.now() - (metrics.trippedAt ?? 0);
      if (elapsed >= this.coolOffPeriodMs) {
        metrics.state = 'HALF-OPEN';
        metrics.consecutiveSuccesses = 0;
      }
    }
  }

  private recordSuccess(metrics: CircuitMetrics): void {
    metrics.consecutiveFailures = 0;

    if (metrics.state === 'HALF-OPEN') {
      metrics.consecutiveSuccesses += 1;
      if (metrics.consecutiveSuccesses >= this.halfOpenSuccessThreshold) {
        metrics.state = 'CLOSED';
        metrics.trippedAt = undefined;
      }
    } else if (metrics.state === 'DEGRADED') {
      metrics.state = 'CLOSED';
    }
  }

  private recordFailure(metrics: CircuitMetrics): void {
    metrics.consecutiveSuccesses = 0;
    metrics.consecutiveFailures += 1;
    metrics.lastFailureTime = Date.now();

    if (metrics.state === 'HALF-OPEN') {
      metrics.state = 'OPEN';
      metrics.trippedAt = Date.now();
    } else if (metrics.consecutiveFailures >= this.failureThreshold) {
      metrics.state = 'OPEN';
      metrics.trippedAt = Date.now();
    } else if (metrics.consecutiveFailures > 0) {
      metrics.state = 'DEGRADED';
    }
  }
}

/**
 * Default process-wide CircuitBreaker singleton.
 */
export const defaultCircuitBreaker = new CircuitBreaker();
