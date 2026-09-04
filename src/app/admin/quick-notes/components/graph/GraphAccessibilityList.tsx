'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getNodeTypeColor } from '@/lib/quick-notes-domain';
import type {
  GraphNode,
  GraphEdge,
} from '@/lib/quick-notes-types';

interface GraphAccessibilityListProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onOpenCreateRelation?: (nodeId: string) => void;
  onDeleteRelation?: (relationId: string) => void;
  className?: string;
}

/**
 * Section 84 Spec Compliance: Accessible Structured Relationship List.
 *
 * Provides a 100% accessible, screen-reader optimized, keyboard-navigable
 * alternative to the visual graph viewport.
 */
export function GraphAccessibilityList({
  nodes,
  edges,
  onOpenCreateRelation,
  onDeleteRelation,
  className = '',
}: GraphAccessibilityListProps) {
  const [search, setSearch] = React.useState('');

  const nodeMap = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const filteredNodes = React.useMemo(() => {
    if (!search.trim()) return nodes;
    const q = search.toLowerCase().trim();
    return nodes.filter(
      (n) => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
    );
  }, [nodes, search]);

  return (
    <section
      aria-label="Accessible Knowledge Relationship Tree"
      className={`space-y-4 p-4 bg-background rounded-2xl border border-border ${className}`}
    >
      {/* Search & Accessibility Notice */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            Knowledge Relationships Directory
          </h3>
          <p className="text-xs text-muted-foreground">
            Screen-reader accessible tabular listing of all knowledge nodes, references, and citations.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search directory…"
            className="pl-9 min-h-[44px] sm:min-h-[36px] text-xs rounded-xl"
          />
        </div>
      </div>

      {filteredNodes.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-xs">
          No knowledge objects match your search criteria.
        </div>
      ) : (
        <div className="space-y-4 divide-y divide-border">
          {filteredNodes.map((node) => {
            const outgoing = edges.filter((e) => e.source === node.id);
            const incoming = edges.filter((e) => e.target === node.id);
            const colorMeta = getNodeTypeColor(node.type);

            return (
              <article
                key={node.id}
                className="pt-4 first:pt-0 space-y-3"
                aria-labelledby={`node-heading-${node.id}`}
              >
                {/* Node Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: colorMeta.hex }}
                      />
                      <Badge variant="outline" className={`text-[10px] font-semibold uppercase ${colorMeta.badge}`}>
                        {node.type}
                      </Badge>
                      {node.isHub && (
                        <Badge variant="secondary" className="text-[10px]">
                          Hub Node
                        </Badge>
                      )}
                    </div>
                    <h4
                      id={`node-heading-${node.id}`}
                      className="text-sm font-semibold text-foreground"
                    >
                      {node.label}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {onOpenCreateRelation && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenCreateRelation(node.id)}
                        className="min-h-[44px] sm:min-h-[36px] px-3 text-xs rounded-lg gap-1.5 active:scale-[0.97] transition-transform"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Link</span>
                      </Button>
                    )}

                    {node.originHref && (
                      <Link
                        href={node.originHref}
                        className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-3 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground active:scale-[0.97] transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        <span>View</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Relationships Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4 border-l-2 border-border/60">
                  {/* Outgoing List */}
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-blue-500" />
                      Connected To ({outgoing.length}):
                    </h5>
                    {outgoing.length === 0 ? (
                      <p className="text-xs text-muted-foreground/80 italic">None</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {outgoing.map((e) => {
                          const target = nodeMap.get(e.target);
                          return (
                            <li
                              key={e.id}
                              className="text-xs p-2 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between gap-2"
                            >
                              <div className="truncate">
                                <span className="font-semibold text-foreground mr-1.5">
                                  {e.label} →
                                </span>
                                <span className="text-foreground">{target?.label || 'Target'}</span>
                              </div>
                              {onDeleteRelation && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onDeleteRelation(e.id)}
                                  className="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] p-2 text-muted-foreground hover:text-destructive active:scale-[0.97] shrink-0"
                                  title="Delete relationship"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Incoming List */}
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <ArrowLeft className="w-3 h-3 text-indigo-500" />
                      Referenced By ({incoming.length}):
                    </h5>
                    {incoming.length === 0 ? (
                      <p className="text-xs text-muted-foreground/80 italic">None</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {incoming.map((e) => {
                          const source = nodeMap.get(e.source);
                          return (
                            <li
                              key={e.id}
                              className="text-xs p-2 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between gap-2"
                            >
                              <div className="truncate">
                                <span className="font-semibold text-foreground mr-1.5">
                                  ← {e.label}
                                </span>
                                <span className="text-foreground">{source?.label || 'Source'}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
