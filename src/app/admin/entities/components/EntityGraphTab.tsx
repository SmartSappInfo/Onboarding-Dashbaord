'use client';

/**
 * @fileOverview CompanyBrain 2.0: Entity Profile Contextual Graph Tab
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Seamless Contextual Integration (PRD & UI Section 26):
 *    - Injects the organizational knowledge graph directly into CRM Entity records (`/admin/entities/[id]`).
 *    - Sales reps and operators immediately see connected contacts, deals, meetings, problems,
 *      and opportunities without navigating away from the customer profile.
 * 2. Emil Kowalski Micro-Interactions & A11y (Rule 1 & Rule 7):
 *    - All interactive chips, buttons, and drawer triggers maintain >= 44px mobile touch targets
 *      and `active:scale-[0.97]` tactile press states.
 * 3. Zero-`any` Standard:
 *    - 100% typed with TypeScript interfaces.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Network,
  Sparkles,
  ExternalLink,
  User,
  Handshake,
  Brain,
  AlertTriangle,
  Flame,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { getEntitySubGraphAction } from '@/lib/memory/actions/graph-actions';
import type { CompanyBrainGraphNode, CompanyBrainGraphEdge } from '@/lib/memory/graph-types';
import { ExplainConnectionDialog } from '@/app/admin/quick-notes/components/graph/ExplainConnectionDialog';
import type { GraphNode } from '@/lib/quick-notes-types';

interface EntityGraphTabProps {
  workspaceId: string;
  entityId: string;
  entityName: string;
  className?: string;
}

export default function EntityGraphTab({
  workspaceId,
  entityId,
  entityName,
  className,
}: EntityGraphTabProps) {
  const { toast } = useToast();
  const { user } = useUser();

  const [nodes, setNodes] = React.useState<CompanyBrainGraphNode[]>([]);
  const [edges, setEdges] = React.useState<CompanyBrainGraphEdge[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Explain dialog state
  const [explainTarget, setExplainTarget] = React.useState<GraphNode | null>(null);

  const fetchGraph = React.useCallback(async () => {
    if (!workspaceId || !entityId || !user) return;
    setIsLoading(true);

    try {
      const res = await getEntitySubGraphAction({
        workspaceId,
        userId: user.uid,
        entityId,
        depth: 2,
      });

      if (res.success && res.data) {
        setNodes(res.data.nodes);
        setEdges(res.data.edges);
      } else {
        toast({
          title: 'Graph Notice',
          description: res.error || 'Could not load entity relationships.',
          variant: 'destructive',
          actionConfig: { path: `/admin/entities/${entityId}`, label: 'Retry' },
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch graph data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, entityId, user, toast]);

  React.useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Categorize connected nodes
  const rootEntityNodeId = `ent_${entityId}`;
  const connectedNodes = nodes.filter((n) => n.id !== rootEntityNodeId);

  const contacts = connectedNodes.filter((n) => n.nodeType === 'person');
  const deals = connectedNodes.filter((n) => n.nodeType === 'deal');
  const memories = connectedNodes.filter((n) => n.nodeType === 'memory');

  const entityAsGraphNode: GraphNode = {
    id: rootEntityNodeId,
    label: entityName,
    type: 'school',
    createdAt: new Date().toISOString(),
    originHref: `/admin/entities/${encodeURIComponent(entityId)}`,
    connectionsCount: connectedNodes.length,
    isHub: true,
    clusterId: 'cluster-crm',
  };

  return (
    <div className={cn('space-y-6 font-figtree', className)}>
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Network className="h-4 w-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              Institutional Relationship Mesh
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Explore {connectedNodes.length} connected nodes and {edges.length} explicit relationships across stakeholders, deals, and AI institutional memories for {entityName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchGraph}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold gap-1.5 active:scale-[0.97]"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            <span>Refresh</span>
          </Button>

          <Link href={`/admin/quick-notes/graph?focus=${encodeURIComponent(rootEntityNodeId)}`}>
            <Button
              type="button"
              size="sm"
              className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold gap-1.5 active:scale-[0.97]"
            >
              <span>Full Graph View</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : connectedNodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center space-y-3 bg-muted/10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Network className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground text-sm">No Graph Connections Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              As deals, meetings, notes, and institutional memories are created, they will automatically appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Key Stakeholders & Contacts */}
          <Card className="rounded-2xl border-border bg-card shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Stakeholders ({contacts.length})</span>
                </CardTitle>
                <Badge variant="outline" className="text-[10px] uppercase font-bold">
                  People
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Directly connected key decision makers and contacts.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">No contacts linked yet.</p>
              ) : (
                contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-2.5 text-xs gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate">{contact.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExplainTarget({
                          id: contact.id,
                          label: contact.label,
                          type: 'contact',
                          createdAt: contact.createdAt,
                          originHref: contact.originHref || null,
                          connectionsCount: 1,
                          isHub: false,
                          clusterId: 'cluster-crm',
                        })
                      }
                      className="text-primary hover:text-primary/80 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 active:scale-[0.97]"
                      title="Explain why connected"
                      aria-label="Explain connection"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Card 2: Deals & Opportunities */}
          <Card className="rounded-2xl border-border bg-card shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>Pipeline Deals ({deals.length})</span>
                </CardTitle>
                <Badge variant="outline" className="text-[10px] uppercase font-bold">
                  Revenue
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Active pipeline opportunities owned by this account.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {deals.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">No active deals linked.</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-2.5 text-xs gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Handshake className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate">{deal.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExplainTarget({
                          id: deal.id,
                          label: deal.label,
                          type: 'deal',
                          createdAt: deal.createdAt,
                          originHref: deal.originHref || null,
                          connectionsCount: 1,
                          isHub: false,
                          clusterId: 'cluster-crm',
                        })
                      }
                      className="text-primary hover:text-primary/80 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 active:scale-[0.97]"
                      title="Explain why connected"
                      aria-label="Explain connection"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Card 3: Institutional Memories & Signals */}
          <Card className="rounded-2xl border-border bg-card shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <span>Extracted Memories ({memories.length})</span>
                </CardTitle>
                <Badge variant="outline" className="text-[10px] uppercase font-bold">
                  Memory
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Pain points, opportunities, and buying signals extracted by AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {memories.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  No extracted memories linked yet.
                </p>
              ) : (
                memories.slice(0, 6).map((mem) => {
                  const mType = mem.metadata?.memoryType as string | undefined;
                  const isProblem = mType === 'problem';
                  const isOpp = mType === 'opportunity';
                  const isRisk = mType === 'risk';

                  return (
                    <div
                      key={mem.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-2.5 text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isProblem ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        ) : isOpp ? (
                          <Flame className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : isRisk ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        ) : (
                          <Brain className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                        )}
                        <span className="font-medium text-foreground truncate">{mem.label}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExplainTarget({
                            id: mem.id,
                            label: mem.label,
                            type: 'memory',
                            createdAt: mem.createdAt,
                            originHref: mem.originHref || null,
                            connectionsCount: 1,
                            isHub: false,
                            clusterId: 'cluster-memory',
                          })
                        }
                        className="text-primary hover:text-primary/80 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 active:scale-[0.97]"
                        title="Explain why connected"
                        aria-label="Explain connection"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Connection Explanation Modal */}
      <ExplainConnectionDialog
        open={!!explainTarget}
        onOpenChange={(open) => {
          if (!open) setExplainTarget(null);
        }}
        startNode={entityAsGraphNode}
        targetNode={explainTarget}
      />
    </div>
  );
}
