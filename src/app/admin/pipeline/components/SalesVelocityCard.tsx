'use client';

/**
 * @fileoverview Sales Velocity & Revenue Pipeline Speedometer
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 51 & UI Section 35):
 * - Displays the standard CRM Sales Velocity formula:
 *     Velocity ($/day) = (Active Deals * Win Rate % * Avg Deal Size) / Avg Sales Cycle Days
 * - Breaks down the 4 core velocity multipliers:
 *     1. Active Deal Volume
 *     2. Win Rate %
 *     3. Average Deal Size ($)
 *     4. Average Sales Cycle Length (Days)
 * - Shows speed to proposal and speed to close milestones.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5):
 * - Strict zero 'any' / zero 'any[]'.
 * - Accessible >= 44px mobile touch targets.
 * - Dynamic multi-currency formatting.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency-utils';
import type { SalesVelocityMetrics } from '@/lib/types';
import { 
  Zap, 
  Clock, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  HelpCircle,
  FileCheck2
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SalesVelocityCardProps {
  velocity: SalesVelocityMetrics;
  currency?: string;
}

export default function SalesVelocityCard({
  velocity,
  currency = 'GHS',
}: SalesVelocityCardProps) {
  return (
    <Card className="rounded-3xl border-border/80 bg-card shadow-sm overflow-hidden">
      <CardHeader className="p-5 md:p-6 border-b border-border/40 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Zap className="h-3 w-3 fill-amber-500 text-amber-500" />
                Pipeline Speed
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-black tracking-tight text-foreground">
                Sales Velocity Engine
              </CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs p-2.5 rounded-xl z-[200]">
                    Sales Velocity measures how much revenue passes through your sales process each day based on opportunity volume, conversion win rate, deal size, and sales cycle length.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Revenue generation speed per calendar day across active pipeline operations.
            </CardDescription>
          </div>

          <div className="flex flex-col items-start sm:items-end bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 shrink-0">
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Daily Revenue Velocity
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {formatCurrency(velocity.salesVelocityPerDay, currency)}
              <span className="text-xs font-bold text-muted-foreground ml-1">/ day</span>
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 md:p-6 space-y-4">
        {/* 4 Multipliers Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Active Opportunities */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
              <span>Active Deals</span>
              <DollarSign className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-lg font-black text-foreground">
              {formatCurrency(velocity.activePipelineValue, currency)}
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold">
              Open Pipeline Value
            </div>
          </div>

          {/* Win Rate */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
              <span>Win Rate</span>
              <Percent className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {velocity.winRatePercentage}%
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold">
              {velocity.totalWonDeals} closed won deals
            </div>
          </div>

          {/* Average Deal Size */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
              <span>Avg Deal Size</span>
              <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div className="text-lg font-black text-foreground">
              {formatCurrency(velocity.avgDealSize, currency)}
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold">
              Won Opportunity Average
            </div>
          </div>

          {/* Average Sales Cycle */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
              <span>Sales Cycle</span>
              <Clock className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <div className="text-lg font-black text-purple-600 dark:text-purple-400">
              {velocity.avgSalesCycleDays} <span className="text-xs font-bold">days</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold">
              Creation to Won
            </div>
          </div>
        </div>

        {/* Milestones Duration Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-muted/20 border border-border/40 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileCheck2 className="h-4 w-4 text-primary" />
            <span>Avg Time to Proposal: <strong className="text-foreground">{velocity.timeToProposalDays} days</strong></span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span>Avg Time to Close: <strong className="text-foreground">{velocity.timeToCloseDays} days</strong></span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
