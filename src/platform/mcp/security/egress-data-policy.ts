/**
 * @fileOverview Data Egress Policy Engine & Exfiltration Detection Scanner (Phase 5 Milestone 3 Task 5)
 *
 * Implements Rule 4 (Zero any/any[]), Rule 9 (Cloud Run Payload Limits), Rule 10 (Inline Architectural Docs),
 * Rule 13 (Never Trust the Model), Rule 23 (Bounded Depth & Traversal), Rule 32 (Cross-Domain Data Exfiltration),
 * Rule 33 (Egress Channel Control), Rule 40 (Append-Only Audit Logging), and Rule 48 (Sanitize Tool Errors).
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. Safe Regex Scanners:
 *    All regex patterns are strictly bounded, linear-time expressions without nested quantifiers
 *    to prevent ReDoS attacks.
 * 2. Bounded Traversal Ceiling:
 *    Traverses nested objects and arrays up to depth 10, skipping prototype properties,
 *    and fails closed if recursion exceeds depth limits.
 * 3. Channel Boundary Enforcement:
 *    Cross-domain exfiltration (e.g. leaking CRM PII or internal credentials to an external webhook/tool)
 *    is blocked with `DATA_EXFILTRATION_DETECTED` and audited to `defaultEventBus`.
 * 4. In-Place Redaction:
 *    When `redactionMode` is active, sensitive strings are replaced with canonical tokens
 *    (`[REDACTED_SECRET]`, `[REDACTED_FINANCIAL]`, `[REDACTED_PII]`).
 */

import crypto from 'node:crypto';
import { defaultEventBus, type EventBus } from '../../events/event-bus';
import { createDomainEvent } from '../../capabilities/events/domain-event';
import type { TenantContext } from './tool-fingerprint-types';
import {
  EGRESS_ERROR_CODES,
  getDefaultChannelCeiling,
  isSensitivityAboveCeiling,
  SENSITIVITY_WEIGHTS,
  type DetectedSensitivity,
  type EgressDestination,
  type EgressEvaluationOptions,
  type EgressEvaluationResult,
  type SensitivityLevel,
} from './egress-data-policy-types';

interface PatternMatcher {
  category: SensitivityLevel;
  patternName: string;
  regex: RegExp;
  confidence: 'high' | 'medium' | 'low';
}

const LINEAR_PATTERNS: PatternMatcher[] = [
  // Credentials
  {
    category: 'credential',
    patternName: 'private_key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    confidence: 'high',
  },
  {
    category: 'credential',
    patternName: 'jwt_token',
    regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
    confidence: 'high',
  },
  {
    category: 'credential',
    patternName: 'api_key_known_provider',
    regex: /\b(?:sk-[a-zA-Z0-9_-]{20,}|AIza[0-9A-Za-z-_]{35}|sk-ant-[a-zA-Z0-9_-]{20,})\b/,
    confidence: 'high',
  },
  {
    category: 'credential',
    patternName: 'generic_secret_assignment',
    regex: /(?:api[_-]?key|secret|auth[_-]?token|password|bearer)\s*[:=]\s*['"][a-zA-Z0-9_!@#$%^&*-]{8,}['"]/i,
    confidence: 'medium',
  },

  // Financial
  {
    category: 'financial',
    patternName: 'credit_card_number',
    // Visa, MC, Amex, Discover (13 to 16 digits)
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/,
    confidence: 'high',
  },
  {
    category: 'financial',
    patternName: 'iban_account',
    regex: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/,
    confidence: 'medium',
  },

  // Personal / PII
  {
    category: 'personal',
    patternName: 'us_ssn',
    regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/,
    confidence: 'high',
  },
];

export interface EgressDataPolicyEngineOptions {
  eventBus?: EventBus;
}

export class EgressDataPolicyEngine {
  private readonly eventBus: EventBus;

  constructor(options?: EgressDataPolicyEngineOptions) {
    this.eventBus = options?.eventBus || defaultEventBus;
  }

  /**
   * Deeply scans an arbitrary data payload for sensitive patterns up to maxDepth.
   */
  public scanPayload(
    data: unknown,
    options?: { maxDepth?: number; maxPayloadSizeBytes?: number }
  ): DetectedSensitivity[] {
    const maxDepth = options?.maxDepth ?? 10;
    const maxPayloadSizeBytes = options?.maxPayloadSizeBytes ?? 100 * 1024; // 100KB

    // Quick size gate (Rule 9)
    try {
      const serialized = JSON.stringify(data);
      if (serialized && Buffer.byteLength(serialized, 'utf8') > maxPayloadSizeBytes) {
        return [
          {
            category: 'restricted',
            patternName: 'payload_size_ceiling_exceeded',
            path: '$',
            snippet: `Payload exceeds ${maxPayloadSizeBytes} bytes`,
            confidence: 'high',
          },
        ];
      }
    } catch {
      // Ignore circular or serialization errors here; handled in traversal
    }

    const detections: DetectedSensitivity[] = [];
    this.traverse(data, '$', 0, maxDepth, detections);
    return detections;
  }

  /**
   * Evaluates if a payload is authorized to egress to the target destination.
   */
  public async evaluateEgress(
    data: unknown,
    destination: EgressDestination,
    tenant?: TenantContext,
    options?: EgressEvaluationOptions
  ): Promise<EgressEvaluationResult> {
    const maxDepth = options?.maxDepth ?? 10;
    const ceiling = options?.allowedSensitivityCeiling ?? getDefaultChannelCeiling(destination);
    const detections = this.scanPayload(data, {
      maxDepth,
      maxPayloadSizeBytes: options?.maxPayloadSizeBytes,
    });

    let highestSensitivity: SensitivityLevel = 'public';
    const violations: DetectedSensitivity[] = [];

    for (const d of detections) {
      if (SENSITIVITY_WEIGHTS[d.category] > SENSITIVITY_WEIGHTS[highestSensitivity]) {
        highestSensitivity = d.category;
      }
      if (isSensitivityAboveCeiling(d.category, ceiling)) {
        violations.push(d);
      }
    }

    const allowed = violations.length === 0;
    let reason: string | undefined;

    if (!allowed) {
      const topViolation = violations[0];
      reason = `[EgressDataPolicy] ${EGRESS_ERROR_CODES.DATA_EXFILTRATION_DETECTED}: Channel '${destination}' blocks sensitivity '${topViolation.category}' (matched '${topViolation.patternName}' at path '${topViolation.path}')`;

      // Emit audit domain event (Rule 40)
      if (tenant) {
        await this.eventBus.publish(
          createDomainEvent({
            type: 'mcp.security.exfiltration_blocked',
            organizationId: tenant.organizationId,
            workspaceId: tenant.workspaceId,
            actor: { type: 'system', id: 'egress_policy_engine' },
            entity: { type: 'egress_channel', id: destination },
            correlationId: crypto.randomUUID(),
            source: 'mcp.egress_data_policy_engine',
            payload: {
              destination,
              highestSensitivity,
              violationCount: violations.length,
              topViolation: {
                category: topViolation.category,
                patternName: topViolation.patternName,
                path: topViolation.path,
              },
            },
          })
        );
      }
    }

    let sanitizedPayload: unknown;
    if (options?.redactionMode) {
      sanitizedPayload = this.sanitizePayload(data, detections);
    }

    return {
      allowed,
      destination,
      highestSensitivity,
      violations,
      reason,
      sanitizedPayload,
    };
  }

  /**
   * Redacts detected secrets and sensitive strings from a deep clone of the data.
   */
  public sanitizePayload(data: unknown, _detections?: DetectedSensitivity[]): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') {
      return this.redactString(String(data));
    }

    try {
      const cloned = JSON.parse(JSON.stringify(data)) as unknown;
      return this.redactRecursive(cloned, 0, 10);
    } catch {
      return '[REDACTION_FAILED]';
    }
  }

  private redactString(value: string): string {
    let result = value;
    for (const matcher of LINEAR_PATTERNS) {
      if (matcher.regex.test(result)) {
        const replacement =
          matcher.category === 'credential'
            ? '[REDACTED_SECRET]'
            : matcher.category === 'financial'
              ? '[REDACTED_FINANCIAL]'
              : '[REDACTED_PII]';
        result = result.replace(new RegExp(matcher.regex, 'g'), replacement);
      }
    }
    return result;
  }

  private redactRecursive(obj: unknown, currentDepth: number, maxDepth: number): unknown {
    if (currentDepth > maxDepth || obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      return this.redactString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item: unknown) => this.redactRecursive(item, currentDepth + 1, maxDepth));
    }

    if (typeof obj === 'object') {
      const record = obj as Record<string, unknown>;
      const newObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(record)) {
        newObj[key] = this.redactRecursive(val, currentDepth + 1, maxDepth);
      }
      return newObj;
    }

    return obj;
  }

  private traverse(
    node: unknown,
    currentPath: string,
    currentDepth: number,
    maxDepth: number,
    outDetections: DetectedSensitivity[]
  ): void {
    if (currentDepth > maxDepth) {
      outDetections.push({
        category: 'restricted',
        patternName: 'max_depth_exceeded',
        path: currentPath,
        snippet: `Object depth exceeds ${maxDepth}`,
        confidence: 'high',
      });
      return;
    }

    if (node === null || node === undefined) {
      return;
    }

    if (typeof node === 'string') {
      this.scanString(node, currentPath, outDetections);
      return;
    }

    if (typeof node === 'number' || typeof node === 'boolean') {
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        this.traverse(node[i], `${currentPath}[${i}]`, currentDepth + 1, maxDepth, outDetections);
      }
      return;
    }

    if (typeof node === 'object') {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        // Check if key name itself indicates high sensitivity
        if (/^(?:apiKey|password|secret|creditCard|ssn)$/i.test(key) && typeof value === 'string') {
          outDetections.push({
            category: /creditCard/i.test(key)
              ? 'financial'
              : /ssn/i.test(key)
                ? 'personal'
                : 'credential',
            patternName: `named_field_${key}`,
            path: `${currentPath}.${key}`,
            snippet: value.slice(0, 4) + '****',
            confidence: 'high',
          });
        }
        this.traverse(value, `${currentPath}.${key}`, currentDepth + 1, maxDepth, outDetections);
      }
    }
  }

  private scanString(
    val: string,
    path: string,
    outDetections: DetectedSensitivity[]
  ): void {
    for (const matcher of LINEAR_PATTERNS) {
      const match = val.match(matcher.regex);
      if (match) {
        const matchedStr = match[0];
        const snippet =
          matchedStr.length > 8
            ? `${matchedStr.slice(0, 4)}...${matchedStr.slice(-4)}`
            : '****';
        outDetections.push({
          category: matcher.category,
          patternName: matcher.patternName,
          path,
          snippet,
          confidence: matcher.confidence,
        });
      }
    }
  }
}

export function createEgressDataPolicyEngine(
  options?: EgressDataPolicyEngineOptions
): EgressDataPolicyEngine {
  return new EgressDataPolicyEngine(options);
}

// Global HMR-safe singleton
declare global {
  var __smartsappEgressEngine: EgressDataPolicyEngine | undefined;
}

export function getEgressDataPolicyEngine(options?: EgressDataPolicyEngineOptions): EgressDataPolicyEngine {
  if (process.env.NODE_ENV === 'test') {
    return new EgressDataPolicyEngine(options);
  }

  if (!globalThis.__smartsappEgressEngine) {
    globalThis.__smartsappEgressEngine = new EgressDataPolicyEngine(options);
  }

  return globalThis.__smartsappEgressEngine;
}

export const globalEgressDataPolicyEngine = getEgressDataPolicyEngine();
