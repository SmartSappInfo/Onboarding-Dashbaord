import MeetingsHomeClient from './MeetingsHomeClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meetings Workspace | SmartSapp',
  description: 'Manage your daily schedule, client appointments, webinars, and meeting intelligence.',
};

export default function MeetingsPage() {
  return <MeetingsHomeClient />;
}
