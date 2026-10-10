import { redirect } from 'next/navigation';

/**
 * Backward compatibility redirect:
 * Routes legacy /admin/messaging/call-centre/campaigns/new to /admin/call-centre/campaigns/new.
 */
export default async function LegacyCallCentreNewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value)) value.forEach(v => query.append(key, v));
  });
  const queryString = query.toString();
  redirect(`/admin/call-centre/campaigns/new${queryString ? `?${queryString}` : ''}`);
}
