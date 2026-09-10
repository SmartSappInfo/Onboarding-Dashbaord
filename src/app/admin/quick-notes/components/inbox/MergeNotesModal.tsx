'use client';

import * as React from 'react';
import {
  GitMerge,
  X,
  Loader2,
  FileText,
  CheckCircle2,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import type { KnowledgeInboxItem, MergeStrategy } from '@/lib/quick-notes-types';
import { mergeDuplicateNotesAction } from '@/lib/quick-notes-insight-actions';

interface MergeNotesModalProps {
  item: KnowledgeInboxItem | null;
  workspaceId: string;
  userId: string;
  open: boolean;
  onClose: () => void;
  onMergedSuccess: () => void;
}

export function MergeNotesModal({
  item,
  workspaceId,
  userId,
  open,
  onClose,
  onMergedSuccess,
}: MergeNotesModalProps) {
  const { toast } = useToast();
  const [strategy, setStrategy] = React.useState<MergeStrategy>('concatenate');
  const [isMerging, setIsMerging] = React.useState(false);

  if (!open || !item || !item.duplicateDetails) return null;

  const sourceTitle = item.sourceKnowledgeTitle || 'Source Note';
  const candidateTitle = item.duplicateDetails.candidateTitle || 'Candidate Note';

  const handleExecuteMerge = async () => {
    setIsMerging(true);
    try {
      const res = await mergeDuplicateNotesAction(
        workspaceId,
        item.sourceKnowledgeId,
        item.duplicateDetails!.candidateNoteId,
        strategy,
        userId
      );

      if (res.success) {
        toast({
          title: 'Notes Merged Successfully',
          description: `Combined into "${candidateTitle}". Source note soft-archived.`,
        });
        onMergedSuccess();
        onClose();
      } else {
        toast({
          title: 'Failed to merge notes',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error executing merge', variant: 'destructive' });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col justify-between">
        {/* Modal Header */}
        <div className="p-5 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <GitMerge className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Merge Duplicate Notes</h2>
              <p className="text-xs text-muted-foreground">Unify duplicate records without losing historical data</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-lg">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Note A (Source) */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Source Note (To Archive)
              </span>
              <h4 className="text-xs font-bold text-foreground line-clamp-2">{sourceTitle}</h4>
              <p className="text-[11px] text-muted-foreground line-clamp-3">
                {item.evidence[0]?.textSnippet || 'Content will be combined into destination note.'}
              </p>
            </div>

            {/* Note B (Destination) */}
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Target Destination (Retained)
              </span>
              <h4 className="text-xs font-bold text-foreground line-clamp-2">{candidateTitle}</h4>
              <p className="text-[11px] text-muted-foreground line-clamp-3">
                {item.duplicateDetails.candidateSnippet || 'Retains primary title, tags, and incoming relations.'}
              </p>
            </div>
          </div>

          {/* Merge Strategy Options */}
          <div className="space-y-3">
            <Label className="text-xs font-bold text-foreground">Select Merging Strategy</Label>
            <RadioGroup
              value={strategy}
              onValueChange={(val) => setStrategy(val as MergeStrategy)}
              className="space-y-2"
            >
              <div
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  strategy === 'concatenate' ? 'border-primary bg-primary/5' : 'border-border/70 hover:bg-muted/30'
                }`}
                onClick={() => setStrategy('concatenate')}
              >
                <RadioGroupItem value="concatenate" id="s-concat" className="mt-0.5" />
                <div className="space-y-0.5">
                  <Label htmlFor="s-concat" className="text-xs font-bold text-foreground cursor-pointer">
                    Full Content Concatenation (Recommended)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Combines text from both notes separated by a clean section divider. Unions all CRM tags and links.
                  </p>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  strategy === 'append_summary' ? 'border-primary bg-primary/5' : 'border-border/70 hover:bg-muted/30'
                }`}
                onClick={() => setStrategy('append_summary')}
              >
                <RadioGroupItem value="append_summary" id="s-summary" className="mt-0.5" />
                <div className="space-y-0.5">
                  <Label htmlFor="s-summary" className="text-xs font-bold text-foreground cursor-pointer">
                    Append as &quot;Merged Findings&quot; Heading
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Places the source note&apos;s contents under a designated sub-heading at the bottom of the destination note.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Safety Guarantee Notice */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-2.5 text-xs text-muted-foreground">
            <Archive className="h-4 w-4 text-primary shrink-0" />
            <span>
              Zero data loss: The source note will be marked as <strong>Archived</strong> with a backlink, never deleted.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs font-semibold">
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleExecuteMerge}
            disabled={isMerging}
            className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm active:scale-[0.98]"
          >
            {isMerging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
            Execute Merge & Archive Source
          </Button>
        </div>
      </div>
    </div>
  );
}
