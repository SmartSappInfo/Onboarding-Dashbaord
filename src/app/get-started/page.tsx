/**
 * Root Route Fallback: /get-started -> /portal/academy/join
 *
 * Prevents 404s when un-scoped root get-started links are navigated to directly.
 */

import { redirect } from 'next/navigation';

export default function RootGetStartedPage() {
  redirect('/portal/academy/join');
}
