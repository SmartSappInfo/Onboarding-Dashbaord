'use client';

import * as React from 'react';
import {
  Check,
  X,
  GitMerge,
  AlertTriangle,
  Sparkles,
  Link2,
  Tag,
  CheckSquare,
  Lightbulb,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { KnowledgeInboxItem } from '@/lib/quick-notes-types';
import { getInboxTypeDisplayLabel } from '@/lib/quick-notes-domain';

interface InboxItemCardProps {
  item: KnowledgeInboxItem;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  onAccept: (item: KnowledgeInboxItem) => void;
  onDismiss: (item: KnowledgeInboxItem) => void;
  onOpenMerge?: (item: KnowledgeInboxItem) => void;
  onOpenDrawer?: (item: KnowledgeInboxItem) => void;
}

export function InboxItemCard({
  item,
  isSelected = false,
  onSelect,
  onAccept,
  onDismiss,
  onOpenMerge,
  onOpenDrawer,
}: InboxItemCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { label: typeLabel, badgeClass: typeBadgeClass } = getInboxTypeDisplayLabel(item.type);

  const confidencePercent = Math.round(item.confidence * 100);

  const getConfidenceColor = (conf: number) => {
    if (conf >= 85) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (conf >= 70) return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20';
    return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 bg-card ${
        isSelected
          ? 'border-primary shadow-md ring-1 ring-primary/30'
          : 'border-border/80 hover:border-border hover:shadow-xs'
      } ${item.status !== 'pending' ? 'opacity-70 bg-muted/20' : ''}`}
    >
      <div className="p-4 sm:p-5 space-y-3">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            {onSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelect(e.target.checked)}
                className="h-4 w-4 rounded-sm border-border accent-primary cursor-pointer"
              />
            )}
            <Badge variant="outline" className={`text-[11px] font-bold ${typeBadgeClass}`}>
              {typeLabel}
            </Badge>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getConfidenceColor(
                confidencePercent
              )}`}
            >
              {confidencePercent}% Confidence
            </span>
            {item.status !== 'pending' && (
              <Badge variant="secondary" className="text-[10px] capitalize font-mono">
                {item.status}
              </Badge>
            )}
          </div>

          <span className="text-[11px] text-muted-foreground font-mono shrink-0">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Title & Description */}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground leading-snug">{item.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
        </div>

        {/* Specialized Content Block: Duplicate Detection */}
        {item.type === 'duplicate_detection' && item.duplicateDetails && (
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <GitMerge className="h-3.5 w-3.5" />
                Overlap with: "{item.duplicateDetails.candidateTitle}"
              </span>
              <span>{Math.round(item.duplicateDetails.similarityScore * 100)}% Match</span>
            </div>
            {item.duplicateDetails.overlappingTopics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.duplicateDetails.overlappingTopics.map((topic, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-900 dark:text-amber-200"
                  >
                    #{topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Specialized Content Block: Contradiction Detection */}
        {item.type === 'contradiction_detection' && item.contradictionDetails && (
          <div className="p-3.5 rounded-xl bg-destructive/5 border border-destructive/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Conflicting Assertions Detected
              </span>
              <Badge variant="outline" className="text-[9px] uppercase font-bold text-destructive border-destructive/30">
                {item.contradictionDetails.severity} Severity
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-card border border-border/60">
                <span className="text-[10px] font-bold text-muted-foreground block mb-0.5 uppercase tracking-wider">
                  Thesis (Current Record)
                </span>
                <p className="text-xs italic text-foreground">"{item.contradictionDetails.thesis?.quote || item.contradictionDetails.thesisQuote || item.contradictionDetails.thesisClaim || ''}"</p>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/60">
                <span className="text-[10px] font-bold text-muted-foreground block mb-0.5 uppercase tracking-wider">
                  Antithesis ({item.contradictionDetails.antithesis?.sourceTitle || 'Other Record'})
                </span>
                <p className="text-xs italic text-foreground">"{item.contradictionDetails.antithesis?.quote || item.contradictionDetails.antithesisQuote || item.contradictionDetails.antithesisClaim || ''}"</p>
              </div>
            </div>
          </div>
        )}

        {/* Specialized Content Block: Link Suggestion */}
        {item.type === 'link_suggestion' && item.suggestedPatch?.relationType && (
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-foreground">
                Connect via{' '}
                <span className="font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400">
                  {item.suggestedPatch.relationType}
                </span>{' '}
                to "{item.suggestedPatch.targetObjectTitle || 'Target Entity'}"
              </span>
            </div>
          </div>
        )}

        {/* Evidence & Provenance Collapsible */}
        {item.evidence && item.evidence.length > 0 && (
          <div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 focus:outline-hidden"
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {isExpanded ? 'Hide Evidence Sources' : `Show Supporting Evidence (${item.evidence.length})`}
            </button>
            {isExpanded && (
              <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-primary/30">
                {item.evidence.map((ev, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">
                    <span className="font-bold text-foreground block">{ev.sourceTitle}</span>
                    <p className="text-[11px] italic mt-0.5">"{ev.textSnippet}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Toolbar */}
        {item.status === 'pending' && (
          <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {item.type === 'duplicate_detection' && onOpenMerge && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenMerge(item)}
                  className="h-8 text-xs font-semibold gap-1 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10 active:scale-[0.98]"
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  Merge Notes...
                </Button>
              )}

              {onOpenDrawer && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenDrawer(item)}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  Inspect Details
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDismiss(item)}
                className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1"
              >
                <X className="h-3.5 w-3.5" />
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={() => onAccept(item)}
                className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 active:scale-[0.98] shadow-xs"
              >
                <Check className="h-3.5 w-3.5" />
                Accept
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
