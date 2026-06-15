import { CampaignWizardClient } from './CampaignWizardClient';

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <CampaignWizardClient campaignId={id} />;
}
