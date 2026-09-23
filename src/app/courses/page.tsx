/**
 * Root Route Fallback: /courses -> /portal/academy/learn
 *
 * Prevents 404s when un-scoped root courses links are navigated to directly.
 */

import { redirect } from 'next/navigation';

export default function RootCoursesPage() {
  redirect('/portal/academy/learn');
}
