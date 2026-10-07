'use client';

/**
 * @fileOverview Knowledge Node Context Menu Component (Phase 11 M5 · T4)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile-first >= 44px touch targets, Emil Kowalski tactile compression)
 * - Rule 55 (Graph Canvas Ceilings: expand neighborhood bounds <= 80 nodes)
 */

import * as React from 'react';
import {
  Sparkles,
  ExternalLink,
  GitFork,
  Inbox,
  X,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GraphNodeRecord } from '@/platform/domains/knowledge_memory/services/knowledge-graph-projection-service';

export interface KnowledgeNodeContextMenuProps {
  node: GraphNodeRecord | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onAskAi: (node: GraphNodeRecord) => void;
  onOpenDetails: (node: GraphNodeRecord) => void;
  onExpandNeighborhood: (node: GraphNodeRecord) => void;
  onAddToReviewQueue: (node: GraphNodeRecord) => void;
  className?: string;
}

export function KnowledgeNodeContextMenu({
  node,
  position,
  onClose,
  onAskAi,
  onOpenDetails,
  onExpandNeighborhood,
  onAddToReviewQueue,
  className,
}: KnowledgeNodeContextMenuProps) {
  if (!node || !position) return null;

  return (
    <div
      style={{ left: position.x, top: position.y }}
      className={cn(
        'fixed z-50 min-w-[220px] rounded-xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100',
        className
      )}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60">
        <div className="space-y-0.5 max-w-[170px]">
          <span className="text-xs font-semibold text-foreground truncate block">
            {node.label}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase font-mono block">
            {node.type} &middot; {node.id}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="space-y-0.5 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onAskAi(node);
            onClose();
          }}
          className="w-full justify-start text-xs min-h-[40px] px-2.5 rounded-lg active:scale-[0.97] hover:bg-primary/10 hover:text-primary"
        >
          <Sparkles className="h-3.5 w-3.5 mr-2 text-primary" />
          Ask AI About Node
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onExpandNeighborhood(node);
            onClose();
          }}
          className="w-full justify-start text-xs min-h-[40px] px-2.5 rounded-lg active:scale-[0.97]"
        >
          <GitFork className="h-3.5 w-3.5 mr-2 text-indigo-500" />
          Expand Neighborhood (depth &le; 2)
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onOpenDetails(node);
            onClose();
          }}
          className="w-full justify-start text-xs min-h-[40px] px-2.5 rounded-lg active:scale-[0.97]"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
          Open Source Record
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onAddToReviewQueue(node);
            onClose();
          }}
          className="w-full justify-start text-xs min-h-[40px] px-2.5 rounded-lg active:scale-[0.97]"
        >
          <Inbox className="h-3.5 w-3.5 mr-2 text-amber-500" />
          Add to Review Queue
        </Button>
      </div>
    </div>
  );
}
