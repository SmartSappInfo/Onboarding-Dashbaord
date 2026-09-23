/**
 * {{Org_name}} Experience Platform — Canonical Route Redirect: /courses -> /learn
 *
 * Honors the URL structure in docs/membership/membership_idea.md (§29) by cleanly
 * redirecting any direct hits or legacy links from /portal/[slug]/courses to
 * the canonical curriculum route at /portal/[slug]/learn.
 */

import { redirect } from 'next/navigation';

interface CoursesRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function CoursesRedirectPage({ params }: CoursesRedirectProps) {
  const { slug } = await params;
  redirect(`/portal/${slug}/learn`);
}
