'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — 4-Card Quick Actions Grid
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Renders the primary action shortcuts matching user mockup (media_1791516336748_2f0e908d.jpg):
 *   1. New Campaign (Megaphone, purple accent)
 *   2. Start Message (Send paperplane, blue accent)
 *   3. Message Templates (FileText document, emerald accent)
 *   4. Manage Queue (Clock, orange accent)
 * - Section header with "View all features →" opening the Directory Modal (theme.md Section 8).
 * - Mobile ergonomics (Rule 7):
 *   - Desktop: 4 columns (lg:grid-cols-4).
 *   - Tablet & Mobile: 2x2 grid (grid-cols-2 gap-3 sm:gap-4 md:gap-5).
 *   - All cards meet min-h-[44px] touch target with tactile active:scale-[0.98].
 * - Safe relative navigation strictly enforced (Rule 8).
 * - Strict Zero-Any Invariant (Rule 4).
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Send,
  FileText,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  PRIMARY_QUICK_ACTIONS,
  type QuickActionItem,
} from '@/lib/messaging/quick-action-constants';
import { MessagingAllFeaturesModal } from './MessagingAllFeaturesModal';
import { cn } from '@/lib/utils';

export interface MessagingQuickActionsProps {
  className?: string;
}

function resolveActionIcon(iconName: QuickActionItem['iconName']) {
  switch (iconName) {
    case 'Megaphone':
      return <Megaphone className="h-5 w-5" />;
    case 'Send':
      return <Send className="h-5 w-5" />;
    case 'FileText':
      return <FileText className="h-5 w-5" />;
    case 'Clock':
      return <Clock className="h-5 w-5" />;
  }
}

function resolveAccentClasses(accent: QuickActionItem['accentColor']) {
  switch (accent) {
    case 'purple':
      return {
        bg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
        badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
      };
    case 'blue':
      return {
        bg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
        badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
      };
    case 'emerald':
      return {
        bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      };
    case 'orange':
      return {
        bg: 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400',
        badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
      };
  }
}

export function MessagingQuickActions({ className }: MessagingQuickActionsProps) {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);

  return (
    <section className={cn('space-y-3.5', className)} aria-labelledby="quick-actions-heading">
      {/* Section Header */}
      <div className="flex flex-row items-center justify-between gap-2">
        <div>
          <h3
            id="quick-actions-heading"
            className="text-base sm:text-lg font-semibold tracking-tight text-foreground"
          >
            Quick Actions
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Get started with the most common messaging tasks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            'inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400',
            'hover:text-blue-700 dark:hover:text-blue-300 hover:underline',
            'active:scale-[0.97] transition-all min-h-[44px] cursor-pointer'
          )}
        >
          <span>View all features</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 4-Card Responsive Grid: 4-col desktop, 2x2 mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        {PRIMARY_QUICK_ACTIONS.map((action) => {
          const accents = resolveAccentClasses(action.accentColor);
          return (
            <Link
              key={action.id}
              href={action.href}
              className={cn(
                'group relative flex flex-col justify-between overflow-hidden',
                'rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 md:p-5 text-card-foreground',
                'shadow-xs hover:shadow-md hover:border-primary/40 transition-all duration-200',
                'active:scale-[0.98] min-h-[140px] sm:min-h-[155px] cursor-pointer'
              )}
            >
              {/* Top: Squircle Icon & Badge */}
              <div className="flex items-center justify-between gap-2">
                <div
                  className={cn(
                    'flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
                    accents.bg
                  )}
                >
                  {resolveActionIcon(action.iconName)}
                </div>
                {action.badgeLabel && (
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold',
                      accents.badge
                    )}
                  >
                    {action.badgeLabel}
                  </span>
                )}
              </div>

              {/* Bottom: Title & Description */}
              <div className="mt-3">
                <span className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors block truncate">
                  {action.title}
                </span>
                <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 mt-1 leading-snug">
                  {action.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* All Features Modal */}
      <MessagingAllFeaturesModal open={modalOpen} onOpenChange={setModalOpen} />
    </section>
  );
}
