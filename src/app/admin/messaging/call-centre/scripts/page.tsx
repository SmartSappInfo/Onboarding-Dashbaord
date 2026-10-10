import { redirect } from 'next/navigation';

/**
 * Backward compatibility redirect:
 * Routes legacy /admin/messaging/call-centre/scripts traffic to /admin/call-centre?tab=scripts.
 */
export default async function LegacyCallCentreScriptsPage({
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
  query.set('tab', 'scripts');
  redirect(`/admin/call-centre?${query.toString()}`);
}
