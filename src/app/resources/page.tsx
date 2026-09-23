/**
 * Root Route Fallback: /resources -> /portal/academy/content
 *
 * Prevents 404s when un-scoped root resources links are navigated to directly.
 */

import { redirect } from 'next/navigation';

export default function RootResourcesPage() {
  redirect('/portal/academy/content');
}
