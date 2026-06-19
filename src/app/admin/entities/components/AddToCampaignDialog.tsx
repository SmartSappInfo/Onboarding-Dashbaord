'use client';

import * as React from 'react';
import { useCallCampaigns } from '@/lib/call-centre-hooks';
import { addContactsToCallCampaignAction } from '@/lib/call-centre-actions';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, PhoneCall, HelpCircle, ArrowLeft, Users, ShieldCheck, UserCheck } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { EntityContact } from '@/lib/types';

export type ContactOverride = {
  entityId: string;
  contactId: string;
  contactName: string;
  phone: string;
  email: string;
};

interface AddToCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Entity IDs to assign. When a single ID is given, a contact picker is shown first. */
  entityIds: string[];
  workspaceId: string;
  /** Contacts for the entity (only used when entityIds.length === 1) */
  entityContacts?: EntityContact[];
  /** When set, skip Step 1 and pre-select this specific contact */
  preSelectedContactId?: string;
  /** Entity display name for description text */
  entityName?: string;
  onComplete?: () => void;
}

type Step = 'pick-contacts' | 'pick-campaign';
type BulkScope = 'primary' | 'signatories' | 'all';

export function AddToCampaignDialog({
  open,
  onOpenChange,
  entityIds,
  workspaceId,
  entityContacts = [],
  preSelectedContactId,
  entityName,
  onComplete,
}: AddToCampaignDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const { campaigns, isLoading } = useCallCampaigns(workspaceId);
  const [selectedCampaignId, setSelectedCampaignId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isSingleEntity = entityIds.length === 1;

  // Contact selection state (single entity mode)
  const [selectedContactIds, setSelectedContactIds] = React.useState<Set<string>>(new Set());

  // Bulk scope state (multi-entity mode)
  const [bulkScope, setBulkScope] = React.useState<BulkScope>('primary');

  // Which step we're on
  const [step, setStep] = React.useState<Step>(isSingleEntity ? 'pick-contacts' : 'pick-campaign');

  // Reset when opening
  React.useEffect(() => {
    if (open) {
      setSelectedCampaignId(null);
      setIsSubmitting(false);
      setBulkScope('primary');

      if (isSingleEntity) {
        setStep('pick-contacts');
        // Pre-select a specific contact if provided, otherwise pre-select primary
        if (preSelectedContactId) {
          setSelectedContactIds(new Set([preSelectedContactId]));
        } else {
          // Auto-select primary contact
          const primary = entityContacts.find(c => c.isPrimary);
          setSelectedContactIds(primary ? new Set([primary.id]) : new Set());
        }
      } else {
        setStep('pick-campaign');
        setSelectedContactIds(new Set());
      }
    }
  }, [open, isSingleEntity, preSelectedContactId, entityContacts]);

  const activeCampaigns = React.useMemo(
    () => campaigns.filter(c => {
      const isArchived = c.status === 'archived';
      const isFixedLaunched = c.allowAddContactsAfterLaunch === false && c.status !== 'draft';
      return !isArchived && !isFixedLaunched;
    }),
    [campaigns]
  );

  // ── Contact quick-selects ─────────────────────────────────────────────────
  const selectPrimary = () => {
    const ids = entityContacts.filter(c => c.isPrimary).map(c => c.id);
    setSelectedContactIds(new Set(ids));
  };
  const selectSignatories = () => {
    const ids = entityContacts.filter(c => c.isSignatory).map(c => c.id);
    setSelectedContactIds(new Set(ids));
  };
  const selectAll = () => {
    setSelectedContactIds(new Set(entityContacts.map(c => c.id)));
  };
  const toggleContact = (id: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!selectedCampaignId) return;
    setIsSubmitting(true);

    try {
      const targetCampaign = campaigns.find(c => c.id === selectedCampaignId);
      const campaignName = targetCampaign?.name || 'Campaign';

      let overrides: ContactOverride[] | undefined;

      if (isSingleEntity) {
        // Build per-contact overrides from selected contacts
        const entityId = entityIds[0];
        const selected = entityContacts.filter(c => selectedContactIds.has(c.id));
        if (selected.length === 0) {
          toast({ variant: 'destructive', title: 'No contacts selected', description: 'Please select at least one contact.' });
          setIsSubmitting(false);
          return;
        }
        overrides = selected.map(c => ({
          entityId,
          contactId: c.id,
          contactName: c.name,
          phone: c.phone || '',
          email: c.email || '',
        }));
      }
      // For multi-entity (bulk), no overrides — server uses contactScope from campaign

      const result = await addContactsToCallCampaignAction(
        selectedCampaignId,
        entityIds,
        workspaceId,
        user?.uid || '',
        overrides,
      );

      if (result.success) {
        toast({
          title: 'Contacts Added',
          description: `Successfully added ${result.count} contact(s) to "${campaignName}".`,
        });
        if (onComplete) onComplete();
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Add',
          description: result.error || 'Could not add contacts to the campaign.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error occurred',
        description: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedFromContacts = isSingleEntity
    ? selectedContactIds.size > 0
    : true;

  const stepLabel = step === 'pick-contacts' ? 'Step 1 of 2' : isSingleEntity ? 'Step 2 of 2' : 'Step 1 of 1';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md flex flex-col h-[72vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-bold tracking-tight">
                {step === 'pick-contacts' ? 'Select Contacts' : 'Choose Campaign'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {step === 'pick-contacts'
                  ? `Pick which contacts from ${entityName || 'this entity'} to add.`
                  : entityIds.length === 1
                    ? `Assign ${selectedContactIds.size} contact(s) to a campaign.`
                    : `Assign ${entityIds.length} entities to a campaign.`}
              </DialogDescription>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-2 py-1 rounded-lg shrink-0">
              {stepLabel}
            </span>
          </div>
        </DialogHeader>

        {/* ── STEP 1: Contact Picker (single entity only) ─────────────────── */}
        {step === 'pick-contacts' && isSingleEntity && (
          <>
            {/* Quick-select buttons */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Quick:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={selectPrimary}
                className="h-7 px-3 rounded-lg text-[10px] font-bold gap-1.5"
              >
                <UserCheck className="h-3 w-3" /> Primary
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectSignatories}
                className="h-7 px-3 rounded-lg text-[10px] font-bold gap-1.5"
              >
                <ShieldCheck className="h-3 w-3" /> Signatories
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="h-7 px-3 rounded-lg text-[10px] font-bold gap-1.5"
              >
                <Users className="h-3 w-3" /> All
              </Button>
              {selectedContactIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedContactIds(new Set())}
                  className="h-7 px-2 rounded-lg text-[10px] font-bold text-muted-foreground hover:text-rose-500 ml-auto"
                >
                  Clear
                </Button>
              )}
            </div>

            <div className="flex-1 min-h-0 border border-border rounded-xl overflow-hidden bg-muted/10 flex flex-col">
              <ScrollArea className="flex-1">
                {entityContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center opacity-50">
                    <PhoneCall className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs font-semibold text-muted-foreground">No contacts registered for this entity.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {entityContacts.map(contact => {
                      const isChecked = selectedContactIds.has(contact.id);
                      const hasPhone = !!contact.phone;
                      return (
                        <div
                          key={contact.id}
                          onClick={() => toggleContact(contact.id)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                            isChecked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30',
                            !hasPhone && 'opacity-60'
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleContact(contact.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-foreground truncate">{contact.name}</p>
                              {contact.isPrimary && (
                                <Badge variant="secondary" className="text-[7px] font-bold uppercase bg-blue-500/10 text-blue-500 border-blue-500/20 px-1.5 py-0">
                                  Primary
                                </Badge>
                              )}
                              {contact.isSignatory && (
                                <Badge className="text-[7px] font-bold uppercase bg-amber-500 text-white border-none px-1.5 py-0">
                                  Signatory
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[7px] font-semibold uppercase tracking-tighter px-1.5 py-0">
                                {contact.typeLabel || contact.typeKey}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground font-medium">
                              {contact.phone ? (
                                <span className="font-mono">{contact.phone}</span>
                              ) : (
                                <span className="text-rose-400 italic">No phone number</span>
                              )}
                              {contact.email && (
                                <span className="truncate max-w-[140px]">{contact.email}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            <DialogFooter className="pt-3 shrink-0 flex flex-row items-center justify-between gap-2 border-t border-border/50">
              <span className="text-[10px] font-bold text-muted-foreground">
                {selectedContactIds.size > 0 ? `${selectedContactIds.size} selected` : 'None selected'}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-bold h-10 text-xs">
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep('pick-campaign')}
                  disabled={!canProceedFromContacts}
                  className="rounded-xl font-bold h-10 text-xs gap-1.5 bg-[#4d69ff] hover:bg-[#3d59ef] text-white"
                >
                  Choose Campaign →
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {/* ── STEP 2 (or only step for bulk): Campaign Picker ─────────────── */}
        {step === 'pick-campaign' && (
          <>
            {/* Bulk scope selector (multi-entity only) */}
            {!isSingleEntity && (
              <div className="shrink-0 space-y-2">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
                  Which contacts to call across all {entityIds.length} entities?
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['primary', 'signatories', 'all'] as BulkScope[]).map(scope => (
                    <button
                      key={scope}
                      onClick={() => setBulkScope(scope)}
                      className={cn(
                        'px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-colors',
                        bulkScope === scope
                          ? 'bg-primary text-white border-primary'
                          : 'border-border text-muted-foreground hover:bg-muted/40'
                      )}
                    >
                      {scope === 'primary' ? 'Primary Only' : scope === 'signatories' ? 'Signatories' : 'All Contacts'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 border border-border rounded-xl overflow-hidden bg-muted/10 flex flex-col">
              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  </div>
                ) : activeCampaigns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center opacity-50 h-full">
                    <PhoneCall className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs font-semibold text-muted-foreground">No active campaigns found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {activeCampaigns.map(camp => {
                      const isLaunched = camp.status !== 'draft';
                      const isFixed = camp.allowAddContactsAfterLaunch === false;
                      const isDisabled = isFixed && isLaunched;

                      return (
                        <div
                          key={camp.id}
                          onClick={() => { if (!isDisabled) setSelectedCampaignId(camp.id); }}
                          className={cn(
                            'flex items-center justify-between px-4 py-3 cursor-pointer transition-colors',
                            isDisabled
                              ? 'opacity-50 cursor-not-allowed bg-muted/20'
                              : selectedCampaignId === camp.id
                                ? 'bg-primary/5 hover:bg-primary/10'
                                : 'hover:bg-muted/30'
                          )}
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <input
                              type="radio"
                              name="selectedCampaign"
                              checked={selectedCampaignId === camp.id}
                              disabled={isDisabled}
                              onChange={() => setSelectedCampaignId(camp.id)}
                              className="mt-1 h-3.5 w-3.5 text-primary border-gray-300 focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-foreground truncate">{camp.name}</span>
                                {isFixed ? (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold uppercase tracking-wider">
                                    Fixed
                                  </span>
                                ) : (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold uppercase tracking-wider">
                                    Dynamic
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                Status: <span className="font-semibold capitalize">{camp.status}</span>
                                {camp.progress && ` • ${camp.progress.completed}/${camp.progress.total} completed`}
                              </p>
                            </div>
                          </div>

                          {isDisabled && (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-muted-foreground hover:text-foreground p-1">
                                    <HelpCircle className="h-4 w-4" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[220px]">
                                  <p className="text-[10px] font-medium leading-relaxed">
                                    This campaign has a fixed audience and has already been launched. Adding contacts is blocked.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            <DialogFooter className="pt-3 shrink-0 flex flex-row items-center justify-between gap-2 border-t border-border/50">
              {isSingleEntity ? (
                <Button
                  variant="ghost"
                  onClick={() => setStep('pick-contacts')}
                  className="rounded-xl font-bold h-10 text-xs gap-1.5 text-muted-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-bold h-10 text-xs">
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedCampaignId || isSubmitting}
                  className="rounded-xl font-bold h-10 text-xs gap-1.5 bg-[#4d69ff] hover:bg-[#3d59ef] text-white"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Assign to Campaign
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
