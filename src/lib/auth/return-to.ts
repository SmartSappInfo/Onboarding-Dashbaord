/**
 * @fileOverview Open-redirect protection for post-auth navigation.
 *
 * The invite flow carries the intended destination (e.g.
 * `/profile-setup?code=SS-XXXX`) through login/signup via a `redirect` query
 * param. An attacker could craft `?redirect=https://evil.com` or `//evil.com`
 * to bounce a freshly-authenticated user off-site. `safeInternalRedirect`
 * only returns paths that are unambiguously app-relative.
 */

const STARTS_WITH_SCHEME = /^\/[^/]*:/;

/** True if the string contains any whitespace or control char (code <= 0x20, or DEL). */
function hasControlOrSpace(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Returns a safe, app-relative path or `null` if the input is unsafe/empty.
 *
 * Accepts: `/profile-setup?code=X`, `/admin`, `/a/b?x=1#y`.
 * Rejects: external URLs, scheme-relative `//host`, `javascript:` and other
 * schemes, backslash tricks, whitespace/control chars, and anything not
 * starting with a single `/`.
 */
export function safeInternalRedirect(
  value: string | null | undefined
): string | null {
  if (!value) return null;

  let candidate = value.trim();
  if (candidate === '') return null;

  // Decode once if it arrived URL-encoded. Guard against malformed encodings.
  try {
    if (/%2[fF]|%3[aA]/.test(candidate)) {
      candidate = decodeURIComponent(candidate);
    }
  } catch {
    return null;
  }

  if (!candidate.startsWith('/')) return null;
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return null;
  if (hasControlOrSpace(candidate)) return null;
  if (STARTS_WITH_SCHEME.test(candidate)) return null;
  if (candidate.toLowerCase().includes('javascript:')) return null;

  return candidate;
}
