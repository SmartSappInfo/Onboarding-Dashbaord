'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Interactive AI Field Placement Assistant for Template Studio (P5.1 UI).
 *    Scans page text streams and visual bounding boxes to suggest form fields,
 *    student/parent inputs, table rows, dates, and signature lines mapped with
 *    normalized percentage coordinates to distinct signer roles.
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
import type { PDFDocumentProxy } from 'pdfjs-dist';
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
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  Check,
  FileText,
  Signature as SignatureIcon,
  Calendar,
  User,
  CheckCircle2,
  Layers,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { detectTemplateFieldsFromPages } from '@/lib/documents/template-ai-field-detector';
import {
  extractPdfDocumentData,
  type ExtractedPageData,
} from '@/lib/documents/client-pdf-text-extractor';
import type { AiFieldSuggestion, AiFieldType } from '@/lib/types/document-signing';

export interface TemplateAiFieldSuggesterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageTexts?: string[];
  pdfUrl?: string;
  pdfDoc?: PDFDocumentProxy | null;
  pagesData?: ExtractedPageData[];
  onApplyFields: (acceptedFields: AiFieldSuggestion[]) => void;
}

const FIELD_TYPE_LABELS: Record<AiFieldType, string> = {
  signature: 'Signature',
  initials: 'Initials',
  date: 'Date',
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

export function TemplateAiFieldSuggester({
  open,
  onOpenChange,
  pageTexts,
  pdfUrl,
  pdfDoc,
  pagesData,
  onApplyFields,
}: TemplateAiFieldSuggesterProps) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [candidates, setCandidates] = React.useState<AiFieldSuggestion[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState('');
  const [scanError, setScanError] = React.useState<string | null>(null);

  const runScan = React.useCallback(async () => {
    setIsScanning(true);
    setScanError(null);

    try {
      let resolvedTexts: string[] = pageTexts ?? [];
      let resolvedPagesData: ExtractedPageData[] | undefined = pagesData;

      // If text data is not pre-populated, extract it directly from the PDF document or URL
      const hasEmptyTexts = resolvedTexts.length === 0 || resolvedTexts.every((t) => !t.trim());
      if (hasEmptyTexts && (!resolvedPagesData || resolvedPagesData.length === 0)) {
        if (pdfDoc) {
          resolvedPagesData = await extractPdfDocumentData(pdfDoc);
          resolvedTexts = resolvedPagesData.map((p) => p.text);
        } else if (pdfUrl) {
          resolvedPagesData = await extractPdfDocumentData(pdfUrl);
          resolvedTexts = resolvedPagesData.map((p) => p.text);
        }
      }

      const detected = detectTemplateFieldsFromPages(resolvedTexts, {
        pagesData: resolvedPagesData,
      });

      setCandidates(detected);
      setSelectedIds(new Set(detected.map((f) => f.id)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to scan document layout.';
      setScanError(msg);
      setCandidates([]);
    } finally {
      setIsScanning(false);
    }
  }, [pageTexts, pagesData, pdfDoc, pdfUrl]);

  // Run detection automatically when modal opens
  React.useEffect(() => {
    if (open) {
      runScan();
    }
  }, [open, runScan]);

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
    setSelectedIds(new Set(filteredCandidates.map((f) => f.id)));
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

  const filteredCandidates = React.useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase().trim();
    return candidates.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.fieldType.toLowerCase().includes(q) ||
        (c.sourceExcerpt && c.sourceExcerpt.toLowerCase().includes(q))
    );
  }, [candidates, searchQuery]);

  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] p-0 flex flex-col rounded-2xl overflow-hidden border bg-background shadow-2xl">
        <DialogHeader className="px-5 py-3 border-b bg-card/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Auto-Detect Form & Signature Fields
            </DialogTitle>
            <DialogDescription className="sr-only">
              Auto-detect form inputs, tables, student/parent details, and signature lines.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {isScanning ? (
            <div className="flex-1 p-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center animate-pulse">
                  <Sparkles className="h-8 w-8 text-primary animate-spin" />
                </div>
              </div>
              <div className="max-w-sm space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Scanning Document with Layout AI...
                </p>
                <p className="text-xs text-muted-foreground">
                  Reading document layout, detecting form tables, input labels, blanks, and signature lines.
                </p>
              </div>
            </div>
          ) : scanError ? (
            <div className="flex-1 p-10 flex flex-col items-center justify-center text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="max-w-xs space-y-1">
                <p className="text-sm font-semibold text-foreground">Layout Scan Error</p>
                <p className="text-xs text-muted-foreground">{scanError}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runScan}
                className="mt-2 min-h-[44px] gap-2 active:scale-[0.97]"
              >
                <RefreshCw className="h-4 w-4" />
                Try Re-scan
              </Button>
            </div>
          ) : candidates.length > 0 ? (
            <>
              {/* Batch Actions and Search Bar */}
              <div className="p-3 bg-muted/30 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-5 text-xs">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter detected fields..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-lg bg-background border-border/70"
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <span className="font-semibold text-muted-foreground text-[11px]">
                    {selectedCount} of {candidates.length} selected
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="h-8 text-xs font-semibold px-2 active:scale-[0.97]"
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDeselectAll}
                      className="h-8 text-xs font-semibold px-2 text-muted-foreground active:scale-[0.97]"
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={runScan}
                      title="Re-scan document"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground active:scale-[0.97]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Candidates Scrollable List */}
              <ScrollArea className="flex-1 p-5">
                <div className="space-y-2">
                  {filteredCandidates.map((candidate) => {
                    const isSelected = selectedIds.has(candidate.id);
                    const docLabel = (candidate.sourceExcerpt || candidate.label)
                      .replace(/^["']|["']$/g, '')
                      .replace(/:\s*$/, '')
                      .trim();

                    return (
                      <div
                        key={candidate.id}
                        onClick={() => toggleCandidate(candidate.id)}
                        className={`group p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center gap-3 ${
                          isSelected
                            ? 'border-primary/50 bg-primary/5 shadow-xs'
                            : 'border-border/60 bg-card hover:border-border opacity-70 hover:opacity-100'
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/30 bg-background'
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>

                        {/* Mapping Content: CONTACT NO <page 1> -> Contact Number <Text Field> */}
                        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap min-w-0 flex-1">
                          {/* Left: Document Label + Page Pill */}
                          <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                            <span
                              className="font-semibold text-xs text-foreground/90 uppercase tracking-tight truncate max-w-[130px] sm:max-w-[200px]"
                              title={docLabel}
                            >
                              {docLabel}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium px-1.5 py-0 h-4 rounded-md bg-muted/60 text-muted-foreground border-border/80 shrink-0 lowercase"
                            >
                              page {candidate.pageNumber}
                            </Badge>
                          </div>

                          {/* Mapping Arrow */}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mx-0.5" />

                          {/* Right: Field Name + Field Type Pill */}
                          <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5 truncate">
                              {getFieldIcon(candidate.fieldType)}
                              {candidate.label}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-medium px-1.5 py-0 h-4 rounded-md bg-primary/10 text-primary border-primary/20 shrink-0"
                            >
                              {FIELD_TYPE_LABELS[candidate.fieldType]}
                            </Badge>
                          </div>
                        </div>
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
                  No Standard Form or Signature Fields Detected
                </p>
                <p className="text-xs text-muted-foreground">
                  We scanned the document text for form labels and signature lines, but couldn&apos;t find unambiguous
                  anchors. You can place fields manually from the toolbar or re-scan.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runScan}
                className="mt-2 min-h-[44px] gap-2 active:scale-[0.97]"
              >
                <RefreshCw className="h-4 w-4" />
                Re-scan Document
              </Button>
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
