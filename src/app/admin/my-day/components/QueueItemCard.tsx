'use client';

/**
 * @fileoverview Ranked Queue Item Card for SmartSapp Seller Workspace (Phase 2).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 30 & UI Section 16:
 * - Represents secondary ranked items in the seller's work queue.
 * - Displays priority rank (#2, #3, etc.), item type, entity context, deal size, SLA ticker,
 *   and quick 1-click execution triggers.
 * - Clicking the card or action button launches the ActionExecutionDrawer.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Minimum 44px touch targets on mobile interactive controls.
 * - Zero 'any' policy strictly enforced.
 * - Conform to Emil Kowalski micro-interactions: active:scale-[0.97] and clean transitions.
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
  Phone,
  MessageSquare,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  MoreVertical,
  X,
} from 'lucide-react';
import type { WorkQueueItem } from '@/lib/seller-workspace/types';
import { SlaCountdownBadge } from './SlaCountdownBadge';

interface QueueItemCardProps {
  item: WorkQueueItem;
  rankIndex: number; // 1-based index (e.g., #2, #3)
  onOpenActionDrawer: (item: WorkQueueItem) => void;
  onQuickComplete: (item: WorkQueueItem) => void;
  onSnooze: (item: WorkQueueItem, hours: number) => void;
  onDismiss: (item: WorkQueueItem) => void;
  isActionLoading?: boolean;
}

export function QueueItemCard({
  item,
  rankIndex,
  onOpenActionDrawer,
  onQuickComplete,
  onSnooze,
  onDismiss,
  isActionLoading = false,
}: QueueItemCardProps) {
  const getTypeIcon = () => {
    switch (item.type) {
      case 'call':
        return <Phone className="h-3.5 w-3.5 text-blue-500" />;
      case 'meeting_prep':
        return <Calendar className="h-3.5 w-3.5 text-purple-500" />;
      case 'buyer_signal':
        return <Sparkles className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />;
    }
  };

  const getImpactBadge = () => {
    switch (item.impact) {
      case 'critical':
        return (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
            Critical
          </Badge>
        );
      case 'high':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px] px-1.5 py-0 h-4 text-white">
            High
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-200">
      <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Rank, Icon, & Context Details */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Rank Badge */}
          <div className="flex flex-col items-center justify-center min-w-[32px] pt-0.5">
            <span className="text-[11px] font-black text-muted-foreground font-mono">
              #{rankIndex}
            </span>
            <div className="h-7 w-7 rounded-lg bg-muted/50 border flex items-center justify-center mt-1">
              {getTypeIcon()}
            </div>
          </div>

          {/* Item Content */}
          <div className="space-y-1 min-w-0 flex-1">
            {/* Meta Tags Row */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-bold text-foreground truncate max-w-[160px] sm:max-w-[220px]">
                {item.entityName || item.dealName || 'Target Record'}
              </span>

              {item.dealValue && (
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.2 rounded">
                  {item.dealValue.toLocaleString()} GHS
                </span>
              )}

              {getImpactBadge()}

              {item.slaDueAt && (
                <SlaCountdownBadge dueDate={item.slaDueAt} status={item.slaStatus} />
              )}
            </div>

            {/* Title */}
            <h4
              onClick={() => onOpenActionDrawer(item)}
              className="text-xs sm:text-sm font-bold text-foreground hover:text-primary transition-colors cursor-pointer leading-snug line-clamp-1"
            >
              {item.title}
            </h4>

            {/* Reason snippet */}
            <p className="text-[11px] text-muted-foreground line-clamp-1 leading-normal">
              {item.reason}
            </p>
          </div>
        </div>

        {/* Right: Quick Action Buttons & Menu */}
        <div className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-muted/50">
          {/* Action Trigger */}
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenActionDrawer(item)}
            disabled={isActionLoading}
            className="rounded-lg text-xs font-bold min-h-[38px] px-3 active:scale-[0.97] transition-all"
          >
            {item.type === 'call' ? (
              <>
                <Phone className="h-3.5 w-3.5 mr-1" /> Call
              </>
            ) : item.type === 'meeting_prep' ? (
              <>
                <Calendar className="h-3.5 w-3.5 mr-1" /> Prep
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Action
              </>
            )}
          </Button>

          {/* 1-Click Quick Complete */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onQuickComplete(item)}
            disabled={isActionLoading}
            className="rounded-lg min-h-[38px] px-2.5 hover:bg-emerald-500/10 hover:text-emerald-600 active:scale-[0.97] transition-all"
            title="Mark as completed"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </Button>

          {/* More Actions Dropdown (Snooze / Dismiss) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isActionLoading}
                className="rounded-lg min-h-[38px] px-2 text-muted-foreground active:scale-[0.97]"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl min-w-[150px]">
              <DropdownMenuLabel className="text-xs font-bold">Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onSnooze(item, 1)}
                className="text-xs cursor-pointer min-h-[36px]"
              >
                <Clock className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                Snooze 1 Hour
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSnooze(item, 4)}
                className="text-xs cursor-pointer min-h-[36px]"
              >
                <Clock className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                Snooze 4 Hours
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSnooze(item, 24)}
                className="text-xs cursor-pointer min-h-[36px]"
              >
                <Clock className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                Tomorrow Morning
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDismiss(item)}
                className="text-xs text-destructive hover:text-destructive cursor-pointer min-h-[36px]"
              >
                <X className="h-3.5 w-3.5 mr-2" />
                Dismiss
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
