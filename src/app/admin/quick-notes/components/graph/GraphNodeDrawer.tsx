'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  X,
  ExternalLink,
  Focus,
  Plus,
  Sparkles,
  Link2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Calendar,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getNodeTypeColor,
  getRelationDisplayLabel,
  getRelationEdgeColor,
} from '@/lib/quick-notes-domain';
import type {
  GraphNode,
  GraphEdge,
  KnowledgeRelation,
} from '@/lib/quick-notes-types';

interface GraphNodeDrawerProps {
  node: GraphNode | null;
  edges: GraphEdge[];
  nodesMap: Map<string, GraphNode>;
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
  onOpenCreateRelation: (nodeId: string) => void;
  onOpenAiSuggestions: (nodeId: string) => void;
  onDeleteRelation?: (relationId: string) => void;
}

export function GraphNodeDrawer({
  node,
  edges,
  nodesMap,
  onClose,
  onFocusNode,
  onOpenCreateRelation,
  onOpenAiSuggestions,
  onDeleteRelation,
}: GraphNodeDrawerProps) {
  if (!node) return null;

  const colorMeta = getNodeTypeColor(node.type);

  // Partition edges into outgoing and incoming
  const outgoingEdges = edges.filter((e) => e.source === node.id);
  const incomingEdges = edges.filter((e) => e.target === node.id);

  return (
    <aside
      aria-label="Node Inspector"
      className="absolute top-0 right-0 z-20 w-full sm:w-96 h-full bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: colorMeta.hex }}
            />
            <Badge variant="outline" className={`text-[10px] font-semibold uppercase tracking-wider ${colorMeta.badge}`}>
              {node.type}
            </Badge>
            {node.isHub && (
              <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Hub ({node.connectionsCount} links)
              </Badge>
            )}
          </div>
          <h3 className="text-base font-semibold text-foreground line-clamp-2 leading-snug">
            {node.label}
          </h3>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Meta Info */}
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
        {node.authorName && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" /> {node.authorName}
          </span>
        )}
        {node.createdAt && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {new Date(node.createdAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="p-3 grid grid-cols-2 gap-2 border-b border-border bg-muted/10">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFocusNode(node.id)}
          className="h-9 gap-1.5 text-xs font-medium rounded-xl"
        >
          <Focus className="w-3.5 h-3.5 text-blue-500" />
          <span>Focus Graph</span>
        </Button>

        {node.originHref ? (
          <Link
            href={node.originHref}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-medium rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Open Record</span>
          </Link>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="h-9 gap-1.5 text-xs font-medium rounded-xl opacity-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Internal Node</span>
          </Button>
        )}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onOpenCreateRelation(node.id)}
          className="h-9 gap-1.5 text-xs font-medium rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Link</span>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onOpenAiSuggestions(node.id)}
          className="h-9 gap-1.5 text-xs font-medium rounded-xl text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-500" />
          <span>AI Discover</span>
        </Button>
      </div>

      {/* Scrollable Relationships Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 divide-y divide-border">
        {/* Outgoing Connections */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
              Connected To ({outgoingEdges.length})
            </h4>
          </div>

          {outgoingEdges.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-1">No outgoing connections.</p>
          ) : (
            <div className="space-y-2">
              {outgoingEdges.map((edge) => {
                const targetNode = nodesMap.get(edge.target);
                const targetColor = targetNode ? getNodeTypeColor(targetNode.type) : null;

                return (
                  <div
                    key={edge.id}
                    className="p-2.5 rounded-xl border border-border bg-background/50 hover:bg-muted/40 transition-colors flex items-start justify-between gap-2"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="text-[9px] font-semibold uppercase tracking-tight py-0"
                          style={{
                            borderColor: getRelationEdgeColor(edge.relationType),
                            borderWidth: 1,
                          }}
                        >
                          {edge.label}
                        </Badge>
                        {edge.sourceKind === 'ai' && (
                          <span className="text-[10px] text-violet-600 font-medium">AI Inferred</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-foreground truncate">
                        {targetNode?.label || 'Target Object'}
                      </p>
                    </div>

                    {onDeleteRelation && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteRelation(edge.id)}
                        className="w-7 h-7 text-muted-foreground hover:text-destructive shrink-0 rounded-lg"
                        title="Delete connection"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Incoming Backlinks */}
        <div className="space-y-2.5 pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5 text-indigo-500" />
              Referenced By ({incomingEdges.length})
            </h4>
          </div>

          {incomingEdges.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-1">No incoming backlinks.</p>
          ) : (
            <div className="space-y-2">
              {incomingEdges.map((edge) => {
                const sourceNode = nodesMap.get(edge.source);

                return (
                  <div
                    key={edge.id}
                    className="p-2.5 rounded-xl border border-border bg-background/50 hover:bg-muted/40 transition-colors flex items-start justify-between gap-2"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] font-semibold py-0">
                          {edge.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">via {sourceNode?.type}</span>
                      </div>
                      <p className="text-xs font-medium text-foreground truncate">
                        {sourceNode?.label || 'Source Object'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
