import { redirect } from 'next/navigation';

/**
 * Backward compatibility redirect:
 * Routes legacy /admin/messaging/call-centre/scripts/new to /admin/call-centre/scripts/new.
 */
export default async function LegacyCallCentreNewScriptPage({
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
  redirect(`/admin/call-centre/scripts/new${queryString ? `?${queryString}` : ''}`);
}
