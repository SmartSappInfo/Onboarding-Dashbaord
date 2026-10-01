'use client';

/**
 * ARCHITECTURE:
 * Batch Programmatic Personalization Modal (Phase 6 - CRM Integration)
 * 
 * Generates personalized visual copies of the current document for a segment of CRM contacts,
 * running each copy through Phase 4 Creative Health diagnostics and Phase 5 Brand Rules.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useTransition } from 'react';
import type { CrmContactPreview } from '@/lib/creative/creative-types';
import { generateBatchPersonalizedCreativesAction } from '@/app/actions/creative-crm-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Sparkles,
  CheckCircle2,
  Loader2,
  Building,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchPersonalizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  workspaceId: string;
  contacts: CrmContactPreview[];
}

export function BatchPersonalizationModal({
  open,
  onOpenChange,
  projectId,
  workspaceId,
  contacts,
}: BatchPersonalizationModalProps) {
  const { toast } = useToast();
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(() =>
    contacts.map((c) => c.id)
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggleContact = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(contacts.map((c) => c.id));
    }
  };

  const handleRunBatch = () => {
    if (selectedContactIds.length === 0) return;
    setIsGenerating(true);

    startTransition(async () => {
      const res = await generateBatchPersonalizedCreativesAction(
        projectId,
        workspaceId,
        selectedContactIds
      );

      setIsGenerating(false);

      if (res.success && res.data) {
        setGeneratedCount(res.data.generatedCount);
        toast({
          title: 'Batch Personalization Complete',
          description: `Generated ${res.data.generatedCount} personalized creatives.`,
        });
      } else {
        toast({
          title: 'Batch Generation Failed',
          description: res.error || 'Could not generate batch.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Users className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              Batch Personalization
              <CardInfoTooltip text="Generate unique, personalized visual creatives for each contact in your target audience with dynamic name, company, and avatar substitution." />
            </DialogTitle>
            <DialogDescription className="sr-only">
              Generate unique, personalized visual creatives for each contact in your target audience with dynamic name, company, and avatar substitution.
            </DialogDescription>
          </div>
        </DialogHeader>

        {generatedCount === null ? (
          <>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Select All Toggle */}
              <div className="flex items-center justify-between border-b border-border/80 pb-2">
                <span className="text-xs font-semibold text-foreground">
                  Target Contacts ({selectedContactIds.length} / {contacts.length} Selected)
                </span>
                <Button
                  onClick={handleSelectAll}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 px-2 rounded-lg"
                >
                  {selectedContactIds.length === contacts.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {/* Contact Selection List */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {contacts.map((c) => {
                  const isSelected = selectedContactIds.includes(c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleToggleContact(c.id)}
                      className={cn(
                        'p-3 rounded-xl border text-xs flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99]',
                        isSelected
                          ? 'bg-muted/60 border-emerald-500/40 text-foreground'
                          : 'bg-background border-border/80 text-muted-foreground hover:border-border'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-xs text-foreground uppercase">
                          {c.firstName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">
                            {c.firstName} {c.lastName}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Building className="w-2.5 h-2.5" /> {c.company || 'Private Contact'}
                          </div>
                        </div>
                      </div>

                      <div
                        className={cn(
                          'w-5 h-5 rounded-md border flex items-center justify-center text-xs font-bold transition-colors',
                          isSelected
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'border-border bg-background text-transparent'
                        )}
                      >
                        ✓
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions Footer */}
            <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="h-10 text-xs font-medium rounded-xl active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRunBatch}
                disabled={isGenerating || isPending || selectedContactIds.length === 0}
                className="h-10 px-5 font-medium text-xs rounded-xl shadow-sm active:scale-[0.97]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating ({selectedContactIds.length})...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate {selectedContactIds.length} Creatives
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Success Summary View */
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Batch Personalization Complete</h3>
              <p className="text-xs text-muted-foreground">
                Successfully rendered {generatedCount} unique personalized creative documents.
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={() => {
                  setGeneratedCount(null);
                  onOpenChange(false);
                }}
                className="font-medium text-xs h-10 px-6 rounded-xl active:scale-[0.97]"
              >
                Done <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
