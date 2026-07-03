import { Suspense } from 'react';
import CalendarClientWrapper from './CalendarClientWrapper';

export const metadata = {
  title: 'Workspace Timeline & Calendar',
  description: 'View and manage workspace meetings, tasks, and scheduling.',
};

export default async function AdminCalendarPage() {
  return (
    <Suspense fallback={<div className="min-h-[500px] w-full" />}>
      <CalendarClientWrapper />
    </Suspense>
  );
}
