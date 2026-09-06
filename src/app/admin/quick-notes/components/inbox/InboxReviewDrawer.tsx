'use client';

import * as React from 'react';
import {
  X,
  Sparkles,
  Check,
  AlertTriangle,
  GitMerge,
  Link2,
  Tag,
  Clock,
  Layers,
  ShieldCheck,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { KnowledgeInboxItem } from '@/lib/quick-notes-types';
import { getInboxTypeDisplayLabel } from '@/lib/quick-notes-domain';

interface InboxReviewDrawerProps {
  item: KnowledgeInboxItem | null;
  open: boolean;
  onClose: () => void;
  onAccept: (item: KnowledgeInboxItem) => void;
  onDismiss: (item: KnowledgeInboxItem) => void;
}

export function InboxReviewDrawer({
  item,
  open,
  onClose,
  onAccept,
  onDismiss,
}: InboxReviewDrawerProps) {
  if (!open || !item) return null;

  const { label: typeLabel, badgeClass: typeBadgeClass } = getInboxTypeDisplayLabel(item.type);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-xl h-full bg-card border-l border-border shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Drawer Header */}
        <div className="p-5 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] font-bold ${typeBadgeClass}`}>
                  {typeLabel}
                </Badge>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {Math.round(item.confidence * 100)}% Certainty
                </span>
              </div>
              <h2 className="text-sm font-bold text-foreground truncate mt-0.5">{item.title}</h2>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-lg">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* AI Suggestion Description */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-foreground">AI Assessment & Rationale</h4>
            <p className="text-xs text-muted-foreground leading-relaxed p-3.5 rounded-xl bg-muted/30 border border-border/60">
              {item.description}
            </p>
          </div>

          {/* Granular Details */}
          {item.contradictionDetails && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                Contradiction Breakdown
              </h4>
              <div className="space-y-2">
                <div className="p-3 rounded-xl border border-border/70 bg-card">
                  <span className="text-[10px] font-bold text-primary block mb-0.5 uppercase">
                    Thesis ({item.contradictionDetails.thesis?.sourceTitle || 'Target Record'})
                  </span>
                  <p className="text-xs italic text-foreground">"{item.contradictionDetails.thesis?.quote || item.contradictionDetails.thesisQuote || item.contradictionDetails.thesisClaim || ''}"</p>
                </div>
                <div className="p-3 rounded-xl border border-border/70 bg-card">
                  <span className="text-[10px] font-bold text-destructive block mb-0.5 uppercase">
                    Antithesis ({item.contradictionDetails.antithesis?.sourceTitle || 'Candidate Record'})
                  </span>
                  <p className="text-xs italic text-foreground">"{item.contradictionDetails.antithesis?.quote || item.contradictionDetails.antithesisQuote || item.contradictionDetails.antithesisClaim || ''}"</p>
                </div>
              </div>
              {item.contradictionDetails.suggestedResolution && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs">
                  <span className="font-bold text-foreground block mb-0.5">Suggested Action:</span>
                  <p className="text-muted-foreground">{item.contradictionDetails.suggestedResolution}</p>
                </div>
              )}
            </div>
          )}

          {/* Evidence Sources */}
          {item.evidence && item.evidence.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Verifiable Grounded Evidence ({item.evidence.length})
              </h4>
              <div className="space-y-2">
                {item.evidence.map((ev, i) => (
                  <div key={i} className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{ev.sourceTitle}</span>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono">
                        {ev.sourceType}
                      </Badge>
                    </div>
                    <p className="text-[11px] italic text-muted-foreground">"{ev.textSnippet}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDismiss(item);
              onClose();
            }}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Dismiss Suggestion
          </Button>

          <Button
            size="sm"
            onClick={() => {
              onAccept(item);
              onClose();
            }}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm active:scale-[0.98]"
          >
            <Check className="h-3.5 w-3.5" />
            Accept & Apply Suggestion
          </Button>
        </div>
      </div>
    </div>
  );
}
