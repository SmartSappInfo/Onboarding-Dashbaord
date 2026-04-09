
import ResultsClient from './ResultsClient';
import { Metadata } from 'next';

/**
 * @fileOverview Meeting Intelligence Hub Entry Point (Server).
 */

export const metadata: Metadata = {
  title: 'Meeting Intelligence Hub',
  description: 'Visualize session reach, attendance velocity, and family census data.',
};

export default async function MeetingResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultsClient meetingId={id} />;
}
