import { redirect } from 'next/navigation';

/**
 * @fileOverview Backward-compatible redirect from /intelligence to /admin/intelligence
 * (Rule 69 Strangler Fig Invariant)
 */
export default function IntelligenceLegacyRedirectPage() {
  redirect('/admin/intelligence');
}
