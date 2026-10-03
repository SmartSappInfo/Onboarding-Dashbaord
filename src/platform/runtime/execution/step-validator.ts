/**
 * @fileOverview Step Output Validator & Untrusted Containerization Middleware (Rules 13, 30, 31, 48)
 *
 * Implements:
 * - Rule 13 & 30: Formal trust boundary enforcement — wraps tool results in XML isolation boundaries
 *   `<untrusted_reference_data id="...">` so tool data cannot impersonate system instructions.
 * - Rule 31: Output validation against capability schemas before returning to agent reasoning context.
 * - Rule 48: Sanitizes internal database, network, and system exceptions into clean structured error codes.
 * - Non-backtracking linear regex scanning to detect and redact prompt injection directives inside tool outputs.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import type { SchemaParser } from '@/platform/capabilities/contracts/capability-definition';
import {
  type StepValidationResult,
  type SanitizedStepError,
} from './execution-types';

// Bounded linear regex patterns for prompt injection and override directives (Rules 13 & 30)
const ADVERSARIAL_DIRECTIVE_PATTERNS = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions\b/gi,
  /\bsystem\s+override\b/gi,
  /\bdisregard\s+(?:all\s+)?(?:guardrails|rules|guidelines)\b/gi,
  /\byou\s+are\s+now\s+(?:an?\s+)?(?:unfiltered|jailbroken|developer\s+mode)\b/gi,
  /<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi,
];

// Sensitive internal system strings to strip from error messages (Rule 48)
const SENSITIVE_ERROR_PATTERNS = [
  /\b(?:1\d{2}|2[0-4]\d|25[0-5]|[1-9]?\d)\.(?:1\d{2}|2[0-4]\d|25[0-5]|[1-9]?\d)\.(?:1\d{2}|2[0-4]\d|25[0-5]|[1-9]?\d)\.(?:1\d{2}|2[0-4]\d|25[0-5]|[1-9]?\d)(?::\d+)?\b/g, // IP addresses
  /0x[0-9a-fA-F]{6,16}/g, // Memory addresses/hex error codes
  /\/(?:users|home|var|tmp|etc|app)\/[a-zA-Z0-9_./-]+/gi, // File system paths
  /(?:password|secret|bearer|token|apikey|key)=[^\s&;]+/gi, // Connection string credentials
];

export class StepValidator {
  /**
   * Estimates token consumption using standard ~4 chars/token heuristic.
   */
  public static estimateTokens(text: string, charsPerToken: number = 4.0): number {
    if (!text) return 0;
    return Math.ceil(text.length / charsPerToken);
  }

  /**
   * Scans a string for prompt injection directives and redacts them in-place.
   */
  public static redactAdversarialDirectives(input: string): string {
    let sanitized = input;
    for (const pattern of ADVERSARIAL_DIRECTIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_INJECTION_DIRECTIVE]');
    }
    return sanitized;
  }

  /**
   * Sanitizes internal technical exceptions into safe, structured error objects (Rule 48).
   */
  public static sanitizeError(err: unknown, stepId: string): SanitizedStepError {
    let rawMessage = 'Unknown execution failure';

    if (err instanceof Error) {
      rawMessage = err.message;
    } else if (typeof err === 'string') {
      rawMessage = err;
    } else if (err && typeof err === 'object') {
      try {
        rawMessage = JSON.stringify(err);
      } catch {
        rawMessage = 'Unserializable error object';
      }
    }

    // Mask sensitive IP addresses, hex pointers, paths, and credentials
    let cleanMessage = rawMessage;
    for (const pattern of SENSITIVE_ERROR_PATTERNS) {
      cleanMessage = cleanMessage.replace(pattern, '[REDACTED_SYSTEM_INFO]');
    }

    // High-level human-readable prefix
    const message = `Tool execution failed on step ${stepId}: ${cleanMessage}`;

    return {
      code: 'TOOL_EXECUTION_FAILED',
      message: message.slice(0, 500),
      details: {
        stepId,
      },
    };
  }

  /**
   * Encloses content in XML reference isolation boundaries (Rules 13 & 30).
   */
  public static containerizeOutput(
    stepId: string,
    content: string | Record<string, unknown> | null | undefined
  ): string {
    const serialized = typeof content === 'string'
      ? content
      : JSON.stringify(content ?? null);

    const safeContent = this.redactAdversarialDirectives(serialized);
    return `<untrusted_reference_data id="step_output_${stepId}">\n${safeContent}\n</untrusted_reference_data>`;
  }

  /**
   * Validates raw tool output against capability schema and wraps in isolation containers (Rule 31).
   */
  public static validateOutput(params: {
    stepId: string;
    capabilityId: string;
    outputSchema?: SchemaParser<unknown> | z.ZodType<unknown>;
    rawOutput: unknown;
  }): StepValidationResult {
    const { stepId, capabilityId, outputSchema, rawOutput } = params;

    // 1. If an output schema is provided, validate with safeParse
    if (outputSchema && typeof outputSchema.safeParse === 'function') {
      const parsed = outputSchema.safeParse(rawOutput);

      if (!parsed.success) {
        const errorIssues = 'error' in parsed && parsed.error ? parsed.error.issues : [];
        const validationErrors: string[] = errorIssues.map(
          (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`
        );

        const sanitizedError: SanitizedStepError = {
          code: 'SCHEMA_VALIDATION_FAILED',
          message: `Tool '${capabilityId}' returned invalid output structure on step '${stepId}'.`,
          details: {
            stepId,
            capabilityId,
            issuesCount: validationErrors.length,
          },
        };

        const isolatedXmlOutput = this.containerizeOutput(
          stepId,
          `ERROR: SCHEMA_VALIDATION_FAILED - ${validationErrors.join('; ')}`
        );

        return {
          valid: false,
          sanitizedError,
          validationErrors,
          isolatedXmlOutput,
          tokensUsed: this.estimateTokens(isolatedXmlOutput),
        };
      }

      // Validated object output
      const validatedOutput = parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
        ? (parsed.data as Record<string, unknown>)
        : { result: parsed.data };

      const isolatedXmlOutput = this.containerizeOutput(stepId, validatedOutput);

      return {
        valid: true,
        validatedOutput,
        isolatedXmlOutput,
        tokensUsed: this.estimateTokens(isolatedXmlOutput),
      };
    }

    // 2. No explicit schema: wrap object or primitive safely
    const validatedOutput = rawOutput && typeof rawOutput === 'object' && !Array.isArray(rawOutput)
      ? (rawOutput as Record<string, unknown>)
      : { result: rawOutput };

    const isolatedXmlOutput = this.containerizeOutput(stepId, rawOutput as Record<string, unknown> | string);

    return {
      valid: true,
      validatedOutput,
      isolatedXmlOutput,
      tokensUsed: this.estimateTokens(isolatedXmlOutput),
    };
  }
}
