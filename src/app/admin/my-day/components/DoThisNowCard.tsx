'use client';

/**
 * @fileoverview Hero "DO THIS NOW" Action Card for SmartSapp Seller Workspace (Phase 2).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 30 & UI Section 14:
 * - Highest-priority work item highlighted prominently at the top of the seller's day.
 * - Displays "What" (title), "Why" (data-backed reason), "Impact/Confidence" (attribution),
 *   and "Suggested Talking Point".
 * - Provides 1-click execution triggers: Launch Action Drawer, Quick Complete, Snooze, Dismiss.
 * - Live SLA countdown ticker integration.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Minimum 44px touch targets on mobile viewports.
 * - Strictly typed without 'any'.
 * - Micro-interactions use active:scale-[0.97] and sub-300ms transitions.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Flame,
  Phone,
  MessageSquare,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  Building2,
  DollarSign,
  TrendingUp,
  X,
  Info,
} from 'lucide-react';
import type { WorkQueueItem } from '@/lib/seller-workspace/types';
import { SlaCountdownBadge } from './SlaCountdownBadge';

interface DoThisNowCardProps {
  item: WorkQueueItem | null;
  onOpenActionDrawer: (item: WorkQueueItem) => void;
  onQuickComplete: (item: WorkQueueItem) => void;
  onSnooze: (item: WorkQueueItem, hours: number) => void;
  onDismiss: (item: WorkQueueItem) => void;
  isActionLoading?: boolean;
}

export function DoThisNowCard({
  item,
  onOpenActionDrawer,
  onQuickComplete,
  onSnooze,
  onDismiss,
  isActionLoading = false,
}: DoThisNowCardProps) {
  const [showScoreBreakdown, setShowScoreBreakdown] = React.useState(false);

  if (!item) {
    return (
      <Card className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-background p-6 shadow-sm text-center">
        <div className="flex flex-col items-center justify-center py-6 space-y-2">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">You are completely caught up!</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Zero urgent items in your queue right now. Great work staying ahead of SLAs and buyer signals!
          </p>
        </div>
      </Card>
    );
  }

  const getTypeIcon = () => {
    switch (item.type) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'meeting_prep':
        return <Calendar className="h-4 w-4" />;
      case 'buyer_signal':
        return <Sparkles className="h-4 w-4 text-amber-500" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <Card className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/[0.04] via-card to-background p-4 sm:p-6 shadow-md relative overflow-hidden transition-all duration-200">
      {/* Top Banner Accent */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-primary to-amber-500" />

      <CardContent className="p-0 space-y-4">
        {/* Header Ribbon: Hero Tag & SLA Countdown */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-black tracking-wider uppercase">
              <Flame className="h-3.5 w-3.5 fill-current animate-pulse" />
              DO THIS NOW
            </span>
            <Badge variant="outline" className="text-[11px] font-semibold flex items-center gap-1">
              {getTypeIcon()}
              <span className="capitalize">{item.type.replace('_', ' ')}</span>
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {item.slaDueAt && (
              <SlaCountdownBadge
                dueDate={item.slaDueAt}
                status={item.slaStatus}
              />
            )}
            <button
              type="button"
              onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-muted/60 hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              title="Click to view AI Priority Breakdown"
            >
              <TrendingUp className="h-3 w-3 text-primary" />
              <span>Score: {item.priorityScore}</span>
              <Info className="h-2.5 w-2.5 ml-0.5 opacity-70" />
            </button>
          </div>
        </div>

        {/* Score Breakdown Drawer/Tray if toggled */}
        {showScoreBreakdown && item.scoreBreakdown && (
          <div className="p-3 rounded-xl bg-muted/30 border text-xs space-y-1.5 font-mono animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="font-bold text-[11px] text-foreground flex justify-between">
              <span>PRIORITY ATTRIBUTION</span>
              <span className="text-primary font-extrabold">{item.scoreBreakdown.totalScore} / 100</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-muted-foreground pt-1">
              <div>Base: +{item.scoreBreakdown.baseScore}</div>
              <div>Deal Value: +{item.scoreBreakdown.dealValueBoost}</div>
              <div>Signals: +{item.scoreBreakdown.signalStrengthBoost}</div>
              <div>SLA Urgency: +{item.scoreBreakdown.slaUrgencyBoost}</div>
            </div>
          </div>
        )}

        {/* Entity & Deal Metadata */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Building2 className="h-3.5 w-3.5" />
            <span className="font-bold text-foreground">{item.entityName || item.dealName || 'Target Record'}</span>
            {item.dealValue && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center font-mono">
                  <DollarSign className="h-3 w-3" />
                  {item.dealValue.toLocaleString()} GHS
                </span>
              </>
            )}
            {item.dealStage && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 ml-1">
                {item.dealStage}
              </Badge>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight leading-snug">
            {item.title}
          </h2>
        </div>

        {/* Why Box (PRD Section 31) */}
        <div className="rounded-xl bg-card border p-3 sm:p-3.5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Why Take Action?</span>
            <span className="text-[11px] text-primary font-semibold">
              {item.confidence}% Confidence
            </span>
          </div>
          <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
            {item.reason}
          </p>
        </div>

        {/* Talking Point Box if available */}
        {item.suggestedTalkingPoint && (
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
              <Sparkles className="h-3 w-3" />
              Suggested Opening Hook
            </div>
            <p className="text-xs italic text-foreground/80 leading-relaxed">
              &ldquo;{item.suggestedTalkingPoint}&rdquo;
            </p>
          </div>
        )}

        {/* Action Button Row - Mobile First with 44px min-h */}
        <div className="pt-2 flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Primary Action Button */}
          <Button
            type="button"
            onClick={() => onOpenActionDrawer(item)}
            disabled={isActionLoading}
            className="flex-1 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-[0.97] transition-all duration-150 flex items-center justify-center gap-2"
          >
            {item.type === 'call' ? (
              <>
                <Phone className="h-4 w-4" /> Call & Advance Deal
              </>
            ) : item.type === 'meeting_prep' ? (
              <>
                <Calendar className="h-4 w-4" /> Open Meeting Brief
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Execute Action
              </>
            )}
          </Button>

          {/* Quick Complete Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => onQuickComplete(item)}
            disabled={isActionLoading}
            className="min-h-[44px] px-3.5 rounded-xl text-xs font-bold hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 active:scale-[0.97] transition-all duration-150"
            title="Mark as completed without logging detailed call duration"
          >
            <CheckCircle2 className="h-4 w-4 sm:mr-1 text-emerald-500" />
            <span className="hidden sm:inline">Complete</span>
          </Button>

          {/* Snooze Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isActionLoading}
                className="min-h-[44px] px-3 rounded-xl text-xs font-bold active:scale-[0.97] transition-all duration-150"
              >
                <Clock className="h-4 w-4 sm:mr-1 text-muted-foreground" />
                <span className="hidden sm:inline">Snooze</span>
                <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl min-w-[160px]">
              <DropdownMenuLabel className="text-xs font-bold">Reschedule</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onSnooze(item, 1)}
                className="text-xs cursor-pointer min-h-[36px]"
              >
                Snooze 1 Hour
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSnooze(item, 4)}
                className="text-xs cursor-pointer min-h-[36px]"
              >
                Snooze 4 Hours
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSnooze(item, 24)}
                className="text-xs cursor-pointer min-h-[36px]"
              >
                Tomorrow Morning
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dismiss Button */}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onDismiss(item)}
            disabled={isActionLoading}
            className="min-h-[44px] px-2.5 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-all duration-150"
            title="Dismiss this recommendation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
