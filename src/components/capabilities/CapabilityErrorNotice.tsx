'use client';

/**
 * @fileOverview Capability Error Notice Component (Phase 1 / PR-9)
 *
 * Implements Rule 23 (State Change Invariant), Rule 51 (User-Facing Error Notice Contract),
 * and PRD §53.
 *
 * An accessible, user-safe error banner with state-change transparency,
 * secure relative route navigation, and tactile retry actions.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, X, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ClientCapabilityError } from '@/platform/capabilities/ui/types';

export interface CapabilityErrorNoticeProps {
  error: ClientCapabilityError;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  className?: string;
}

export function CapabilityErrorNotice({
  error,
  onRetry,
  onDismiss,
  className,
}: CapabilityErrorNoticeProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const isSafeRelativePath = (path: string): boolean => {
    return path.startsWith('/') && !path.startsWith('//') && !path.includes(':');
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-foreground shadow-sm transition-all',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-destructive">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold tracking-tight text-destructive">
              Action Failed
            </h4>

            {/* State Change Badge (Rule 23 & Rule 51) */}
            {error.stateChanged === 'no' ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                No changes made
              </span>
            ) : error.stateChanged === 'yes' ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                State modified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-3 w-3" />
                Unknown state
              </span>
            )}

            <span className="text-xs text-muted-foreground font-mono">
              [{error.code}]
            </span>
          </div>

          <p className="text-sm text-foreground/90 leading-relaxed">
            {error.message}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Retry Button */}
            {error.retryable && onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying}
                className="min-h-[44px] rounded-xl active:scale-[0.97] transition-transform gap-1.5"
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', isRetrying && 'animate-spin')}
                />
                <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
              </Button>
            )}

            {/* Actionable Path Navigation (Rule: single relative path only) */}
            {error.actionConfig && isSafeRelativePath(error.actionConfig.path) && (
              <Button
                type="button"
                variant="default"
                size="sm"
                asChild
                className="min-h-[44px] rounded-xl active:scale-[0.97] transition-transform gap-1.5"
              >
                <Link href={error.actionConfig.path}>
                  <span>{error.actionConfig.label}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error notice"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
