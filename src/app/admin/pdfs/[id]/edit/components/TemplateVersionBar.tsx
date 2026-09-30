'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Authoritative Title & Workflow Bar for Template Studio.
 *    Displays the document's internal name with inline pencil editing,
 *    an ultra-thin workflow step navigator (Details -> Builder -> Publish),
 *    and action buttons (Version History, Publish Version).
 * 2. Visual Invariants & User Specifications:
 *    - Hosts internal document name (no version number v1.0, removed "Approved production template").
 *    - Inline pencil editing allows renaming directly in the header.
 *    - Thinner stepper embedded in the title bar replaces the bulky page-body stepper.
 * 3. Mobile-First & Accessibility (Rule 7):
 *    - Touch targets >= 44x44px (`min-h-[44px]` on mobile).
 *    - Tactile micro-interactions via `active:scale-[0.97]`.
 * 4. Strict Typing (Rule 4 Zero-Tolerance Typing):
 *    - Strictly zero `any`.
 */

import * as React from 'react';
import { 
  FileText, 
  Pencil, 
  Check, 
  X, 
  ChevronRight, 
  History, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { TemplateVersion } from '@/lib/types/document-signing';

export interface TemplateVersionBarProps {
  documentName: string;
  onDocumentNameChange?: (name: string) => void;
  isDraft: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  currentStep: number;
  onStepClick: (step: number) => void;
  onOpenHistory: () => void;
  onOpenPublish: () => void;
  currentVersion?: TemplateVersion | null;
  className?: string;
}

const STEPS = [
  { stepNum: 1, name: 'Details' },
  { stepNum: 2, name: 'Builder' },
  { stepNum: 3, name: 'Publish' },
];

export function TemplateVersionBar({
  documentName,
  onDocumentNameChange,
  isDraft,
  hasUnsavedChanges,
  isSaving,
  currentStep,
  onStepClick,
  onOpenHistory,
  onOpenPublish,
  className,
}: TemplateVersionBarProps) {
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [tempName, setTempName] = React.useState(documentName);

  React.useEffect(() => {
    setTempName(documentName);
  }, [documentName]);

  const handleSaveName = () => {
    const trimmed = tempName.trim();
    if (trimmed && onDocumentNameChange && trimmed !== documentName) {
      onDocumentNameChange(trimmed);
    } else {
      setTempName(documentName);
    }
    setIsEditingName(false);
  };

  const handleCancelName = () => {
    setTempName(documentName);
    setIsEditingName(false);
  };

  return (
    <div
      className={cn(
        'w-full bg-background/95 backdrop-blur-md border-b border-border/60 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-xs min-h-[52px]',
        className
      )}
      role="region"
      aria-label="Document Title & Workflow Bar"
    >
      {/* Left: Document Name with Pencil Editing & Status Badge */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" aria-hidden="true" />
        </div>

        {isEditingName ? (
          <div className="flex items-center gap-1.5">
            <Input
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') handleCancelName();
              }}
              className="h-8 text-xs font-semibold px-2 w-44 sm:w-64 rounded-lg bg-background border-primary/50"
              placeholder="Document name..."
            />
            <button
              type="button"
              onClick={handleSaveName}
              title="Save name"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={handleCancelName}
              title="Cancel"
              className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted text-muted-foreground active:scale-[0.97] transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-sm font-semibold text-foreground tracking-tight truncate max-w-[150px] sm:max-w-[220px] md:max-w-[280px]"
              title={documentName || 'Untitled Document'}
            >
              {documentName || 'Untitled Document'}
            </span>

            {onDocumentNameChange && (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                title="Rename document"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-[0.97] transition-all"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}

            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                isDraft
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
              )}
            >
              {isDraft ? 'Draft' : 'Published'}
            </Badge>
          </div>
        )}

        {/* Unsaved changes / Saved indicator */}
        <div className="hidden xl:flex items-center gap-1.5 pl-3 border-l border-border/60 text-xs">
          {isSaving ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              Saving...
            </span>
          ) : hasUnsavedChanges ? (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Unsaved edits
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              All changes saved
            </span>
          )}
        </div>
      </div>

      {/* Center: Thinner Workflow Stepper */}
      <nav
        aria-label="Workflow Steps"
        className="flex items-center bg-muted/40 p-0.5 rounded-xl border border-border/60 gap-0.5"
      >
        {STEPS.map((stepItem, idx) => {
          const isActive = currentStep === stepItem.stepNum;
          const isCompleted = currentStep > stepItem.stepNum;
          return (
            <React.Fragment key={stepItem.name}>
              <button
                type="button"
                onClick={() => onStepClick(stepItem.stepNum)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all select-none min-h-[32px] active:scale-[0.97]',
                  isActive
                    ? 'bg-background text-primary font-semibold shadow-xs ring-1 ring-border/50'
                    : isCompleted
                    ? 'text-primary/90 hover:text-primary hover:bg-background/50'
                    : 'text-muted-foreground/60 hover:text-foreground/80'
                )}
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted-foreground/20 text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : stepItem.stepNum}
                </span>
                <span className="hidden sm:inline">{stepItem.name}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" aria-hidden="true" />
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenHistory}
          className="min-h-[44px] sm:min-h-[34px] px-3 text-xs font-medium text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
        >
          <History className="w-4 h-4 mr-1.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Version History</span>
          <span className="sm:hidden">History</span>
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={onOpenPublish}
          disabled={isSaving}
          className="min-h-[44px] sm:min-h-[34px] px-3.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all shadow-sm"
        >
          <UploadCloud className="w-4 h-4 mr-1.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Publish Version</span>
          <span className="sm:hidden">Publish</span>
        </Button>
      </div>
    </div>
  );
}
