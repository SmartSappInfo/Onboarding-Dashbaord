'use client';

/**
 * @fileOverview Interactive Duplicate Conflict Resolution Modal for New School Signup.
 * 
 * DESIGN RATIONALE:
 * Reuses UI patterns, iconography, and comparative layout standards from DuplicateResolutionPortal
 * to present a clear, mobile-optimized conflict resolution screen when a public signup submission
 * matches an existing institution record.
 * 
 * CAUTION AREAS FOR MAINTAINERS:
 * 1. Mobile Usability: Action buttons and selection cards enforce min-h-[44px] touch targets.
 * 2. Async Submission: Confirm button is disabled during pending server action execution with a Loader2 spinner.
 * 3. Strict Typing: Fully typed props and handlers without any 'any' or 'any[]'.
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
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  RefreshCw,
  PlusCircle,
  Edit3,
  Loader2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { EnrichedDuplicateMatch } from '@/lib/signup-conflict-actions';
import type { SignupInput } from '@/lib/signup-actions';

export interface SignupDuplicateResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  signupInput: SignupInput | null;
  duplicates: EnrichedDuplicateMatch[];
  onResolveNew: () => Promise<void>;
  onResolveMerge: (targetEntityId: string) => Promise<void>;
}

export function SignupDuplicateResolutionModal({
  isOpen,
  onClose,
  signupInput,
  duplicates,
  onResolveNew,
  onResolveMerge,
}: SignupDuplicateResolutionModalProps) {
  const [resolutionMode, setResolutionMode] = React.useState<'merge' | 'create'>('merge');
  const [selectedTargetEntityId, setSelectedTargetEntityId] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Set default selected target entity ID whenever duplicates change
  React.useEffect(() => {
    if (duplicates.length > 0) {
      setSelectedTargetEntityId(duplicates[0].entityId);
    }
  }, [duplicates]);

  if (!signupInput || duplicates.length === 0) {
    return null;
  }

  const primaryContact = signupInput.entityContacts?.[0];
  const activeMatchedEntity = duplicates.find((d) => d.entityId === selectedTargetEntityId) || duplicates[0];

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      if (resolutionMode === 'create') {
        await onResolveNew();
      } else {
        await onResolveMerge(selectedTargetEntityId || activeMatchedEntity.entityId);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl">
        {/* Header Section */}
        <DialogHeader className="p-6 pb-4 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 ring-1 ring-amber-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Duplicate Conflict Detected</span>
                <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] uppercase font-bold">
                  {duplicates.length} {duplicates.length === 1 ? 'Match' : 'Matches'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                We found an existing institution record matching details from your entry. Choose how you would like to proceed.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
          {/* Comparative Data Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Newly Submitted Details */}
            <div className="rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Newly Submitted
                </span>
                <Badge variant="secondary" className="text-[9px] font-semibold">New Entry</Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{signupInput.name}</span>
                </div>

                {signupInput.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{signupInput.location}</span>
                  </div>
                )}

                {primaryContact && (
                  <div className="pt-2 border-t border-border/40 space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>{primaryContact.name || 'Primary Contact'}</span>
                    </div>
                    {primaryContact.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{primaryContact.email}</span>
                      </div>
                    )}
                    {primaryContact.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{primaryContact.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Existing Matched Entity Details */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Existing Entity
                </span>
                <Badge variant="outline" className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40 text-[9px] font-bold">
                  {activeMatchedEntity.reason}
                </Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate">{activeMatchedEntity.name}</span>
                </div>

                {activeMatchedEntity.locationString && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{activeMatchedEntity.locationString}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-amber-500/20 space-y-1">
                  {activeMatchedEntity.primaryEmail && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{activeMatchedEntity.primaryEmail}</span>
                    </div>
                  )}
                  {activeMatchedEntity.primaryPhone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{activeMatchedEntity.primaryPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Multiple Duplicates Selector if more than 1 duplicate matched */}
          {duplicates.length > 1 && (
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-bold text-muted-foreground">Select Matched Entity to Merge Into:</Label>
              <div className="grid grid-cols-1 gap-2">
                {duplicates.map((dup) => (
                  <button
                    key={dup.entityId}
                    type="button"
                    onClick={() => setSelectedTargetEntityId(dup.entityId)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all min-h-[44px] ${
                      selectedTargetEntityId === dup.entityId
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs font-bold truncate">{dup.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-[9px] font-semibold shrink-0">
                      {dup.reason}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resolution Options Selector */}
          <div className="space-y-3 pt-2 border-t border-border">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Resolution Strategy
            </Label>

            <RadioGroup
              value={resolutionMode}
              onValueChange={(val) => setResolutionMode(val as 'merge' | 'create')}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {/* Option A: Merge & Update Existing */}
              <label
                htmlFor="opt-merge"
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all min-h-[52px] ${
                  resolutionMode === 'merge'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-border bg-card hover:bg-accent/40'
                }`}
              >
                <RadioGroupItem value="merge" id="opt-merge" className="mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-primary" />
                    <span>Update Existing Record</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Merges newly entered contacts & info into <strong>{activeMatchedEntity.name}</strong> without creating duplicates.
                  </p>
                </div>
              </label>

              {/* Option B: Force Create New */}
              <label
                htmlFor="opt-create"
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all min-h-[52px] ${
                  resolutionMode === 'create'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-border bg-card hover:bg-accent/40'
                }`}
              >
                <RadioGroupItem value="create" id="opt-create" className="mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <PlusCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Create New Institution</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Ignores the conflict and creates a brand new institution entity alongside the existing record.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        </div>

        {/* Footer Action Bar */}
        <DialogFooter className="p-4 px-6 bg-slate-50 dark:bg-slate-900 border-t border-border flex items-center justify-between sm:justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-11 px-4 text-xs font-semibold rounded-xl min-h-[44px] gap-1.5"
          >
            <Edit3 className="h-4 w-4" />
            <span>Cancel & Edit</span>
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="h-11 px-6 text-xs font-bold rounded-xl min-h-[44px] gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>{resolutionMode === 'merge' ? 'Update & Finalize' : 'Create & Finalize'}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
