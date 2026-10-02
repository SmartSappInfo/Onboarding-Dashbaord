'use client';

/**
 * @fileOverview Emergency Dead-Man Switch Alert Banner (Phase 4 Milestone 4)
 *
 * Implements Rule 60 (Emergency Dead-Man Controls) and Rule 61 (Operator Console Surface).
 */

import * as React from 'react';
import { ShieldAlert } from 'lucide-react';

export interface DeadManPauseBannerProps {
  isPaused: boolean;
}

export function DeadManPauseBanner({ isPaused }: DeadManPauseBannerProps) {
  if (!isPaused) return null;

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 sm:p-4 text-destructive flex items-start gap-3 shadow-sm animate-in fade-in duration-300">
      <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
      <div className="space-y-0.5 text-xs sm:text-sm">
        <div className="font-semibold flex items-center gap-2">
          <span>Emergency Dead-Man Switch Active</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-destructive/20 uppercase tracking-wider">
            Halted
          </span>
        </div>
        <p className="text-muted-foreground leading-relaxed text-xs">
          Autonomous agent background ingestion and memory mutations are currently paused across this organization.
          Cloud Tasks background indexers are holding in retry backoff mode.
        </p>
      </div>
    </div>
  );
}
