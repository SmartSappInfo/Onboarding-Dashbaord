/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Authoritative AI Governance, Prompt Defense & Quota Telemetry Service (P5.5).
 * 2. Invariants Maintained:
 *    - Prompt Injection Sandboxing (FM-P5-02): Identifies adversarial prompt injection phrases
 *      and sanitizes untrusted input before forwarding to LLM models.
 *    - Quota Circuit Breaker (FM-P5-06): Protects against cascading failures by tripping after
 *      5 consecutive provider errors/rate limits, activating degraded fallback immediately.
 *    - Audit Telemetry Standard: Every AI execution is logged with token consumption, latency,
 *      and model attribution in the `document_ai_analyses` collection.
 *    - Zero-Tolerance Typing (Rule 4): Strictly 0 `any` or `any[]` throughout.
 */

import { adminDb } from '@/lib/firebase-admin';
import {
  DocumentAiAnalysisLogSchema,
  type DocumentAiAnalysisLog,
} from '@/lib/types/document-signing';

const ADVERSARIAL_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  {
    regex: /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/gi,
    label: 'Instruction Override Attempt',
  },
  {
    regex: /system\s+(?:override|prompt|directive)/gi,
    label: 'System Override Token',
  },
  {
    regex: /you\s+are\s+now\s+(?:a|in|an)\s+(?:developer|dan|unrestricted|jailbreak)/gi,
    label: 'Jailbreak Role Switch',
  },
  {
    regex: /(?:exfiltrate|leak|dump)\s+(?:database|credentials|tokens|keys|secrets|passwords?)/gi,
    label: 'Data Exfiltration Directive',
  },
  {
    regex: /<script[\s\S]*?>/gi,
    label: 'Script Injection Payload',
  },
];

export interface PromptInjectionCheckResult {
  isSuspicious: boolean;
  detectedPatterns: string[];
  sanitizedText: string;
}

/**
 * Scans untrusted input for prompt injection signatures and returns sanitized text.
 */
export function detectPromptInjection(inputText: string): PromptInjectionCheckResult {
  if (!inputText) {
    return { isSuspicious: false, detectedPatterns: [], sanitizedText: '' };
  }

  const detected: string[] = [];
  let sanitized = inputText;

  for (const { regex, label } of ADVERSARIAL_PATTERNS) {
    if (regex.test(inputText)) {
      detected.push(label);
      // Reset regex index for global replace
      regex.lastIndex = 0;
      sanitized = sanitized.replace(regex, '[POTENTIAL_INJECTION_FLAGGED]');
    }
  }

  return {
    isSuspicious: detected.length > 0,
    detectedPatterns: detected,
    sanitizedText: sanitized,
  };
}

/**
 * Persists an AI execution audit log entry with token usage and latency telemetry.
 */
export async function recordAiExecutionLog(
  entry: DocumentAiAnalysisLog
): Promise<{ success: boolean; logId: string }> {
  const validated = DocumentAiAnalysisLogSchema.parse(entry);

  await adminDb
    .collection('document_ai_analyses')
    .doc(validated.id)
    .set(validated);

  return {
    success: true,
    logId: validated.id,
  };
}

interface BreakerState {
  consecutiveFailures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, BreakerState>();
const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 60000; // 60s cooldown

/**
 * Checks whether AI requests can proceed for a workspace or if circuit breaker is tripped.
 */
export function checkAiQuotaAndCircuitBreaker(workspaceId: string): {
  canProceed: boolean;
  reason?: string;
} {
  const state = circuitBreakers.get(workspaceId);
  if (!state || !state.isOpen) {
    return { canProceed: true };
  }

  const now = Date.now();
  if (now - state.lastFailureTime > COOLDOWN_MS) {
    // Half-open: attempt recovery
    state.isOpen = false;
    state.consecutiveFailures = 0;
    return { canProceed: true };
  }

  return {
    canProceed: false,
    reason: `Circuit breaker open due to provider rate limiting (HTTP 429). Degraded fallback active. Retry in ${Math.ceil(
      (COOLDOWN_MS - (now - state.lastFailureTime)) / 1000
    )}s.`,
  };
}

/**
 * Records a provider failure, tripping the circuit breaker if threshold is reached.
 */
export function recordAiFailure(workspaceId: string, _errorMessage: string): void {
  const now = Date.now();
  const current = circuitBreakers.get(workspaceId) || {
    consecutiveFailures: 0,
    lastFailureTime: now,
    isOpen: false,
  };

  current.consecutiveFailures++;
  current.lastFailureTime = now;

  if (current.consecutiveFailures >= FAILURE_THRESHOLD) {
    current.isOpen = true;
  }

  circuitBreakers.set(workspaceId, current);
}

/**
 * Records a successful AI execution, resetting failure count.
 */
export function recordAiSuccess(workspaceId: string): void {
  const current = circuitBreakers.get(workspaceId);
  if (current) {
    current.consecutiveFailures = 0;
    current.isOpen = false;
  }
}

/**
 * Test helper to reset in-memory circuit breaker state.
 */
export function resetCircuitBreakerForTesting(): void {
  circuitBreakers.clear();
}
