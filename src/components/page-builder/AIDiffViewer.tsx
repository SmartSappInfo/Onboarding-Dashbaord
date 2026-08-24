'use client';

/**
 * @file src/components/page-builder/AIDiffViewer.tsx
 * @description Visual Diff Viewer & Floating Action Bar for AI Change Sets in SmartSapp Page Builder.
 * Highlights added, modified, and deleted sections/blocks with color badges (green/amber/red).
 * Provides mobile-friendly touch targets (`min-h-[44px]`) and approve/reject/refine controls.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Mobile Touch Target Optimization (`min-h-[44px]`).
 * - Accessible focus outlines and visual active states.
 */

import React, { useState } from 'react';
import type { AIChangeSet } from '@/lib/types';
import { Check, X, Sparkles, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

export interface AIDiffViewerProps {
  changeSet: AIChangeSet;
  onApprove: () => void;
  onReject: () => void;
  onRefine?: (feedback: string) => void;
}

export const AIDiffViewer: React.FC<AIDiffViewerProps> = ({
  changeSet,
  onApprove,
  onReject,
  onRefine,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [refineFeedback, setRefineFeedback] = useState<string>('');
  const [showRefineInput, setShowRefineInput] = useState<boolean>(false);

  const { diff, prompt } = changeSet;

  const handleRefineSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (refineFeedback.trim() && onRefine) {
      onRefine(refineFeedback.trim());
      setRefineFeedback('');
      setShowRefineInput(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full px-4 sm:px-0">
      <div className="bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-4 transition-all duration-200 ease-out">
        {/* Header summary bar */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="w-4 h-4" />
            </span>
            <span>AI Suggested Changes</span>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-[0.97] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={isExpanded ? 'Collapse diff details' : 'Expand diff details'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Prompt summary */}
        <p className="mt-2 text-xs text-muted-foreground italic line-clamp-2">
          &ldquo;{prompt}&rdquo;
        </p>

        {/* Expanded Diff Badges & Details */}
        {isExpanded && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {diff.addedSectionCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                  +{diff.addedSectionCount} Section{diff.addedSectionCount > 1 ? 's' : ''}
                </span>
              )}
              {diff.modifiedSectionCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                  {diff.modifiedSectionCount} Modified Section{diff.modifiedSectionCount > 1 ? 's' : ''}
                </span>
              )}
              {diff.deletedSectionCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
                  -{diff.deletedSectionCount} Section{diff.deletedSectionCount > 1 ? 's' : ''}
                </span>
              )}
              {diff.addedBlockCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                  +{diff.addedBlockCount} Block{diff.addedBlockCount > 1 ? 's' : ''}
                </span>
              )}
              {diff.modifiedBlockCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                  {diff.modifiedBlockCount} Modified Block{diff.modifiedBlockCount > 1 ? 's' : ''}
                </span>
              )}
              {!diff.hasChanges && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <AlertCircle className="w-3.5 h-3.5" /> No structural changes detected
                </span>
              )}
            </div>

            {/* Optional Refine Text Area */}
            {showRefineInput && (
              <form onSubmit={handleRefineSubmit} className="mt-2 space-y-2">
                <input
                  type="text"
                  value={refineFeedback}
                  onChange={(e) => setRefineFeedback(e.target.value)}
                  placeholder="Tell AI what to refine (e.g. make CTA button orange)..."
                  className="w-full text-xs px-3 py-2 min-h-[44px] rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRefineInput(false)}
                    className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!refineFeedback.trim()}
                    className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg font-medium min-h-[44px] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Send Refinement
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Action Button Bar */}
        <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-border/50">
          <button
            type="button"
            onClick={onReject}
            className="flex-1 min-h-[44px] px-3 py-2 flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-[0.97] transition-all text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <X className="w-4 h-4" /> Reject
          </button>

          {onRefine && !showRefineInput && (
            <button
              type="button"
              onClick={() => setShowRefineInput(true)}
              className="flex-1 min-h-[44px] px-3 py-2 flex items-center justify-center gap-1.5 rounded-xl border border-border text-foreground hover:bg-muted active:scale-[0.97] transition-all text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Refine
            </button>
          )}

          <button
            type="button"
            onClick={onApprove}
            className="flex-1 min-h-[44px] px-3 py-2 flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all text-xs font-semibold shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Check className="w-4 h-4" /> Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
