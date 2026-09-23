/**
 * {{Org_name}} Experience Platform — Canonical Route Redirect: /get-started -> /join
 *
 * Redirects any direct hits or legacy links from /portal/[slug]/get-started to
 * the canonical member registration & onboarding route at /portal/[slug]/join.
 */

import { redirect } from 'next/navigation';

interface GetStartedRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function GetStartedRedirectPage({ params }: GetStartedRedirectProps) {
  const { slug } = await params;
  redirect(`/portal/${slug}/join`);
}
