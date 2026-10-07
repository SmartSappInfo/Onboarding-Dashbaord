/**
 * @fileOverview Structured Error Taxonomy for Knowledge & Memory (Phase 11 M3 · T0)
 *
 * Implements Rule 48 (Structured Error Taxonomy) and Rule 17 (Non-Delegable Decider Error).
 * Strictly typed errors with machine-readable codes and client-safe messages.
 */

export const KNOWLEDGE_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  KNOWLEDGE_DEAD_MAN_PAUSED: 'KNOWLEDGE_DEAD_MAN_PAUSED',
  NON_DELEGABLE_ACTION: 'NON_DELEGABLE_ACTION',
  CANDIDATE_NOT_FOUND: 'CANDIDATE_NOT_FOUND',
  CANDIDATE_ALREADY_DECIDED: 'CANDIDATE_ALREADY_DECIDED',
  CONFLICT_NOT_FOUND: 'CONFLICT_NOT_FOUND',
  CONFLICT_ALREADY_RESOLVED: 'CONFLICT_ALREADY_RESOLVED',
  PROMPT_INJECTION_DETECTED: 'PROMPT_INJECTION_DETECTED',
  INVALID_DECISION: 'INVALID_DECISION',
  GRAPH_QUERY_EXCEEDED_LIMIT: 'GRAPH_QUERY_EXCEEDED_LIMIT',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type KnowledgeErrorCode = (typeof KNOWLEDGE_ERROR_CODES)[keyof typeof KNOWLEDGE_ERROR_CODES];

export class KnowledgeDomainError extends Error {
  readonly code: KnowledgeErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: KnowledgeErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(`[${code}] ${message}`);
    this.name = 'KnowledgeDomainError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
