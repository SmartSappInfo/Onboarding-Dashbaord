import { WorkspaceClient } from './WorkspaceClient';

export default async function WorkspaceContainerPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  return <WorkspaceClient campaignId={campaignId} />;
}
