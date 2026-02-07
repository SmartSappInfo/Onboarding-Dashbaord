'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// This page now acts as a redirect for backward compatibility.
export default function OldSchoolMeetingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  useEffect(() => {
    if (slug) {
      // Redirect to the new "parent-engagement" meeting type URL
      router.replace(`/meetings/parent-engagement/${slug}`);
    }
  }, [slug, router]);

  // Render a simple loading state while redirecting
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
