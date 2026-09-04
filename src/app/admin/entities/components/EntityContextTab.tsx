'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 5: Entity AI Context & Dossier Tab Component
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Dedicated AI Intelligence Surface:
 *    - First-class tab on `/admin/entities/[id]` displaying live executive dossier,
 *      token budget metrics, active conflict alerts, and grounded citations.
 * 2. Mobile Ergonomics & Accessibility (Rule 7):
 *    - Touch targets >= 44px min-height (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Interactive buttons feature tactile compression (`active:scale-[0.97]`).
 * 4. Zero-`any` Standard:
 *    - Strictly typed with `SubjectDossier`, `ContextPackage`, and `ActionResult`.
 *
 * @testability Mounted inside `/admin/entities/[id]/page.tsx`.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Brain,
  Sparkles,
  ShieldAlert,
  TrendingUp,
  CheckCircle2,
  Layers,
  Quote,
  ChevronRight,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  getEntityDossierAction,
  buildContextAction,
  synthesizeContextDossierWithAIAction,
} from '@/lib/memory/actions/context-builder-actions';
import type { SubjectDossier, ContextPackage } from '@/lib/memory/context-types';
import type { ContextDossierOutput } from '@/ai/flows/generate-context-dossier-flow';
import { ContextPanel } from '@/components/memory/context/ContextPanel';
import { ContextCitationDrawer } from '@/components/memory/context/ContextCitationDrawer';

export interface EntityContextTabProps {
  entityId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
  entityName: string;
}

export default function EntityContextTab({
  entityId,
  workspaceId,
  organizationId,
  userId,
  entityName,
}: EntityContextTabProps) {
  const { toast } = useToast();
  const [dossier, setDossier] = React.useState<SubjectDossier | null>(null);
  const [contextPackage, setContextPackage] = React.useState<ContextPackage | null>(null);
  const [aiBrief, setAiBrief] = React.useState<ContextDossierOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSynthesizing, setIsSynthesizing] = React.useState(false);
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  const [isCitationsOpen, setIsCitationsOpen] = React.useState(false);

  const loadDossier = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [dossierRes, pkgRes] = await Promise.all([
        getEntityDossierAction({ entityId, workspaceId, organizationId, userId }),
        buildContextAction({
          workspaceId,
          organizationId,
          userId,
          subject: { type: 'entity', id: entityId },
          objective: `Assemble AI context for ${entityName}`,
          maxTokens: 4000,
        }),
      ]);

      if (dossierRes.success && dossierRes.data) {
        setDossier(dossierRes.data);
      } else if (dossierRes.error) {
        toast({
          variant: 'destructive',
          title: 'Could Not Load Dossier',
          description: dossierRes.error,
        });
      }

      if (pkgRes.success && pkgRes.data) {
        setContextPackage(pkgRes.data);
      }
    } catch (err) {
      console.error('[EntityContextTab] Error loading dossier:', err);
      toast({
        variant: 'destructive',
        title: 'Context Assembly Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [entityId, workspaceId, organizationId, userId, entityName, toast]);

  React.useEffect(() => {
    loadDossier();
  }, [loadDossier]);

  const handleSynthesizeBrief = async () => {
    setIsSynthesizing(true);
    try {
      const res = await synthesizeContextDossierWithAIAction({
        subjectId: entityId,
        subjectType: 'entity',
        workspaceId,
        organizationId,
        userId,
      });

      if (res.success && res.data) {
        setAiBrief(res.data);
        toast({
          title: 'AI Brief Generated',
          description: 'Grounded executive briefing synthesized with Gemini 2.5 Flash.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Synthesis Failed',
          description: res.error || 'Could not generate briefing.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Synthesis Error',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSynthesizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Brain className="w-10 h-10 animate-pulse text-primary mb-3" />
        <p className="text-sm font-semibold text-foreground">Assembling Entity AI Context...</p>
        <p className="text-xs text-muted-foreground mt-1">
          Synthesizing CRM records, Qdrant vectors, and Graph relationships
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-card shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                CompanyBrain Executive Intelligence
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider">
                Phase 5 Context
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live context synthesis across institutional memory, active deals, and relationship topology.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCitationsOpen(true)}
            className="h-10 min-h-[44px] px-3 gap-1.5 text-xs active:scale-[0.97] transition-all"
            disabled={!dossier || dossier.citations.length === 0}
          >
            <Quote className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Citations ({dossier?.citations.length ?? 0})</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPanelOpen(true)}
            className="h-10 min-h-[44px] px-3 gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/5 active:scale-[0.97] transition-all"
          >
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>Open Context Panel</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSynthesizeBrief}
            disabled={isSynthesizing}
            className="h-10 min-h-[44px] px-4 gap-2 text-xs font-semibold bg-primary text-primary-foreground active:scale-[0.97] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSynthesizing ? 'Synthesizing...' : 'Synthesize AI Brief'}</span>
          </Button>
        </div>
      </div>

      {/* Active Contradiction Warning Banner */}
      {dossier && dossier.activeConflictWarnings.length > 0 && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-semibold text-xs">
              <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
              <span>Active Factual Contradictions Flagged ({dossier.activeConflictWarnings.length})</span>
            </div>
            <Link href="/admin/quick-notes/conflicts">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 min-h-[44px] text-xs text-rose-700 dark:text-rose-400 hover:text-rose-900 px-2 active:scale-[0.97]"
              >
                Resolve in Conflict Center
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
          <p className="text-xs text-rose-700/90 dark:text-rose-300/80">
            {dossier.activeConflictWarnings[0].summary}
          </p>
        </div>
      )}

      {/* Executive AI Briefing (If synthesized) */}
      {aiBrief && (
        <Card className="border-primary/30 bg-primary/[0.02] shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">
                  Executive Briefing (Gemini 2.5 Flash)
                </CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {Math.round(aiBrief.confidenceScore * 100)}% Confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs leading-relaxed text-foreground">
            <p className="text-sm font-medium text-foreground/90">{aiBrief.executiveSummary}</p>
            <div className="rounded-lg bg-muted/40 p-3 text-xs border border-border/40">
              <span className="font-semibold block mb-1">Commercial Outlook</span>
              {aiBrief.commercialOutlook}
            </div>

            {aiBrief.strategicRecommendations.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-semibold block text-xs">Strategic Recommendations</span>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {aiBrief.strategicRecommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2-Column Dossier Dashboard */}
      {dossier && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Commercial & Concerns */}
          <div className="space-y-6">
            {/* Commercial Outlook Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <CardTitle className="text-sm font-semibold">Commercial Outlook</CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-mono uppercase',
                      dossier.commercialOutlook.revenueMomentum === 'strong'
                        ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'border-blue-500 text-blue-700 dark:text-blue-300'
                    )}
                  >
                    {dossier.commercialOutlook.revenueMomentum} Momentum
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 p-2.5 border border-border/50">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                      Pipeline Value
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      GHS {(dossier.commercialOutlook.dealValue ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2.5 border border-border/50">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                      Pipeline Stage
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {dossier.commercialOutlook.stage || 'Active'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Concerns & Risks */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-sm font-semibold">Current Concerns & Risks</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {dossier.currentConcerns.map((concern, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-2.5 text-xs text-amber-900 dark:text-amber-200"
                  >
                    • {concern}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Stakeholders & Open Commitments */}
          <div className="space-y-6">
            {/* Key Stakeholders Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">Key Stakeholders</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {dossier.keyStakeholders.map((stakeholder, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px]">
                        {stakeholder.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-foreground block truncate">
                          {stakeholder.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {stakeholder.role}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                      {stakeholder.relationshipStatus}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Open Commitments & Action Items */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <CardTitle className="text-sm font-semibold">Open Commitments & Tasks</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {dossier.openCommitments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    All scheduled commitments are complete.
                  </p>
                ) : (
                  dossier.openCommitments.map((act, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs"
                    >
                      <span className="font-medium text-foreground truncate pr-2">{act.title}</span>
                      <Badge
                        variant={
                          act.priority === 'urgent'
                            ? 'destructive'
                            : act.priority === 'high'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="text-[10px] uppercase font-mono px-1.5 py-0 shrink-0"
                      >
                        {act.priority}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Slide-over Context Panel */}
      <ContextPanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        contextPackage={contextPackage}
        onGenerateAiBrief={handleSynthesizeBrief}
        isGeneratingBrief={isSynthesizing}
      />

      {/* Citations Drawer */}
      <ContextCitationDrawer
        open={isCitationsOpen}
        onOpenChange={setIsCitationsOpen}
        citations={dossier?.citations || []}
      />
    </div>
  );
}
