'use client';

import * as React from 'react';
import { Check, X, Clock, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ExecutionStatus = 'success' | 'failed' | 'waiting' | 'skipped' | 'cancelled' | null;

interface ExecutionOverlayProps {
  executionStatus?: string | null;
  executionError?: string | null;
  executionMeta?: any;
}

export function useExecutionOverlay(data: ExecutionOverlayProps) {
  const status = data.executionStatus as ExecutionStatus;
  if (!status) return { borderClass: '', badgeIcon: null, glowClass: '', opacityClass: '' };

  const map = {
    success: {
      borderClass: 'border-emerald-500 ring-2 ring-emerald-500/20 dark:ring-emerald-500/10',
      glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]',
      opacityClass: '',
      badgeIcon: 'check' as const,
    },
    failed: {
      borderClass: 'border-rose-500 ring-2 ring-rose-500/20 dark:ring-rose-500/10',
      glowClass: 'shadow-[0_0_12px_rgba(244,63,94,0.25)]',
      opacityClass: '',
      badgeIcon: 'x' as const,
    },
    waiting: {
      borderClass: 'border-purple-500 ring-2 ring-purple-500/20 dark:ring-purple-500/10 animate-pulse',
      glowClass: 'shadow-[0_0_12px_rgba(168,85,247,0.25)]',
      opacityClass: '',
      badgeIcon: 'clock' as const,
    },
    cancelled: {
      borderClass: 'border-amber-500 ring-2 ring-amber-500/20 dark:ring-amber-500/10',
      glowClass: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
      opacityClass: '',
      badgeIcon: 'minus' as const,
    },
    skipped: {
      borderClass: 'border-muted bg-muted/40',
      glowClass: '',
      opacityClass: 'opacity-40 grayscale-[20%]',
      badgeIcon: 'minus' as const,
    },
  };

  return map[status] || { borderClass: '', badgeIcon: null, glowClass: '', opacityClass: '' };
}

interface ExecutionBadgeProps {
  status: string | null | undefined;
  icon: 'check' | 'x' | 'clock' | 'minus';
}

export function ExecutionBadge({ status, icon }: ExecutionBadgeProps) {
  const baseClasses = "w-5 h-5 rounded-full border shadow-sm flex items-center justify-center text-white shrink-0";
  
  const styles = {
    success: "bg-emerald-500 border-emerald-600",
    failed: "bg-rose-500 border-rose-600",
    waiting: "bg-purple-500 border-purple-600",
    cancelled: "bg-amber-500 border-amber-600",
    skipped: "bg-muted border-border text-muted-foreground",
  };

  const IconMap = {
    check: Check,
    x: X,
    clock: Clock,
    minus: Minus,
  };

  const IconComponent = IconMap[icon] || Minus;
  const resolvedStatus = (status as ExecutionStatus) || 'skipped';

  return (
    <div className={cn(baseClasses, styles[resolvedStatus])}>
      <IconComponent size={10} strokeWidth={3} />
    </div>
  );
}
