'use client';

/**
 * @fileoverview Root Application Error Boundary
 *
 * ARCHITECTURAL POINTER:
 * Next.js App Router root error boundary. Catches unhandled errors across all child pages
 * and layouts that do not have their own localized error boundary.
 * Prevents the "missing required error components, refreshing..." fallback message.
 */

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export default function AppRootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[Root App Error Boundary Caught]:', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <div className="rounded-3xl border border-destructive/20 bg-card p-8 shadow-xl max-w-md w-full text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            An unexpected error occurred while rendering this page. You can try refreshing the component or returning to the dashboard.
          </p>
          {error?.message && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-[11px] font-mono text-muted-foreground text-left overflow-x-auto max-h-28 scrollbar-thin">
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
            Try again
          </Button>
          <Button
            variant="outline"
            asChild
            className="h-10 min-h-[44px] px-5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs active:scale-[0.98]"
          >
            <Link href="/admin">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
