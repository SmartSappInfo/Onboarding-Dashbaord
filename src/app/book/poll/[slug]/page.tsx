import { notFound } from 'next/navigation';
import { getMeetingPollBySlugAction } from '@/app/actions/meeting-poll-actions';
import { PublicPollClient } from './PublicPollClient';

interface PublicPollPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function PublicPollPage({ params }: PublicPollPageProps) {
  const { slug } = await params;
  const res = await getMeetingPollBySlugAction(slug);

  if (!res.success || !res.poll) {
    notFound();
  }

  return <PublicPollClient initialPoll={res.poll} initialVotes={res.votes || []} />;
}
