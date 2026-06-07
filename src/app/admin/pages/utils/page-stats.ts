/**
 * Pure formatting utilities for campaign page statistics.
 * Zero React dependencies — fully unit-testable.
 */

/**
 * Formats a conversion rate as a percentage string.
 * Returns '—' when views is 0 to avoid division-by-zero.
 */
export function formatCVR(views: number, conversions: number): string {
  if (!views) return '—';
  return `${((conversions / views) * 100).toFixed(1)}%`;
}

/**
 * Formats a raw count for compact display (e.g. 12400 → "12.4k").
 * Returns '—' for undefined/null values (e.g. new pages with no stats yet).
 */
export function formatStatCount(n: number | undefined | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
