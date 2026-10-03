import { redirect } from 'next/navigation';

/**
 * @fileOverview Alias Route: `/admin/settings/ai/capabilities` -> `/admin/mcp?tab=catalog` (Phase 5 Milestone 4)
 *
 * Implements Rule 69 (Strangler Pattern & SSOT): redirects capability admin requests directly
 * to the canonical Operator Capability Console.
 */
export default function CapabilitiesSettingsRedirectPage() {
  redirect('/admin/mcp?tab=catalog');
}
