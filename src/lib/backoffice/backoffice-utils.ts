/**
 * Shared utility functions for the Super Admin Backoffice.
 * These are standard JS functions (not Server Actions) and should
 * remain synchronous where possible.
 */

/**
 * Creates a before/after snapshot pair for audit purposes.
 * Strips undefined values for clean Firestore storage.
 */
export function createAuditSnapshot(
  data: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!data) return null;

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
