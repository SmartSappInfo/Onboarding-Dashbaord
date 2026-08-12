'use client';

import * as React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { enrollContactsInAutomationAction } from '@/lib/automation-actions';
import type { EnrollContactsOptions } from '@/lib/automations/service';
import type { Automation, EntityContact, AudienceFilter } from '@/lib/types';
import type { ConditionGroup } from '@/lib/automation-condition';
import { AudienceSelector } from '@/app/admin/messaging/audiences/components/AudienceSelector';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, AlertCircle, CheckCircle2, Users } from 'lucide-react';
import { useTerminology } from '@/hooks/use-terminology';

interface AddToAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityIds?: string[];
  workspaceId: string;
  automationId?: string;
  automationName?: string;
  entityContacts?: EntityContact[];
  entityName?: string;
  onComplete?: () => void;
}

const EMPTY_CONTACTS: EntityContact[] = [];
const EMPTY_ENTITY_IDS: string[] = [];

export function AddToAutomationDialog({
  open,
  onOpenChange,
  entityIds = EMPTY_ENTITY_IDS,
  workspaceId,
  automationId,
  automationName,
  entityContacts = EMPTY_CONTACTS,
  entityName,
  onComplete,
}: AddToAutomationDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { activeOrganizationId = 'default' } = useTenant();
  const organizationId = activeOrganizationId;
  const { singular, plural } = useTerminology();

  const isSingleEntity = entityIds.length === 1;

  // Selected Automation state (when opening without pre-bound automationId)
  const [selectedAutomationId, setSelectedAutomationId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Audience Selector state (reusing Message Composer Audience Engine)
  const [audienceMode, setAudienceMode] = React.useState<'all' | 'advanced' | 'saved' | 'manual'>('all');
  const [filters, setFilters] = React.useState<AudienceFilter[]>([]);
  const [filterLogic, setFilterLogic] = React.useState<'AND' | 'OR'>('AND');
  const [groups, setGroups] = React.useState<ConditionGroup[]>([]);
  const [savedAudienceId, setSavedAudienceId] = React.useState('');
  const [selectedContacts, setSelectedContacts] = React.useState<
    Array<{ entityId: string; contactId: string; name?: string; email?: string; phone?: string; entityName?: string }>
  >([]);
  const [contactScope, setContactScope] = React.useState<'primary' | 'signatories' | 'all'>('all');
  const [reachCount, setReachCount] = React.useState<number | null>(null);
  const [reachContactCount, setReachContactCount] = React.useState<number | null>(null);

  // 1. Query active automations for the workspace
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

  // Reset dialog state when opened
  React.useEffect(() => {
    if (open) {
      setSelectedAutomationId(automationId || null);
      setIsSubmitting(false);
      setAudienceMode(isSingleEntity ? 'manual' : 'all');
      setFilters([]);
      setFilterLogic('AND');
      setGroups([]);
      setSavedAudienceId('');
      setContactScope('all');
      setReachCount(null);
      setReachContactCount(null);

      if (isSingleEntity && entityIds.length > 0) {
        const sourceContacts = entityContacts.length > 0 ? entityContacts : [{ id: entityIds[0], name: entityName || singular, email: '', phone: '' }];
        setSelectedContacts(
          sourceContacts.map((c) => ({
            entityId: entityIds[0],
            contactId: c.id,
            name: c.name || entityName,
            email: 'email' in c ? c.email : '',
            phone: 'phone' in c ? c.phone : '',
            entityName: entityName || singular,
          }))
        );
      } else {
        setSelectedContacts([]);
      }
    }
  }, [open, isSingleEntity, entityIds, entityContacts, entityName, singular, automationId]);

  const handleAudienceChange = React.useCallback(
    (updates: {
      audienceMode?: 'all' | 'advanced' | 'saved' | 'manual';
      filters?: AudienceFilter[];
      filterLogic?: 'AND' | 'OR';
      groups?: ConditionGroup[];
      savedAudienceId?: string;
      selectedContacts?: Array<{ entityId: string; contactId: string; name?: string; email?: string; phone?: string; entityName?: string }>;
      contactScope?: 'primary' | 'signatories' | 'all';
    }) => {
      if (updates.audienceMode !== undefined) setAudienceMode(updates.audienceMode);
      if (updates.filters !== undefined) setFilters(updates.filters);
      if (updates.filterLogic !== undefined) setFilterLogic(updates.filterLogic);
      if (updates.groups !== undefined) setGroups(updates.groups);
      if (updates.savedAudienceId !== undefined) setSavedAudienceId(updates.savedAudienceId);
      if (updates.selectedContacts !== undefined) setSelectedContacts(updates.selectedContacts);
      if (updates.contactScope !== undefined) setContactScope(updates.contactScope);
    },
    []
  );

  const handleReachCalculated = React.useCallback((count: number, contactCount: number) => {
    setReachCount(count);
    setReachContactCount(contactCount);
  }, []);

  const handleConfirm = async () => {
    const targetAutomationId = automationId || selectedAutomationId;
    if (!targetAutomationId || !user) return;

    if (audienceMode === 'manual' && selectedContacts.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Contacts Selected',
        description: 'Please select at least one contact to enroll in the automation.',
      });
      return;
    }

    const options: EnrollContactsOptions = {
      audienceMode,
      filters: audienceMode === 'advanced' || audienceMode === 'saved' ? filters : [],
      filterLogic,
      groups: audienceMode === 'advanced' || audienceMode === 'saved' ? groups : [],
      contactScope,
      selectedContacts: audienceMode === 'manual' ? selectedContacts : undefined,
    };

    const targetEntityIds = isSingleEntity ? entityIds : [];

    setIsSubmitting(true);

    try {
      const selectedAutomation = activeAutomations.find((a) => a.id === targetAutomationId);
      const targetAutomationName = automationName || selectedAutomation?.name || 'Automation';

      const result = await enrollContactsInAutomationAction(
        targetEntityIds,
        targetAutomationId,
        workspaceId,
        user.uid,
        options
      );

      if (result.success) {
        toast({
          title: 'Direct Enrollment Scheduled',
          description: `Successfully enqueued ${result.enrolledCount ?? reachContactCount ?? 'all'} contact run(s) into "${targetAutomationName}".`,
          actionConfig: {
            path: `/admin/automations/${targetAutomationId}/edit?tab=activity`,
            label: 'View Activity Logs',
          },
          duration: 10000,
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
  const activeTargetAutomationId = automationId || selectedAutomationId;

  // Dynamic button label based on reach calculation and audience selection
  const getCtaLabel = () => {
    if (audienceMode === 'manual') {
      return `Enroll ${selectedContacts.length} Selected Contact(s)`;
    }
    if (reachContactCount !== null) {
      return `Enroll ${reachContactCount.toLocaleString()} Matching Contacts`;
    }
    if (reachCount !== null) {
      return `Enroll ${reachCount.toLocaleString()} Matching Entities`;
    }
    return 'Enroll Audience in Automation';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-2xl overflow-hidden focus:outline-none flex flex-col h-[90vh] md:h-[82vh]">
        <DialogHeader className="space-y-2 text-left shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-xl text-primary animate-pulse">
                <Sparkles className="h-4 w-4" />
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Enroll Contacts in Automation
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground font-medium leading-relaxed mt-1">
            {automationId
              ? `Filter, segment, and select contacts across all 19,000+ workspace records to enroll directly into this flow.`
              : `Select target contacts across your workspace or ${entityLabel} for automated enrollment.`}
          </DialogDescription>
          {automationId ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-950 dark:text-emerald-200 font-bold mt-2">
              <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Target Flow:</span>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 font-bold px-2.5 py-0.5">
                {automationName || 'Active Automation'}
              </Badge>
            </div>
          ) : null}
        </DialogHeader>

        {/* --- MAIN AUDIENCE SELECTOR CONTENT --- */}
        <div className="flex-1 min-h-0 flex flex-col my-3 space-y-4 overflow-hidden">
          {/* Target Automation Selector (Only when not pre-bound) */}
          {!automationId ? (
            <div className="space-y-1 text-left shrink-0">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                Select Automation
              </label>
              {isLoadingAutomations ? (
                <div className="flex items-center justify-center p-3 border border-dashed border-border rounded-xl bg-muted/20">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
              ) : activeAutomations.length === 0 ? (
                <div className="flex items-center gap-2 p-3 border border-dashed border-amber-500/30 rounded-xl bg-amber-500/5 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-xs font-bold">No active automations found.</p>
                </div>
              ) : (
                <Select value={selectedAutomationId ?? ''} onValueChange={setSelectedAutomationId}>
                  <SelectTrigger className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold">
                    <SelectValue placeholder="Choose an active automation program..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 bg-popover border border-border text-popover-foreground rounded-xl p-1 shadow-xl">
                    <ScrollArea className="h-full max-h-48 overflow-y-auto">
                      {activeAutomations.map((automation) => (
                        <SelectItem key={automation.id} value={automation.id} className="rounded-lg p-2 font-semibold text-xs cursor-pointer">
                          {automation.name}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : null}

          {/* Reusable Message Composer Audience Selector Engine */}
          <div className="flex-1 min-h-0 border border-border rounded-2xl p-4 bg-card/40 overflow-hidden flex flex-col">
            <ScrollArea className="h-full pr-2">
              <AudienceSelector
                workspaceId={workspaceId}
                organizationId={organizationId}
                channel="sms"
                audienceMode={audienceMode}
                filters={filters}
                filterLogic={filterLogic}
                groups={groups}
                savedAudienceId={savedAudienceId}
                selectedContacts={selectedContacts}
                contactScope={contactScope}
                onChange={handleAudienceChange}
                onReachCalculated={handleReachCalculated}
              />
            </ScrollArea>
          </div>
        </div>

        {/* --- FOOTER CTAS --- */}
        <div className="pt-3 shrink-0 flex items-center justify-between border-t border-border mt-auto">
          <div className="flex items-center gap-2">
            {reachCount !== null && (
              <Badge variant="secondary" className="text-xs font-bold bg-primary/10 text-primary border-primary/20 px-3 py-1 rounded-xl">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                {reachCount.toLocaleString()} Matched {reachContactCount !== null ? `(${reachContactCount.toLocaleString()} Contacts)` : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl font-bold h-11 min-h-[44px] text-xs text-muted-foreground hover:text-foreground hover:bg-muted border-border bg-transparent px-4 active:scale-[0.97] transition-all"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                isSubmitting ||
                !activeTargetAutomationId ||
                (audienceMode === 'manual' && selectedContacts.length === 0) ||
                (audienceMode !== 'manual' && (reachCount === 0 || reachContactCount === 0))
              }
              className="rounded-xl font-bold h-11 min-h-[44px] text-xs bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97] transition-all flex items-center gap-1.5 px-5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Enrolling...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {getCtaLabel()}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
