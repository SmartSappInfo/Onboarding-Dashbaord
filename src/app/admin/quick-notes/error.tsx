'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainerFluid } from '@/components/ui/page-container';

export default function QuickNotesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surface for observability; replace with the platform logger if/when added.
    console.error('[QuickNotes] route error:', error);
  }, [error]);

  return (
    <PageContainerFluid>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive/70" />
        <h2 className="mt-4 font-serif text-lg font-medium text-foreground">Something went wrong</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Quick Notes couldn&apos;t load. This is usually transient — try again.
        </p>
        <Button onClick={reset} variant="outline" className="mt-4 gap-2">
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </PageContainerFluid>
  );
}
