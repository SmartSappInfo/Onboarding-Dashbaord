/**
 * @fileoverview Single Source of Truth for Message Style Priority Resolution
 * & Default Organization Style Auto-Provisioning.
 *
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer & Security Protocol):
 * 1. Tenant Sovereignty: Primary governance level for message styles is Organization (orgId).
 *    Styles define an organization's unified brand identity (Logo, Colors, Fonts, Header, Footer).
 * 2. Deterministic 7-Tier Resolution Order:
 *    - Org-specific default style (organizationId === orgId && isDefault === true)
 *    - Workspace-specific default style (workspaceIds includes workspaceId && isDefault === true)
 *    - Any Org-specific style (organizationId === orgId)
 *    - Any Workspace-specific style (workspaceIds includes workspaceId)
 *    - Global default style (scope === 'global' && isDefault === true)
 *    - Any default style (isDefault === true)
 *    - First style in collection (styles[0])
 * 3. Race-Condition Safe Auto-Seeding: Uses deterministic Document IDs ('style_org_' + orgId + '_default')
 *    to prevent duplicate creation across concurrent sessions.
 *
 * CAUTION: Never fallback to hardcoded SmartSapp Hub branding for non-root organizations.
 * Always derive defaults from activeOrganization / activeWorkspace.
 */

import type { MessageStyle, Organization } from '../types';

/**
 * Returns the highest priority MessageStyle for a given organization and workspace
 * using a deterministic 7-tier resolution hierarchy.
 *
 * Safe for pure in-memory evaluation (no I/O).
 *
 * @param styles       Array of candidate MessageStyles.
 * @param orgId        Active Organization ID.
 * @param workspaceId  Active Workspace ID.
 * @returns            Matching MessageStyle or undefined if styles array is empty.
 */
export function getDefaultStyle(
  styles: MessageStyle[] | undefined | null,
  orgId?: string,
  workspaceId?: string
): MessageStyle | undefined {
  if (!styles || styles.length === 0) return undefined;

  // Tier 1: Org-specific default style
  if (orgId) {
    const orgDefault = styles.find(
      (s) => s.organizationId === orgId && s.isDefault === true
    );
    if (orgDefault) return orgDefault;
  }

  // Tier 2: Workspace-specific default style
  if (workspaceId) {
    const wsDefault = styles.find(
      (s) => s.workspaceIds?.includes(workspaceId) && s.isDefault === true
    );
    if (wsDefault) return wsDefault;
  }

  // Tier 3: Any Org-specific style
  if (orgId) {
    const anyOrgStyle = styles.find((s) => s.organizationId === orgId);
    if (anyOrgStyle) return anyOrgStyle;
  }

  // Tier 4: Any Workspace-specific style
  if (workspaceId) {
    const anyWsStyle = styles.find((s) => s.workspaceIds?.includes(workspaceId));
    if (anyWsStyle) return anyWsStyle;
  }

  // Tier 5: Global default style
  const globalDefault = styles.find(
    (s) => s.scope === 'global' && s.isDefault === true
  );
  if (globalDefault) return globalDefault;

  // Tier 6: Any marked default style
  const anyDefault = styles.find((s) => s.isDefault === true);
  if (anyDefault) return anyDefault;

  // Tier 7: Fallback to first available style
  return styles[0];
}

/**
 * Canonical default HTML wrapper template for auto-provisioned organization styles.
 */
export const DEFAULT_ORG_STYLE_WRAPPER = `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{org_name}}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: 'Figtree', Helvetica, Arial, sans-serif; color: #1E293B;">
  <div style="background-color: #F8FAFC; padding: 32px 16px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); border: 1px solid #E2E8F0;">
      <!-- Header Logo Bar -->
      <div style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #F1F5F9; text-align: left;">
        {{#if org_logo_url}}
          <img src="{{org_logo_url}}" alt="{{org_name}}" style="max-height: 48px; width: auto; display: block; border: 0;" />
        {{else}}
          <div style="font-size: 20px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em;">{{org_name}}</div>
        {{/if}}
      </div>
      <!-- Email Main Content Gateway -->
      <div style="padding: 36px 32px; font-size: 15px; line-height: 1.6; color: #334155;">
        {{content}}
      </div>
      <!-- Organization Footer -->
      {{org_footer}}
    </div>
  </div>
</body>
</html>
`.trim();


