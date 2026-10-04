/**
 * @fileOverview Resilient Retry Policy & 5-State Circuit Breaker Engine (Phase 7 Milestone 4)
 *
 * ARCHITECTURAL INVARIANTS & POLICIES:
 * 1. TRI-STATE ERROR CLASSIFICATION: Errors classified into TRANSIENT (retryable), PERMANENT (DLQ quarantine),
 *    and FATAL (immediate halt) preventing futile retry loops.
 * 2. FULL JITTER RANDOMIZATION: Randomizes backoff delays between 0.5x and 1.5x of the exponential base,
 *    preventing synchronized thundering herd storms against recovering downstream services.
 * 3. 5-STATE CIRCUIT BREAKERS (Rule 24): Tracks capability health (healthy -> degraded -> open -> half_open -> recovered),
 *    failing fast to prevent hammering overwhelmed providers.
 * 4. STRICT ZERO ANY POLICY (Rule 4): Type-safe throughout with explicit interfaces and Zod v4 schemas.
 */

import {
  type WorkflowRetryPolicyConfig,
  type ErrorClassificationResult,
  type CircuitBreakerConfig,
  type CapabilityCircuitState,
  DEFAULT_WORKFLOW_RETRY_POLICY,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './workflow-resilience-types';

// ── 1. Error Classification Engine ───────────────────────────────────────────

/**
 * Inspects any thrown error or status code and classifies it into TRANSIENT, PERMANENT, or FATAL.
 */
export function classifyWorkflowError(
  err: unknown,
  config: Partial<WorkflowRetryPolicyConfig> = DEFAULT_WORKFLOW_RETRY_POLICY
): ErrorClassificationResult {
  const resolvedConfig: WorkflowRetryPolicyConfig = {
    ...DEFAULT_WORKFLOW_RETRY_POLICY,
    ...config,
  };

  if (!err) {
    return {
      category: 'PERMANENT',
      retryable: false,
      reason: 'Null or undefined error',
    };
  }

  // Extract message and code
  let code = '';
  let message = '';
  let status: number | undefined;

  if (typeof err === 'object' && err !== null) {
    const rec = err as Record<string, unknown>;
    if (typeof rec.code === 'string') code = rec.code.toUpperCase();
    if (typeof rec.status === 'number') status = rec.status;
    if (typeof rec.statusCode === 'number') status = rec.statusCode;
    if (typeof rec.message === 'string') message = rec.message.toLowerCase();
  } else if (typeof err === 'string') {
    message = err.toLowerCase();
  }

  // 1. Check FATAL (Security, Authorization, Dead-Man)
  const isExplicitFatal =
    (resolvedConfig.fatalErrorCodes ?? []).some((fc) => code.includes(fc.toUpperCase())) ||
    code === 'DEAD_MAN_PAUSED' ||
    code === 'AUTHORIZATION_DENIED' ||
    code === 'TENANT_MISMATCH' ||
    code === 'PAYLOAD_TAMPERED' ||
    code === 'NON_DELEGABLE_ACTION' ||
    code === 'IDOR_VIOLATION' ||
    status === 401 ||
    status === 403 ||
    message.includes('dead-man') ||
    message.includes('permission denied') ||
    message.includes('forbidden');

  if (isExplicitFatal) {
    return {
      category: 'FATAL',
      retryable: false,
      reason: `Fatal security or authorization failure: ${code || message || '403 Forbidden'}`,
    };
  }

  // 2. Check TRANSIENT (Network, Rate Limits, Provider 503, Timeouts)
  const isExplicitTransient =
    (resolvedConfig.retryableErrorCodes ?? []).some((rc) => code.includes(rc.toUpperCase())) ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code === 'RATE_LIMITED' ||
    code === 'TIMEOUT' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'SERVICE_UNAVAILABLE' ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('temporarily unavailable') ||
    message.includes('service unavailable') ||
    message.includes('transient') ||
    message.includes('downstream') ||
    message.includes('econnreset');

  if (isExplicitTransient) {
    return {
      category: 'TRANSIENT',
      retryable: true,
      reason: `Transient downstream failure: ${code || message || `HTTP ${status}`}`,
      suggestedBackoffMultiplier: status === 429 ? 2.5 : 1.0,
    };
  }

  // 3. Fallback: PERMANENT (Schema Validation, Bad Request, Missing Entity)
  return {
    category: 'PERMANENT',
    retryable: false,
    reason: `Permanent functional or validation failure: ${code || message || 'Unclassified error'}`,
  };
}

// ── 2. Backoff Calculation with Full Jitter ───────────────────────────────────

export interface RetryDelayResult {
  delayMs: number;
  delaySeconds: number;
  attempt: number;
}

/**
 * Calculates exponential backoff delay with full jitter (Rule 23).
 *
 * Formula:
 * base = min(maxBackoffMs, baseBackoffMs * (multiplier ^ (attempt - 1)))
 * jittered = base * (0.5 + Math.random()) -> uniformly in [0.5 * base, 1.5 * base]
 */
export function calculateRetryDelay(
  policy: WorkflowRetryPolicyConfig,
  attempt: number
): RetryDelayResult {
  const safeAttempt = Math.max(1, attempt);
  const exponentialBase =
    policy.baseBackoffMs * Math.pow(policy.backoffMultiplier, safeAttempt - 1);
  const clampedBase = Math.min(policy.maxBackoffMs, exponentialBase);

  let jitteredMs: number;

  switch (policy.jitter) {
    case 'full':
      // Random uniform factor between 0.5 and 1.5
      jitteredMs = Math.round(clampedBase * (0.5 + Math.random()));
      break;
    case 'equal':
      // Half deterministic, half random
      jitteredMs = Math.round(clampedBase * 0.5 + clampedBase * 0.5 * Math.random());
      break;
    case 'none':
    default:
      jitteredMs = Math.round(clampedBase);
      break;
  }

  // Ensure delay is between baseBackoffMs / 2 and maxBackoffMs * 1.5
  const finalDelayMs = Math.max(50, Math.min(policy.maxBackoffMs * 1.5, jitteredMs));
  const delaySeconds = Math.max(1, Math.ceil(finalDelayMs / 1000));

  return {
    delayMs: finalDelayMs,
    delaySeconds,
    attempt: safeAttempt,
  };
}

// ── 3. 5-State Circuit Breaker Manager (Rule 24) ──────────────────────────────

export class WorkflowCircuitBreakerManager {
  private readonly states = new Map<string, CapabilityCircuitState>();
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  /**
   * Generates a stable key for capability circuit tracking.
   */
  private getCircuitKey(capabilityId: string, tenantId?: string): string {
    return tenantId ? `${tenantId}:${capabilityId}` : capabilityId;
  }

  /**
   * Retrieves or initializes the circuit state for a capability.
   */
  public getCircuitState(capabilityId: string, tenantId?: string): CapabilityCircuitState {
    const key = this.getCircuitKey(capabilityId, tenantId);
    let state = this.states.get(key);
    if (!state) {
      state = {
        capabilityId,
        state: 'healthy',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastStateChangeTimestamp: Date.now(),
      };
      this.states.set(key, state);
    }
    return state;
  }

  /**
   * Checks whether the capability circuit permits invocation.
   */
  public canExecute(
    capabilityId: string,
    tenantId?: string
  ): { allowed: boolean; state: CapabilityCircuitState['state']; waitMsRemaining?: number } {
    const circuit = this.getCircuitState(capabilityId, tenantId);
    const now = Date.now();

    if (circuit.state === 'open') {
      const elapsed = now - (circuit.lastFailureTimestamp ?? circuit.lastStateChangeTimestamp);
      if (elapsed >= this.config.cooldownMs) {
        // Cooldown elapsed: transition to half_open probe state
        circuit.state = 'half_open';
        circuit.consecutiveSuccesses = 0;
        circuit.lastStateChangeTimestamp = now;
        return { allowed: true, state: 'half_open' };
      }

      const waitMsRemaining = this.config.cooldownMs - elapsed;
      return { allowed: false, state: 'open', waitMsRemaining };
    }

    return { allowed: true, state: circuit.state };
  }

  /**
   * Boolean convenience helper indicating whether execution is currently permitted.
   */
  public isExecutionPermitted(capabilityId: string, tenantId?: string): boolean {
    return this.canExecute(capabilityId, tenantId).allowed;
  }

  /**
   * Records a successful execution, updating circuit state toward healthy.
   */
  public recordSuccess(capabilityId: string, tenantId?: string): CapabilityCircuitState['state'] {
    const circuit = this.getCircuitState(capabilityId, tenantId);
    const now = Date.now();

    circuit.consecutiveFailures = 0;

    if (circuit.state === 'half_open') {
      circuit.consecutiveSuccesses += 1;
      if (circuit.consecutiveSuccesses >= this.config.successThreshold) {
        // Probes succeeded: transition to recovered -> healthy
        circuit.state = 'healthy';
        circuit.consecutiveSuccesses = 0;
        circuit.lastStateChangeTimestamp = now;
        circuit.trippedReason = undefined;
      }
    } else if (circuit.state === 'degraded') {
      circuit.state = 'healthy';
      circuit.lastStateChangeTimestamp = now;
    }

    return circuit.state;
  }

  /**
   * Records an execution failure, potentially degrading or tripping the circuit.
   */
  public recordFailure(
    capabilityId: string,
    reason?: string,
    tenantId?: string
  ): CapabilityCircuitState['state'] {
    const circuit = this.getCircuitState(capabilityId, tenantId);
    const now = Date.now();

    circuit.consecutiveFailures += 1;
    circuit.lastFailureTimestamp = now;
    circuit.trippedReason = reason;

    if (circuit.state === 'half_open') {
      // Probe failed: trip immediately back to open
      circuit.state = 'open';
      circuit.lastStateChangeTimestamp = now;
      return 'open';
    }

    if (circuit.consecutiveFailures >= this.config.failureThreshold) {
      // Threshold reached: trip to open
      circuit.state = 'open';
      circuit.lastStateChangeTimestamp = now;
      return 'open';
    }

    if (circuit.consecutiveFailures > 0 && circuit.state === 'healthy') {
      // First few transient failures: mark degraded
      circuit.state = 'degraded';
      circuit.lastStateChangeTimestamp = now;
      return 'degraded';
    }

    return circuit.state;
  }

  /**
   * Explicitly trips a circuit breaker (e.g. on unhandled downstream outage).
   */
  public tripCircuit(
    capabilityId: string,
    reason: string,
    tenantId?: string
  ): void {
    const circuit = this.getCircuitState(capabilityId, tenantId);
    circuit.state = 'open';
    circuit.lastFailureTimestamp = Date.now();
    circuit.lastStateChangeTimestamp = Date.now();
    circuit.trippedReason = reason;
  }

  /**
   * Manually resets a circuit breaker to healthy state.
   */
  public resetCircuit(capabilityId: string, tenantId?: string): void {
    const key = this.getCircuitKey(capabilityId, tenantId);
    this.states.delete(key);
  }

  /**
   * Clears all circuit states (for testing isolation).
   */
  public clear(): void {
    this.states.clear();
  }
}

// ── 4. Global Singleton Preservation (Rule 69) ──────────────────────────────

declare global {
  var __smartsappWorkflowCircuitBreakerManager: WorkflowCircuitBreakerManager | undefined;
}

export function getWorkflowCircuitBreakerManager(
  config?: Partial<CircuitBreakerConfig>
): WorkflowCircuitBreakerManager {
  if (process.env.NODE_ENV !== 'production') {
    if (!globalThis.__smartsappWorkflowCircuitBreakerManager) {
      globalThis.__smartsappWorkflowCircuitBreakerManager = new WorkflowCircuitBreakerManager(config);
    }
    return globalThis.__smartsappWorkflowCircuitBreakerManager;
  }

  return new WorkflowCircuitBreakerManager(config);
}

// ── 5. Workflow Retry Policy Facade ──────────────────────────────────────────

export class WorkflowRetryPolicy {
  private readonly config: WorkflowRetryPolicyConfig;
  private readonly circuitBreakerManager: WorkflowCircuitBreakerManager;

  constructor(
    config?: Partial<WorkflowRetryPolicyConfig>,
    circuitBreakerManager?: WorkflowCircuitBreakerManager
  ) {
    this.config = { ...DEFAULT_WORKFLOW_RETRY_POLICY, ...config };
    this.circuitBreakerManager = circuitBreakerManager ?? getWorkflowCircuitBreakerManager();
  }

  public classifyError(err: unknown): ErrorClassificationResult {
    return classifyWorkflowError(err, this.config);
  }

  public calculateBackoffDelay(attempt: number): RetryDelayResult {
    return calculateRetryDelay(this.config, attempt);
  }

  public getCircuitBreaker(capabilityId: string, tenant?: { organizationId: string }) {
    const mgr = this.circuitBreakerManager;
    const orgId = tenant?.organizationId;
    return {
      getState: () => mgr.getCircuitState(capabilityId, orgId).state,
      recordSuccess: () => mgr.recordSuccess(capabilityId, orgId),
      recordFailure: (reason?: string) => mgr.recordFailure(capabilityId, reason, orgId),
      isExecutionPermitted: () => mgr.isExecutionPermitted(capabilityId, orgId),
    };
  }

  public getCircuitBreakerManager(): WorkflowCircuitBreakerManager {
    return this.circuitBreakerManager;
  }
}

declare global {
  var __smartsappWorkflowRetryPolicy: WorkflowRetryPolicy | undefined;
}

export function getWorkflowRetryPolicy(config?: WorkflowRetryPolicyConfig): WorkflowRetryPolicy {
  if (process.env.NODE_ENV !== 'production') {
    if (!globalThis.__smartsappWorkflowRetryPolicy) {
      globalThis.__smartsappWorkflowRetryPolicy = new WorkflowRetryPolicy(config);
    }
    return globalThis.__smartsappWorkflowRetryPolicy;
  }

  return new WorkflowRetryPolicy(config);
}

