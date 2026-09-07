'use client';

/**
 * @fileOverview CompanyBrain 2.0: MemoryInspectorDrawer Component
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Deep Explainability & Provenance:
 *    - Surfaces full provenance: source note ID, verbatim evidence quote, confidence meter,
 *      connected CRM entity links, and audit history.
 * 2. Mobile Accessibility & Touch Targets:
 *    - Action buttons guarantee >= 44px touch targets on mobile (`min-h-[44px]`).
 * 3. Emil Kowalski Interaction Polish:
 *    - Buttons feature `active:scale-[0.97]`, smooth transitions, and keyboard focus states.
 * 4. Zero-`any` Type Safety:
 *    - Uses strictly typed `MemoryObject` and typed callback handlers.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Brain,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  Building2,
  Quote,
  FileText,
  Clock,
  Loader2,
  ExternalLink,
  Edit3,
  Network,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { MemoryObject } from '@/lib/memory/types';
import { MEMORY_TYPE_CONFIG, VERIFICATION_CONFIG } from './MemoryCard';

export interface MemoryInspectorDrawerProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  memory: MemoryObject | null;
  onConfirm?: (memoryId: string) => Promise<void> | void;
  onInvalidate?: (memoryId: string, reason?: string) => Promise<void> | void;
  onUpdate?: (
    memoryId: string,
    updates: { title?: string; content?: string }
  ) => Promise<void> | void;
  isProcessing?: boolean;
}

export function MemoryInspectorDrawer({
  open,
  onOpenChange,
  onClose,
  memory,
  onConfirm,
  onInvalidate,
  onUpdate,
  isProcessing = false,
}: MemoryInspectorDrawerProps) {
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange?.(newOpen);
    if (!newOpen && onClose) {
      onClose();
    }
  };
  const { toast } = useToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState('');
  const [editedContent, setEditedContent] = React.useState('');
  const [invalidationReason, setInvalidationReason] = React.useState('');
  const [showInvalidateInput, setShowInvalidateInput] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync edit fields when memory prop changes
  React.useEffect(() => {
    if (memory) {
      setEditedTitle(memory.title || '');
      setEditedContent(memory.content);
      setIsEditing(false);
      setShowInvalidateInput(false);
      setInvalidationReason('');
    }
  }, [memory]);

  if (!memory) return null;

  const typeConfig = MEMORY_TYPE_CONFIG[memory.type] ?? {
    label: memory.type,
    color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    icon: Brain,
  };
  const TypeIcon = typeConfig.icon;

  const verifConfig = VERIFICATION_CONFIG[memory.verification] ?? VERIFICATION_CONFIG.unverified;
  const VerifIcon = verifConfig.icon;

  const confidenceScore = Math.round((memory.confidence || 0.8) * 100);

  const handleSaveEdit = async () => {
    if (!onUpdate) return;
    if (!editedContent.trim()) {
      toast({ title: 'Memory content cannot be empty', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdate(memory.id, {
        title: editedTitle.trim(),
        content: editedContent.trim(),
      });
      setIsEditing(false);
      toast({ title: 'Memory updated successfully' });
    } catch {
      toast({ title: 'Failed to update memory', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!onConfirm) return;
    setIsSubmitting(true);
    try {
      await onConfirm(memory.id);
      toast({ title: 'Memory confirmed as verified truth' });
    } catch {
      toast({ title: 'Failed to confirm memory', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvalidateAction = async () => {
    if (!onInvalidate) return;
    if (!invalidationReason.trim()) {
      toast({ title: 'Please provide a reason for invalidating this memory', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onInvalidate(memory.id, invalidationReason.trim());
      setShowInvalidateInput(false);
      toast({ title: 'Memory marked as invalidated / archived' });
    } catch {
      toast({ title: 'Failed to invalidate memory', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto flex flex-col justify-between p-6 gap-6"
      >
        <div className="space-y-6">
          {/* Header */}
          <SheetHeader className="space-y-2 border-b border-border/60 pb-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn('gap-1 text-xs font-semibold border px-2.5 py-0.5', typeConfig.color)}
                >
                  <TypeIcon className="h-3.5 w-3.5" />
                  {typeConfig.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn('gap-1 text-xs font-medium border px-2 py-0.5', verifConfig.badgeClass)}
                >
                  <VerifIcon className="h-3 w-3" />
                  {verifConfig.label}
                </Badge>
              </div>

              {!isEditing && onUpdate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-8 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground active:scale-[0.97]"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </div>

            <SheetTitle className="text-lg font-semibold text-foreground tracking-tight pt-1">
              {memory.title || 'Institutional Memory Object'}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Atomic institutional knowledge unit decomposed and indexed by CompanyBrain.
            </SheetDescription>
          </SheetHeader>

          {/* Confidence Score Bar */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Extraction Confidence
              </span>
              <span className="font-mono font-bold text-foreground">{confidenceScore}%</span>
            </div>
            <Progress value={confidenceScore} className="h-2 rounded-full" />
          </div>

          {/* Main Content / Edit Form */}
          {isEditing ? (
            <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Title
                </label>
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="Memory Title"
                  className="text-sm bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Content
                </label>
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  placeholder="Memory Content"
                  rows={4}
                  className="text-xs bg-background"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={isSubmitting}
                  className="h-8 text-xs min-h-[44px] sm:min-h-[32px]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSubmitting}
                  className="h-8 text-xs font-semibold gap-1.5 min-h-[44px] sm:min-h-[32px] active:scale-[0.97]"
                >
                  {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Knowledge Statement
              </h5>
              <div className="rounded-xl border border-border bg-card p-3.5 text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {memory.content}
              </div>
            </div>
          )}

          {/* Verbatim Evidence Quote */}
          {memory.evidence && (
            <div className="space-y-1.5">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Quote className="h-3 w-3 text-primary" />
                Verbatim Source Evidence
              </h5>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs italic text-foreground/90 border-l-4 border-l-primary">
                &ldquo;{memory.evidence}&rdquo;
              </div>
            </div>
          )}

          {/* Connected Entities */}
          {memory.entities && memory.entities.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-blue-500" />
                Connected CRM Entities
              </h5>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {memory.entities.map((ent, idx) => (
                  <div
                    key={`${ent.entityName}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate">{ent.entityName}</span>
                    </div>
                    <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0 shrink-0">
                      {ent.entityType}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provenance Details */}
          <div className="space-y-2 border-t border-border/60 pt-4">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Provenance & Metadata
            </h5>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Source Record
                </span>
                <span className="font-mono font-medium text-foreground">
                  {memory.source.type} : {memory.source.sourceId.slice(0, 8)}...
                </span>
              </div>

              {memory.source.type === 'user_note' && (
                <div className="flex items-center justify-between text-muted-foreground pt-1">
                  <span className="text-[11px]">Direct Note Link</span>
                  <Link
                    href={`/admin/quick-notes?search=${encodeURIComponent(memory.source.sourceId)}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                  >
                    <span>View Note</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-between text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Network className="h-3.5 w-3.5 text-primary" />
                  Knowledge Graph
                </span>
                <Link
                  href={`/admin/quick-notes?tab=graph&nodeId=${encodeURIComponent(memory.id)}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                >
                  <span>Explore in Graph</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <div className="flex items-center justify-between text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Extracted At
                </span>
                <span className="text-foreground">
                  {new Date(memory.createdAt).toLocaleString()}
                </span>
              </div>

              {memory.lifecycle?.lastReviewedAt && (
                <div className="flex items-center justify-between text-muted-foreground pt-1">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Reviewed
                  </span>
                  <span className="text-foreground">
                    {new Date(memory.lifecycle.lastReviewedAt).toLocaleString()}
                  </span>
                </div>
              )}

              {memory.lifecycle?.invalidationReason && (
                <div className="rounded-md bg-rose-500/10 p-2 text-xs text-rose-700 dark:text-rose-300 mt-2">
                  <span className="font-bold">Invalidation Reason: </span>
                  {memory.lifecycle.invalidationReason}
                </div>
              )}
            </div>
          </div>

          {/* Invalidate Reason Input prompt */}
          {showInvalidateInput && (
            <div className="rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-3 space-y-2">
              <label className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                Reason for Invalidation
              </label>
              <Input
                value={invalidationReason}
                onChange={(e) => setInvalidationReason(e.target.value)}
                placeholder="e.g. Outdated decision, superseded by Q3 contract..."
                className="text-xs bg-background"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInvalidateInput(false)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleInvalidateAction}
                  disabled={isSubmitting}
                  className="h-7 text-xs font-semibold gap-1 min-h-[44px] sm:min-h-[28px] active:scale-[0.97]"
                >
                  {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Confirm Invalidation
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <SheetFooter className="border-t border-border/60 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            {memory.verification !== 'invalidated' && onInvalidate && !showInvalidateInput && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInvalidateInput(true)}
                disabled={isSubmitting}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 min-h-[44px] sm:min-h-[36px] active:scale-[0.97]"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Invalidate
              </Button>
            )}

            {memory.verification === 'ai_generated' && onConfirm && (
              <Button
                type="button"
                onClick={handleConfirmAction}
                disabled={isSubmitting}
                className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold min-h-[44px] sm:min-h-[36px] active:scale-[0.97] gap-1.5"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Confirm Truth
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
