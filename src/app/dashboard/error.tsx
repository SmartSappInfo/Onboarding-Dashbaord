'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Dashboard Error:', error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
      <div className="rounded-lg border bg-card p-8 shadow-sm max-w-md w-full">
        <h2 className="text-2xl font-bold tracking-tight mb-2">Something went wrong!</h2>
        <p className="text-muted-foreground mb-6">
          We encountered an error while loading the dashboard. Please try again.
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      </div>
    </div>
  );
}
