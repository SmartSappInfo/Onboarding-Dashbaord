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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
      <DialogContent className="max-w-xl bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
            <Users className="w-5 h-5 text-cyan-400" /> Programmatic Batch Personalization
          </DialogTitle>
        </DialogHeader>

        {generatedCount === null ? (
          <div className="space-y-5 pt-2">
            <p className="text-xs text-slate-400 leading-relaxed">
              Generate unique, personalized visual creatives for each contact in your target audience with dynamic name, company, and avatar substitution.
            </p>

            {/* Select All Toggle */}
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <span className="text-xs font-bold text-white">
                Target Contacts ({selectedContactIds.length} / {contacts.length} Selected)
              </span>
              <Button
                onClick={handleSelectAll}
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 px-2 rounded-lg"
              >
                {selectedContactIds.length === contacts.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {/* Contact Selection List */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-none">
              {contacts.map((c) => {
                const isSelected = selectedContactIds.includes(c.id);

                return (
                  <div
                    key={c.id}
                    onClick={() => handleToggleContact(c.id)}
                    className={cn(
                      'p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99]',
                      isSelected
                        ? 'bg-slate-900 border-emerald-500/40 text-slate-200'
                        : 'bg-slate-950/60 border-slate-850 text-slate-500 hover:border-slate-800'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white uppercase">
                        {c.firstName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-white">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Building className="w-2.5 h-2.5" /> {c.company || 'Private Contact'}
                        </div>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'w-5 h-5 rounded-lg border flex items-center justify-center text-xs font-black transition-colors',
                        isSelected
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'border-slate-800 bg-slate-900 text-transparent'
                      )}
                    >
                      ✓
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-2 border-t border-slate-850">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="h-10 text-xs font-bold border-slate-800 bg-slate-900 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRunBatch}
                disabled={isGenerating || isPending || selectedContactIds.length === 0}
                className="h-10 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/10 active:scale-[0.97]"
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
            </div>
          </div>
        ) : (
          /* Success Summary View */
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Batch Personalization Complete</h3>
              <p className="text-xs text-slate-400">
                Successfully rendered {generatedCount} unique personalized creative documents.
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={() => {
                  setGeneratedCount(null);
                  onOpenChange(false);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 font-bold text-xs text-slate-950 h-10 px-6 rounded-xl active:scale-[0.97]"
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
