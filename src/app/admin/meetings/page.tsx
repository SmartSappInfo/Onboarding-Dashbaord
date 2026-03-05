import MeetingsClient from './MeetingsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Session Registry',
  description: 'Coordinate and manage parent engagement sessions and staff training workshops.',
};

export default function MeetingsPage() {
  return <MeetingsClient />;
}
