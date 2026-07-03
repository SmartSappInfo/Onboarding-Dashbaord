'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const CalendarClient = dynamic(() => import('./CalendarClient'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-24 space-y-4 min-h-[500px]">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="text-sm font-semibold text-muted-foreground animate-pulse">
        Loading System Calendar Timeline...
      </p>
    </div>
  ),
});

export default function CalendarClientWrapper() {
  return <CalendarClient />;
}
