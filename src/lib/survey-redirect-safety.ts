/**
 * @fileOverview Validation for survey completion redirect targets.
 *
 * A survey's `redirectUrl` is authored copy, but it is passed through variable
 * substitution before use, so respondent-supplied answers can land inside it. Without
 * validation that turns a benign template such as `https://example.com/{{q1}}` into an
 * attacker-chosen destination, and a template that is *entirely* a variable into an
 * arbitrary URI — including `javascript:` (script execution) and `data:` (content
 * injection). See audit F5.
 *
 * Kept dependency-free so it is unit-testable without Next.js or Firebase.
 */

/** Schemes that may ever appear in a completion redirect. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Whether `url` is safe to use as a survey completion redirect target.
 *
 * Accepts absolute http(s) URLs and site-relative paths (`/thanks`). Rejects
 * everything else: other schemes, protocol-relative URLs (`//evil.test`, which inherit
 * the current scheme and navigate off-site), and unparseable input.
 *
 * @param url The redirect target after variable substitution.
 * @param allowedHosts Optional allowlist of permitted hostnames. When provided, an
 *        absolute URL must match one of them exactly, or be a subdomain of one.
 */
export function isSafeRedirectUrl(
  url: string | undefined | null,
  allowedHosts?: readonly string[],
): boolean {
  if (!url) return false;

  const trimmed = url.trim();
  if (!trimmed) return false;

  // Protocol-relative ("//host/path") inherits the page scheme and leaves the site.
  if (trimmed.startsWith('//')) return false;

  // Site-relative paths stay on this origin and are always safe.
  if (trimmed.startsWith('/')) return true;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;

  if (allowedHosts && allowedHosts.length > 0) {
    const host = parsed.hostname.toLowerCase();
    return allowedHosts.some((allowed) => {
      const a = allowed.toLowerCase();
      return host === a || host.endsWith(`.${a}`);
    });
  }

  return true;
}
