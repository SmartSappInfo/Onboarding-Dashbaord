'use client';

/**
 * 4-Dimension Enrichment Progress Panel (Lead Intelligence 2.0 - Phase 4)
 * UI Spec Section 22: "The UX should make enrichment understandable"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Visual Transparency: Displays 4 distinct meters (Company, Tech, Contacts, Verification).
 * 2. Emil Kowalski Motion: Uses active physics (active:scale-[0.97]) and smooth progress fills.
 * 3. 1-Click Action: Allows user to enrich missing dimensions on demand.
 * 4. Strict Zero-`any` typing.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Cpu, 
  Users, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  Loader2
} from 'lucide-react';
import type { EnrichmentDimensionScore } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface EnrichmentProgressPanelProps {
  dimensions: EnrichmentDimensionScore;
  onEnrichMissing?: () => void;
  isEnriching?: boolean;
  className?: string;
}

export const EnrichmentProgressPanel: React.FC<EnrichmentProgressPanelProps> = ({
  dimensions,
  onEnrichMissing,
  isEnriching = false,
  className
}) => {
  const getStatusColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  const isComplete = dimensions.overallEnrichmentPercent >= 85;

  return (
    <Card className={cn("border border-border/70 bg-card/80 backdrop-blur-xs rounded-2xl shadow-xs overflow-hidden", className)}>
      <CardHeader className="p-4 bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
            Enrichment Profile
          </CardTitle>
        </div>
        <Badge className={cn("font-bold text-xs px-2.5 py-0.5 rounded-full border", getStatusColor(dimensions.overallEnrichmentPercent))}>
          {dimensions.overallEnrichmentPercent}% Complete
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Dimension 1: Company */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Company Firmographics
            </span>
            <span className="font-mono font-bold text-muted-foreground flex items-center gap-1">
              {dimensions.companyScore >= 80 && <CheckCircle2 className="h-3 w-3 text-emerald-500 inline" />}
              {dimensions.companyScore}%
            </span>
          </div>
          <Progress value={dimensions.companyScore} className="h-2 rounded-full bg-muted" />
        </div>

        {/* Dimension 2: Technology */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-muted-foreground" /> Technology Stack
            </span>
            <span className="font-mono font-bold text-muted-foreground flex items-center gap-1">
              {dimensions.techScore >= 80 && <CheckCircle2 className="h-3 w-3 text-emerald-500 inline" />}
              {dimensions.techScore}%
            </span>
          </div>
          <Progress value={dimensions.techScore} className="h-2 rounded-full bg-muted" />
        </div>

        {/* Dimension 3: Contacts */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" /> Decision Makers
            </span>
            <span className="font-mono font-bold text-muted-foreground flex items-center gap-1">
              {dimensions.contactsScore >= 80 && <CheckCircle2 className="h-3 w-3 text-emerald-500 inline" />}
              {dimensions.contactsScore}%
            </span>
          </div>
          <Progress value={dimensions.contactsScore} className="h-2 rounded-full bg-muted" />
        </div>

        {/* Dimension 4: Verification */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" /> Verification & Deliverability
            </span>
            <span className="font-mono font-bold text-muted-foreground flex items-center gap-1">
              {dimensions.verificationScore >= 80 && <CheckCircle2 className="h-3 w-3 text-emerald-500 inline" />}
              {dimensions.verificationScore}%
            </span>
          </div>
          <Progress value={dimensions.verificationScore} className="h-2 rounded-full bg-muted" />
        </div>

        {/* Action Button */}
        {onEnrichMissing && !isComplete && (
          <Button
            type="button"
            onClick={onEnrichMissing}
            disabled={isEnriching}
            className="w-full mt-2 font-bold text-xs rounded-xl min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs flex items-center justify-center gap-2 active:scale-[0.97] transition-transform cursor-pointer"
          >
            {isEnriching ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Enriching Incomplete Data...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Enrich Missing Data</span>
              </>
            )}
          </Button>
        )}

        {isComplete && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Profile is fully enriched across all core dimensions.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
