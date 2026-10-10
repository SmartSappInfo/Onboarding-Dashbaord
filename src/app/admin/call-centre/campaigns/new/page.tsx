import { CampaignWizardClient } from './CampaignWizardClient';

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; step?: string; scriptId?: string }>;
}) {
  const { id, step, scriptId } = await searchParams;
  const initialStep = step ? parseInt(step, 10) : undefined;
  return <CampaignWizardClient campaignId={id} initialStep={initialStep} initialScriptId={scriptId} />;
}
