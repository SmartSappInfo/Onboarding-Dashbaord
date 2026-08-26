import * as React from 'react';
import { Suspense } from 'react';
import { PollsClient } from './PollsClient';

export default function MeetingPollsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading consensus polls...</div>}>
      <PollsClient />
    </Suspense>
  );
}
