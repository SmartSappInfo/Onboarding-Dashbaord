import { redirect } from 'next/navigation';

/**
 * @fileOverview Alias Route: `/admin/settings/ai/capabilities` -> `/admin/companybrain/tools`
 *
 * Implements P-D3: redirects tenant capability admin requests directly to the canonical
 * CompanyBrain MCP tool and capability console.
 */
export default function CapabilitiesSettingsRedirectPage() {
  redirect('/admin/companybrain/tools');
}
