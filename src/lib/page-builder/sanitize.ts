import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize author-supplied HTML before it is injected via
 * `dangerouslySetInnerHTML`. Strips scripts, inline event handlers, and other
 * XSS vectors while preserving safe formatting markup.
 *
 * Runs identically on server and client (isomorphic) so sanitized output is
 * stable across the SSR/hydration boundary.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
}

/**
 * Sanitize author-supplied CSS destined for an inline `<style>` block. We can't
 * run DOMPurify over raw CSS, so we defensively strip anything that could break
 * out of the style context or smuggle script execution.
 */
export function sanitizeCss(dirty: string): string {
  return dirty
    .replace(/<\/?(style|script)[^>]*>/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '');
}
