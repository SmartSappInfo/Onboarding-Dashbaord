import type { OrgBranding } from '@/lib/types';

/**
 * Strips out script blocks, javascript: protocols, and inline on-event handlers
 * to prevent XSS vulnerability vectors when rendering custom HTML templates.
 */
export function sanitizeCustomHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Strip script blocks
    .replace(/href\s*=\s*"javascript:[^"]*?"/gi, 'href="#"')            // Strip JS protocols in double quotes
    .replace(/href\s*=\s*'javascript:[^']*?'/gi, 'href="#"')            // Strip JS protocols in single quotes
    .replace(/href\s*=\s*javascript:[^\s>]+/gi, 'href="#"')             // Strip unquoted JS protocols
    .replace(/\s+on\w+\s*=\s*"[^"]*?"/gi, '')                           // Strip onEvent="handler" in double quotes
    .replace(/\s+on\w+\s*=\s*'[^']*?'/gi, '')                           // Strip onEvent='handler' in single quotes
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');                           // Strip unquoted onEvent=handler
}

/**
 * Resolves standard tokens inside a custom HTML template.
 */
export function resolveCustomFooterHtml(template: string, org: OrgBranding): string {
  const currentYear = new Date().getFullYear().toString();
  const sanitized = sanitizeCustomHtml(template);
  
  return sanitized
    .replaceAll('{{org_name}}', org.name || '')
    .replaceAll('{{logo_url}}', org.logoUrl || '')
    .replaceAll('{{org_address}}', org.address || '')
    .replaceAll('{{org_email}}', org.email || '')
    .replaceAll('{{org_phone}}', org.phone || '')
    .replaceAll('{{org_website}}', org.website || '')
    .replaceAll('{{facebook_link}}', org.socialLinks?.facebook || '#')
    .replaceAll('{{twitter_link}}', org.socialLinks?.twitter || '#')
    .replaceAll('{{linkedin_link}}', org.socialLinks?.linkedin || '#')
    .replaceAll('{{instagram_link}}', org.socialLinks?.instagram || '#')
    .replaceAll('{{youtube_link}}', org.socialLinks?.youtube || '#')
    .replaceAll('{{current_year}}', currentYear);
}
