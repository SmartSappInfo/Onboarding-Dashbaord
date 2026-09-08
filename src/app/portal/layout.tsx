import type { ReactNode } from 'react';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Member Portal Root Layout (/portal)
 * -----------------------------------
 * 1. Single Source of Truth for Dynamic Route Enforcement:
 *    All 16 portal routes (/portal/[slug], /portal/[slug]/learn/*, /portal/[slug]/community/*, etc.)
 *    are dynamic, multi-tenant, and customer-authenticated at runtime.
 * 2. Build-Time Static Generation Prevention:
 *    Enforces `dynamic = 'force-dynamic'` and `revalidate = 0` across all nested child segments.
 *    Completely prevents Next.js Turbopack from attempting to execute `PortalService.getPortalBySlug`
 *    or querying Firestore during cloud CI/CD builds.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PortalRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
