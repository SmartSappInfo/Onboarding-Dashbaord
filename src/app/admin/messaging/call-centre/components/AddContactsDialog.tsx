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
import { Loader2, Search, User } from 'lucide-react';

interface AddContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  workspaceId: string;
  campaignName: string;
}

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

  // Search hook
  const { results, isLoading, hasMore, loadMore } = useEntitySearch({
    search: searchTerm,
    pageSize: 15,
    enabled: open,
  });

  // Reset selection on dialog open/close
  React.useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setSearchTerm('');
    }
  }, [open]);

  const toggleSelect = (entityId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  };

  const handleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allPageIds = results.map((r) => r.entityId).filter(Boolean) as string[];
      const allSelected = allPageIds.every((id) => next.has(id));
      if (allSelected) {
        allPageIds.forEach((id) => next.delete(id));
      } else {
        allPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleAddContacts = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const entityIdsArray = Array.from(selectedIds);
      const result = await addContactsToCallCampaignAction(
        campaignId,
        entityIdsArray,
        workspaceId,
        user?.uid || ''
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
          <DialogTitle className="font-bold tracking-tight">Add Contacts to Campaign</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Dynamic audience for campaign: <span className="font-semibold text-foreground">{campaignName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Search Input bar */}
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

        {/* Selected count badge info */}
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
              Clear Selection
            </Button>
          </div>
        )}

        {/* Content list block */}
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
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : null}
                  Load More
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="pt-4 shrink-0 flex flex-row items-center justify-end gap-2 border-t border-border/50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold h-11 text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddContacts}
            disabled={selectedIds.size === 0 || isSubmitting}
            className="rounded-xl font-bold h-11 text-xs gap-1.5 bg-[#4d69ff] hover:bg-[#3d59ef] text-white"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Add to Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
