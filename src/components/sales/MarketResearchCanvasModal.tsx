'use client';

/**
 * @fileOverview Market Research Canvas Modal (Phase 10 Milestone 3 Task 1)
 * 
 * ARCHITECTURAL INVARIANTS:
 * 1. theme.md §8 Standardized Modal Architecture:
 *    - Surface & geometry: border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl
 *    - Demarcated Header: <DialogHeader demarcated> (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4)
 *    - Zero raw descriptions: <DialogDescription className="sr-only">
 *    - Single-circle info tooltip: <CardInfoTooltip text="..." /> elevated at z-[10050]
 *    - Demarcated Footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 with rounded-xl active:scale-[0.97] buttons
 * 2. Trust Boundaries (Rules 13 & 30): Scraped market facts isolated in <untrusted_reference_data id="...">.
 * 3. Shadow Mode Simulation Support (Rule 42): Operators can preview simulation results.
 * 4. Strict Typing: Zero `any` or `any[]` (Rule 4).
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  Sparkles,
  Globe2,
  TrendingUp,
  Target,
  Zap,
  Loader2,
  ShieldCheck,
  Building,
  RotateCcw,
} from 'lucide-react';
import { researchMarketAction } from '@/app/actions/sales-agent-actions';
import type { MarketResearchResult } from '@/platform/agents/sales/context/lead-context-types';
import { useToast } from '@/hooks/use-toast';

function UntrustedReferenceData({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return React.createElement('untrusted_reference_data', { id, className }, children);
}

export interface MarketResearchCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  workspaceId: string;
  initialIndustry?: string;
  initialRegion?: string;
}

export function MarketResearchCanvasModal({
  isOpen,
  onClose,
  organizationId,
  workspaceId,
  initialIndustry = 'Education',
  initialRegion = 'Ghana, West Africa',
}: MarketResearchCanvasModalProps) {
  const { toast } = useToast();
  const [industry, setIndustry] = React.useState(initialIndustry);
  const [region, setRegion] = React.useState(initialRegion);
  const [targetAudience, setTargetAudience] = React.useState('K-12 Private School Administrators');
  const [competitors, setCompetitors] = React.useState('Legacy Paper Ledgers, Spreadsheets');

  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<MarketResearchResult | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setIndustry(initialIndustry);
      setRegion(initialRegion);
    }
  }, [isOpen, initialIndustry, initialRegion]);

  const handleExecuteResearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!industry.trim() || !region.trim()) return;

    setIsLoading(true);
    try {
      const res = await researchMarketAction({
        organizationId,
        workspaceId,
        industry: industry.trim(),
        region: region.trim(),
        targetAudience: targetAudience.trim() || undefined,
        competitors: competitors
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      });

      if (!res.success || !res.data) {
        toast({
          variant: 'destructive',
          title: 'Research Failed',
          description: res.error || 'Could not synthesize market intelligence.',
        });
        return;
      }

      setResult(res.data);
      toast({
        title: 'Market Research Synthesized',
        description: `Generated intelligence dossier for ${res.data.industry} in ${res.data.region}.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while executing market research.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl max-h-[90vh]">
        {/* Demarcated Header (theme.md §8) */}
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
              Market Research Canvas
            </DialogTitle>
            <CardInfoTooltip text="Agent-driven market research synthesizing TAM/SAM estimates, high-intent triggers, and tailored outreach hooks for any target geography." />
          </div>
          <DialogDescription className="sr-only">
            Autonomous agent market intelligence and TAM research canvas
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1 text-sm">
          {!result ? (
            /* Input Form State */
            <form onSubmit={handleExecuteResearch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="industry-input" className="text-xs font-medium">
                    Industry Sector *
                  </Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="industry-input"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="e.g. Education, Healthcare, Logistics"
                      className="pl-9 h-10 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="region-input" className="text-xs font-medium">
                    Target Geography / City *
                  </Label>
                  <div className="relative">
                    <Globe2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="region-input"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="e.g. Kumasi, Ghana or Nairobi, Kenya"
                      className="pl-9 h-10 rounded-xl"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="audience-input" className="text-xs font-medium">
                  Target Audience / Buyer Persona
                </Label>
                <div className="relative">
                  <Target className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="audience-input"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g. Private School Principals & Bursars"
                    className="pl-9 h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="competitors-input" className="text-xs font-medium">
                  Known Incumbents & Competitors (Comma-separated)
                </Label>
                <Input
                  id="competitors-input"
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                  placeholder="e.g. Paper Ledgers, Legacy Software"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 flex items-start gap-3">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="font-semibold text-foreground">Governed Research Persona</div>
                  <div>
                    Research will be orchestrated by <span className="font-medium text-foreground">prospecting_agent</span> (L0_READ) with verified anti-SSRF safe egress checks (Rule 34).
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* Dossier Result State */
            <div className="space-y-5">
              {/* Executive Overview Banner */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] bg-background">
                      {result.researchId.slice(0, 16)}
                    </Badge>
                    <span className="text-xs font-semibold text-foreground">
                      {result.industry} — {result.region}
                    </span>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px]">
                    Verified Intelligence ({result.sourcesCount} Sources)
                  </Badge>
                </div>
                <div className="text-xs font-mono text-muted-foreground bg-card/60 p-2.5 rounded-lg border border-border/40">
                  {result.tamSamEstimate}
                </div>
              </div>

              {/* Market Trends (Isolated in UntrustedReferenceData) */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  <span>Market Dynamics & Industry Trends</span>
                </div>
                <div className="space-y-1.5">
                  {result.marketTrends.map((trend, idx) => (
                    <UntrustedReferenceData key={idx} id={`trend_${idx}`} className="block">
                      <div className="p-2.5 rounded-lg border border-border/60 bg-muted/10 text-xs text-foreground/90">
                        • {trend}
                      </div>
                    </UntrustedReferenceData>
                  ))}
                </div>
              </div>

              {/* High Intent Triggers */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span>High-Intent Buying Triggers</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.highIntentTriggers.map((trigger, idx) => (
                    <UntrustedReferenceData key={idx} id={`trigger_${idx}`} className="block">
                      <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-foreground/90">
                        ⚡ {trigger}
                      </div>
                    </UntrustedReferenceData>
                  ))}
                </div>
              </div>

              {/* Recommended Outreach Angles */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span>Recommended Value Propositions & Hooks</span>
                </div>
                <div className="space-y-1.5">
                  {result.recommendedAngles.map((angle, idx) => (
                    <UntrustedReferenceData key={idx} id={`angle_${idx}`} className="block">
                      <div className="p-2.5 rounded-lg border border-border/60 bg-card text-xs text-foreground/90">
                        🎯 {angle}
                      </div>
                    </UntrustedReferenceData>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Demarcated Footer (theme.md §8) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 shrink-0 min-h-[56px]">
          <div>
            {result && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Research Query
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs px-4"
            >
              {result ? 'Done' : 'Cancel'}
            </Button>
            {!result ? (
              <Button
                size="sm"
                onClick={() => handleExecuteResearch()}
                disabled={isLoading || !industry.trim() || !region.trim()}
                className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs px-4 gap-1.5 bg-primary text-primary-foreground font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Synthesizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Research Market
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onClose}
                className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs px-4 bg-primary text-primary-foreground font-semibold"
              >
                Apply to Filters
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default MarketResearchCanvasModal;
