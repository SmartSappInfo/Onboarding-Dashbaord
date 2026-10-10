import { ScriptBuilderClient } from './ScriptBuilderClient';

export default async function NewScriptPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; returnCampaignId?: string }>;
}) {
  const { id, returnCampaignId } = await searchParams;
  return <ScriptBuilderClient scriptId={id} returnCampaignId={returnCampaignId} />;
}
