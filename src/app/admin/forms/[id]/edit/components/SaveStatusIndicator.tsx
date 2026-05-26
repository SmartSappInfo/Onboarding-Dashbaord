'use client';

import * as React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

interface Props {
  status: SaveStatus;
  className?: string;
}

const statusConfig: Record<SaveStatus, {
  label: string;
  icon: React.ReactNode;
  className: string;
}> = {
  idle:     { label: '',                  icon: null,                                                   className: 'opacity-0 pointer-events-none' },
  dirty:    { label: 'Unsaved changes',   icon: <Clock className="h-3 w-3" />,                          className: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800' },
  saving:   { label: 'Saving…',          icon: <Loader2 className="h-3 w-3 animate-spin" />,           className: 'text-muted-foreground bg-muted border-border' },
  saved:    { label: 'All changes saved', icon: <CheckCircle2 className="h-3 w-3" />,                  className: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800' },
  error:    { label: 'Save failed',       icon: <AlertCircle className="h-3 w-3" />,                   className: 'text-destructive bg-destructive/5 border-destructive/30' },
  conflict: { label: 'Conflict — refresh', icon: <AlertTriangle className="h-3 w-3" />,                className: 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800' },
};

/**
 * Pure display component for autosave status.
 * Receives `status` as prop — no internal state, no side effects.
 */
export default function SaveStatusIndicator({ status, className }: Props) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all duration-300',
        config.className,
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={config.label || 'Save status'}
    >
      {config.icon}
      {config.label && <span>{config.label}</span>}
    </div>
  );
}
