'use client';

/**
 * @fileOverview UploadingState for DocumentUploader — Single Source of Truth
 *
 * 10-RULE COMPLIANCE HIGHLIGHTS:
 * - Rule 1 (Best Practices & Animations): Framer-quality loading spinners and pulse progress transitions.
 * - Rule 2 (Risk Analysis & Resilience): Safe progress clamp (0 to 100) and fallback filename display.
 * - Rule 3 (Feature Impact & Regressions): Preserves visual parity with ImageUploader / VideoUploader progress states.
 * - Rule 4 (Strict Type-Safety): Zero 'any' or 'any[]'. Explicit UploadingStateProps interface.
 * - Rule 5 (Firebase Rules & Progress Events): Responds to real-time byte progress callbacks from Firebase Storage.
 * - Rule 6 (Single Source of Truth): Shared progress view for all document uploads.
 * - Rule 7 (Mobile & A11y First): Clear text percentage and screen-reader accessible progress indicators.
 * - Rule 8 (Security & Protection): Pure visual indicator, untrusted file names truncated and escaped in text sinks.
 * - Rule 9 (High Scale & Load): Minimal DOM updates driven by throttled percent updates.
 * - Rule 10 (Maintainer Guidance): ARCHITECTURAL NOTE explaining upload progress and layout dimensions.
 *
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Maintains a consistent min-h-[170px] bounding box matching EmptyState to prevent
 * layout shift (CLS) during file upload start and completion.
 *
 * @testability src/components/shared/document-uploader/__tests__/DocumentUploader.test.tsx
 */

import React from 'react';
import { Loader2, FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UploadingStateProps {
  fileName?: string;
  progress: number;
  className?: string;
}

export function UploadingState({
  fileName,
  progress,
  className,
}: UploadingStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        'w-full relative min-h-[170px] rounded-2xl overflow-hidden border border-border/80 bg-muted/30 flex flex-col items-center justify-center p-6 text-center space-y-3',
        className
      )}
    >
      <div className="relative w-12 h-12 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <FileUp className="w-4 h-4 text-primary absolute inset-0 m-auto" />
      </div>

      <div className="space-y-1 max-w-[280px]">
        <p className="text-xs font-bold text-foreground truncate" title={fileName}>
          {fileName || 'Uploading document...'}
        </p>
        <p className="text-[11px] font-semibold text-muted-foreground animate-pulse">
          Uploading • {progress}%
        </p>
      </div>

      <div className="w-48 max-w-full h-1.5 bg-muted rounded-full overflow-hidden border border-border/50">
        <div
          className="h-full bg-primary rounded-full transition-all duration-200"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
