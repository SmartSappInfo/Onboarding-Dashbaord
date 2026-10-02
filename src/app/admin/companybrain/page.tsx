import { redirect } from 'next/navigation';

/**
 * @fileOverview Legacy Redirect: /admin/companybrain -> /admin/brain (Phase 4 Milestone 4)
 *
 * Implements Rule 1 (Preserve Preexisting Ecosystem) & Strangler Pattern.
 */

export default function CompanyBrainRedirectPage() {
  redirect('/admin/brain');
}
