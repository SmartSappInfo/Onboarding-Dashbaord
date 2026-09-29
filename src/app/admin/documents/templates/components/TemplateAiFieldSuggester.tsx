'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Interactive AI Field Placement Assistant for Template Studio (P5.1 UI).
 *    Scans page text streams to suggest signature lines, names, dates, and initials
 *    mapped with normalized percentage coordinates to distinct signer roles.
 * 2. Mobile-First & Accessibility:
 *    - All touch controls strictly enforce `min-h-[44px]`.
 *    - Tactile micro-interactions (`active:scale-[0.97]`).
 *    - Everyday, human-friendly UI English terminology.
 * 3. Non-Destructive Invariant:
 *    - Candidates are held in local state until the author explicitly clicks
 *      "Apply All" or approves individual fields. Draft state is never mutated autonomously.
 * 4. Zero-Tolerance Typing (Rule 4):
 *    - Strictly 0 `any` or `any[]` throughout.
 */

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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Check,
  FileText,
  Signature as SignatureIcon,
  Calendar,
  User,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { detectTemplateFieldsFromPages } from '@/lib/documents/template-ai-field-detector';
import type { AiFieldSuggestion, AiFieldType, RecipientRole } from '@/lib/types/document-signing';

export interface TemplateAiFieldSuggesterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageTexts: string[];
  onApplyFields: (acceptedFields: AiFieldSuggestion[]) => void;
}

const FIELD_TYPE_LABELS: Record<AiFieldType, string> = {
  signature: 'Signature',
  initials: 'Initials',
  date: 'Date Signed',
  signer_name: 'Signer Name',
  text: 'Text Field',
  checkbox: 'Checkbox',
};

function getFieldIcon(type: AiFieldType): React.ReactElement {
  switch (type) {
    case 'signature':
      return <SignatureIcon className="h-4 w-4 text-primary" />;
    case 'initials':
      return <Layers className="h-4 w-4 text-indigo-500" />;
    case 'date':
      return <Calendar className="h-4 w-4 text-emerald-500" />;
    case 'signer_name':
      return <User className="h-4 w-4 text-blue-500" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function getConfidenceBadge(confidence: number): React.ReactElement {
  const pct = Math.round(confidence * 100);
  if (pct >= 90) {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-semibold py-0 h-4">
        {pct}% match
      </Badge>
    );
  }
  if (pct >= 80) {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] font-semibold py-0 h-4">
        {pct}% match
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-semibold py-0 h-4">
      {pct}% match
    </Badge>
  );
}

function getRoleBadge(role: RecipientRole): React.ReactElement {
  if (role === 'signer') {
    return (
      <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary">
        Primary Signer
      </Badge>
    );
  }
  if (role === 'countersigner') {
    return (
      <Badge variant="outline" className="text-[10px] font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400">
        Countersigner
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] font-semibold">
      {role}
    </Badge>
  );
}

export function TemplateAiFieldSuggester({
  open,
  onOpenChange,
  pageTexts,
  onApplyFields,
}: TemplateAiFieldSuggesterProps) {
  const [candidates, setCandidates] = React.useState<AiFieldSuggestion[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Run detection when modal opens or pages change
  React.useEffect(() => {
    if (!open) return;

    const detected = detectTemplateFieldsFromPages(pageTexts);
    setCandidates(detected);
    // Select all by default
    setSelectedIds(new Set(detected.map((f) => f.id)));
  }, [open, pageTexts]);

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(candidates.map((f) => f.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleApply = () => {
    const toApply = candidates
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({ ...c, accepted: true }));
    onApplyFields(toApply);
    onOpenChange(false);
  };

  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] p-0 flex flex-col rounded-2xl overflow-hidden border bg-background shadow-2xl">
        <DialogHeader className="p-5 border-b bg-card/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
                Auto-Detect Signature Fields
                <Badge variant="secondary" className="text-[10px] font-bold uppercase py-0 h-4">
                  Layout AI
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Automatically identifies signature lines, dates, and signer names in your document.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {candidates.length > 0 ? (
            <>
              {/* Batch Actions Bar */}
              <div className="p-3 bg-muted/30 border-b flex items-center justify-between text-xs px-5">
                <span className="font-semibold text-muted-foreground">
                  {selectedCount} of {candidates.length} fields selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-7 text-xs font-semibold px-2"
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectAll}
                    className="h-7 text-xs font-semibold px-2 text-muted-foreground"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {/* Candidates Scrollable List */}
              <ScrollArea className="flex-1 p-5">
                <div className="space-y-2.5">
                  {candidates.map((candidate) => {
                    const isSelected = selectedIds.has(candidate.id);
                    return (
                      <div
                        key={candidate.id}
                        onClick={() => toggleCandidate(candidate.id)}
                        className={`group p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-primary/50 bg-primary/5 shadow-sm'
                            : 'border-border/60 bg-card hover:border-border opacity-70'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`h-5 w-5 rounded-md border flex items-center justify-center mt-0.5 transition-colors ${
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-muted-foreground/30 bg-background'
                            }`}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                {getFieldIcon(candidate.fieldType)}
                                {candidate.label}
                              </span>
                              {getRoleBadge(candidate.recipientRole)}
                              {getConfidenceBadge(candidate.confidence)}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span>Page {candidate.pageNumber}</span>
                              <span>•</span>
                              <span>
                                Position: {candidate.leftPct.toFixed(0)}% X, {candidate.topPct.toFixed(0)}% Y
                              </span>
                              {candidate.sourceExcerpt && (
                                <>
                                  <span>•</span>
                                  <span className="italic truncate max-w-[200px]">
                                    &ldquo;{candidate.sourceExcerpt}&rdquo;
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                          {FIELD_TYPE_LABELS[candidate.fieldType]}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 p-10 flex flex-col items-center justify-center text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                <FileText className="h-6 w-6" />
              </div>
              <div className="max-w-xs space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  No Standard Signature Blocks Detected
                </p>
                <p className="text-xs text-muted-foreground">
                  We scanned the document text for signature lines, but couldn&apos;t find unambiguous
                  anchors. You can still place fields manually from the toolbar.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-card/40 flex items-center justify-between sm:justify-between gap-3 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] px-4 font-semibold text-xs active:scale-[0.97]"
          >
            Cancel
          </Button>

          {candidates.length > 0 && (
            <Button
              type="button"
              onClick={handleApply}
              disabled={selectedCount === 0}
              className="min-h-[44px] px-6 font-semibold text-xs shadow-md active:scale-[0.97] gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Apply {selectedCount} Field{selectedCount === 1 ? '' : 's'} to Canvas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
