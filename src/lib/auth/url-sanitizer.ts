/**
 * @fileOverview Client & Server URL query parameter sanitizer.
 * Enforces OWASP Top 10 and CWE-598 (Information Exposure via Query Strings).
 * Governed by SmartSapp Agentic Development Rules (Rules 1, 4, 8, 10, 13, 54).
 *
 * This utility prevents sensitive credentials (such as passwords, secret tokens,
 * or credentials) from persisting in browser history, URL address bars, or leaking
 * into same-origin HTTP Referer headers.
 */

/**
 * Strict set of lower-cased parameter names that are classified as sensitive credentials.
 * Legitimate routing tokens (such as `redirect`, `invite`, `email`, `oobCode`) are
 * explicitly excluded and preserved.
 */
const SENSITIVE_PARAM_NAMES: ReadonlySet<string> = new Set([
  'password',
  'pass',
  'pwd',
  'passwd',
  'temppassword',
  'temp_password',
  'newpassword',
  'new_password',
  'confirmpassword',
  'confirm_password',
  'secret',
  'client_secret',
  'authtoken',
  'auth_token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'credential',
  'credentials',
]);

/**
 * Checks whether a given query parameter key matches any sensitive credential name.
 * Normalizes input by lowercasing and trimming (Rule 2: Case variation resilience).
 */
export function isSensitiveParamKey(key: string): boolean {
  if (!key) return false;
  return SENSITIVE_PARAM_NAMES.has(key.toLowerCase().trim());
}

/**
 * Determines whether a given query string contains any sensitive parameter keys.
 */
export function hasSensitiveParams(searchString: string): boolean {
  if (!searchString) return false;
  const search = searchString.startsWith('?') ? searchString.slice(1) : searchString;
  const params = new URLSearchParams(search);
  for (const key of params.keys()) {
    if (isSensitiveParamKey(key)) return true;
  }
  return false;
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
