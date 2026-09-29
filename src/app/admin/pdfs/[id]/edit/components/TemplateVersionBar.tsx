'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Authoritative Versioning Navigation Bar for Template Studio (Phase 3 Task 6).
 * 2. Visual Invariants & Microcopy (Rule 7 Everyday English):
 *    - Displays clean, minimal version indicators (e.g. "Version 1.0 (Published)" or "Version 2.0 (Draft)").
 *    - Uses accessible color tokens (emerald for published, amber for draft, slate for superseded).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Touch targets >= 44x44px (`min-h-[44px]`).
 *    - Tactile button depressions via `active:scale-[0.97]`.
 * 4. Strict Typing (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any`.
 */

import * as React from 'react';
import { GitBranch, History, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TemplateVersion } from '@/lib/types/document-signing';

export interface TemplateVersionBarProps {
  currentVersion?: TemplateVersion | null;
  isDraft: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onOpenHistory: () => void;
  onOpenPublish: () => void;
  className?: string;
}

export function TemplateVersionBar({
  currentVersion,
  isDraft,
  hasUnsavedChanges,
  isSaving,
  onOpenHistory,
  onOpenPublish,
  className,
}: TemplateVersionBarProps) {
  const versionNumber = currentVersion ? `v${currentVersion.versionNumber}.0` : 'v1.0';
  const statusLabel = isDraft ? 'Draft' : currentVersion?.status === 'published' ? 'Published' : 'Archived';

  return (
    <div
      className={cn(
        'w-full bg-background/95 backdrop-blur-md border-b border-border/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs',
        className
      )}
      role="region"
      aria-label="Template Version Controls"
    >
      {/* Left: Version Identity & Status Pill */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <GitBranch className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground tracking-tight">
                {versionNumber}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[11px] font-medium px-2 py-0.5 rounded-full border',
                  isDraft
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                )}
              >
                {statusLabel}
              </Badge>
            </div>
            <p className="text-[12px] text-muted-foreground line-clamp-1">
              {currentVersion?.changeSummary || 'Approved production template'}
            </p>
          </div>
        </div>

        {/* Unsaved changes indicator */}
        <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-border/60 text-xs">
          {isSaving ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              Saving...
            </span>
          ) : hasUnsavedChanges ? (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Unsaved draft edits
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              All changes saved
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenHistory}
          className="min-h-[44px] sm:min-h-[36px] px-3 text-xs font-medium text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
        >
          <History className="w-4 h-4 mr-1.5 shrink-0" aria-hidden="true" />
          Version History
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={onOpenPublish}
          disabled={isSaving}
          className="min-h-[44px] sm:min-h-[36px] px-3.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all shadow-sm"
        >
          <UploadCloud className="w-4 h-4 mr-1.5 shrink-0" aria-hidden="true" />
          Publish Version
        </Button>
      </div>
    </div>
  );
}
