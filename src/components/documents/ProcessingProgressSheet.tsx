'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Processing Progress UI:
 *    Real-time status sheet displaying live pipeline stages, percentage progress,
 *    and failure diagnostics for `DocumentProcessingJob` records (PRD Section 36).
 * 2. Emil Kowalski Animation Standards:
 *    Uses hardware-accelerated transforms, smooth spring progress transitions (<300ms),
 *    and glowing stage indicators.
 * 3. Mobile Ergonomics & Accessibility:
 *    All buttons and dismiss controls enforce `min-h-[44px]` touch target bounds.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState } from 'react';
import { 
  CheckCircle, AlertCircle, RefreshCw, Loader2, 
  FileText, Sparkles, Shield, Cpu, Layers 
} from 'lucide-react';
import type { 
  DocumentProcessingJob, 
  ProcessingJobType 
} from '@/lib/types/document-types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { retryFailedProcessingJobAction } from '@/lib/documents/processing-actions';
import { useToast } from '@/hooks/use-toast';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';

interface ProcessingProgressSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: DocumentProcessingJob | null;
  workspaceId: string;
  sourceUrl?: string;
  onReprocessComplete?: () => void;
}

const STAGES: { type: ProcessingJobType; label: string; icon: React.ElementType; description: string }[] = [
  {
    type: 'validate_source',
    label: 'Validating Source',
    icon: Shield,
    description: 'Verifying protocol security, MIME integrity, and host access.',
  },
  {
    type: 'detect_format',
    label: 'Format Detection',
    icon: FileText,
    description: 'Analyzing document structure, vector streams, and metadata.',
  },
  {
    type: 'extract_pages',
    label: 'Extracting Pages',
    icon: Layers,
    description: 'Extracting individual page spreads, bounding geometry, and ratios.',
  },
  {
    type: 'generate_thumbnails',
    label: 'Rendering & Thumbnails',
    icon: Cpu,
    description: 'Generating optimized raster previews and crisp grid thumbnails.',
  },
  {
    type: 'extract_text',
    label: 'Search Indexing',
    icon: Sparkles,
    description: 'Extracting searchable text tokens for in-reader keyword search.',
  },
  {
    type: 'finalize_document',
    label: 'Finalizing Document',
    icon: CheckCircle,
    description: 'Committing ready state to publication channels.',
  },
];

export function ProcessingProgressSheet({
  open,
  onOpenChange,
  job,
  workspaceId,
  sourceUrl,
  onReprocessComplete,
}: ProcessingProgressSheetProps) {
  const { toast } = useToast();
  const [isRetrying, setIsRetrying] = useState(false);

  if (!job) return null;

  const currentStageIndex = STAGES.findIndex((s) => s.type === job.jobType);
  const isFailed = job.status === 'failed';
  const isCompleted = job.status === 'completed' || job.progress === 100;

  const handleRetry = async () => {
    if (!sourceUrl) {
      toast({ variant: 'destructive', title: 'Source URL missing', description: 'Cannot retry without a valid source file URL.' });
      return;
    }

    setIsRetrying(true);
    try {
      const res = await retryFailedProcessingJobAction(job.id, workspaceId, sourceUrl);
      if (res.success) {
        toast({ title: 'Processing Restarted', description: 'The document processing job has been resumed.' });
        onReprocessComplete?.();
      } else {
        toast({ variant: 'destructive', title: 'Retry Failed', description: res.error || 'Could not resume job.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Network failure during retry.' });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 text-primary rounded-lg shadow-sm">
              <Cpu className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              Document Ingestion Pipeline
              <CardInfoTooltip text="Asynchronous multi-stage rendering, thumbnail generation, and search indexing." />
            </DialogTitle>
            <DialogDescription className="sr-only">
              Asynchronous multi-stage rendering, thumbnail generation, and search indexing.
            </DialogDescription>
          </div>
          <Badge 
            variant="outline"
            className={
              isCompleted
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-bold text-xs'
                : isFailed
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 font-bold text-xs'
                : 'border-primary/30 bg-primary/10 text-primary font-bold animate-pulse text-xs'
            }
          >
            {isCompleted ? 'Ready & Published' : isFailed ? 'Processing Failed' : `Processing • ${job.progress}%`}
          </Badge>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="text-foreground">{job.progress}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/40 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isFailed ? 'bg-rose-500' : isCompleted ? 'bg-emerald-500' : 'bg-primary'
                }`}
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

        {/* Stages Timeline */}
        <div className="space-y-3 py-3">
          {STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isStageCompleted = isCompleted || idx < currentStageIndex;
            const isStageActive = !isCompleted && idx === currentStageIndex && !isFailed;
            const isStageFailed = isFailed && idx === currentStageIndex;

            return (
              <div 
                key={stage.type}
                className={`flex items-start gap-3.5 p-3 rounded-2xl border transition-all duration-200 ${
                  isStageActive
                    ? 'border-primary/40 bg-primary/5 shadow-sm'
                    : isStageFailed
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : isStageCompleted
                    ? 'border-emerald-500/20 bg-emerald-500/5 opacity-80'
                    : 'border-transparent opacity-40'
                }`}
              >
                <div 
                  className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    isStageCompleted
                      ? 'bg-emerald-500/20 text-emerald-600'
                      : isStageFailed
                      ? 'bg-rose-500/20 text-rose-600'
                      : isStageActive
                      ? 'bg-primary/20 text-primary animate-pulse'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isStageCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : isStageFailed ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : isStageActive ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>

                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">{stage.label}</p>
                    {isStageActive && <span className="text-[10px] font-bold text-primary animate-pulse">Running</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{stage.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Failure Diagnostic Card */}
        {isFailed && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 space-y-1 text-left">
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <span>Diagnostic Error: {job.errorCode || 'UNKNOWN_ERROR'}</span>
            </div>
            <p className="text-[11px] opacity-90 pl-6">{job.errorMessage || 'An error occurred during stage execution.'}</p>
          </div>
        )}
        </div>

        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          {isFailed && (
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs min-h-[44px] active:scale-[0.97]"
            >
              {isRetrying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Retry Ingestion Job
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-xl font-medium text-xs min-h-[44px] active:scale-[0.97]"
          >
            {isCompleted ? 'Done' : 'Dismiss'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
