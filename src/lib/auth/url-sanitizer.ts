/**
 * @fileOverview Client & Server URL query parameter sanitizer.
 * Enforces OWASP Top 10 and CWE-598 (Information Exposure via Query Strings).
 * Governed by SmartSapp Agentic Development Rules (Rules 1, 4, 8, 10, 13, 54).
 *
 * Single Source of Truth for sensitive parameter pattern recognition across
 * both the Next.js Edge proxy and client-side DOM hooks.
 *
 * Prevents sensitive credentials (passwords, temporary tokens, API secrets)
 * from persisting in browser history, address bars, proxy access logs, or
 * leaking into same-origin HTTP Referer headers.
 */

/**
 * Blocklist of sensitive query parameter patterns that must NEVER appear in URL strings.
 *
 * Performance Budget (Rule 9 & 54): Pre-compiled regex patterns executed against
 * URLSearchParams keys ensure O(N) evaluation (< 1ms execution on the Edge runtime).
 *
 * Supports snake_case, camelCase, kebab-case, and abbreviations:
 * - password, current_password, current-password, temp_password, temp-password, new_password, new-password, confirm_password, confirm-password
 * - pass, temppass, newpass, confirmpass
 * - pwd, passwd
 * - secret, client_secret, client-secret
 * - auth_token, auth-token, access_token, access-token, refresh_token, refresh-token, id_token, id-token
 * - credential, credentials
 */
export const SENSITIVE_PARAM_PATTERNS: readonly RegExp[] = [
  /^(current_?|confirm_?|temp_?|new_?)?pass(word)?$/i,
  /^(current|confirm|temp|new)-pass(word)?$/i,
  /^pwd$/i,
  /^passwd$/i,
  /^(client_?)?secret$/i,
  /^client-secret$/i,
  /^(auth|access|refresh|id)[_-]?token$/i,
  /^credentials?$/i,
];

/**
 * Checks whether a given query parameter key matches any sensitive credential pattern.
 * Normalizes input by lowercasing and trimming (Rule 2: Case variation resilience).
 */
export function isSensitiveParamKey(key: string): boolean {
  if (!key) return false;
  const normalized = key.trim();
  return SENSITIVE_PARAM_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Determines whether a given query string or URLSearchParams contains any sensitive parameter keys.
 */
export function hasSensitiveParams(searchStringOrParams: string | URLSearchParams): boolean {
  if (!searchStringOrParams) return false;
  const params =
    typeof searchStringOrParams === 'string'
      ? new URLSearchParams(searchStringOrParams.startsWith('?') ? searchStringOrParams.slice(1) : searchStringOrParams)
      : searchStringOrParams;

  for (const key of params.keys()) {
    if (isSensitiveParamKey(key)) return true;
  }
  return false;
}

/**
 * Returns a cleaned URLSearchParams instance with all sensitive parameters stripped.
 * Preserves all safe parameters and returns a mutated clone.
 */
export function sanitizeSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const sanitized = new URLSearchParams(searchParams);
  for (const key of Array.from(sanitized.keys())) {
    if (isSensitiveParamKey(key)) {
      sanitized.delete(key);
    }
  }
  return sanitized;
}

/**
 * Returns a cleaned query string with all sensitive parameters stripped.
 * Preserves all safe parameters and returns empty string if no parameters remain.
 */
export function sanitizeQueryString(searchString: string): string {
  if (!searchString) return '';
  const search = searchString.startsWith('?') ? searchString.slice(1) : searchString;
  const params = new URLSearchParams(search);
  let changed = false;

  for (const key of Array.from(params.keys())) {
    if (isSensitiveParamKey(key)) {
      params.delete(key);
      changed = true;
    }
  }

  if (!changed) return searchString;
  const result = params.toString();
  return result ? `?${result}` : '';
}

/**
 * Scrubs sensitive parameters from the current window location in place using history.replaceState.
 * Safe to call on client mount; no-ops in SSR environments.
 * Returns true if a mutation occurred, false otherwise.
 */
export function scrubBrowserUrlInPlace(): boolean {
  if (typeof window === 'undefined' || !window.location.search) return false;
  if (!hasSensitiveParams(window.location.search)) return false;

  const cleanedSearch = sanitizeQueryString(window.location.search);
  const newUrl = `${window.location.pathname}${cleanedSearch}${window.location.hash}`;
  window.history.replaceState(null, '', newUrl);
  return true;
}
