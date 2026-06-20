'use client';

import * as React from 'react';
import { useEntitySearch } from '@/hooks/use-entity-search';
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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, User, ArrowLeft, UserCheck, ShieldCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContactOverride } from '@/app/admin/entities/components/AddToCampaignDialog';

interface AddContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  workspaceId: string;
  campaignName: string;
}

type Scope = 'primary' | 'signatories' | 'all';
type Step = 'pick-entities' | 'pick-scope';

export function AddContactsDialog({
  open,
  onOpenChange,
  campaignId,
  workspaceId,
  campaignName,
}: AddContactsDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [step, setStep] = React.useState<Step>('pick-entities');
  const [scope, setScope] = React.useState<Scope>('primary');

  // Search hook
  const { results, isLoading, hasMore, loadMore } = useEntitySearch({
    search: searchTerm,
    pageSize: 60,
    enabled: open,
  });

  // Reset on dialog open/close
  React.useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setSearchTerm('');
      setStep('pick-entities');
      setScope('primary');
    }
  }, [open]);

  const toggleSelect = (entityId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) next.delete(entityId);
      else next.add(entityId);
      return next;
    });
  };

  const handleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allPageIds = results.map((r) => r.entityId).filter(Boolean) as string[];
      const allSelected = allPageIds.every((id) => next.has(id));
      if (allSelected) allPageIds.forEach((id) => next.delete(id));
      else allPageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  // Build contact overrides from the selected entities + scope
  const buildOverrides = (): ContactOverride[] | undefined => {
    // We resolve scope server-side via contactScope — pass no overrides
    // but we need the scope to be respected. For now we send entityIds and rely
    // on the campaign's audienceDefinition.contactScope set by the caller.
    // If scope !== 'primary' we pass overrides derived from entity contact data.
    const overrides: ContactOverride[] = [];
    const selectedEntities = results.filter(r => r.entityId && selectedIds.has(r.entityId));

    for (const entity of selectedEntities) {
      const contacts = (entity as any).entityContacts as Array<{
        id: string; name: string; phone?: string; email?: string;
        isPrimary?: boolean; isSignatory?: boolean;
      }> | undefined;

      if (!contacts || contacts.length === 0) continue;

      let filtered = contacts;
      if (scope === 'primary') filtered = contacts.filter(c => c.isPrimary);
      else if (scope === 'signatories') filtered = contacts.filter(c => c.isSignatory);
      // 'all' → use all contacts

      for (const c of filtered) {
        if (!c.phone && !c.email) continue; // skip contacts with no reachable info
        overrides.push({
          entityId: entity.entityId!,
          contactId: c.id,
          contactName: c.name,
          phone: c.phone || '',
          email: c.email || '',
        });
      }
    }

    // Fall back to entity-level if no contact data available (legacy)
    return overrides.length > 0 ? overrides : undefined;
  };

  const handleAddContacts = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const entityIdsArray = Array.from(selectedIds);
      const overrides = buildOverrides();

      const result = await addContactsToCallCampaignAction(
        campaignId,
        entityIdsArray,
        workspaceId,
        user?.uid || '',
        overrides,
      );
      if (result.success) {
        toast({
          title: 'Contacts Added',
          description: `Successfully added ${result.count} new contact(s) to campaign: ${campaignName}`,
        });
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Operation Failed',
          description: result.error || 'Failed to add contacts.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const allPageIds = results.map((r) => r.entityId).filter(Boolean) as string[];
  const isAllSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md flex flex-col h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-bold tracking-tight">
                {step === 'pick-entities' ? 'Add Contacts to Campaign' : 'Choose Contact Scope'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {step === 'pick-entities'
                  ? <>Campaign: <span className="font-semibold text-foreground">{campaignName}</span></>
                  : <>{selectedIds.size} {selectedIds.size === 1 ? 'entity' : 'entities'} selected — which contacts to add?</>
                }
              </DialogDescription>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-2 py-1 rounded-lg shrink-0">
              Step {step === 'pick-entities' ? '1' : '2'} of 2
            </span>
          </div>
        </DialogHeader>

        {/* ── STEP 1: Entity Picker ─────────────────────────────────────── */}
        {step === 'pick-entities' && (
          <>
            {/* Search bar */}
            <div className="relative shrink-0">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search contacts by name..."
                className="pl-10 h-11 rounded-xl"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Selection badge */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between px-1 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground hover:text-rose-500 px-1 h-auto"
                >
                  Clear
                </Button>
              </div>
            )}

            {/* Entity list */}
            <div className="flex-1 min-h-0 border border-border rounded-xl overflow-hidden bg-muted/10 flex flex-col">
              {results.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
                  <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAllOnPage} />
                  <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    Select All on Page
                  </span>
                </div>
              )}

              <ScrollArea className="flex-1">
                {isLoading && results.length === 0 ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  </div>
                ) : results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center opacity-40">
                    <User className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs font-semibold text-muted-foreground">No contacts found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {results.map((entity) => {
                      const id = entity.entityId;
                      if (!id) return null;
                      const isChecked = selectedIds.has(id);
                      return (
                        <div
                          key={id}
                          onClick={() => toggleSelect(id)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                        >
                          <Checkbox checked={isChecked} onCheckedChange={() => toggleSelect(id)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate">{entity.displayName}</p>
                            <p className="text-[9px] font-medium text-muted-foreground truncate uppercase mt-0.5">
                              {entity.entityType}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {hasMore && (
                  <div className="p-3 text-center border-t border-border/40 bg-muted/5">
                    <Button
                      onClick={loadMore}
                      disabled={isLoading}
                      variant="ghost"
                      size="sm"
                      className="rounded-lg font-bold text-[10px] uppercase tracking-wider h-8"
                    >
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                      Load More
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </div>

            <DialogFooter className="pt-3 shrink-0 flex flex-row items-center justify-end gap-2 border-t border-border/50">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-bold h-11 text-xs">
                Cancel
              </Button>
              <Button
                onClick={() => setStep('pick-scope')}
                disabled={selectedIds.size === 0}
                className="rounded-xl font-bold h-11 text-xs gap-1.5 bg-[#4d69ff] hover:bg-[#3d59ef] text-white"
              >
                Next: Choose Scope →
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── STEP 2: Contact Scope Selector ────────────────────────────── */}
        {step === 'pick-scope' && (
          <>
            <div className="flex-1 flex flex-col gap-4 justify-center py-4">
              <p className="text-xs text-muted-foreground text-center">
                For each of the <span className="font-bold text-foreground">{selectedIds.size}</span> selected {selectedIds.size === 1 ? 'entity' : 'entities'}, which contacts should be added to the call queue?
              </p>

              <div className="grid grid-cols-1 gap-3">
                {([
                  { value: 'primary', label: 'Primary Contact Only', desc: 'Add only the main contact for each entity', icon: UserCheck, color: 'blue' },
                  { value: 'signatories', label: 'Signatories', desc: 'Add authorised signers / decision makers', icon: ShieldCheck, color: 'amber' },
                  { value: 'all', label: 'All Contacts', desc: 'Add every registered contact — one call per person', icon: Users, color: 'violet' },
                ] as const).map(({ value, label, desc, icon: Icon, color }) => (
                  <button
                    key={value}
                    onClick={() => setScope(value)}
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                      scope === value
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:bg-muted/30'
                    )}
                  >
                    <div className={cn(
                      'p-2.5 rounded-xl shrink-0',
                      color === 'blue' && 'bg-blue-500/10 text-blue-500',
                      color === 'amber' && 'bg-amber-500/10 text-amber-500',
                      color === 'violet' && 'bg-violet-500/10 text-violet-500',
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    <div className={cn(
                      'ml-auto h-4 w-4 rounded-full border-2 shrink-0 transition-all',
                      scope === value ? 'border-primary bg-primary' : 'border-border'
                    )} />
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-3 shrink-0 flex flex-row items-center justify-between gap-2 border-t border-border/50">
              <Button
                variant="ghost"
                onClick={() => setStep('pick-entities')}
                className="rounded-xl font-bold h-11 text-xs gap-1.5 text-muted-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-bold h-11 text-xs">
                  Cancel
                </Button>
                <Button
                  onClick={handleAddContacts}
                  disabled={isSubmitting}
                  className="rounded-xl font-bold h-11 text-xs gap-1.5 bg-[#4d69ff] hover:bg-[#3d59ef] text-white"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Add to Campaign
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
