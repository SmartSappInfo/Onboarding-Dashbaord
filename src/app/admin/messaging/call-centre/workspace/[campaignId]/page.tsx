import { redirect } from 'next/navigation';

/**
 * Backward compatibility redirect:
 * Routes legacy /admin/messaging/call-centre/workspace/[campaignId] to /admin/call-centre/workspace/[campaignId].
 */
export default async function LegacyCallCentreWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { campaignId } = await params;
  const sParams = await searchParams;
  const query = new URLSearchParams();
  Object.entries(sParams).forEach(([key, value]) => {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value)) value.forEach(v => query.append(key, v));
  });
  const queryString = query.toString();
  redirect(`/admin/call-centre/workspace/${campaignId}${queryString ? `?${queryString}` : ''}`);
}
