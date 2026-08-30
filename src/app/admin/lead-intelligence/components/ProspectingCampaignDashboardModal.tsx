'use client';

/**
 * Prospecting Campaign Telemetry Dashboard Modal (Lead Intelligence 2.0 - Phase 10)
 * UI Spec Section 43: "Prospecting Campaign Dashboard"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Visual campaign funnel progression tracking.
 * 2. Key conversion metrics cards.
 * 3. Mobile touch target compliance (min-h-[44px]).
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, 
  Users, 
  Globe, 
  ShieldCheck, 
  Briefcase, 
  Send, 
  TrendingUp, 
  Download,
  CheckCircle2
} from 'lucide-react';
import type { ProspectingCampaign } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface ProspectingCampaignDashboardModalProps {
  campaign: ProspectingCampaign | null;
  isOpen: boolean;
  onClose: () => void;
  onExportCampaign?: (campaign: ProspectingCampaign) => void;
}

export const ProspectingCampaignDashboardModal: React.FC<ProspectingCampaignDashboardModalProps> = ({
  campaign,
  isOpen,
  onClose,
  onExportCampaign
}) => {
  if (!campaign) return null;

  const stats = campaign.stats || {
    totalProspects: 0,
    enrichedCount: 0,
    verifiedCount: 0,
    qualifiedCount: 0,
    dealsCreated: 0,
    outreachSent: 0
  };

  const conversionRate = stats.totalProspects > 0 
    ? Math.round((stats.dealsCreated / stats.totalProspects) * 100)
    : 0;

  const funnelStages = [
    { label: 'Sourced', count: stats.totalProspects, icon: Users, color: 'text-sky-500' },
    { label: 'Enriched', count: stats.enrichedCount, icon: Globe, color: 'text-purple-500' },
    { label: 'Verified', count: stats.verifiedCount, icon: ShieldCheck, color: 'text-emerald-500' },
    { label: 'Qualified', count: stats.qualifiedCount, icon: TrendingUp, color: 'text-amber-500' },
    { label: 'Deals', count: stats.dealsCreated, icon: Briefcase, color: 'text-primary' },
    { label: 'Outreach', count: stats.outreachSent, icon: Send, color: 'text-rose-500' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl w-[96vw] p-0 bg-card border-border/80 shadow-2xl rounded-2xl overflow-hidden z-[10003] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                  Campaign Telemetry: {campaign.name}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                Target: {campaign.targetCriteria?.region || 'All Regions'} • {campaign.targetCriteria?.industry || 'All Industries'}
              </DialogDescription>
            </div>

            <Badge className={cn(
              "text-xs font-bold capitalize",
              campaign.status === 'running' && "bg-emerald-500/20 text-emerald-600 border-emerald-500/40",
              campaign.status === 'draft' && "bg-muted text-muted-foreground border-border",
              campaign.status === 'completed' && "bg-primary/20 text-primary border-primary/40"
            )}>
              {campaign.status}
            </Badge>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-border/70 bg-muted/10 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Qualified Pipeline
              </span>
              <p className="text-xl font-extrabold text-foreground">{stats.qualifiedCount}</p>
              <p className="text-[10px] text-muted-foreground">&ge; {campaign.qualificationThreshold} Score</p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/70 bg-muted/10 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                CRM Deals Generated
              </span>
              <p className="text-xl font-extrabold text-primary">{stats.dealsCreated}</p>
              <p className="text-[10px] text-muted-foreground">In active pipeline</p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/70 bg-muted/10 space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Funnel Conversion
              </span>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{conversionRate}%</p>
              <p className="text-[10px] text-muted-foreground">Lead to Deal yield</p>
            </div>
          </div>

          {/* Funnel Visual Pipeline (UI Spec Section 43) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Funnel Stage Telemetry
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {funnelStages.map((stage, idx) => {
                const Icon = stage.icon;
                return (
                  <div
                    key={stage.label}
                    className="p-3 rounded-xl border border-border/60 bg-card space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-muted-foreground">
                        {idx + 1}. {stage.label}
                      </span>
                      <Icon className={cn("h-3.5 w-3.5", stage.color)} />
                    </div>
                    <p className="text-base font-extrabold text-foreground">{stage.count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold rounded-xl"
          >
            Close
          </Button>

          {onExportCampaign && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onExportCampaign(campaign)}
              className="h-9 px-4 text-xs font-bold rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Qualified Leads (CSV)</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
