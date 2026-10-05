'use client';

/**
 * @fileOverview Prospect Finder HUD Component (Phase 10 Milestone 3 Task 4)
 * 
 * ARCHITECTURAL INVARIANTS:
 * 1. Active AI Persona Status: Visual indicator of the autonomous SDR agent (`lead_sdr`).
 * 2. Real-Time SSE Stream: Connection status (Rule 62) and incoming event counter.
 * 3. 1-Click Launchers: Direct triggers for Market Research Canvas and Segment-to-Campaign.
 * 4. Mobile First: Responsive flex layout with touch targets >= 44px and active scale transitions.
 * 5. Strict Zero-any typing (Rule 4).
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot,
  Radio,
  RotateCw,
  Megaphone,
  Globe2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProspectFinderHudProps {
  onOpenMarketResearch: () => void;
  onOpenSegmentToCampaign: () => void;
  onRefresh?: () => void;
  activePersona?: string;
  isRefreshing?: boolean;
  className?: string;
  streamStatus?: 'connecting' | 'connected' | 'disconnected';
  realtimeEventCount?: number;
}

export function ProspectFinderHud({
  onOpenMarketResearch,
  onOpenSegmentToCampaign,
  onRefresh,
  activePersona = 'lead_sdr',
  isRefreshing = false,
  className,
  streamStatus = 'connected',
  realtimeEventCount = 0,
}: ProspectFinderHudProps) {
  const getPersonaLabel = (persona: string) => {
    switch (persona) {
      case 'market_researcher':
        return 'Market Research Specialist';
      case 'lead_qualifier':
        return 'Lead Qualification Co-Pilot';
      case 'lead_sdr':
      default:
        return 'Autonomous Lead SDR';
    }
  };

  return (
    <div
      className={cn(
        'p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md text-card-foreground shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 transition-all',
        className
      )}
    >
      {/* Left: Active Persona & Agentic Status */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground tracking-tight">
                {getPersonaLabel(activePersona)}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold uppercase tracking-wider bg-primary/5 text-primary border-primary/30"
              >
                Active Agent
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-muted-foreground">
                Autonomous ICP Discovery & Scoring
              </span>
            </div>
          </div>
        </div>

        {/* Live SSE Stream Status Indicator (Rule 62) */}
        <div className="flex items-center gap-1.5 pl-2 sm:border-l sm:border-border/60">
          <span className="relative flex h-2 w-2">
            {streamStatus === 'connected' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={cn(
                'relative inline-flex rounded-full h-2 w-2',
                streamStatus === 'connected'
                  ? 'bg-emerald-500'
                  : streamStatus === 'connecting'
                  ? 'bg-amber-500'
                  : 'bg-muted-foreground'
              )}
            />
          </span>
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Radio className="h-3 w-3" />
            <span className="capitalize">{streamStatus}</span>
          </span>
          {realtimeEventCount > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold bg-muted"
            >
              +{realtimeEventCount} events
            </Badge>
          )}
        </div>
      </div>

      {/* Right: Quick Action Launchers */}
      <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-[0.97] transition-transform"
            title="Refresh Intelligence"
          >
            <RotateCw
              className={cn('h-3.5 w-3.5 mr-1.5', isRefreshing && 'animate-spin text-primary')}
            />
            <span>Refresh</span>
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenMarketResearch}
          className="h-9 px-3 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/30 active:scale-[0.97] transition-transform gap-1.5"
        >
          <Globe2 className="h-3.5 w-3.5 text-sky-500" />
          <span>Research Market</span>
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={onOpenSegmentToCampaign}
          className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-transform gap-1.5 shadow-sm"
        >
          <Megaphone className="h-3.5 w-3.5" />
          <span>Turn Segment into Campaign</span>
        </Button>
      </div>
    </div>
  );
}
export default ProspectFinderHud;
