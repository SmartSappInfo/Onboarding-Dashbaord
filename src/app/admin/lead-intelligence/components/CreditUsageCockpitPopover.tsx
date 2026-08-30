'use client';

/**
 * Credit Usage Cockpit Popover (Lead Intelligence 2.0 - Phase 14)
 * UI Spec Section 59 & 60: "Credit UX & Quota Warnings"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Always visible credit meter with non-intrusive hover/click breakdown.
 * 2. Visualizes consumption across Discovery, Enrichment, AI, and Verification.
 * 3. Mobile-responsive with touch targets >= 44px.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Coins, 
  Search, 
  Cpu, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  Calendar,
  Zap
} from 'lucide-react';
import type { CreditLedgerSummary } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface CreditUsageCockpitPopoverProps {
  ledger: CreditLedgerSummary;
  className?: string;
}

export const CreditUsageCockpitPopover: React.FC<CreditUsageCockpitPopoverProps> = ({
  ledger,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const percentUsed = Math.min(100, Math.round((ledger.used / Math.max(1, ledger.totalAllocated)) * 100));

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-9 px-3 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold active:scale-[0.97]",
            ledger.warningTriggered
              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              : "bg-card border-border/80 text-foreground hover:bg-muted/40",
            className
          )}
        >
          <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-mono">{ledger.remaining.toLocaleString()}</span>
          <span className="text-[11px] text-muted-foreground font-normal hidden sm:inline">credits</span>
          {ledger.warningTriggered && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4 rounded-2xl bg-card border border-border/80 shadow-2xl space-y-3.5" align="end">
        {/* Top Header */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-foreground flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-500" /> Credit Consumption
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {percentUsed}% Used
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Monthly allocation for search, enrichment, AI dossiers & SMTP verification.
          </p>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-muted-foreground">{ledger.used.toLocaleString()} used</span>
            <span className="text-foreground font-bold">{ledger.remaining.toLocaleString()} remaining</span>
          </div>
          <Progress 
            value={percentUsed} 
            className={cn(
              "h-2 bg-muted",
              percentUsed >= 90 ? "[&>div]:bg-rose-500" :
              percentUsed >= 75 ? "[&>div]:bg-amber-500" :
              "[&>div]:bg-primary"
            )}
          />
        </div>

        {/* 4 Category Breakdown (UI Spec Section 59) */}
        <div className="space-y-2 pt-1 border-t border-border/50 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <Search className="w-3 h-3 text-sky-500" /> Discovery Search
            </span>
            <span className="font-mono text-foreground font-bold">{ledger.discoveryUsed.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <Cpu className="w-3 h-3 text-purple-500" /> Waterfall Enrichment
            </span>
            <span className="font-mono text-foreground font-bold">{ledger.enrichmentUsed.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <Sparkles className="w-3 h-3 text-amber-500" /> AI Strategy Dossiers
            </span>
            <span className="font-mono text-foreground font-bold">{ledger.aiUsed.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3 h-3 text-emerald-500" /> SMTP Email Verification
            </span>
            <span className="font-mono text-foreground font-bold">{ledger.verificationUsed.toLocaleString()}</span>
          </div>
        </div>

        {/* Quota Reset Notice */}
        <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Resets on
          </span>
          <span className="font-mono">{new Date(ledger.resetDate).toLocaleDateString()}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
};
