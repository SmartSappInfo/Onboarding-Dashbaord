'use client';

/**
 * CRM Match Studio & Resolution Modal (Lead Intelligence 2.0 - Phase 9)
 * UI Spec Section 38: "Phase 9 UX — CRM Match Resolution"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. 3-Way choice: Enrich Existing, Create New, or Ignore Collision.
 * 2. Non-destructive merge preview.
 * 3. Mobile touch target compliance (min-h-[44px]).
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  GitMerge, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  PlusCircle, 
  XCircle, 
  Loader2,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import type { Prospect, CRMMatchCandidate, CRMEnrichmentMergePayload } from '@/lib/lead-intelligence/types';
import { enrichExistingCRMRecordAction, syncProspectToCRMAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CRMMatchStudioModalProps {
  prospect: Prospect;
  matchCandidate: CRMMatchCandidate;
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export const CRMMatchStudioModal: React.FC<CRMMatchStudioModalProps> = ({
  prospect,
  matchCandidate,
  isOpen,
  onClose,
  onResolved
}) => {
  const { toast } = useToast();
  const [selectedResolution, setSelectedResolution] = useState<'enrich' | 'create_new' | 'ignore'>('enrich');
  const [mergeContacts, setMergeContacts] = useState(true);
  const [updateScore, setUpdateScore] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecuteResolution = async () => {
    setIsExecuting(true);
    try {
      if (selectedResolution === 'enrich') {
        const payload: CRMEnrichmentMergePayload = {
          prospectId: prospect.id,
          targetEntityId: matchCandidate.entityId,
          mergeContacts,
          mergeTechnographics: true,
          updateScore,
          tagsToAdd: ['matched-lead']
        };

        const res = await enrichExistingCRMRecordAction(payload, prospect.workspaceId, prospect.organizationId);
        if (res.success) {
          toast({
            title: 'CRM Record Enriched ✓',
            description: `Successfully merged intelligence into "${matchCandidate.entityName}" with ${res.newContactsAddedCount || 0} new contact(s).`
          });
          onResolved();
          onClose();
        } else {
          toast({
            variant: 'destructive',
            title: 'Enrichment Failed',
            description: res.error || 'Failed to merge CRM record.'
          });
        }
      } else if (selectedResolution === 'create_new') {
        const res = await syncProspectToCRMAction(prospect);
        if (res.success) {
          toast({
            title: 'New Lead Created ✓',
            description: `Created new CRM Entity for "${prospect.name}".`
          });
          onResolved();
          onClose();
        } else {
          toast({
            variant: 'destructive',
            title: 'Creation Failed',
            description: res.error || 'Failed to create new lead.'
          });
        }
      } else {
        // Ignore
        toast({ title: 'Match Ignored', description: 'Collision alert dismissed.' });
        onClose();
      }
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl w-[96vw] p-0 bg-card border-border/80 shadow-2xl rounded-2xl overflow-hidden z-[10003] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <GitMerge className="h-5 w-5 text-amber-500" />
                <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                  CRM Match Resolution Studio
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                We found a possible existing record in your CRM. Choose how to link this intelligence.
              </DialogDescription>
            </div>

            <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/40 text-xs font-mono font-bold">
              {matchCandidate.matchScore}% Match Confidence
            </Badge>
          </div>
        </DialogHeader>

        {/* Side-by-Side Comparison Card */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Discovered Prospect */}
            <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 block">
                Discovered Prospect (Lead Intelligence)
              </span>
              <h4 className="text-xs font-bold text-foreground truncate">{prospect.name}</h4>
              <p className="text-[11px] text-muted-foreground font-mono truncate">{prospect.domain || 'No domain'}</p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                <span>{prospect.contacts.length} Contact(s)</span>
                <span>•</span>
                <span>Score: {prospect.scoring?.overallScore ?? 0}/100</span>
              </div>
            </div>

            {/* Existing CRM Record */}
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                Existing CRM Entity
              </span>
              <h4 className="text-xs font-bold text-foreground truncate">{matchCandidate.entityName}</h4>
              <p className="text-[11px] text-muted-foreground font-mono truncate">ID: {matchCandidate.entityId}</p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                <span>Owner: {matchCandidate.ownerName || 'Unassigned'}</span>
                <span>•</span>
                <span>{matchCandidate.contactsCount} Contact(s)</span>
              </div>
            </div>
          </div>

          {/* 3-Way Choice Radio Group (UI Spec Section 38) */}
          <div className="space-y-3 pt-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Resolution Strategy
            </span>

            <RadioGroup
              value={selectedResolution}
              onValueChange={(val: string) => setSelectedResolution(val as 'enrich' | 'create_new' | 'ignore')}
              className="space-y-2"
            >
              {/* Option 1: Enrich Existing (Recommended) */}
              <label
                htmlFor="res-enrich"
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                  selectedResolution === 'enrich'
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/70 hover:bg-muted/20"
                )}
              >
                <RadioGroupItem value="enrich" id="res-enrich" className="mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">
                      Enrich Existing CRM Record (Recommended)
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/40 text-[9px] font-bold">
                      No Duplicates
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Non-destructively merges verified contacts, technographics, and AI insights into "{matchCandidate.entityName}".
                  </p>

                  {/* Nested Toggles for Enrich */}
                  {selectedResolution === 'enrich' && (
                    <div className="pt-3 space-y-2 border-t border-border/50 mt-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="toggle-merge-contacts" className="text-xs font-medium text-foreground cursor-pointer">
                          Merge new verified decision makers
                        </Label>
                        <Switch
                          id="toggle-merge-contacts"
                          checked={mergeContacts}
                          onCheckedChange={setMergeContacts}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="toggle-update-score" className="text-xs font-medium text-foreground cursor-pointer">
                          Update CRM entity lead score to {prospect.scoring?.overallScore ?? 0}
                        </Label>
                        <Switch
                          id="toggle-update-score"
                          checked={updateScore}
                          onCheckedChange={setUpdateScore}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {/* Option 2: Create Distinct New */}
              <label
                htmlFor="res-create"
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                  selectedResolution === 'create_new'
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/70 hover:bg-muted/20"
                )}
              >
                <RadioGroupItem value="create_new" id="res-create" className="mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  <span className="text-xs font-bold text-foreground">
                    Create Distinct New Entity
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Treat this as a completely separate institution and create a new CRM record.
                  </p>
                </div>
              </label>

              {/* Option 3: Ignore */}
              <label
                htmlFor="res-ignore"
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                  selectedResolution === 'ignore'
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/70 hover:bg-muted/20"
                )}
              >
                <RadioGroupItem value="ignore" id="res-ignore" className="mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  <span className="text-xs font-bold text-foreground">
                    Ignore Match Collision
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Dismiss this match suggestion and keep prospect in discovery list.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold rounded-xl"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleExecuteResolution}
            disabled={isExecuting}
            className="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Execute Resolution</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
