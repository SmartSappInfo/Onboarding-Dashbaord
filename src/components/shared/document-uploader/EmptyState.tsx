'use client';

/**
 * @fileOverview EmptyState for DocumentUploader — Single Source of Truth
 *
 * 10-RULE COMPLIANCE HIGHLIGHTS:
 * - Rule 1 (Best Practices & Animations): Drag-and-drop feedback, active:scale-[0.97] press micro-interactions.
 * - Rule 2 (Risk Analysis & Resilience): Fallback text hints and safe file drop propagation.
 * - Rule 3 (Feature Impact & Regressions): Drop-in replacement for legacy single-string uploaders.
 * - Rule 4 (Strict Type-Safety): Zero 'any' or 'any[]'. Explicit EmptyStateProps interface.
 * - Rule 5 (Firebase Storage Compatibility): Directs file inputs to storage-compliant pipeline.
 * - Rule 6 (Single Source of Truth): Reusable empty dropzone used across all document upload flows.
 * - Rule 7 (Mobile & A11y First): Touch targets >= 44px (min-h-[44px]) across all breakpoints, keyboard enter/space trigger, full aria-label.
 * - Rule 8 (Security & Protection): Pure UI trigger without direct unescaped content execution.
 * - Rule 9 (High Scale & Load): Pure functional component without heavy state or unnecessary re-renders.
 * - Rule 10 (Maintainer Guidance): ARCHITECTURAL NOTE explaining drag-drop zone and source selection.
 *
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * This component provides the initial dropzone and primary action buttons (File Upload,
 * Media Library, Cloud Link). All interactive buttons must strictly maintain min-h-[44px]
 * touch targets to ensure mobile usability on touchscreen devices and compliance with WCAG 2.5.5.
 *
 * @testability src/components/shared/document-uploader/__tests__/DocumentUploader.test.tsx
 */

import React, { useState } from 'react';
import { Upload, FolderHeart, Link as LinkIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  onTriggerUpload: () => void;
  onOpenMedia: () => void;
  onOpenLink: () => void;
  onDropFiles: (file: File) => void;
  maxSizeMB: number;
  className?: string;
  allowedExtensionsHint?: string;
}

export function EmptyState({
  onTriggerUpload,
  onOpenMedia,
  onOpenLink,
  onDropFiles,
  maxSizeMB,
  className,
  allowedExtensionsHint = 'XLSX • CSV • PDF • DOCX • TXT',
}: EmptyStateProps): React.ReactElement {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onDropFiles(file);
    }
  };

  return (
    <div
      className={cn(
        'w-full rounded-2xl border-2 border-dashed transition-all duration-200 p-5 flex flex-col items-center justify-center gap-3 text-center cursor-pointer min-h-[170px]',
        isDragActive
          ? 'border-primary bg-primary/10 scale-[1.01] ring-4 ring-primary/20 shadow-md'
          : 'border-border/70 bg-muted/20 hover:border-primary/40 hover:bg-muted/30',
        className
      )}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={onTriggerUpload}
      role="button"
      tabIndex={0}
      aria-label="Upload document, choose from media library, or add link"
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTriggerUpload();
        }
      }}
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-105">
        <FileText className="w-5 h-5" />
      </div>

      <div className="space-y-0.5">
        <p className="text-xs font-bold text-foreground">
          Drag &amp; drop document or choose below
        </p>
        <p className="text-[10px] font-semibold text-muted-foreground">
          {allowedExtensionsHint} • Max {maxSizeMB}MB
        </p>
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-2 w-full pt-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          size="sm"
          onClick={onTriggerUpload}
          className="min-h-[44px] h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 px-4 shrink-0 active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload File</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenMedia}
          className="min-h-[44px] h-11 rounded-xl text-xs font-bold bg-card border-border/80 text-foreground hover:bg-accent gap-1.5 px-4 shrink-0 active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FolderHeart className="w-3.5 h-3.5 text-primary" />
          <span>Media Documents</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenLink}
          className="min-h-[44px] h-11 rounded-xl text-xs font-bold bg-card border-border/80 text-foreground hover:bg-accent gap-1.5 px-4 shrink-0 active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LinkIcon className="w-3.5 h-3.5 text-primary" />
          <span>Cloud Link</span>
        </Button>
      </div>
    </div>
  );
}
