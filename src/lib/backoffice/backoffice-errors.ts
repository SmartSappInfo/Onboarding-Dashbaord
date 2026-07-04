// ─────────────────────────────────────────────────
// Backoffice Error Utilities
// Shared, isomorphic (no 'use server') error types and
// narrowing helpers for the control plane.
// ─────────────────────────────────────────────────

/**
 * Thrown by backoffice authorization when the caller is not
 * authenticated or lacks the required RBAC grant.
 */
export class BackofficeAuthError extends Error {
  constructor(
    message: string,
    readonly code: 'unauthenticated' | 'forbidden'
  ) {
    super(message);
    this.name = 'BackofficeAuthError';
  }
}

/**
 * Narrows an unknown catch value to a human-readable message.
 * Replaces `catch (error: any)` patterns (no-any rule).
 */
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Unexpected error';
}
