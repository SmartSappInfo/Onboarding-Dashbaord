'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Slide-over Drawer for inspecting historical template versions (Phase 3 Task 6).
 * 2. Visual Invariants & Everyday Microcopy (Rule 7 Minimal Text):
 *    Displays chronological audit records of approved template versions with
 *    author timestamps, field counts, and change summaries.
 * 3. Emil Kowalski Micro-Interactions:
 *    Tactile controls with `active:scale-[0.97]` and smooth sliding transitions.
 * 4. Strict Typing (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any`.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitBranch, Clock, User, History, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TemplateVersion } from '@/lib/types/document-signing';

export interface VersionHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: TemplateVersion[];
  currentVersionId?: string;
  onSelectVersion?: (version: TemplateVersion) => void;
}

export function VersionHistoryDrawer({
  open,
  onOpenChange,
  versions,
  currentVersionId,
  onSelectVersion,
}: VersionHistoryDrawerProps) {
  // Sort descending by version number
  const sortedVersions = React.useMemo(() => {
    return [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  }, [versions]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col bg-background"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <History className="w-4 h-4" />
            </div>
            <SheetTitle className="text-base font-semibold text-foreground">
              Version History
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Browse all historical approved versions and draft revisions for this template.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {sortedVersions.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <GitBranch className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-foreground">No versions found</p>
              <p className="text-[11px] text-muted-foreground">
                Publishing your first revision will create Version 1.0.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedVersions.map((version) => {
                const isSelected = version.id === currentVersionId;
                const isPublished = version.status === 'published';
                const isSuperseded = version.status === 'superseded';
                const isDraft = version.status === 'draft';

                return (
                  <div
                    key={version.id}
                    className={cn(
                      'rounded-xl border p-4 transition-all duration-200 space-y-3 relative',
                      isSelected
                        ? 'border-primary/60 bg-primary/5 shadow-xs ring-1 ring-primary/30'
                        : 'border-border/60 bg-card hover:border-border'
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground tracking-tight">
                          Version {version.versionNumber}.0
                        </span>
                        {isSelected && (
                          <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0.5">
                            Active
                          </Badge>
                        )}
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                          isPublished && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
                          isSuperseded && 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30',
                          isDraft && 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                        )}
                      >
                        {isPublished ? 'Published' : isSuperseded ? 'Superseded' : 'Draft'}
                      </Badge>
                    </div>

                    {/* Change Note */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {version.changeSummary || 'Approved production release.'}
                    </p>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground/70" />
                        <span>
                          {new Date(version.publishedAt || version.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-muted-foreground/70" />
                        <span>{version.fields.length} fields</span>
                      </div>

                      {version.createdBy && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-muted-foreground/70" />
                          <span className="truncate max-w-[100px]">{version.createdBy}</span>
                        </div>
                      )}
                    </div>

                    {onSelectVersion && !isSelected && (
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectVersion(version)}
                          className="w-full h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 active:scale-[0.97]"
                        >
                          View Fields
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
