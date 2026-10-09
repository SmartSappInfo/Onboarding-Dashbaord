'use client';

/**
 * @fileOverview Recent Campaigns Card & AI Assistant Promotion Banner.
 * 
 * Part of SmartSapp Communications Hub (Phase 8).
 * Conforms to SmartSapp Agentic Development Rules:
 * - Rule 1: Zero `any` or `any[]` typing.
 * - Rule 7: Mobile-first ergonomic touch targets (`min-h-[44px]`).
 * - Rule 8: Safe relative internal navigation.
 * - Rule 19: Directs users to AI Modal or Campaign Wizard with human review.
 */

import * as React from 'react';
import Link from 'next/link';
import { Megaphone, Sparkles, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RecentCampaignItem } from '@/lib/types/messaging-dashboard';

export interface RecentCampaignsCardProps {
  campaigns?: RecentCampaignItem[];
  isLoading?: boolean;
  onOpenAiModal?: () => void;
  className?: string;
}

export function RecentCampaignsCard({
  campaigns = [],
  isLoading,
  onOpenAiModal,
  className,
}: RecentCampaignsCardProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3', className)}>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Recent Campaigns</h3>
            <p className="text-xs text-muted-foreground">Latest broadcast dispatches</p>
          </div>
          <Link
            href="/admin/messaging/campaigns"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1 active:scale-[0.97] transition-all"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="divide-y divide-border/50 pt-1">
          {campaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center italic">
              No campaigns found in this workspace.
            </p>
          ) : (
            campaigns.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Megaphone className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {c.recipientCount.toLocaleString()} recipients · {c.deliveryRate}% delivered
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {c.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Promo Banner */}
      <div className="rounded-2xl border border-primary/20 bg-linear-to-r from-blue-500/10 via-purple-500/10 to-transparent p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <Sparkles className="w-4 h-4" /> SmartSapp AI Assistant
          </div>
          <p className="text-xs text-muted-foreground">
            Let AI do the heavy lifting — draft messages, analyze delivery trends, and engage your audience.
          </p>
        </div>
        <Button
          type="button"
          onClick={onOpenAiModal}
          className="min-h-[44px] rounded-xl text-xs font-semibold active:scale-[0.97] transition-all shrink-0"
        >
          Try AI Assistant →
        </Button>
      </div>
    </div>
  );
}
