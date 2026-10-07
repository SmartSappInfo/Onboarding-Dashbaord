'use client';

/**
 * @fileOverview Knowledge Item Inspector Drawer Component (Phase 11 M3 · T7)
 *
 * Implements theme.md §8 (Standardized Modal & Dialog System Architecture),
 * Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-first >= 44px touch targets),
 * Rule 29 (Immutable Temporal Fact Supersession), and Rule 30 (Untrusted Reference Data).
 *
 * Invariants:
 * - Demarcated Header: <DialogHeader demarcated> with min-h-[52px], bg-muted/20, border-b.
 * - Single-Circle Info Tooltip: <CardInfoTooltip text="..."> at z-[10050].
 * - Zero Raw Visual Descriptions: <DialogDescription className="sr-only">.
 * - Demarcated Footer: px-6 py-3.5, border-t, bg-muted/15, with tactile rounded-xl buttons.
 */

import * as React from 'react';
import {
  Clock,
  Layers,
  Link as LinkIcon,
  Shield,
  Calendar,
  Sparkles,
  GitBranch,
  History,
  FileText,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { KnowledgeCandidate } from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';

export interface KnowledgeItemInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: KnowledgeCandidate | null;
  className?: string;
}

export function KnowledgeItemInspector({
  isOpen,
  onClose,
  candidate,
  className,
}: KnowledgeItemInspectorProps) {
  if (!candidate) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'sm:max-w-2xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 overflow-hidden flex flex-col',
          className
        )}
      >
        {/* Demarcated Header (theme.md §8.2) */}
        <DialogHeader
          demarcated
          className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                Knowledge Item Inspector
              </DialogTitle>
              <CardInfoTooltip text="Inspects full temporal provenance, relationship projections, and sensitivity guarantees of this candidate knowledge entity." />
            </div>
          </div>
          <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase">
            {candidate.status}
          </Badge>
          <DialogDescription className="sr-only">
            Inspect knowledge item details, provenance, temporal validity, and suggested graph links.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-sm max-h-[75vh] overflow-y-auto">
          {/* Candidate Overview */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Title & Canonical Identifier
              </span>
              <span className="font-mono text-xs text-muted-foreground">ID: {candidate.id}</span>
            </div>
            <p className="text-base font-semibold text-foreground">{candidate.title}</p>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                Source: {candidate.source.type}:{candidate.source.id}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Confidence: {Math.round(candidate.confidence * 100)}%
              </Badge>
              <Badge variant="outline" className="text-xs">
                Sensitivity: {candidate.sensitivity}
              </Badge>
            </div>
          </div>

          {/* Temporal Validity & Lineage (Rule 29) */}
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-foreground font-semibold text-xs tracking-tight">
              <History className="h-4 w-4 text-primary" />
              <span>Temporal Validity & Lineage</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase block font-medium">Valid From</span>
                <span className="font-mono text-foreground">{candidate.validFrom || candidate.createdAt}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase block font-medium">Valid Until</span>
                <span className="font-mono text-foreground">{candidate.validUntil || 'Active / Indefinite'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase block font-medium">Version</span>
                <span className="font-mono text-foreground">v{candidate.version}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase block font-medium">Superseded By</span>
                <span className="font-mono text-foreground">{candidate.supersededBy || 'None'}</span>
              </div>
            </div>
          </div>

          {/* Content / Untrusted Container */}
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Reference Content
            </span>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/60 text-xs font-mono break-words leading-relaxed">
              {candidate.content}
            </div>
          </div>

          {/* Subject References & Relationships */}
          {candidate.suggestedRelationships && candidate.suggestedRelationships.length > 0 && (
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs tracking-tight">
                <LinkIcon className="h-4 w-4 text-primary" />
                <span>Suggested Graph Links</span>
              </div>
              <div className="space-y-2">
                {candidate.suggestedRelationships.map((rel, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/50 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-primary font-medium">{rel.predicate}</span>
                      <span className="text-muted-foreground">&rarr;</span>
                      <span className="font-mono text-foreground">{rel.targetId}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {Math.round(rel.confidence * 100)}% conf
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Demarcated Footer (theme.md §8.4) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            variant="outline"
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl text-xs font-medium active:scale-[0.97] transition-all"
          >
            Close Inspector
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
