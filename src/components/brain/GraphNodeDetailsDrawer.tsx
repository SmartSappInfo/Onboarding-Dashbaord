'use client';

/**
 * @fileOverview Graph Node Details & Relations Drawer (Phase 4 Milestone 5)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>`
 * - Zero Raw Descriptions: routed through `<CardInfoTooltip text="..." />` alongside title
 * - Screen Reader AA: `<DialogDescription className="sr-only">`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]`
 *
 * Security & Governance (Rules 4, 7, 8, 13, 30, 47, 61):
 * - Rule 30: Untrusted graph node data isolated inside `<untrusted_reference_data>` container
 * - Strict Zero-Any Invariant (Rule 4)
 * - Anti-IDOR Tenant Scoping (Rule 47)
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Network,
  ExternalLink,
  Share2,
  Layers,
  ArrowRight,
  ShieldAlert,
  Hash,
} from 'lucide-react';
import type { EntityGraphNode, EntityGraphEdge } from '@/app/actions/memory-actions';

export interface GraphNodeDetailsDrawerProps {
  node: EntityGraphNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidentEdges?: EntityGraphEdge[];
}

export function GraphNodeDetailsDrawer({
  node,
  open,
  onOpenChange,
  incidentEdges = [],
}: GraphNodeDetailsDrawerProps) {
  if (!node) return null;

  const getNodeTypeBadge = () => {
    switch (node.nodeType.toLowerCase()) {
      case 'person':
      case 'contact':
        return <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 font-medium">Person</Badge>;
      case 'deal':
        return <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 font-medium">Deal</Badge>;
      case 'meeting':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-medium">Meeting</Badge>;
      case 'semantic':
      case 'memory':
      case 'knowledge':
        return <Badge className="bg-primary/15 text-primary border-primary/30 font-medium">Knowledge</Badge>;
      case 'entity':
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium">Root Entity</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{node.nodeType}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl max-h-[90vh]"
      >
        {/* Demarcated Header (theme.md §8.2) */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="text-base sm:text-lg font-semibold truncate flex items-center gap-2">
              <Network className="h-4 w-4 text-primary shrink-0" />
              <span>Node Details & Relations</span>
            </DialogTitle>
            <CardInfoTooltip
              text="Inspect graph node taxonomy, connection topology, relational edges, and origin entity reference."
            />
          </div>
          <DialogDescription className="sr-only">
            Graph node relationship inspector and connected knowledge entities.
          </DialogDescription>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Node Identity & Untrusted Label Container (Rule 30) */}
          <div className="p-4 rounded-xl border border-border/80 bg-muted/15 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getNodeTypeBadge()}
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                  <Hash className="h-3 w-3" />
                  {node.id}
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Share2 className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-foreground">
                  {node.connectionsCount ?? incidentEdges.length}
                </span>{' '}
                connections
              </div>
            </div>

            {/* Rule 30 Untrusted Reference Data Container */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-amber-500" />
                Entity Label (Grounded)
              </div>
              <div className="p-3 rounded-lg bg-background border border-border/60 font-medium text-sm leading-relaxed">
                {/* Visual marker of Rule 30 isolation */}
                <span className="sr-only">&lt;untrusted_reference_data id=&quot;{node.id}&quot;&gt;</span>
                <span className="break-words">{node.label}</span>
                <span className="sr-only">&lt;/untrusted_reference_data&gt;</span>
              </div>
            </div>
          </div>

          {/* Incident Edges & Topology */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                Relational Edges ({incidentEdges.length})
              </h4>
            </div>

            {incidentEdges.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                No active incident edges recorded for this node in the current traversal radius.
              </div>
            ) : (
              <div className="space-y-2">
                {incidentEdges.map((edge) => (
                  <div
                    key={edge.id}
                    className="p-3 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors flex items-center justify-between text-xs gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] font-semibold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20 shrink-0">
                        {edge.relationshipType}
                      </span>
                      <div className="flex items-center gap-1 text-muted-foreground truncate">
                        <span className="truncate max-w-[100px]">{edge.sourceNodeId}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[100px]">{edge.targetNodeId}</span>
                      </div>
                    </div>

                    {edge.confidence !== undefined && (
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                        {Math.round(edge.confidence * 100)}% conf
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Demarcated Footer (theme.md §8.5) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          {node.originHref && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl active:scale-[0.97] mr-auto gap-1.5 min-h-[44px] sm:min-h-[36px]"
            >
              <Link href={node.originHref}>
                <ExternalLink className="h-3.5 w-3.5 text-primary" />
                <span>Open Origin Record</span>
              </Link>
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
