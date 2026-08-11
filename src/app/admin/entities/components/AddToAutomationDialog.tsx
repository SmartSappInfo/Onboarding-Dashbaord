'use client';

import * as React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { enrollContactsInAutomationAction } from '@/lib/automation-actions';
import type { Automation, EntityContact } from '@/lib/types';
import { getEntityContactsAction } from '@/app/actions/entity-contact-actions';
import { getEffectiveContactTypes } from '@/lib/contact-type-actions';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Loader2, Sparkles, AlertCircle, Search, Users, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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

type BulkScope = 'all' | 'primary' | 'signatories' | 'roles' | 'custom';

export interface WorkspaceContactItem {
  id: string;
  entityId: string;
  entityName: string;
  name: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  isSignatory: boolean;
  typeKey?: string;
  typeLabel?: string;
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
  const { singular, plural } = useTerminology();

  const isSingleEntity = entityIds.length === 1;

  // Contact list state (single entity mode)
  const [contacts, setContacts] = React.useState<EntityContact[]>(entityContacts);
  const [isLoadingContacts, setIsLoadingContacts] = React.useState(false);
  const [selectedContactIds, setSelectedContactIds] = React.useState<Set<string>>(new Set());

  // Search & Filter state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [bulkScope, setBulkScope] = React.useState<BulkScope>('all');
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = React.useState<{ label: string; value: string }[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = React.useState(false);

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

  // 2. Query workspace entities to extract contacts when entityIds is empty or canvas mode is active
  const isCanvasMode = !isSingleEntity;
  const { results: searchedEntities, isLoading: isLoadingWorkspaceEntities } = useEntitySearch({
    search: '',
    pageSize: 100,
    filters: [{ field: 'status', value: 'active' }],
    enabled: open && isCanvasMode,
  });

  // Flatten workspace entities into WorkspaceContactItem list with unique ID sanitization
  const workspaceContacts = React.useMemo(() => {
    if (!searchedEntities || searchedEntities.length === 0) return [];
    const list: WorkspaceContactItem[] = [];

    searchedEntities.forEach((entity) => {
      const eName = entity.displayName || entity.primaryContactName || entity.entityName || 'Primary Contact';
      const primaryEmail = entity.primaryEmail || '';
      const primaryPhone = entity.primaryPhone || '';
      const entityContactsList = entity.entityContacts || [];

      if (entityContactsList.length === 0) {
        list.push({
          id: entity.id || entity.entityId,
          entityId: entity.entityId || entity.id,
          entityName: eName,
          name: eName,
          email: primaryEmail,
          phone: primaryPhone,
          isPrimary: true,
          isSignatory: false,
          typeKey: 'primary',
          typeLabel: 'Primary',
        });
      } else {
        entityContactsList.forEach((c, idx) => {
          const fallbackContactId = c.id || `${entity.entityId || entity.id}_c_${idx}`;
          list.push({
            id: fallbackContactId,
            entityId: entity.entityId || entity.id,
            entityName: eName,
            name: c.name || eName,
            email: c.email || primaryEmail,
            phone: c.phone || primaryPhone,
            isPrimary: Boolean(c.isPrimary),
            isSignatory: Boolean(c.isSignatory),
            typeKey: c.typeKey,
            typeLabel: c.typeLabel || c.typeKey,
          });
        });
      }
    });

    return list;
  }, [searchedEntities]);

  // Filter contacts by Scope and Search query with empty role guard
  const filteredWorkspaceContacts = React.useMemo(() => {
    let source: WorkspaceContactItem[] = isSingleEntity
      ? contacts.map((c, idx) => ({
          id: c.id || `${entityIds[0]}_c_${idx}`,
          entityId: entityIds[0],
          entityName: entityName || `1 ${singular}`,
          name: c.name || 'Contact',
          email: c.email || '',
          phone: c.phone || '',
          isPrimary: Boolean(c.isPrimary),
          isSignatory: Boolean(c.isSignatory),
          typeKey: c.typeKey,
          typeLabel: c.typeLabel || c.typeKey,
        }))
      : workspaceContacts;

    if (bulkScope === 'primary') {
      source = source.filter((c) => c.isPrimary);
    } else if (bulkScope === 'signatories') {
      source = source.filter((c) => c.isSignatory);
    } else if (bulkScope === 'roles') {
      if (selectedRoles.length === 0) {
        // Empty role selection guard: show 0 contacts until at least 1 role is picked
        source = [];
      } else {
        const normalizedRoles = selectedRoles.map((r) => r.toLowerCase().trim());
        source = source.filter(
          (c) =>
            (c.typeLabel && normalizedRoles.includes(c.typeLabel.toLowerCase().trim())) ||
            (c.typeKey && normalizedRoles.includes(c.typeKey.toLowerCase().trim()))
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      source = source.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.entityName.toLowerCase().includes(q) ||
          (c.typeLabel && c.typeLabel.toLowerCase().includes(q))
      );
    }

    return source;
  }, [isSingleEntity, contacts, workspaceContacts, entityIds, entityName, singular, bulkScope, selectedRoles, searchQuery]);

  // Load available roles dynamically based on active workspace
  React.useEffect(() => {
    if (open && workspaceId) {
      setIsLoadingRoles(true);
      let cancelled = false;

      getEffectiveContactTypes('institution', undefined, workspaceId)
        .then((types) => {
          if (cancelled) return;
          setAvailableRoles(
            types
              .filter((t) => t.active)
              .map((t) => ({ label: t.label, value: t.label }))
          );
          setIsLoadingRoles(false);
        })
        .catch((err) => {
          console.error('Failed to load effective contact types:', err);
          if (!cancelled) setIsLoadingRoles(false);
        });

      return () => {
        cancelled = true;
      };
    }
  }, [open, workspaceId]);

  // Load contacts for single entity if not passed or empty
  React.useEffect(() => {
    if (open) {
      setSelectedAutomationId(automationId || null);
      setIsSubmitting(false);
      setBulkScope(isSingleEntity ? 'custom' : 'all');
      setSelectedRoles([]);
      setSearchQuery('');

      if (isSingleEntity) {
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
        setSelectedContactIds(new Set());
      }
    }
  }, [open, isSingleEntity, entityIds, entityContacts, automationId]);

  // Selection toggle handlers
  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedContactIds);
    filteredWorkspaceContacts.forEach((c) => next.add(c.id));
    setSelectedContactIds(next);
  };

  const deselectAllFiltered = () => {
    const next = new Set(selectedContactIds);
    filteredWorkspaceContacts.forEach((c) => next.delete(c.id));
    setSelectedContactIds(next);
  };

  const handleConfirm = async () => {
    if (!selectedAutomationId || !user) return;

    const hasSpecificChecked = selectedContactIds.size > 0;
    const isSearchFiltered = searchQuery.trim().length > 0 || (bulkScope === 'roles' && selectedRoles.length > 0);
    const isCustomScope = hasSpecificChecked || isSearchFiltered;

    const selectedList = hasSpecificChecked
      ? filteredWorkspaceContacts.filter((c) => selectedContactIds.has(c.id))
      : filteredWorkspaceContacts;

    let targetEntityIds = isSingleEntity
      ? entityIds
      : Array.from(new Set(selectedList.map((c) => c.entityId)));

    if (targetEntityIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Contacts Selected',
        description: 'Please select or filter at least one contact to enroll.',
      });
      return;
    }

    const effectiveSelectedContactIds = hasSpecificChecked
      ? Array.from(selectedContactIds)
      : isSearchFiltered
      ? filteredWorkspaceContacts.map((c) => c.id)
      : undefined;

    const options = {
      contactScope: isCustomScope ? ('custom' as const) : bulkScope,
      selectedContactIds: effectiveSelectedContactIds,
      roles: bulkScope === 'roles' ? selectedRoles : undefined,
    };

    setIsSubmitting(true);

    try {
      const selectedAutomation = activeAutomations.find((a) => a.id === selectedAutomationId);
      const targetAutomationName = automationName || selectedAutomation?.name || 'Automation';

      const result = await enrollContactsInAutomationAction(
        targetEntityIds,
        selectedAutomationId,
        workspaceId,
        user.uid,
        options
      );

      if (result.success) {
        toast({
          title: 'Direct Enrollment Scheduled',
          description: `Successfully enqueued ${result.enrolledCount ?? targetEntityIds.length} contact run(s) into "${targetAutomationName}".`,
          actionConfig: {
            path: `/admin/automations/${selectedAutomationId}/edit?tab=activity`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[95vw] rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-2xl overflow-hidden focus:outline-none flex flex-col h-[85vh] md:h-[75vh]">
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
              ? `Search and select contacts from your workspace to enroll directly into this automation flow.`
              : `Enroll targeted contacts from the selected ${entityLabel} directly.`}
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

        {/* --- MAIN ENROLLMENT CONTENT --- */}
        <div className="flex-1 min-h-0 flex flex-col my-3 space-y-3">
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
                  <SelectTrigger className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold">
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

          {/* Search Input Bar */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by name, email, role, or institution..."
              className="pl-9 pr-8 h-10 rounded-xl border-border bg-background/50 text-xs font-semibold focus:ring-2 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Target Scope Filters */}
          <div className="shrink-0 space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Filter Scope
              </label>
              <span className="text-[10px] font-bold text-muted-foreground">
                Showing {filteredWorkspaceContacts.length} contact(s)
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { key: 'all' as BulkScope, label: 'All Contacts' },
                { key: 'primary' as BulkScope, label: 'Primary Only' },
                { key: 'signatories' as BulkScope, label: 'Signatories' },
                { key: 'roles' as BulkScope, label: 'By Role(s)' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setBulkScope(opt.key)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all text-center truncate',
                    bulkScope === opt.key
                      ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                      : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {bulkScope === 'roles' && (
              <div className="mt-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                {isLoadingRoles ? (
                  <div className="h-11 flex items-center px-3 border border-border rounded-xl bg-muted/20 min-h-[44px]">
                    <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin mr-2" />
                    <span className="text-xs text-muted-foreground font-semibold">Loading roles...</span>
                  </div>
                ) : (
                  <MultiSelect
                    options={availableRoles}
                    value={selectedRoles}
                    onChange={setSelectedRoles}
                    placeholder="Select roles..."
                    className="min-h-[44px]"
                    maxCount={3}
                  />
                )}
              </div>
            )}
          </div>

          {/* Quick Selection Toolbar */}
          <div className="shrink-0 flex items-center justify-between px-1 py-1 bg-muted/30 border border-border/80 rounded-xl">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                {selectedContactIds.size} Checked
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-[10px] font-bold text-primary hover:underline px-2 py-1 rounded-lg"
              >
                Select All ({filteredWorkspaceContacts.length})
              </button>
              {selectedContactIds.size > 0 && (
                <button
                  type="button"
                  onClick={deselectAllFiltered}
                  className="text-[10px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Contact Selection List */}
          <div className="flex-1 min-h-0 border border-border rounded-xl overflow-hidden bg-muted/10">
            {isLoadingContacts || isLoadingWorkspaceEntities ? (
              <div className="h-full flex items-center justify-center p-8 text-center space-y-2">
                <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto" />
                <p className="text-xs font-semibold text-muted-foreground">Loading workspace contacts...</p>
              </div>
            ) : filteredWorkspaceContacts.length === 0 ? (
              <div className="h-full flex items-center justify-center p-8 text-center space-y-2">
                <Users className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                <p className="text-xs font-bold text-foreground">No contacts found</p>
                <p className="text-[10px] text-muted-foreground">
                  {bulkScope === 'roles' && selectedRoles.length === 0
                    ? 'Please select at least one role above to view contacts.'
                    : 'Try adjusting your search query or filter scope.'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-full p-2">
                <div className="space-y-1.5">
                  {filteredWorkspaceContacts.map((contact) => {
                    const isChecked = selectedContactIds.has(contact.id);
                    return (
                      <div
                        key={`${contact.entityId}-${contact.id}`}
                        onClick={() => toggleContact(contact.id)}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none',
                          isChecked
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border/60 bg-card hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleContact(contact.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-md h-4 w-4 border-border data-[state=checked]:bg-primary shrink-0"
                          />
                          <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center uppercase shrink-0">
                            {contact.name ? contact.name.substring(0, 2) : 'C'}
                          </div>
                          <div className="space-y-0.5 min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-foreground truncate">{contact.name}</p>
                              {contact.isPrimary && (
                                <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary border-primary/20 uppercase">
                                  Primary
                                </Badge>
                              )}
                              {contact.isSignatory && (
                                <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 uppercase">
                                  Signatory
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] font-semibold text-muted-foreground truncate">{contact.entityName}</p>
                            <p className="text-[10px] font-mono text-muted-foreground/80 truncate">
                              {contact.email || contact.phone || 'No direct contact info'}
                            </p>
                          </div>
                        </div>
                        {contact.typeLabel && (
                          <Badge variant="secondary" className="text-[9px] font-semibold px-2 py-0.5 rounded-lg shrink-0 ml-2">
                            {contact.typeLabel}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* --- FOOTER CTAS --- */}
        <div className="pt-3 shrink-0 flex items-center justify-end gap-2 border-t border-border mt-auto">
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
            disabled={isSubmitting || !selectedAutomationId || (selectedContactIds.size === 0 && filteredWorkspaceContacts.length === 0)}
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
                Enroll {selectedContactIds.size > 0 ? `${selectedContactIds.size} Selected` : `All (${filteredWorkspaceContacts.length})`} Contacts
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
