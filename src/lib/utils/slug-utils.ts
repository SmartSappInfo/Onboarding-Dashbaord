/**
 * @fileOverview Pure URL slug sanitization utility.
 * Safe to import anywhere in client or server code.
 */

/**
 * Transforms any raw title or string into a URL-friendly slug.
 */
export function sanitizeSlug(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
