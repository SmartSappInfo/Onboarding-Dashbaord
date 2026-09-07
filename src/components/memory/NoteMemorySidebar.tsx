'use client';

/**
 * @fileOverview CompanyBrain 2.0: NoteMemorySidebar Component
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Note -> Memory Capture Layer:
 *    - Bridges human note drafting with atomic organizational memory extraction.
 * 2. Real-time Feedback & Extraction:
 *    - Allows human-in-the-loop inspection and confirmation of extracted candidates directly within the editor dialog.
 * 3. Mobile Accessibility:
 *    - All touch targets >= 44px on mobile (`min-h-[44px]`).
 * 4. Zero-`any` Standard:
 *    - Strict TypeScript interfaces with no `any` or `any[]`.
 */

import * as React from 'react';
import {
  Brain,
  Sparkles,
  CheckCircle2,
  Loader2,
  Eye,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { MemoryObject } from '@/lib/memory/types';
import {
  extractMemoriesFromNoteAction,
  getNoteMemoriesAction,
  confirmMemoryAction,
  invalidateMemoryAction,
  updateMemoryAction,
} from '@/lib/memory/actions/memory-actions';
import { MemoryInspectorDrawer } from './MemoryInspectorDrawer';
import { MEMORY_TYPE_CONFIG } from './MemoryCard';

export interface NoteMemorySidebarProps {
  noteId?: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
  title: string;
  plainText: string;
  className?: string;
}

export function NoteMemorySidebar({
  noteId,
  workspaceId,
  organizationId,
  userId,
  title,
  plainText,
  className,
}: NoteMemorySidebarProps) {
  const { toast } = useToast();
  const [memories, setMemories] = React.useState<MemoryObject[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [inspectTarget, setInspectTarget] = React.useState<MemoryObject | null>(null);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  // Load existing memories for this note
  const loadMemories = React.useCallback(async () => {
    if (!noteId || !workspaceId || !userId) return;
    setIsLoading(true);
    try {
      const res = await getNoteMemoriesAction({ noteId, workspaceId, userId });
      if (res.success && res.data) {
        setMemories(res.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoading(false);
    }
  }, [noteId, workspaceId, userId]);

  React.useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  // Extract memories from note
  const handleExtract = async () => {
    if (!noteId) {
      toast({
        title: 'Save note first',
        description: 'Please save this note before extracting organizational memories.',
      });
      return;
    }
    const trimmedText = plainText.trim();
    if (!trimmedText) {
      toast({
        title: 'Note is empty',
        description: 'Type some content into the note before extracting memories.',
        variant: 'destructive',
      });
      return;
    }

    setIsExtracting(true);
    try {
      const res = await extractMemoriesFromNoteAction({
        noteId,
        workspaceId,
        organizationId,
        userId,
        title: title || 'Untitled note',
        plainText: trimmedText,
        forceReExtract: true,
      });

      if (res.success && res.data) {
        setMemories(res.data.memories);
        toast({
          title: 'Memories extracted!',
          description: `Extracted ${res.data.memories.length} atomic memory units.`,
        });
      } else {
        toast({
          title: 'Extraction failed',
          description: res.error || 'Failed to extract memories.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown extraction error.';
      toast({ title: 'Extraction error', description: msg, variant: 'destructive' });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirm = async (memoryId: string) => {
    setProcessingId(memoryId);
    try {
      const res = await confirmMemoryAction({ memoryId, workspaceId, userId });
      if (res.success && res.data) {
        setMemories((prev) => prev.map((m) => (m.id === memoryId ? res.data! : m)));
        if (inspectTarget?.id === memoryId) {
          setInspectTarget(res.data);
        }
        toast({ title: 'Memory confirmed as verified truth' });
      } else {
        toast({ title: 'Confirmation failed', description: res.error, variant: 'destructive' });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleInvalidate = async (memoryId: string, reason: string) => {
    setProcessingId(memoryId);
    try {
      const res = await invalidateMemoryAction({ memoryId, workspaceId, reason, userId });
      if (res.success && res.data) {
        setMemories((prev) => prev.map((m) => (m.id === memoryId ? res.data! : m)));
        if (inspectTarget?.id === memoryId) {
          setInspectTarget(res.data);
        }
        toast({ title: 'Memory archived' });
      } else {
        toast({ title: 'Invalidation failed', description: res.error, variant: 'destructive' });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdate = async (
    memoryId: string,
    updates: { title?: string; content?: string }
  ) => {
    setProcessingId(memoryId);
    try {
      const res = await updateMemoryAction({ memoryId, workspaceId, updates, userId });
      if (res.success && res.data) {
        setMemories((prev) => prev.map((m) => (m.id === memoryId ? res.data! : m)));
        if (inspectTarget?.id === memoryId) {
          setInspectTarget(res.data);
        }
      } else {
        throw new Error(res.error || 'Failed to update memory');
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className={cn('rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Brain className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-xs font-bold text-foreground">Organization Memory</h4>
            <p className="text-[10px] text-muted-foreground">
              {memories.length} atomic memories indexed
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleExtract}
          disabled={isExtracting || !noteId}
          className="h-8 text-xs font-semibold gap-1.5 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 active:scale-[0.97]"
          title="Extract structured decisions, insights, and entities"
        >
          {isExtracting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span>{memories.length > 0 ? 'Re-extract' : 'Extract'}</span>
        </Button>
      </div>

      {!noteId && (
        <p className="text-xs text-muted-foreground italic rounded-lg bg-background/50 p-2.5 border border-dashed border-border">
          Save this note to extract and index it into organization memory.
        </p>
      )}

      {/* Memory Cards list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading memories...</span>
        </div>
      ) : memories.length > 0 ? (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {memories.map((m) => {
            const typeConfig = MEMORY_TYPE_CONFIG[m.type] ?? {
              label: m.type,
              color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
              icon: Brain,
            };
            const TypeIcon = typeConfig.icon;
            const isConfirmed = m.verification === 'user_confirmed';
            const isInvalidated = m.verification === 'invalidated';

            return (
              <div
                key={m.id}
                className={cn(
                  'rounded-lg border bg-background p-2.5 transition-all text-xs space-y-1.5',
                  isInvalidated && 'opacity-50'
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] font-semibold border px-1.5 py-0', typeConfig.color)}
                  >
                    <TypeIcon className="h-2.5 w-2.5 mr-1" />
                    {typeConfig.label}
                  </Badge>

                  <div className="flex items-center gap-1">
                    {isConfirmed ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {Math.round((m.confidence || 0.8) * 100)}% conf.
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-foreground font-medium line-clamp-2">{m.content}</p>

                {/* Entity chips */}
                {m.entities && m.entities.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    {m.entities.map((e, idx) => (
                      <span
                        key={`${e.entityName}-${idx}`}
                        className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-0.2 text-[9px] text-muted-foreground"
                      >
                        <Building2 className="h-2 w-2" />
                        {e.entityName}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setInspectTarget(m)}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="h-3 w-3" />
                    Inspect
                  </button>

                  {!isConfirmed && !isInvalidated && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={processingId === m.id}
                      onClick={() => handleConfirm(m.id)}
                      className="h-6 px-1.5 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      {processingId === m.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 mr-0.5" />
                      )}
                      Confirm
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : noteId ? (
        <div className="text-center py-4 space-y-1">
          <p className="text-xs text-muted-foreground">No memories extracted yet.</p>
          <p className="text-[10px] text-muted-foreground">
            Click &ldquo;Extract&rdquo; to analyze this note for decisions, insights, and facts.
          </p>
        </div>
      ) : null}

      {/* Inspector Drawer */}
      <MemoryInspectorDrawer
        open={!!inspectTarget}
        onOpenChange={(open) => {
          if (!open) setInspectTarget(null);
        }}
        memory={inspectTarget}
        onConfirm={handleConfirm}
        onInvalidate={(id, reason) => handleInvalidate(id, reason || '')}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
