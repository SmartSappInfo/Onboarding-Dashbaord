/**
 * @fileOverview Pure utilities for interactive document layers.
 * Safe to import anywhere in client or server code.
 */

const SAFE_PROTOCOL_REGEX = /^(https?:\/\/|tel:|mailto:|https:\/\/wa\.me\/)/i;

/**
 * Validates whether a target link protocol is safe to execute.
 */
export function sanitizeLayerUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Strip dangerous javascript: or data: prefixes
  if (/^(javascript:|data:|vbscript:)/i.test(trimmed)) {
    return null;
  }

  if (SAFE_PROTOCOL_REGEX.test(trimmed)) {
    return trimmed;
  }

  // Default to https if no protocol specified
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
}
