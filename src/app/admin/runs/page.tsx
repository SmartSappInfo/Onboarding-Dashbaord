import { redirect } from 'next/navigation';

/**
 * @fileOverview Strangler Fig Redirect: /admin/runs -> /admin/intelligence/runs (Phase 8 Milestone 2)
 *
 * Implements Rule 69 (Strangler Fig Pattern SSOT) to preserve backward-compatibility
 * with legacy run links while migrating to the unified Intelligence Mission Control.
 */

interface AdminRunsRedirectProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminRunsRedirectPage({
  searchParams,
}: AdminRunsRedirectProps) {
  const resolvedParams = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedParams)) {
    if (typeof value === 'string') {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    }
  }

  const queryString = query.toString();
  const target = queryString
    ? `/admin/intelligence/runs?${queryString}`
    : '/admin/intelligence/runs';

  redirect(target);
}
