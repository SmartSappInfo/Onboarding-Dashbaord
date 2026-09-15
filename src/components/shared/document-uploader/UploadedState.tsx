'use client';

/**
 * @fileOverview UploadedState for DocumentUploader — Single Source of Truth
 *
 * 10-RULE COMPLIANCE HIGHLIGHTS:
 * - Rule 1 (Best Practices & Animations): Type-tinted icons, active:scale-[0.97] press micro-interactions.
 * - Rule 2 (Risk Analysis & Resilience): Graceful fallback on missing storedName via URL decoder.
 * - Rule 3 (Feature Impact & Regressions): Preserves seamless drop-in parity for file-upload questions and layout blocks.
 * - Rule 4 (Strict Type-Safety): Zero 'any' or 'any[]'. Explicit UploadedStateProps interface.
 * - Rule 5 (Firebase Storage Compatibility): Reads and formats public Firebase Storage media download URLs.
 * - Rule 6 (Single Source of Truth): Reusable document display card with integrated replace and remove controls.
 * - Rule 7 (Mobile & A11y First): Strict >= 44px (min-h-[44px] min-w-[44px]) touch targets across all viewports, full aria-labels, focus-visible rings.
 * - Rule 8 (Security & Protection): Hardened with target="_blank" rel="noopener noreferrer" against tabnabbing.
 * - Rule 9 (High Scale & Load): Module-level hoisted regexes (TIMESTAMP_PREFIX_REGEX) per js-hoist-regexp.
 * - Rule 10 (Maintainer Guidance): ARCHITECTURAL NOTE explaining document format extraction and replacement actions.
 *
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Renders the chosen document with appropriate file type icon, metadata,
 * download/preview link, change options, and delete controls.
 * All interactive buttons must maintain min-h-[44px] and min-w-[44px] touch targets.
 *
 * @testability src/components/shared/document-uploader/__tests__/DocumentUploader.test.tsx
 */

import React, { useState } from 'react';
import {
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  FileImage,
  ExternalLink,
  Trash2,
  RefreshCw,
  Upload,
  FolderHeart,
  Link as LinkIcon,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface UploadedStateProps {
  url: string;
  fileName?: string;
  onTriggerUpload: () => void;
  onOpenMedia: () => void;
  onOpenLink: () => void;
  onRemove: () => void;
  className?: string;
}

const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
/** Hoisted module-level regex for stripping Unix timestamps and UUID prefixes from storage filenames (js-hoist-regexp) */
const UPLOAD_PREFIX_REGEX = /^(?:\d{10,14}(?:-[a-z0-9]{6})?|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[-_]/i;

function getExtension(nameOrUrl: string): string {
  try {
    const clean = nameOrUrl.split('?')[0];
    const dotIdx = clean.lastIndexOf('.');
    if (dotIdx > 0 && dotIdx < clean.length - 1) {
      return clean.slice(dotIdx).toLowerCase();
    }
  } catch {
    // fallback
  }
  return '';
}

function getDisplayFileName(url: string, storedName?: string): string {
  if (storedName && storedName.trim()) return storedName.trim();
  try {
    const decoded = decodeURIComponent(url);
    const path = decoded.split('?')[0];
    const segments = path.split('/');
    const last = segments[segments.length - 1];
    if (last) {
      // If starts with timestamp or UUID like 1740000000000-filename.xlsx or uuid-filename.xlsx
      return last.replace(UPLOAD_PREFIX_REGEX, '');
    }
  } catch {
    // fallback
  }
  return 'Attached Document';
}

function DocumentTypeIcon({ extension }: { extension: string }): React.ReactElement {
  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return (
      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <FileSpreadsheet className="h-5 w-5" />
      </div>
    );
  }
  if (extension === '.pdf') {
    return (
      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
        <FileText className="h-5 w-5" />
      </div>
    );
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return (
      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
        <FileImage className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs bg-primary/10 text-primary border border-primary/20">
      <FileIcon className="h-5 w-5" />
    </div>
  );
}

export function UploadedState({
  url,
  fileName,
  onTriggerUpload,
  onOpenMedia,
  onOpenLink,
  onRemove,
  className,
}: UploadedStateProps): React.ReactElement {
  const [isChanging, setIsChanging] = useState(false);
  const displayName = getDisplayFileName(url, fileName);
  const extension = getExtension(displayName) || getExtension(url);

  return (
    <div
      className={cn(
        'w-full rounded-2xl border border-border/80 bg-card/90 dark:bg-card/60 p-4 shadow-xs hover:border-primary/30 transition-all text-left space-y-3',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <DocumentTypeIcon extension={extension} />
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <p
                className="text-xs sm:text-sm font-bold text-foreground truncate"
                title={displayName}
              >
                {displayName}
              </p>
              {extension && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-muted text-muted-foreground uppercase border border-border/50 shrink-0">
                  {extension.replace('.', '').toUpperCase()}
                </span>
              )}
            </div>
            <p
              className="text-[10px] font-mono text-muted-foreground truncate"
              title={url}
            >
              {url}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {url && url !== '#' && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-ring"
              title="Open / Download Document"
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${displayName} in new tab`}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsChanging((prev) => !prev)}
            className="min-h-[44px] min-w-[44px] h-11 w-11 rounded-xl text-muted-foreground hover:text-primary active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-ring"
            title="Change Document Source"
            aria-label="Change Document Source"
          >
            {isChanging ? <X className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="min-h-[44px] min-w-[44px] h-11 w-11 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-destructive"
            title="Remove Document"
            aria-label="Remove Document"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isChanging && (
        <div className="pt-2.5 border-t border-border/50 flex flex-wrap items-center gap-2 animate-in fade-in duration-150">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Replace with:
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setIsChanging(false);
              onTriggerUpload();
            }}
            className="min-h-[44px] h-11 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 px-3.5 active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsChanging(false);
              onOpenMedia();
            }}
            className="min-h-[44px] h-11 text-xs font-bold rounded-xl border-border text-foreground hover:bg-accent gap-1.5 px-3.5 active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FolderHeart className="w-3.5 h-3.5 text-primary" />
            <span>Media Library</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsChanging(false);
              onOpenLink();
            }}
            className="min-h-[44px] h-11 text-xs font-bold rounded-xl border-border text-foreground hover:bg-accent gap-1.5 px-3.5 active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LinkIcon className="w-3.5 h-3.5 text-primary" />
            <span>Cloud Link</span>
          </Button>
        </div>
      )}
    </div>
  );
}
