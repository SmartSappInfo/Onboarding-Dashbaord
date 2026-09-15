'use client';

/**
 * @fileOverview UrlDialog for DocumentUploader — Single Source of Truth
 *
 * 10-RULE COMPLIANCE HIGHLIGHTS:
 * - Rule 1 (Best Practices & Animations): Radix dialog overlay, active:scale-[0.97] press states.
 * - Rule 2 (Risk Analysis & Resilience): Real-time URL validation with user-friendly error hints.
 * - Rule 3 (Feature Impact & Regressions): Preserves capability to link external Google Sheets/Drive or cloud templates.
 * - Rule 4 (Strict Type-Safety): Zero 'any' or 'any[]'. Explicit UrlDialogProps interface.
 * - Rule 5 (Firebase Rules & Host Policy): Aligned with SAMPLE_FILE_ALLOWED_HOSTS allowlist.
 * - Rule 6 (Single Source of Truth): Reusable modal for attaching external cloud documents.
 * - Rule 7 (Mobile & A11y First): Touch targets >= 44px (min-h-[44px] h-11), autoFocus on URL input, clear labels.
 * - Rule 8 (Security & Protection): Strict host allowlist verification via isSafeSampleFileUrl (prevents SSRF/XSS).
 * - Rule 9 (High Scale & Load): Pure client component with local state sync on open.
 * - Rule 10 (Maintainer Guidance): ARCHITECTURAL NOTE explaining cloud document link attachment and validation.
 *
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Prompts author for a document link (Google Sheets/Drive, Dropbox, OneDrive, AWS S3, etc.)
 * with live allowlist validation and safe filename derivation.
 * All interactive buttons strictly maintain min-h-[44px] touch targets.
 *
 * @testability src/components/shared/document-uploader/__tests__/DocumentUploader.test.tsx
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { isSafeSampleFileUrl } from '@/lib/surveys/sample-file';
import { extractFileNameFromStorageUrl } from '@/lib/survey-response-utils';

export interface UrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (url: string, fileName?: string) => void;
  initialUrl?: string;
  initialFileName?: string;
}

export function UrlDialog({
  open,
  onOpenChange,
  onConfirm,
  initialUrl = '',
  initialFileName = '',
}: UrlDialogProps): React.ReactElement {
  const [url, setUrl] = useState(initialUrl);
  const [customName, setCustomName] = useState(initialFileName);

  useEffect(() => {
    if (open) {
      setUrl(initialUrl || '');
      setCustomName(initialFileName || '');
    }
  }, [open, initialUrl, initialFileName]);

  const trimmedUrl = url.trim();
  const isValid = trimmedUrl.length > 0 && isSafeSampleFileUrl(trimmedUrl);

  const handleConfirm = () => {
    if (!isValid) return;

    let derived = customName.trim();
    if (!derived) {
      if (trimmedUrl.includes('docs.google.com/spreadsheets')) {
        derived = 'Google_Sheet_Template.xlsx';
      } else if (trimmedUrl.includes('docs.google.com/document')) {
        derived = 'Google_Doc_Template.docx';
      } else {
        derived = extractFileNameFromStorageUrl(trimmedUrl) || 'Document_Link';
      }
    }

    onConfirm(trimmedUrl, derived);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border bg-background text-foreground max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirm();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <LinkIcon className="h-5 w-5" />
              <DialogTitle className="text-base font-bold tracking-tight">
                Attach Cloud Document Link
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Provide a share link for Google Sheets, Google Drive, Dropbox, OneDrive, AWS S3,
              or direct document download URL.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Document URL</Label>
              <Input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/... or https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-11 rounded-xl bg-muted/40 border-border/70 text-xs font-semibold focus-visible:ring-primary/30"
                autoFocus
              />
              {trimmedUrl.length > 0 && !isValid && (
                <div className="flex items-center gap-1.5 text-rose-500 text-[11px] font-medium pt-0.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Please enter a valid link from a supported provider (Google Drive/Docs, Dropbox, OneDrive, S3, or Cloudinary).
                  </span>
                </div>
              )}
              {isValid && (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium pt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Verified safe document provider</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Document Display Name <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                type="text"
                placeholder="e.g. Student_Roster_Template.xlsx"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="h-11 rounded-xl bg-muted/40 border-border/70 text-xs font-semibold focus-visible:ring-primary/30"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] h-11 text-xs font-bold rounded-xl active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid}
              className="min-h-[44px] h-11 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 active:scale-[0.97] transition-all"
            >
              Attach Document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
