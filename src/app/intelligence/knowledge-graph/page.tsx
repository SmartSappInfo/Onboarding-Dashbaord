import { redirect } from 'next/navigation';

/**
 * @fileOverview Strangler Fig Redirect: /intelligence/knowledge-graph -> /admin/intelligence/knowledge/graph (Rule 69)
 */
export default function LegacyKnowledgeGraphRedirectPage() {
  redirect('/admin/intelligence/knowledge/graph');
}
