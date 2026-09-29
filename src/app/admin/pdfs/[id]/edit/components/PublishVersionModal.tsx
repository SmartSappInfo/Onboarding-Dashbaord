'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Interactive Publication Modal for Document Templates (Phase 3 Task 6).
 * 2. Visual Preflight & Diff Inspection:
 *    Uses `diffTemplateVersions` to display added, removed, and modified fields
 *    before promoting a draft version to immutable publication.
 * 3. Everyday Minimal UI English (Rule 7 Minimal Text):
 *    No cryptographic or technical jargon. Simple labels like "Change summary",
 *    "New fields", "Modified fields", and "Publish Version".
 * 4. Strict Typing & Zero-`any` (Rule 4):
 *    Strictly zero `any`.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, Plus, Minus, Edit3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { publishTemplateVersionAction } from '@/lib/documents/contract-actions';
import { diffTemplateVersions, type TemplateVersionDiff } from '@/lib/documents/template-version-service';
import type { TemplateVersion } from '@/lib/types/document-signing';

export interface PublishVersionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  templateId: string;
  currentDraftVersion: TemplateVersion;
  previousPublishedVersion?: TemplateVersion | null;
  onSuccess: (publishedVersion: TemplateVersion) => void;
}

export function PublishVersionModal({
  open,
  onOpenChange,
  workspaceId,
  templateId,
  currentDraftVersion,
  previousPublishedVersion,
  onSuccess,
}: PublishVersionModalProps) {
  const { toast } = useToast();
  const [changeSummary, setChangeSummary] = React.useState('');
  const [isPublishing, setIsPublishing] = React.useState(false);

  // Compute diff if previous published version exists
  const diff: TemplateVersionDiff | null = React.useMemo(() => {
    if (!previousPublishedVersion) return null;
    return diffTemplateVersions(previousPublishedVersion, currentDraftVersion);
  }, [previousPublishedVersion, currentDraftVersion]);

  const targetVersionNumber = currentDraftVersion.versionNumber;
  const fieldsCount = currentDraftVersion.fields.length;
  const signatureFieldsCount = currentDraftVersion.fields.filter(
    (f) => f.type === 'signature'
  ).length;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;

    if (!changeSummary.trim()) {
      toast({
        title: 'Summary required',
        description: 'Please describe the changes in this version for audit records.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsPublishing(true);
      const res = await publishTemplateVersionAction({
        workspaceId,
        templateId,
        versionId: currentDraftVersion.id,
        changeSummary: changeSummary.trim(),
      });

      if (!res.success || !res.publishedVersion) {
        throw new Error(res.error || 'Failed to publish version.');
      }

      toast({
        title: `Version ${targetVersionNumber}.0 Published`,
        description: 'This version is now approved and active for new agreements.',
        actionConfig: {
          path: '/admin/finance/contracts',
          label: 'View Contracts',
        },
      });

      onSuccess(res.publishedVersion);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publication failed.';
      toast({
        title: 'Publishing Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden bg-background">
        <form onSubmit={handlePublish}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
                Release v{targetVersionNumber}.0
              </Badge>
              <span className="text-xs text-muted-foreground">Immutable Version</span>
            </div>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Publish Template Version
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Published versions are locked against edits to guarantee contract integrity. Future updates will automatically create a new draft.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {/* Version Preflight Inspection Card */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Total Form Fields</span>
                <span className="text-foreground font-semibold">{fieldsCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Signatures Required</span>
                <span className="text-foreground font-semibold">{signatureFieldsCount}</span>
              </div>

              {/* Field Diffs (if updating from previous version) */}
              {diff && (
                <div className="pt-2 border-t border-border/40 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                      <Plus className="w-3 h-3" />
                      {diff.addedFields.length}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Added</span>
                  </div>

                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center justify-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                      <Edit3 className="w-3 h-3" />
                      {diff.modifiedFields.length}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Modified</span>
                  </div>

                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <div className="flex items-center justify-center gap-1 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                      <Minus className="w-3 h-3" />
                      {diff.removedFields.length}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Removed</span>
                  </div>
                </div>
              )}

              {signatureFieldsCount === 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No signature fields found on this document.</span>
                </div>
              )}
            </div>

            {/* Change Summary Field */}
            <div className="space-y-2">
              <Label htmlFor="changeSummary" className="text-xs font-medium text-foreground">
                What changed in this version? <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="changeSummary"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g., Added counterparty signature block and updated payment milestone notice."
                rows={3}
                required
                className="text-xs resize-none min-h-[72px]"
              />
              <p className="text-[11px] text-muted-foreground">
                This note will be visible in the template audit log and contract version history.
              </p>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/50 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPublishing}
              className="min-h-[44px] sm:min-h-[36px] active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPublishing || !changeSummary.trim()}
              className="min-h-[44px] sm:min-h-[36px] px-4 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Publish Version v{targetVersionNumber}.0
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
