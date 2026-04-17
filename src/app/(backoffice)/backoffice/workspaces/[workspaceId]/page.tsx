import WorkspaceDetailClient from './WorkspaceDetailClient';

/**
 * Workspace Detail Page
 * Fetches workspaceId from URL params and renders the detail view.
 */
export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <WorkspaceDetailClient workspaceId={workspaceId} />;
}
