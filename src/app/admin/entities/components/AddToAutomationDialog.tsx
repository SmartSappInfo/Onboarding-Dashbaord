'use client';

import * as React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { enrollContactsInAutomationAction } from '@/lib/automation-actions';
import type { Automation, EntityContact } from '@/lib/types';
import { getEntityContactsAction } from '@/app/actions/entity-contact-actions';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, AlertCircle, PlayCircle, ArrowLeft, Users, ShieldCheck, UserCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/hooks/use-terminology';

interface AddToAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityIds: string[];
  workspaceId: string;
  entityContacts?: EntityContact[];
  entityName?: string;
  onComplete?: () => void;
}

type Step = 'pick-contacts' | 'pick-automation';
type BulkScope = 'primary' | 'signatories' | 'roles' | 'all';

const EMPTY_CONTACTS: EntityContact[] = [];

export function AddToAutomationDialog({
  open,
  onOpenChange,
  entityIds,
  workspaceId,
  entityContacts = EMPTY_CONTACTS,
  entityName,
  onComplete,
}: AddToAutomationDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { singular, plural } = useTerminology();

  const isSingleEntity = entityIds.length === 1;

  // Navigation steps
  const [step, setStep] = React.useState<Step>(isSingleEntity ? 'pick-contacts' : 'pick-automation');

  // Contact list state (single entity mode)
  const [contacts, setContacts] = React.useState<EntityContact[]>(entityContacts);
  const [isLoadingContacts, setIsLoadingContacts] = React.useState(false);
  const [selectedContactIds, setSelectedContactIds] = React.useState<Set<string>>(new Set());

  // Bulk scopes and filters
  const [bulkScope, setBulkScope] = React.useState<BulkScope>('primary');
  const [rolesInput, setRolesInput] = React.useState<string>('');

  const [selectedAutomationId, setSelectedAutomationId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // 1. Query automations for the workspace
  const automationsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'automations'),
      where('workspaceIds', 'array-contains', workspaceId)
    );
  }, [firestore, workspaceId]);

  const { data: rawAutomations, isLoading: isLoadingAutomations } = useCollection<Automation>(automationsQuery);

  const activeAutomations = React.useMemo(() => {
    if (!rawAutomations) return [];
    return rawAutomations.filter((a) => a.isActive && !a.isArchived);
  }, [rawAutomations]);

  // Load contacts for single entity if not passed or empty
  React.useEffect(() => {
    if (open) {
      setSelectedAutomationId(null);
      setIsSubmitting(false);
      setBulkScope('primary');
      setRolesInput('');

      if (isSingleEntity) {
        setStep('pick-contacts');
        if (!entityContacts || entityContacts.length === 0) {
          setIsLoadingContacts(true);
          getEntityContactsAction(entityIds[0])
            .then((res) => {
              setContacts(res);
              const primary = res.find((c) => c.isPrimary);
              setSelectedContactIds(primary ? new Set([primary.id]) : new Set());
              setIsLoadingContacts(false);
            })
            .catch((err) => {
              console.error('Failed to load entity contacts:', err);
              setIsLoadingContacts(false);
            });
        } else {
          setContacts(entityContacts);
          const primary = entityContacts.find((c) => c.isPrimary);
          setSelectedContactIds(primary ? new Set([primary.id]) : new Set());
        }
      } else {
        setStep('pick-automation');
        setSelectedContactIds(new Set());
      }
    }
  }, [open, isSingleEntity, entityIds, entityContacts]);

  // Single-entity quick selects
  const selectPrimary = () => {
    const ids = contacts.filter((c) => c.isPrimary).map((c) => c.id);
    setSelectedContactIds(new Set(ids));
  };

  const selectSignatories = () => {
    const ids = contacts.filter((c) => c.isSignatory).map((c) => c.id);
    setSelectedContactIds(new Set(ids));
  };

  const selectAll = () => {
    setSelectedContactIds(new Set(contacts.map((c) => c.id)));
  };

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!selectedAutomationId || !user) return;

    let options: {
      contactScope: 'primary' | 'signatories' | 'roles' | 'all' | 'custom';
      selectedContactIds?: string[];
      roles?: string[];
    };

    if (isSingleEntity) {
      if (selectedContactIds.size === 0) {
        toast({
          variant: 'destructive',
          title: 'No Contacts Selected',
          description: 'Please select at least one contact to enroll.',
        });
        return;
      }
      options = {
        contactScope: 'custom',
        selectedContactIds: Array.from(selectedContactIds),
      };
    } else {
      if (bulkScope === 'roles' && !rolesInput.trim()) {
        toast({
          variant: 'destructive',
          title: 'Role Specification Required',
          description: 'Please enter at least one contact role to filter by.',
        });
        return;
      }
      options = {
        contactScope: bulkScope,
        roles: bulkScope === 'roles' ? rolesInput.split(',').map((r) => r.trim()).filter(Boolean) : undefined,
      };
    }

    setIsSubmitting(true);

    try {
      const selectedAutomation = activeAutomations.find((a) => a.id === selectedAutomationId);
      const automationName = selectedAutomation?.name || 'Automation';

      const result = await enrollContactsInAutomationAction(
        entityIds,
        selectedAutomationId,
        workspaceId,
        user.uid,
        options
      );

      if (result.success) {
        toast({
          title: 'Direct Enrollment Scheduled',
          description: `Successfully enqueued ${result.enrolledCount ?? entityIds.length} contact run(s) into "${automationName}".`,
        });
        onComplete?.();
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Enrollment Failed',
          description: result.error || 'Failed to enroll contacts. Please try again.',
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errMsg || 'An unexpected error occurred during direct enrollment.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const entityLabel = entityIds.length === 1 ? singular : plural;
  const isContactsPickStep = step === 'pick-contacts' && isSingleEntity;
  const stepLabel = isContactsPickStep ? 'Step 1 of 2' : isSingleEntity ? 'Step 2 of 2' : 'Step 1 of 1';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl border-none bg-slate-900 text-slate-100 p-6 shadow-2xl overflow-hidden focus:outline-none flex flex-col h-[75vh] md:h-[65vh]">
        <DialogHeader className="space-y-2 text-left shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-xl text-primary animate-pulse">
                <Sparkles className="h-4 w-4" />
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-white">
                {isContactsPickStep ? 'Select Contacts' : 'Direct Automation Enrollment'}
              </DialogTitle>
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-950/80 px-2 py-1 rounded-lg shrink-0 border border-slate-800">
              {stepLabel}
            </span>
          </div>
          <DialogDescription className="text-xs text-slate-400 font-medium leading-relaxed mt-1">
            {isContactsPickStep
              ? `Choose which specific contacts from ${entityName || 'this entity'} to enroll in the workflow.`
              : `Enroll targeted contacts from the selected ${entityLabel} directly. This bypasses the trigger condition.`}
          </DialogDescription>
        </DialogHeader>

        {/* --- STEP 1: Contacts checklist (Single entity only) --- */}
        {isContactsPickStep && (
          <div className="flex-1 min-h-0 flex flex-col my-4 space-y-3">
            {/* Quick selectors */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Quick:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={selectPrimary}
                className="h-7 px-2.5 rounded-lg text-[10px] font-bold gap-1 bg-slate-950/40 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <UserCheck className="h-3 w-3 text-blue-400" /> Primary
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectSignatories}
                className="h-7 px-2.5 rounded-lg text-[10px] font-bold gap-1 bg-slate-950/40 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <ShieldCheck className="h-3 w-3 text-amber-400" /> Signatories
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="h-7 px-2.5 rounded-lg text-[10px] font-bold gap-1 bg-slate-950/40 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <Users className="h-3 w-3 text-violet-400" /> All
              </Button>
              {selectedContactIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedContactIds(new Set())}
                  className="h-7 px-2 rounded-lg text-[10px] font-bold text-slate-500 hover:text-rose-400 hover:bg-transparent ml-auto"
                >
                  Clear
                </Button>
              )}
            </div>

            <div className="flex-1 min-h-0 border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/30">
              {isLoadingContacts ? (
                <div className="flex items-center justify-center p-12 h-full">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center opacity-50 h-full">
                  <Users className="h-8 w-8 text-slate-500 mb-2" />
                  <p className="text-xs font-semibold text-slate-400">No contacts registered for this school.</p>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="divide-y divide-slate-800/50">
                    {contacts.map((contact) => {
                      const isChecked = selectedContactIds.has(contact.id);
                      const hasDetails = contact.phone || contact.email;
                      return (
                        <div
                          key={contact.id}
                          onClick={() => toggleContact(contact.id)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                            isChecked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-slate-800/20',
                            !hasDetails && 'opacity-50'
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleContact(contact.id)}
                            className="border-slate-700 data-[state=checked]:bg-primary"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-slate-100 truncate">{contact.name}</p>
                              {contact.isPrimary && (
                                <Badge variant="secondary" className="text-[7px] font-bold uppercase bg-blue-500/10 text-blue-400 border-blue-500/20 px-1.5 py-0">
                                  Primary
                                </Badge>
                              )}
                              {contact.isSignatory && (
                                <Badge className="text-[7px] font-bold uppercase bg-amber-500/20 text-amber-400 border-amber-500/30 px-1.5 py-0">
                                  Signatory
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[7px] font-semibold uppercase tracking-tighter px-1.5 py-0 border-slate-700 text-slate-400">
                                {contact.typeLabel || contact.typeKey}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400 font-medium">
                              {contact.phone ? (
                                <span className="font-mono">{contact.phone}</span>
                              ) : (
                                <span className="text-rose-400/70 italic text-[9px]">No phone</span>
                              )}
                              {contact.email ? (
                                <span className="truncate max-w-[140px]">{contact.email}</span>
                              ) : (
                                <span className="text-rose-400/70 italic text-[9px]">No email</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="pt-3 shrink-0 flex items-center justify-between gap-2 border-t border-slate-800/60">
              <span className="text-[10px] font-bold text-slate-400">
                {selectedContactIds.size} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="rounded-xl font-bold h-10 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep('pick-automation')}
                  disabled={selectedContactIds.size === 0}
                  className="rounded-xl font-bold h-10 text-xs bg-[#4d69ff] hover:bg-[#3d59ef] text-white active:scale-[0.97] transition-all"
                >
                  Choose Automation →
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* --- STEP 2 (or only step for bulk): Scope & Automation picker --- */}
        {step === 'pick-automation' && (
          <div className="flex-1 min-h-0 flex flex-col my-4 space-y-4">
            {/* Bulk scope selection */}
            {!isSingleEntity && (
              <div className="shrink-0 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 block text-left">
                  Target Scope (All {entityIds.length} Entities)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'primary', label: 'Primary Only' },
                    { key: 'signatories', label: 'Signatories' },
                    { key: 'all', label: 'All Contacts' },
                    { key: 'roles', label: 'By Role(s)' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setBulkScope(opt.key)}
                      className={cn(
                        'px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all text-center',
                        bulkScope === opt.key
                          ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                          : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {bulkScope === 'roles' && (
                  <div className="mt-2.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200 text-left">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      Roles filter (comma-separated)
                    </label>
                    <Input
                      value={rolesInput}
                      onChange={(e) => setRolesInput(e.target.value)}
                      placeholder="e.g. Finance, Director, Owner"
                      className="h-10 rounded-xl bg-slate-950/40 border-slate-800 text-slate-200 text-xs font-semibold focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-transparent placeholder:text-slate-600"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Target counts summary */}
            {isSingleEntity && (
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Contacts</span>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/15 font-bold px-2 py-0.5 border border-primary/20 rounded-lg">
                  {selectedContactIds.size} contact(s) selected
                </Badge>
              </div>
            )}

            {/* Automation Selection Selector */}
            <div className="space-y-1.5 text-left shrink-0">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                Select Automation
              </label>

              {isLoadingAutomations ? (
                <div className="flex items-center justify-center p-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </div>
              ) : activeAutomations.length === 0 ? (
                <div className="flex items-center gap-2.5 p-4 border border-dashed border-amber-500/30 rounded-xl bg-amber-500/5 text-amber-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-xs font-bold leading-normal">
                    No active automations found. Create or activate one first.
                  </p>
                </div>
              ) : (
                <Select
                  value={selectedAutomationId || undefined}
                  onValueChange={setSelectedAutomationId}
                >
                  <SelectTrigger className="w-full h-11 px-3.5 rounded-xl border border-slate-800 bg-slate-950/40 text-slate-200 focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-semibold transition-all">
                    <SelectValue placeholder="Choose an active automation program..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-1 shadow-xl">
                    <ScrollArea className="h-full max-h-48 overflow-y-auto">
                      {activeAutomations.map((automation) => (
                        <SelectItem
                          key={automation.id}
                          value={automation.id}
                          className="rounded-lg p-2.5 font-semibold text-xs cursor-pointer hover:bg-slate-850 focus:bg-slate-800 focus:text-white transition-colors"
                        >
                          {automation.name}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="pt-3 mt-auto shrink-0 flex items-center justify-between gap-2 border-t border-slate-800/60">
              {isSingleEntity ? (
                <Button
                  variant="ghost"
                  onClick={() => setStep('pick-contacts')}
                  disabled={isSubmitting}
                  className="rounded-xl font-bold h-10 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="rounded-xl font-bold h-10 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800 bg-transparent"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedAutomationId || isSubmitting}
                  className="rounded-xl font-bold h-10 text-xs bg-primary text-white hover:bg-primary/95 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97] transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Enrolling...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-3.5 w-3.5" />
                      Enroll Target(s)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
