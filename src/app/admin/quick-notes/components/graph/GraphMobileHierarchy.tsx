'use client';

/**
 * @fileOverview CompanyBrain 2.0: Mobile Interactive Graph Card Hierarchy
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Mobile First & Touch Safe (UI Doc Sections 50 & 94):
 *    - Eliminates touch/pinch gesture traps by replacing complex desktop canvas on mobile
 *      with an expandable, accessible relationship card hierarchy.
 * 2. Touch Target Compliance (Rule 7):
 *    - All interactive cards, expanders, and jump buttons maintain >= 44px height (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions (Rule 1):
 *    - Uses `active:scale-[0.97]` tactile press feedback and smooth transitions.
 * 4. Zero-`any` Standard:
 *    - 100% typed with `GraphNode` and `GraphEdge`.
 */

import * as React from 'react';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Building2,
  Brain,
  Handshake,
  User,
  Video,
  ListTodo,
  FileText,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { GraphNode, GraphEdge } from '@/lib/quick-notes-types';
import { getNodeTypeColor } from '@/lib/quick-notes-domain';

interface GraphMobileHierarchyProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelectNode: (nodeId: string) => void;
  onExplainConnection?: (startId: string, targetId: string) => void;
  className?: string;
}

export function GraphMobileHierarchy({
  nodes,
  edges,
  onSelectNode,
  onExplainConnection,
  className,
}: GraphMobileHierarchyProps) {
  const [search, setSearch] = React.useState('');
  const [expandedNodeIds, setExpandedNodeIds] = React.useState<Set<string>>(new Set());

  const nodeMap = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const filteredNodes = React.useMemo(() => {
    if (!search.trim()) return nodes;
    const q = search.toLowerCase().trim();
    return nodes.filter(
      (n) => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
    );
  }, [nodes, search]);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'school':
      case 'entity':
        return Building2;
      case 'contact':
        return User;
      case 'deal':
        return Handshake;
      case 'meeting':
      case 'call':
        return Video;
      case 'memory':
      case 'insight':
      case 'decision':
        return Brain;
      case 'task':
        return ListTodo;
      default:
        return FileText;
    }
  };

  return (
    <div className={cn('space-y-4 font-figtree', className)}>
      {/* Mobile Search Header */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search connected accounts, deals, notes..."
          className="pl-10 min-h-[44px] text-sm rounded-xl bg-card border-border"
        />
      </div>

      {filteredNodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          No matching connections found.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNodes.map((node) => {
            const isExpanded = expandedNodeIds.has(node.id);
            const outgoingEdges = edges.filter((e) => e.source === node.id);
            const incomingEdges = edges.filter((e) => e.target === node.id);
            const totalConnections = outgoingEdges.length + incomingEdges.length;
            const colors = getNodeTypeColor(node.type);
            const Icon = getNodeIcon(node.type);

            return (
              <div
                key={node.id}
                className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden transition-all"
              >
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(node.id)}
                  className="w-full flex items-center justify-between p-3.5 text-left min-h-[52px] hover:bg-muted/30 active:scale-[0.99] transition-all gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border',
                        colors.fill,
                        colors.border
                      )}
                    >
                      <Icon className={cn('h-4 w-4', colors.text)} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-foreground truncate leading-tight">
                        {node.label}
                      </h4>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] px-1.5 py-0 uppercase font-bold', colors.badge)}
                        >
                          {node.type}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {totalConnections} connection{totalConnections === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-1 rounded-md text-muted-foreground shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </div>
                </button>

                {/* Expanded Details & Neighborhood */}
                {isExpanded && (
                  <div className="border-t border-border/60 bg-muted/20 p-3.5 space-y-3">
                    {/* Actions Row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onSelectNode(node.id)}
                        className="min-h-[44px] text-xs font-semibold gap-1.5 rounded-lg active:scale-[0.97]"
                      >
                        <span>Inspect Node</span>
                      </Button>

                      {node.originHref && (
                        <a
                          href={node.originHref}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary px-3 py-2 rounded-lg hover:bg-primary/10 min-h-[44px] active:scale-[0.97]"
                        >
                          <span>Open Source</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {/* Connected Targets */}
                    {totalConnections === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No direct connections recorded yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Connected Items:
                        </span>

                        {outgoingEdges.map((edge) => {
                          const targetNode = nodeMap.get(edge.target);
                          if (!targetNode) return null;

                          return (
                            <div
                              key={edge.id}
                              className="flex items-center justify-between rounded-lg border border-border bg-card p-2 text-xs gap-2"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0 shrink-0">
                                  {edge.relationType.replace(/_/g, ' ')}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="font-medium text-foreground truncate">
                                  {targetNode.label}
                                </span>
                              </div>

                              {onExplainConnection && (
                                <button
                                  type="button"
                                  onClick={() => onExplainConnection(node.id, targetNode.id)}
                                  className="text-primary hover:text-primary/80 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 active:scale-[0.97]"
                                  title="Explain why these are connected"
                                  aria-label="Explain connection"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {incomingEdges.map((edge) => {
                          const sourceNode = nodeMap.get(edge.source);
                          if (!sourceNode) return null;

                          return (
                            <div
                              key={edge.id}
                              className="flex items-center justify-between rounded-lg border border-border bg-card p-2 text-xs gap-2"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-medium text-foreground truncate">
                                  {sourceNode.label}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0 shrink-0">
                                  {edge.relationType.replace(/_/g, ' ')}
                                </Badge>
                              </div>

                              {onExplainConnection && (
                                <button
                                  type="button"
                                  onClick={() => onExplainConnection(sourceNode.id, node.id)}
                                  className="text-primary hover:text-primary/80 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 active:scale-[0.97]"
                                  title="Explain why these are connected"
                                  aria-label="Explain connection"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
