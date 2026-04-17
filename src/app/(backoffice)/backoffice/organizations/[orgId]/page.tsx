import OrgDetailClient from './OrgDetailClient';

/**
 * Organization Detail Page
 * Fetches orgId from URL params and renders the tabbed detail view.
 */
export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <OrgDetailClient orgId={orgId} />;
}
