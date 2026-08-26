import * as React from 'react';
import { Metadata } from 'next';
import { MeetingsShell } from './components/MeetingsShell';

export const metadata: Metadata = {
  title: 'Meetings Workspace | SmartSapp',
  description: 'Unified operational workspace for scheduling, webinars, office hours, and AI intelligence.',
};

export default function MeetingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MeetingsShell>{children}</MeetingsShell>;
}
