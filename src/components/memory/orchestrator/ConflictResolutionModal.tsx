'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Conflict Resolution Modal
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Human-in-the-Loop Adjudication:
 *    - Allows operators to resolve contradictions with deliberate audit rationale.
 * 2. Mobile Accessibility:
 *    - All radio targets and action buttons have >= 44px touch targets.
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]` and smooth dialog fade.
 * 4. Zero-`any` Standard:
 *    - Strictly typed props and handlers.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import type {
  MemoryConflict,
  ConflictResolutionChoice,
} from '@/lib/memory/orchestrator-types';

export interface ConflictResolutionModalProps {
  conflict: MemoryConflict | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    conflictId: string,
    choice: ConflictResolutionChoice,
    notes: string
  ) => Promise<void>;
  isSaving?: boolean;
}

export function ConflictResolutionModal({
  conflict,
  isOpen,
  onClose,
  onSave,
  isSaving = false,
}: ConflictResolutionModalProps) {
  const [selectedChoice, setSelectedChoice] =
    React.useState<ConflictResolutionChoice>('confirm_a');
  const [resolutionNotes, setResolutionNotes] = React.useState('');

  React.useEffect(() => {
    if (conflict) {
      setSelectedChoice('confirm_a');
      setResolutionNotes('');
    }
  }, [conflict]);

  if (!conflict) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(conflict.id, selectedChoice, resolutionNotes.trim());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Resolve Knowledge Contradiction
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Determine the authoritative institutional truth between these contradictory
            claims.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Dispute Context */}
          <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs space-y-1">
            <span className="font-semibold text-foreground">Conflict Summary:</span>
            <p className="text-muted-foreground">{conflict.summary}</p>
          </div>

          {/* Resolution Options */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Authoritative Decision</Label>
            <RadioGroup
              value={selectedChoice}
              onValueChange={(val) =>
                setSelectedChoice(val as ConflictResolutionChoice)
              }
              className="space-y-2"
            >
              <div className="flex items-start space-x-3 p-3 rounded-xl border border-border hover:bg-muted/40 cursor-pointer min-h-[44px]">
                <RadioGroupItem value="confirm_a" id="res-a" className="mt-0.5" />
                <div className="flex-1 cursor-pointer">
                  <Label htmlFor="res-a" className="text-xs font-semibold cursor-pointer">
                    Confirm Claim A (Supersede B)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Adopts &quot;{conflict.evidenceA.title}&quot; as verified truth and archives Claim B.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-xl border border-border hover:bg-muted/40 cursor-pointer min-h-[44px]">
                <RadioGroupItem value="confirm_b" id="res-b" className="mt-0.5" />
                <div className="flex-1 cursor-pointer">
                  <Label htmlFor="res-b" className="text-xs font-semibold cursor-pointer">
                    Confirm Claim B (Supersede A)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Adopts &quot;{conflict.evidenceB.title}&quot; as verified truth and archives Claim A.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-xl border border-border hover:bg-muted/40 cursor-pointer min-h-[44px]">
                <RadioGroupItem value="keep_both" id="res-both" className="mt-0.5" />
                <div className="flex-1 cursor-pointer">
                  <Label htmlFor="res-both" className="text-xs font-semibold cursor-pointer">
                    Keep Both (Context-Specific Truth)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Both claims remain valid under different contexts, dates, or scopes.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-xl border border-border hover:bg-muted/40 cursor-pointer min-h-[44px]">
                <RadioGroupItem value="custom_synthesis" id="res-synth" className="mt-0.5" />
                <div className="flex-1 cursor-pointer">
                  <Label htmlFor="res-synth" className="text-xs font-semibold cursor-pointer">
                    Custom Synthesis
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Synthesize the conflict with custom notes recorded below as truth.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-xl border border-border hover:bg-muted/40 cursor-pointer min-h-[44px]">
                <RadioGroupItem value="dismiss" id="res-dismiss" className="mt-0.5" />
                <div className="flex-1 cursor-pointer">
                  <Label htmlFor="res-dismiss" className="text-xs font-semibold cursor-pointer">
                    Dismiss Dispute
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Ignore this dispute without altering either source memory.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Audit Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold">
              Resolution Audit Notes
            </Label>
            <Textarea
              id="notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Explain the rationale for future operators and AI agents..."
              rows={3}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="min-h-[44px] text-xs active:scale-[0.97]"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] text-xs gap-1.5 active:scale-[0.97]"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save & Apply Resolution
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
