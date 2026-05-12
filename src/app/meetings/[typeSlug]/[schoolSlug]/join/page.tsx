import JoiningPageClient from '@/components/joining-page-client';
import Footer from '@/components/footer';

/**
 * Meeting Joining Page (Waiting Room) — Server Component
 * 
 * Accessible at /meetings/[typeSlug]/[schoolSlug]/join?token=[registrantToken]
 * 
 * This page serves as a "Thank You for Registering" + countdown/waiting room.
 * If no valid token is present, the client component redirects to registration.
 * Attendance is logged ONLY when the user transitions to the actual meeting link.
 */
export default async function MeetingJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ typeSlug: string; schoolSlug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { typeSlug, schoolSlug } = await params;
  const { token } = await searchParams;

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        <JoiningPageClient
          typeSlug={typeSlug}
          schoolSlug={schoolSlug}
          token={token || null}
        />
      </main>
      <Footer />
    </div>
  );
}
