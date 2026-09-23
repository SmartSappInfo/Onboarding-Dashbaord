'use client';

/**
 * @fileoverview Portal Studio Route Error Boundary
 *
 * ARCHITECTURAL POINTER:
 * Catches any unhandled client exceptions occurring inside the Portal Studio view
 * (e.g. malformed Firestore entity links, missing sub-objects, or rendering anomalies)
 * and displays an actionable recovery screen with retry and navigation fallback.
 * Adheres to .agents/AGENTS.md guidelines:
 * - Minimum touch target >= 44px
 * - Relative navigation paths
 * - Clear active states (active:scale-[0.98])
 */

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, ArrowLeft, LayoutGrid } from 'lucide-react';

export default function PortalStudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[Portal Studio Error Boundary Caught]:', error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[500px] w-full flex-col items-center justify-center bg-background/50 p-6 text-center">
      <div className="rounded-3xl border border-destructive/20 bg-card/90 p-8 shadow-xl max-w-lg w-full space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black tracking-tight text-foreground">
            Portal Studio Temporarily Unavailable
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A rendering issue occurred while loading this Experience Portal. You can attempt to reload the studio or navigate back to your portals list.
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
            Retry Studio
          </Button>
          <Button
            variant="outline"
            asChild
            className="h-10 min-h-[44px] px-5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs active:scale-[0.98]"
          >
            <Link href="/admin/portals">
              <ArrowLeft className="h-4 w-4" />
              Back to Portals
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
