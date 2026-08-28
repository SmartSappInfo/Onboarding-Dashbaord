import type { OrgBranding } from '@/lib/types';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Strips out script blocks, javascript: protocols, iframes, and dangerous handlers
 * using DOMPurify to prevent XSS vectors when rendering custom HTML templates.
 */
export function sanitizeCustomHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  });
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
