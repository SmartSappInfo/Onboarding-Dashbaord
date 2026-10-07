import { redirect } from 'next/navigation';

/**
 * @fileOverview Strangler Fig Redirect: /intelligence/knowledge/inbox -> /admin/intelligence/knowledge/inbox (Rule 69)
 */
export default function LegacyKnowledgeInboxRedirectPage() {
  redirect('/admin/intelligence/knowledge/inbox');
}
