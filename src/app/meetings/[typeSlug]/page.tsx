import { redirect, notFound } from 'next/navigation';

/**
 * Legacy Redirector (Server Component)
 * Handles old-style /meetings/school-slug URLs by redirecting to the default parent-engagement type.
 */
export default async function OldSchoolMeetingPage({ params }: { params: Promise<{ typeSlug: string }> }) {
  const { typeSlug } = await params;

  // Prevent redirect loops for nested static segments
  const reservedPaths = ['parent-engagement', 'kickoff', 'training', 'webinar'];
  if (reservedPaths.includes(typeSlug)) {
    notFound();
  }

  // Redirect to the new structured URL
  redirect(`/meetings/parent-engagement/${typeSlug}`);
}
