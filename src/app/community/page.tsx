/**
 * Root Route Fallback: /community -> /portal/academy/community
 *
 * Prevents 404s when un-scoped root community links are navigated to directly.
 */

import { redirect } from 'next/navigation';

export default function RootCommunityPage() {
  redirect('/portal/academy/community');
}
