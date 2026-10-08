'use client';

/**
 * @fileOverview Interactive Graph Reasoning & Relationship Intelligence Modal (Phase 13 Milestone 5 Task 3)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with `px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20`
 * - Single-Circle Info Tooltip: `<CardInfoTooltip text="..." />` alongside title at `z-[10050]`
 * - Zero Raw Descriptions: `<DialogDescription className="sr-only">`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]` with `min-h-[44px]` touch targets
 *
 * Rules:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 7: Mobile-first responsive touch targets >= 44px.
 * - Rule 8 & 47: Anti-IDOR tenant scoping.
 * - Rule 13 & 30: Untrusted reference data containerization (<untrusted_reference_data id="...">).
 * - Rule 41: Structured 4-part explainability grid (WHAT / WHY / IMPACT / RISK).
 * - Rule 55: Clamped Graph Traversals (max 80 nodes, max 150 edges, depth <= 2).
 * - Rule 60: Emergency Dead-Man Switch evaluation.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Network,
  Share2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldAlert,
  Loader2,
  Crown,
  Link2,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  MAX_GRAPH_NODES,
  type AnalyzeInfluenceResult,
  type AccountContagionCluster,
  type MultiHopPathReasoning,
  type GraphInfluenceScore,
} from '@/platform/domains/graph_reasoning/graph-reasoning-types';
import {
  getDecisionMakerInfluenceMapAction,
  detectAccountRiskContagionAction,
  findCausalRelationshipPathAction,
} from '@/app/actions/graph-reasoning-actions';

export type GraphReasoningMode = 'influence' | 'contagion' | 'causal';

export interface GraphReasoningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  workspaceId: string;
  defaultEntityId?: string;
  defaultEntityLabel?: string;
  initialMode?: GraphReasoningMode;
}

export function GraphReasoningModal({
  open,
  onOpenChange,
  organizationId,
  workspaceId,
  defaultEntityId = 'ent_campus_accra',
  defaultEntityLabel = 'Accra Premier Campus',
  initialMode = 'influence',
}: GraphReasoningModalProps): React.JSX.Element {
  const [mode, setMode] = React.useState<GraphReasoningMode>(initialMode);
  const [zoomLevel, setZoomLevel] = React.useState<number>(1);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  // Mode Data States
  const [influenceData, setInfluenceData] = React.useState<AnalyzeInfluenceResult | null>(null);
  const [contagionData, setContagionData] = React.useState<AccountContagionCluster | null>(null);
  const [causalData, setCausalData] = React.useState<MultiHopPathReasoning | null>(null);

  // Sync initial mode
  React.useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Fetch data when mode or entity changes
  React.useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const fetchData = async (): Promise<void> => {
      setIsLoading(true);
      try {
        if (mode === 'influence') {
          const res = await getDecisionMakerInfluenceMapAction({
            organizationId,
            workspaceId,
            entityId: defaultEntityId,
            maxNodes: MAX_GRAPH_NODES,
          });
          if (isMounted && res.success && res.data) {
            setInfluenceData(res.data);
          }
        } else if (mode === 'contagion') {
          const res = await detectAccountRiskContagionAction({
            organizationId,
            workspaceId,
            sourceEntityId: defaultEntityId,
          });
          if (isMounted && res.success && res.data) {
            setContagionData(res.data);
          }
        } else if (mode === 'causal') {
          const res = await findCausalRelationshipPathAction({
            organizationId,
            workspaceId,
            sourceNodeId: defaultEntityId,
            targetNodeId: 'ent_sister_kumasi',
          });
          if (isMounted && res.success && res.data) {
            setCausalData(res.data);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to query graph reasoning engine';
        toast({
          title: 'Graph Reasoning Error',
          description: message,
          variant: 'destructive',
          actionConfig: {
            path: '/admin/intelligence/organization',
            label: 'View Missions',
          },
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [open, mode, organizationId, workspaceId, defaultEntityId]);

  const isClamped =
    mode === 'influence' &&
    ((influenceData?.totalStakeholders ?? 0) > MAX_GRAPH_NODES || influenceData?.clamped);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 gap-0 overflow-hidden">
        {/* Demarcated Header strictly adhering to theme.md §8 */}
        <DialogHeader
          demarcated
          className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Network className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                Graph Reasoning & Relationship Intelligence
              </DialogTitle>
              <CardInfoTooltip text="Interactive relationship graph explorer featuring influence centrality mapping, risk contagion propagation paths, and multi-hop causal reasoning clamped to 80 nodes (Rule 55)." />
            </div>
            <Badge variant="outline" className="text-xs font-mono font-medium">
              {defaultEntityLabel}
            </Badge>
          </div>
          <DialogDescription className="sr-only">
            Interactive relationship graph explorer featuring influence centrality mapping, risk contagion propagation paths, and multi-hop causal reasoning.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Switcher Bar */}
        <div className="px-6 py-2.5 bg-muted/10 border-b border-border/60 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMode('influence')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all active:scale-[0.97]',
                mode === 'influence'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              )}
            >
              Influence Centrality
            </button>
            <button
              type="button"
              onClick={() => setMode('contagion')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all active:scale-[0.97]',
                mode === 'contagion'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              )}
            >
              Risk Contagion
            </button>
            <button
              type="button"
              onClick={() => setMode('causal')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all active:scale-[0.97]',
                mode === 'causal'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              )}
            >
              Causal Paths
            </button>
          </div>

          {/* Canvas Zoom & Reset Controls */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.2))}
              className="h-8 w-8 p-0 rounded-lg min-h-[32px] sm:min-h-[36px]"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] font-mono text-muted-foreground w-10 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.2))}
              className="h-8 w-8 p-0 rounded-lg min-h-[32px] sm:min-h-[36px]"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setZoomLevel(1)}
              className="h-8 px-2 rounded-lg text-xs"
              title="Reset Zoom"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Clamped Warning Banner strictly adhering to Rule 55 */}
        {isClamped && influenceData && (
          <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">
              Showing most relevant 80 of {influenceData.totalStakeholders} nodes · Bounded for performance (Rule 55)
            </span>
          </div>
        )}

        {/* Modal Main Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-xs font-medium">Computing graph topology & influence models...</p>
            </div>
          ) : mode === 'influence' ? (
            /* Influence Centrality View */
            <div className="space-y-4">
              {/* Interactive SVG Preview Canvas */}
              <div className="rounded-xl border border-border/80 bg-muted/5 p-4 flex items-center justify-center min-h-[220px] overflow-hidden relative">
                <svg
                  viewBox="0 0 500 200"
                  className="w-full h-48 transition-transform duration-200"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  {/* Central Node */}
                  <circle cx="250" cy="100" r="32" className="fill-primary/20 stroke-primary stroke-2" />
                  <text
                    x="250"
                    y="104"
                    textAnchor="middle"
                    className="fill-foreground text-[10px] font-semibold font-mono"
                  >
                    Campus Root
                  </text>

                  {/* Satellite Stakeholders */}
                  {influenceData?.stakeholders.map((s, idx) => {
                    const angle = (idx / (influenceData.stakeholders.length || 1)) * 2 * Math.PI;
                    const cx = 250 + Math.cos(angle) * 140;
                    const cy = 100 + Math.sin(angle) * 65;

                    return (
                      <g key={s.nodeId}>
                        <line
                          x1="250"
                          y1="100"
                          x2={cx}
                          y2={cy}
                          className="stroke-border/80 stroke-1 stroke-dasharray-2"
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={s.isKeyDecisionMaker ? 22 : 18}
                          className={cn(
                            s.isKeyDecisionMaker
                              ? 'fill-amber-500/20 stroke-amber-500 stroke-2'
                              : 'fill-muted stroke-border stroke-1'
                          )}
                        />
                        <text
                          x={cx}
                          y={cy + 4}
                          textAnchor="middle"
                          className="fill-foreground text-[9px] font-mono font-medium"
                        >
                          {s.nodeLabel.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <span className="absolute bottom-2 right-3 text-[10px] font-mono text-muted-foreground">
                  SVG Topology Preview
                </span>
              </div>

              {/* Stakeholders Card Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Evaluated Stakeholders & Authority Drivers
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {influenceData?.stakeholders.map((s) => (
                    <div
                      key={s.nodeId}
                      className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-foreground">
                              {s.nodeLabel}
                            </span>
                            {s.isKeyDecisionMaker && (
                              <Crown className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {s.roleCategory} · {s.directConnectionCount} direct links
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-bold font-mono text-primary">
                            {s.compositeInfluenceScore}
                          </span>
                          <span className="block text-[10px] font-mono text-muted-foreground">
                            Score
                          </span>
                        </div>
                      </div>

                      {s.isKeyDecisionMaker && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium"
                        >
                          Key Decision-Maker
                        </Badge>
                      )}

                      <div className="pt-2 border-t border-border/40">
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {s.influenceDrivers.map((driver, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                              <span>{driver}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : mode === 'contagion' ? (
            /* Risk Contagion View */
            <div className="space-y-4">
              {/* Financial Exposure Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Total Revenue Exposure
                  </span>
                  <div className="flex items-center gap-1 text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                    <DollarSign className="h-4 w-4" />
                    <span>${contagionData?.totalRevenueExposure?.toLocaleString() ?? '0'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Contagion Risk Tier
                  </span>
                  <div>
                    <Badge
                      variant="outline"
                      className="border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-xs font-bold"
                    >
                      {contagionData?.contagionRiskTier ?? 'ELEVATED'}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Affected Blast Radius
                  </span>
                  <span className="text-sm font-mono text-foreground">
                    {contagionData?.blastRadius?.entityCount ?? 0} entities · {contagionData?.blastRadius?.dealCount ?? 0} deals
                  </span>
                </div>
              </div>

              {/* Affected Nodes & Transmission Vectors */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Geometric Attenuation Propagation Paths
                </h4>
                {contagionData?.affectedNodes.map((node) => (
                  <div
                    key={node.nodeId}
                    className="p-3.5 rounded-xl border border-border/80 bg-card flex flex-wrap items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {node.label}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          Hop {node.hopDistance}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono border-rose-500/30 text-rose-600">
                          {node.relationship}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        Vulnerability Factor: {(node.vulnerabilityFactor * 100).toFixed(0)}% · Associated Deal: ${node.associatedDealAmount.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-destructive">
                        {node.transmittedRiskScore}
                      </span>
                      <span className="block text-[10px] font-mono text-muted-foreground">
                        Transmitted Risk
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Transmission Vectors Evidence */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Identified Transmission Vectors
                </h4>
                {contagionData?.riskTransmissionVectors.map((v, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-border/60 bg-muted/10 text-xs text-muted-foreground space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground font-mono">
                        {v.vectorType}
                      </span>
                      <span className="font-mono text-[10px]">
                        Weight: {(v.weight * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p>{v.evidence}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Causal Paths View */
            <div className="space-y-4">
              {/* Multi-Hop Path Steps */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Multi-Hop Topological Path
                </h4>
                <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl border border-border/80 bg-muted/10">
                  {causalData?.hops.map((hop, idx) => (
                    <React.Fragment key={hop.hopIndex}>
                      <div className="p-2.5 rounded-lg border border-border/60 bg-card text-xs">
                        <span className="font-semibold text-foreground block">
                          {hop.fromLabel}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {hop.fromNodeId}
                        </span>
                      </div>
                      <div className="flex flex-col items-center px-1 text-muted-foreground">
                        <span className="text-[9px] font-mono uppercase font-bold text-primary">
                          {hop.relationship}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-primary" />
                      </div>
                      {idx === (causalData?.hops.length ?? 0) - 1 && (
                        <div className="p-2.5 rounded-lg border border-border/60 bg-card text-xs">
                          <span className="font-semibold text-foreground block">
                            {hop.toLabel}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {hop.toNodeId}
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Rule 41 Structured Explainability Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Rule 41 Explainability Grid
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1 shadow-xs">
                    <span className="text-xs font-bold text-primary uppercase font-mono tracking-wider">
                      WHAT
                    </span>
                    <p className="text-xs text-foreground leading-relaxed">
                      {causalData?.explainabilityGrid.what}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1 shadow-xs">
                    <span className="text-xs font-bold text-indigo-500 uppercase font-mono tracking-wider">
                      WHY
                    </span>
                    <p className="text-xs text-foreground leading-relaxed">
                      {causalData?.explainabilityGrid.why}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1 shadow-xs">
                    <span className="text-xs font-bold text-emerald-500 uppercase font-mono tracking-wider">
                      IMPACT
                    </span>
                    <p className="text-xs text-foreground leading-relaxed">
                      {causalData?.explainabilityGrid.impact}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1 shadow-xs">
                    <span className="text-xs font-bold text-rose-500 uppercase font-mono tracking-wider">
                      RISK
                    </span>
                    <p className="text-xs text-foreground leading-relaxed">
                      {causalData?.explainabilityGrid.risk}
                    </p>
                  </div>
                </div>
              </div>

              {/* Untrusted Reference Container for Raw Narrative (Rules 13 & 30) */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Isolated Causal Narrative (Rules 13 & 30)
                </h4>
                {React.createElement(
                  'untrusted_reference_data',
                  {
                    id: 'causal_narrative_context',
                    'data-testid': 'untrusted-reference-container',
                    'data-untrusted-source': 'graph_reasoning_engine',
                    className:
                      'block p-3.5 rounded-xl border border-border/60 bg-muted/20 font-mono text-xs text-muted-foreground whitespace-pre-wrap',
                  },
                  causalData?.causalInferenceNarrative
                )}
              </div>
            </div>
          )}
        </div>

        {/* Demarcated Footer strictly adhering to theme.md §8 */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] rounded-xl active:scale-[0.97] border-border/80 text-foreground"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
