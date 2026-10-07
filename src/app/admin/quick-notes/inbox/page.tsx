import { redirect } from 'next/navigation';

/**
 * @fileOverview Strangler Fig Redirect: /admin/quick-notes/inbox -> /admin/intelligence/knowledge/inbox (Rule 69)
 */
export default function LegacyQuickNotesInboxRedirectPage() {
  redirect('/admin/intelligence/knowledge/inbox');
}
