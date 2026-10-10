import { redirect } from 'next/navigation';

/**
 * Backward compatibility redirect:
 * Routes legacy /admin/messaging/call-centre traffic to the standalone /admin/call-centre route.
 */
export default async function LegacyCallCentrePage({
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
  redirect(`/admin/call-centre${queryString ? `?${queryString}` : ''}`);
}
