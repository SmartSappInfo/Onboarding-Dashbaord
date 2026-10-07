'use client';

/**
 * @fileOverview Visual Knowledge Graph Toolbar & Mode Switcher (Phase 11 M5 · T4)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile-first >= 44px touch targets, Emil Kowalski tactile compression)
 * - Rule 55 (Graph Canvas Ceilings: max 80 nodes, max 150 edges)
 * - PRD §18 (3 Canonical Graph Interaction Modes: Explore, Explain, Investigate)
 */

import * as React from 'react';
import {
  Compass,
  GitBranch,
  SearchCode,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { cn } from '@/lib/utils';
import type { GraphExplorerMode } from '@/platform/domains/knowledge_memory/contracts/knowledge-ui-types';

export interface KnowledgeGraphToolbarProps {
  mode: GraphExplorerMode;
  onModeChange: (mode: GraphExplorerMode) => void;
  nodeTypeFilter: string;
  onNodeTypeFilterChange: (type: string) => void;
  visibleNodesCount: number;
  visibleEdgesCount: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  className?: string;
}

export function KnowledgeGraphToolbar({
  mode,
  onModeChange,
  nodeTypeFilter,
  onNodeTypeFilterChange,
  visibleNodesCount,
  visibleEdgesCount,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  className,
}: KnowledgeGraphToolbarProps) {
  const nodeTypes = [
    { id: 'all', label: 'All Types' },
    { id: 'entity', label: 'Organizations' },
    { id: 'person', label: 'People' },
    { id: 'deal', label: 'Deals' },
    { id: 'meeting', label: 'Meetings' },
    { id: 'decision', label: 'Decisions' },
    { id: 'fact', label: 'Facts' },
  ];

  return (
    <div
      className={cn(
        'flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm',
        className
      )}
    >
      {/* 3 Interaction Modes (PRD §18) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
          <Button
            variant={mode === 'explore' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onModeChange('explore')}
            className={cn(
              'rounded-lg text-xs min-h-[40px] px-3 active:scale-[0.97] flex items-center gap-1.5 transition-all',
              mode === 'explore' && 'bg-background shadow-xs text-foreground font-semibold'
            )}
          >
            <Compass className="h-3.5 w-3.5 text-primary" />
            Explore
          </Button>

          <Button
            variant={mode === 'explain' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onModeChange('explain')}
            className={cn(
              'rounded-lg text-xs min-h-[40px] px-3 active:scale-[0.97] flex items-center gap-1.5 transition-all',
              mode === 'explain' && 'bg-background shadow-xs text-foreground font-semibold'
            )}
          >
            <GitBranch className="h-3.5 w-3.5 text-amber-500" />
            Explain Path
          </Button>

          <Button
            variant={mode === 'investigate' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onModeChange('investigate')}
            className={cn(
              'rounded-lg text-xs min-h-[40px] px-3 active:scale-[0.97] flex items-center gap-1.5 transition-all',
              mode === 'investigate' && 'bg-background shadow-xs text-foreground font-semibold'
            )}
          >
            <SearchCode className="h-3.5 w-3.5 text-indigo-500" />
            Investigate
          </Button>
        </div>

        <CardInfoTooltip text="Explore: manual navigation & expanding. Explain: pick 2 nodes to find connecting path. Investigate: AI analyzes connected subgraph hypotheses (PRD §18)." />
      </div>

      {/* Filter by Node Type */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
        <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
        {nodeTypes.map((type) => (
          <Button
            key={type.id}
            variant={nodeTypeFilter === type.id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onNodeTypeFilterChange(type.id)}
            className="rounded-lg text-xs min-h-[36px] px-2.5 active:scale-[0.97]"
          >
            {type.label}
          </Button>
        ))}
      </div>

      {/* Zoom Controls & Rule 55 Ceiling Telemetry */}
      <div className="flex items-center gap-2 self-end lg:self-auto">
        {/* Rule 55 Ceiling Telemetry */}
        <Badge
          variant="outline"
          className={cn(
            'text-[11px] font-mono px-2.5 py-1 rounded-lg border-border/80 flex items-center gap-1.5',
            visibleNodesCount >= 75 ? 'border-amber-500/40 text-amber-600 bg-amber-500/10' : 'text-muted-foreground'
          )}
          title="Rule 55: Graph is bounded to <= 80 nodes and <= 150 edges for memory and 60fps performance."
        >
          <Layers className="h-3 w-3" />
          <span>
            {visibleNodesCount}/80 nodes &middot; {visibleEdgesCount}/150 edges
          </span>
        </Badge>

        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomIn}
            className="h-8 w-8 rounded-lg active:scale-[0.97]"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomOut}
            className="h-8 w-8 rounded-lg active:scale-[0.97]"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onResetZoom}
            className="h-8 w-8 rounded-lg active:scale-[0.97]"
            title="Reset View"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
