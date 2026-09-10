'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Check, X, Quote, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  suggestKnowledgeLinksAction,
  createKnowledgeRelationAction,
} from '@/lib/quick-notes-graph-actions';
import { getRelationDisplayLabel } from '@/lib/quick-notes-domain';
import type { AiLinkSuggestion, GraphNode } from '@/lib/quick-notes-types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';

interface AiLinkSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetNodeId: string | null;
  nodes: GraphNode[];
  onSuggestionAccepted: () => void;
}

export function AiLinkSuggestionsDialog({
  open,
  onOpenChange,
  targetNodeId,
  nodes,
  onSuggestionAccepted,
}: AiLinkSuggestionsDialogProps) {
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();

  const [isLoading, setIsLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<AiLinkSuggestion[]>([]);
  const [acceptedIds, setAcceptedIds] = React.useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set());

  const targetNode = React.useMemo(
    () => nodes.find((n) => n.id === targetNodeId),
    [nodes, targetNodeId]
  );

  React.useEffect(() => {
    if (open && activeWorkspaceId && user && targetNodeId) {
      setIsLoading(true);
      setSuggestions([]);
      setAcceptedIds(new Set());
      setDismissedIds(new Set());

      suggestKnowledgeLinksAction(activeWorkspaceId, user.uid, targetNodeId)
        .then((res) => {
          if (res.success) {
            setSuggestions(res.data);
          } else {
            toast({
              variant: 'destructive',
              title: 'Link discovery error',
              description: res.error,
            });
          }
        })
        .catch((err) => {
          console.error('[AiLinkSuggestionsDialog] Error:', err);
          toast({
            variant: 'destructive',
            title: 'Inference error',
            description: 'Failed to discover link suggestions.',
          });
        })
        .finally(() => setIsLoading(false));
    }
  }, [open, activeWorkspaceId, user, targetNodeId, toast]);

  const handleAccept = async (suggestion: AiLinkSuggestion) => {
    if (!activeWorkspaceId || !user || !targetNodeId) return;

    const key = `${suggestion.fromObjectId}->${suggestion.toObjectId}`;
    setAcceptedIds((prev) => new Set(prev).add(key));

    const targetObj = nodes.find((n) => n.id === suggestion.toObjectId);

    try {
      const res = await createKnowledgeRelationAction(
        activeWorkspaceId,
        user.uid,
        user.displayName || 'AI Linking Agent',
        {
          fromObjectId: suggestion.fromObjectId,
          fromObjectType: targetNode?.type || 'note',
          toObjectId: suggestion.toObjectId,
          toObjectType: targetObj?.type || 'note',
          relationType: suggestion.relationType,
          confidence: suggestion.confidenceScore,
          source: 'ai',
          metadata: {
            aiReasoning: suggestion.reasoning,
            evidenceQuotes: suggestion.evidenceQuotes,
          },
        }
      );

      if (res.success) {
        toast({
          title: 'Link confirmed',
          description: `Established "${getRelationDisplayLabel(suggestion.relationType)}" connection.`,
        });
        onSuggestionAccepted();
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to establish link',
          description: res.error,
        });
      }
    } catch (err) {
      console.error('[AiLinkSuggestionsDialog] Error:', err);
    }
  };

  const handleDismiss = (suggestion: AiLinkSuggestion) => {
    const key = `${suggestion.fromObjectId}->${suggestion.toObjectId}`;
    setDismissedIds((prev) => new Set(prev).add(key));
  };

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedIds.has(`${s.fromObjectId}->${s.toObjectId}`)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-violet-700 dark:text-violet-300">
            <Sparkles className="w-5 h-5 text-violet-500" />
            AI Discovered Relationships
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Semantic connections detected between <strong className="text-foreground">{targetNode?.label}</strong> and
            relevant organizational knowledge.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
              <span>Analyzing knowledge semantics and evidence quotes…</span>
            </div>
          ) : visibleSuggestions.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-xs space-y-1">
              <p className="font-medium text-foreground">No new relationships detected.</p>
              <p>The AI didn&apos;t find strong evidence-backed connections above the confidence threshold.</p>
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
              {visibleSuggestions.map((s) => {
                const key = `${s.fromObjectId}->${s.toObjectId}`;
                const isAccepted = acceptedIds.has(key);

                return (
                  <div
                    key={key}
                    className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                      isAccepted
                        ? 'bg-emerald-50/50 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : 'bg-card border-border hover:border-violet-300 dark:hover:border-violet-800 shadow-xs'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-semibold text-violet-800 bg-violet-100 dark:bg-violet-950 dark:text-violet-300 border-violet-200"
                        >
                          {getRelationDisplayLabel(s.relationType)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {Math.round(s.confidenceScore * 100)}% match
                        </Badge>
                      </div>

                      {isAccepted ? (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Added
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDismiss(s)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                          >
                            <X className="w-3.5 h-3.5 mr-1" /> Dismiss
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => handleAccept(s)}
                            className="h-7 px-2.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Connect
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Target Title */}
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{s.toObjectTitle || 'Connected Record'}</span>
                    </p>

                    {/* Reasoning */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {s.reasoning}
                    </p>

                    {/* Evidence Quotes */}
                    {s.evidenceQuotes && s.evidenceQuotes.length > 0 && (
                      <div className="p-2 bg-muted/40 rounded-lg text-[11px] text-muted-foreground/90 space-y-1">
                        <span className="font-semibold text-foreground flex items-center gap-1 text-[10px] uppercase">
                          <Quote className="w-2.5 h-2.5" /> Evidence Quote
                        </span>
                        <p className="italic line-clamp-2">&quot;{s.evidenceQuotes[0]}&quot;</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-9 text-xs"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
