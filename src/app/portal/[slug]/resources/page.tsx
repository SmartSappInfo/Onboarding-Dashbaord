/**
 * {{Org_name}} Experience Platform — Canonical Route Redirect: /resources -> /content
 *
 * Honors the URL structure in docs/membership/membership_idea.md (§29) by cleanly
 * redirecting any direct hits or legacy links from /portal/[slug]/resources to
 * the canonical content vault route at /portal/[slug]/content.
 */

import { redirect } from 'next/navigation';

interface ResourcesRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function ResourcesRedirectPage({ params }: ResourcesRedirectProps) {
  const { slug } = await params;
  redirect(`/portal/${slug}/content`);
}
