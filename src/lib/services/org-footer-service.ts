/**
 * @fileoverview Org-bound email footer rendering service.
 *
 * This module is intentionally PURE — no Firestore reads, no network I/O.
 * Org data is fetched upstream (messaging-branding.ts or template-resolver.ts)
 * and passed in as resolved variables. This makes the service fully unit-testable
 * without any Firebase mocking.
 *
 * Token support inside footerHtml:
 *   {{unsubscribe_copy}}   — org unsubscribe compliance text
 *   {{unsubscribe_link}}   — per-recipient tokenized preference URL
 *   {{org_name}}           — organization display name
 *   {{org_address}}        — physical mailing address
 *   {{org_email}}          — org contact email
 *   {{org_phone}}          — org contact phone
 *   {{org_website}}        — org website URL
 *   {{current_year}}       — current calendar year
 *   {{brand_primary_color}}— org primary brand hex color
 */

/**
 * HTML comment injected into every rendered footer.
 * The messaging engine checks for this sentinel to prevent double-appending
 * when a style wrapper already contains the footer.
 */
export const ORG_FOOTER_SENTINEL = '<!-- org-footer-sentinel -->';

/**
 * The canonical default footer template.
 * Used when an organization has not configured a custom footerHtml.
 * Designed to be email-client safe (table-based, inline styles).
 */
export const DEFAULT_ORG_FOOTER_HTML = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 0;">
  <tr>
    <td style="padding: 32px 40px; background-color: #F8FAFC; border-top: 1px solid #F1F5F9;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-family: Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; line-height: 1.6; color: #64748B;">
            <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">{{org_name}}</p>
            {{#if org_address}}<p style="margin: 0 0 4px 0;">{{org_address}}</p>{{/if}}
            {{#if org_contact}}<p style="margin: 0 0 16px 0;">{{org_contact}}</p>{{/if}}
            <p style="margin: 0 0 6px 0; font-size: 11px; color: #94A3B8;">{{unsubscribe_copy}}</p>
            <p style="margin: 0; font-size: 11px; color: #94A3B8;">
              To manage your preferences or opt out, <a href="{{unsubscribe_link}}" style="color: {{brand_primary_color}}; text-decoration: underline;">unsubscribe here</a>.
            </p>
            <p style="margin: 12px 0 0; font-size: 10px; color: #CBD5E1;">© {{current_year}} {{org_name}}. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();

/**
 * All token values required to render the org footer.
 * Strict typing — no `any`.
 */
export interface OrgFooterVariables {
  unsubscribe_copy: string;
  unsubscribe_link: string;
  org_name: string;
  org_address: string;
  org_email: string;
  org_phone: string;
  org_website: string;
  current_year: string;
  brand_primary_color: string;
}

/**
 * Pure function — resolves all {{token}} placeholders in the footer template.
 *
 * @param footerHtml     Custom HTML template (falls back to DEFAULT_ORG_FOOTER_HTML).
 * @param footerEnabled  When false, returns '' immediately (no footer appended).
 * @param vars           All token values for substitution.
 * @returns              Resolved HTML string wrapped in sentinel comment, or ''.
 */
export function resolveOrgFooter(
  footerHtml: string | undefined,
  footerEnabled: boolean | undefined,
  vars: OrgFooterVariables,
): string {
  // Early exit: footer is explicitly disabled
  if (footerEnabled === false) return '';

  const template = footerHtml?.trim() || DEFAULT_ORG_FOOTER_HTML;

  // Build the contact line from available fields (phone • email)
  const contactParts: string[] = [];
  if (vars.org_phone) contactParts.push(vars.org_phone);
  if (vars.org_email) contactParts.push(vars.org_email);
  const orgContact = contactParts.join('  •  ');

  // Resolve {{#if field}}...{{/if}} conditional blocks before token substitution
  const withConditionals = resolveConditionals(template, {
    org_address: vars.org_address,
    org_contact: orgContact,
  });

  // Replace all {{token}} placeholders — order is intentional (longest first avoids partial matches)
  const rendered = withConditionals
    .replaceAll('{{unsubscribe_copy}}', vars.unsubscribe_copy)
    .replaceAll('{{unsubscribe_link}}', vars.unsubscribe_link)
    .replaceAll('{{brand_primary_color}}', vars.brand_primary_color)
    .replaceAll('{{org_address}}', vars.org_address)
    .replaceAll('{{org_website}}', vars.org_website)
    .replaceAll('{{org_contact}}', orgContact)
    .replaceAll('{{org_email}}', vars.org_email)
    .replaceAll('{{org_phone}}', vars.org_phone)
    .replaceAll('{{org_name}}', vars.org_name)
    .replaceAll('{{current_year}}', vars.current_year);

  return `\n${ORG_FOOTER_SENTINEL}\n${rendered}`;
}

/**
 * Checks whether an HTML string already contains the org footer.
 * Used by the messaging engine to prevent double-appending.
 *
 * Returns true if the HTML contains:
 * - The sentinel comment  (auto-appended footer), OR
 * - The {{org_footer}} token  (style wrapper with explicit footer slot)
 */
export function htmlContainsFooter(html: string): boolean {
  return html.includes(ORG_FOOTER_SENTINEL) || html.includes('{{org_footer}}');
}

/**
 * Builds the OrgFooterVariables map from raw branding variables.
 * Provides safe fallbacks for all fields so the footer always renders.
 *
 * @param vars  The flat variable map already available in the messaging engine.
 */
export function buildOrgFooterVars(vars: Record<string, string>): OrgFooterVariables {
  return {
    unsubscribe_copy:
      vars.unsubscribe_copy ||
      'You are receiving this email because you are registered with our services.',
    unsubscribe_link: vars.unsubscribe_link || '#',
    org_name: vars.org_name || '',
    org_address: vars.org_address || '',
    org_email: vars.org_email || '',
    org_phone: vars.org_phone || '',
    org_website: vars.org_website || '',
    current_year: vars.current_year || new Date().getFullYear().toString(),
    brand_primary_color: vars.brand_primary_color || '#3B5FFF',
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Resolves simple {{#if field}}...{{/if}} blocks.
 * When the field value is falsy (empty string, undefined), the block is removed.
 * When truthy, the block contents are kept (with the tags stripped).
 */
function resolveConditionals(
  template: string,
  fields: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(fields)) {
    const ifRegex = new RegExp(
      `\\{\\{#if ${key}\\}\\}([\\s\\S]*?)\\{\\{/if\\}\\}`,
      'g',
    );
    result = result.replace(ifRegex, value ? '$1' : '');
  }
  return result;
}
