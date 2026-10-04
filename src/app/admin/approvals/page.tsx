import { redirect } from 'next/navigation';

/**
 * @fileOverview Strangler Fig Redirect: /admin/approvals -> /admin/intelligence/approvals (Phase 8 Milestone 3)
 *
 * Implements Rule 69 (Strangler Fig Pattern SSOT) to preserve backward-compatibility
 * with legacy approval bookmarks and links while migrating to the unified Intelligence Mission Control.
 */

interface AdminApprovalsRedirectProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminApprovalsRedirectPage({
  searchParams,
}: AdminApprovalsRedirectProps) {
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
    ? `/admin/intelligence/approvals?${queryString}`
    : '/admin/intelligence/approvals';

  redirect(target);
}
