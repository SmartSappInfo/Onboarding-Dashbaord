import MeetingsClient from '../MeetingsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sessions & Webinars Registry | SmartSapp Meetings',
  description: 'Coordinate, manage, and monitor group sessions, orientations, and broadcast webinars.',
};

export default function SessionsPage() {
  return <MeetingsClient />;
}
