'use client';

/**
 * @fileoverview Deals & Pipeline Route Error Boundary
 *
 * ARCHITECTURAL POINTER:
 * Catches any unhandled client exceptions occurring inside the Pipeline or Overview
 * views and displays an actionable recovery screen with retry mechanisms.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, Layout } from 'lucide-react';

export default function PipelineError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[Pipeline Error Boundary Caught]:', error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[450px] w-full flex-col items-center justify-center bg-background/50 p-6 text-center">
      <div className="rounded-3xl border border-destructive/20 bg-card/90 p-8 shadow-xl max-w-lg w-full space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black tracking-tight text-foreground">
            Pipeline View Interrupted
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A temporary client error occurred while rendering the pipeline view. You can reload the view or return to the main board.
          </p>
          {error?.message && (
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-[11px] font-mono text-muted-foreground text-left overflow-x-auto max-h-24 scrollbar-thin">
              {error.message}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            onClick={() => reset()}
            className="h-10 min-h-[44px] px-5 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/95 flex items-center justify-center gap-2 text-xs active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" />
            Retry View
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/admin/pipeline';
              }
            }}
            className="h-10 min-h-[44px] px-5 rounded-xl font-bold border-border/80 hover:bg-muted/10 flex items-center justify-center gap-2 text-xs active:scale-[0.98]"
          >
            <Layout className="h-4 w-4" />
            Reload Pipeline
          </Button>
        </div>
      </div>
    </div>
  );
}
