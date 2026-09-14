'use client';

/**
 * ARCHITECTURAL GUIDANCE & MAINTAINER NOTES (Call Centre Queue Management - Rule 10):
 * - Displays all contacts currently queued in a call campaign (scheduled, callbacks, deferred, in-progress, completed).
 * - Supports real-time client-side search across contact name, parent entity name, phone, email, and notes.
 * - Provides status-based pill filtering and counters.
 * - Supports single and batch contact removal for uncompleted queue items, calling `removeContactsFromCampaignAction`.
 * - Completed items preserve analytics/audit logs and are protected against deletion.
 * - Adheres strictly to Workspace Rules: min-h-[44px] touch targets on mobile (Rule 8), zero 'any' typing (Rule 5), and accessible ARIA attributes.
 */

import * as React from 'react';
import Link from 'next/link';
import { 
  Search, 
  Trash2, 
  UserPlus, 
  Phone, 
  Mail, 
  AlertCircle, 
  Building2, 
  UserCircle2, 
  Check, 
  Copy, 
  Loader2,
  Calendar,
  FilterX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { removeContactsFromCampaignAction } from '@/lib/call-centre-actions';
import { formatSafeDate, formatSafeRelativeTime } from '@/lib/date-utils';
import { getErrorMessage } from '@/lib/errors/report-error';
import { cn } from '@/lib/utils';
import type { CallCampaign, CallQueueItem, CallQueueItemStatus } from '@/lib/types';

interface CampaignQueueTabProps {
  campaign: CallCampaign;
  queueItems: CallQueueItem[];
  workspaceId: string;
  onOpenAddContacts: () => void;
}

type FilterStatus = 'all' | 'scheduled' | 'callback_scheduled' | 'deferred' | 'in_progress' | 'completed' | 'skipped';

const REMOVABLE_STATUSES: CallQueueItemStatus[] = [
  'scheduled',
  'callback_scheduled',
  'deferred',
  'skipped',
  'invalid_contact',
  'cancelled',
];

export function CampaignQueueTab({
  campaign,
  queueItems,
  workspaceId,
  onOpenAddContacts,
}: CampaignQueueTabProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<FilterStatus>('all');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [copiedPhoneId, setCopiedPhoneId] = React.useState<string | null>(null);

  // Deletion modal state
  const [itemsPendingRemoval, setItemsPendingRemoval] = React.useState<CallQueueItem[] | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);

  // Counts for filter pills
  const counts = React.useMemo(() => {
    const res = {
      all: queueItems.length,
      scheduled: 0,
      callback_scheduled: 0,
      deferred: 0,
      in_progress: 0,
      completed: 0,
      skipped: 0,
    };
    for (const item of queueItems) {
      if (item.status === 'scheduled') res.scheduled++;
      else if (item.status === 'callback_scheduled') res.callback_scheduled++;
      else if (item.status === 'deferred') res.deferred++;
      else if (item.status === 'in_progress') res.in_progress++;
      else if (item.status === 'completed') res.completed++;
      else if (item.status === 'skipped') res.skipped++;
    }
    return res;
  }, [queueItems]);

  // Filtered queue items based on search and status
  const filteredItems = React.useMemo(() => {
    let items = queueItems;

    if (selectedStatus !== 'all') {
      items = items.filter(item => item.status === selectedStatus);
    }

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase().trim();
      items = items.filter(item => {
        const contactName = (item.contactName || '').toLowerCase();
        const entityName = (item.entityName || '').toLowerCase();
        const phone = (item.entityPhone || '').toLowerCase();
        const email = (item.entityEmail || '').toLowerCase();
        const role = (item.contactRole || '').toLowerCase();
        const notes = (item.notesDraft || '').toLowerCase();
        const outcome = (item.outcome || '').toLowerCase();

        return (
          contactName.includes(term) ||
          entityName.includes(term) ||
          phone.includes(term) ||
          email.includes(term) ||
          role.includes(term) ||
          notes.includes(term) ||
          outcome.includes(term)
        );
      });
    }

    return items;
  }, [queueItems, selectedStatus, searchQuery]);

  // Removable items currently visible in the table
  const visibleRemovableItems = React.useMemo(() => {
    return filteredItems.filter(item => REMOVABLE_STATUSES.includes(item.status));
  }, [filteredItems]);

  const allVisibleRemovableSelected = 
    visibleRemovableItems.length > 0 && 
    visibleRemovableItems.every(item => selectedIds.has(item.id));

  // Toggle selection for all visible removable items
  const handleToggleSelectAll = (checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        visibleRemovableItems.forEach(item => next.add(item.id));
      } else {
        visibleRemovableItems.forEach(item => next.delete(item.id));
      }
      return next;
    });
  };

  // Toggle individual item
  const handleToggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Copy phone number to clipboard
  const handleCopyPhone = async (phone: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhoneId(itemId);
      setTimeout(() => setCopiedPhoneId(null), 2000);
      toast({ title: 'Phone Copied', description: phone });
    } catch {
      // ignore clipboard error
    }
  };

  // Execute removal of contacts
  const handleConfirmRemoval = async () => {
    if (!itemsPendingRemoval || itemsPendingRemoval.length === 0 || !user?.uid) return;

    setIsRemoving(true);
    try {
      const idsToRemove = itemsPendingRemoval.map(item => item.id);
      const res = await removeContactsFromCampaignAction(
        campaign.id,
        idsToRemove,
        workspaceId,
        user.uid
      );

      if (res.success) {
        toast({
          title: 'Contacts Removed from Queue',
          description: `Successfully removed ${res.count} contact(s) from campaign queue.`,
        });
        // Clear selection for deleted items
        setSelectedIds(prev => {
          const next = new Set(prev);
          idsToRemove.forEach(id => next.delete(id));
          return next;
        });
        setItemsPendingRemoval(null);
      } else {
        toast({
          variant: 'destructive',
          title: 'Removal Failed',
          description: res.error || 'Failed to remove contacts from queue.',
        });
      }
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: getErrorMessage(err) || 'An unexpected error occurred.',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  // Render status badge
  const renderStatusBadge = (item: CallQueueItem) => {
    switch (item.status) {
      case 'scheduled':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-bold uppercase text-[9px] px-2 py-0.5 rounded-md">
            Scheduled
          </Badge>
        );
      case 'callback_scheduled':
        return (
          <div className="flex flex-col gap-0.5">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold uppercase text-[9px] px-2 py-0.5 rounded-md w-fit">
              Callback
            </Badge>
            {item.callbackDate && (
              <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" />
                {formatSafeDate(item.callbackDate, 'MMM d, h:mm a')}
              </span>
            )}
          </div>
        );
      case 'deferred':
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 font-bold uppercase text-[9px] px-2 py-0.5 rounded-md">
            Deferred
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 font-bold uppercase text-[9px] px-2 py-0.5 rounded-md animate-pulse">
            Calling...
          </Badge>
        );
      case 'completed':
        return (
          <div className="flex flex-col gap-0.5">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold uppercase text-[9px] px-2 py-0.5 rounded-md w-fit">
              Completed
            </Badge>
            {item.outcome && (
              <span className="text-[10px] text-muted-foreground/90 font-medium truncate max-w-[140px]" title={item.outcome}>
                {item.outcome}
              </span>
            )}
          </div>
        );
      case 'skipped':
        return (
          <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 font-bold uppercase text-[9px] px-2 py-0.5 rounded-md">
            Skipped
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-bold uppercase text-[9px] px-2 py-0.5 rounded-md">
            {String(item.status)}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 pt-2">
      {/* ── Filter Bar & Actions ─────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {([
            { id: 'all', label: 'All Contacts', count: counts.all },
            { id: 'scheduled', label: 'Scheduled', count: counts.scheduled },
            { id: 'callback_scheduled', label: 'Callbacks', count: counts.callback_scheduled },
            { id: 'deferred', label: 'Deferred', count: counts.deferred },
            { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
            { id: 'completed', label: 'Completed', count: counts.completed },
            { id: 'skipped', label: 'Skipped', count: counts.skipped },
          ] as const).map(pill => {
            const isSelected = selectedStatus === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSelectedStatus(pill.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[44px] md:min-h-[36px] cursor-pointer',
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{pill.label}</span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-extrabold',
                  isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar & Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search queue by contact, entity, phone, email..."
              className="pl-10 h-11 md:h-10 rounded-xl bg-card border-border text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                aria-label="Clear search"
              >
                <FilterX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Batch Remove Button (When items selected) */}
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => {
                  const items = queueItems.filter(i => selectedIds.has(i.id) && REMOVABLE_STATUSES.includes(i.status));
                  setItemsPendingRemoval(items);
                }}
                className="h-11 md:h-10 px-3.5 rounded-xl font-bold text-xs gap-1.5 shadow-sm active:scale-[0.97]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove Selected ({selectedIds.size})</span>
              </Button>
            )}

            {/* Add Contacts from Entities Button */}
            <Button
              onClick={onOpenAddContacts}
              variant="outline"
              className="h-11 md:h-10 px-4 rounded-xl font-bold text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5 active:scale-[0.97]"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add Contacts</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Queue Table / List View ─────────────────────────────── */}
      {queueItems.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl bg-card p-6 space-y-3">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
          <h4 className="text-sm font-bold text-foreground">Call Queue is Empty</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            This campaign does not have any contacts in its queue yet. Add contacts from your entities to start dialing.
          </p>
          <div className="pt-2">
            <Button
              onClick={onOpenAddContacts}
              className="rounded-xl font-bold text-xs h-11 px-5 gap-2 bg-primary hover:bg-primary/90 text-white"
            >
              <UserPlus className="h-4 w-4" />
              Add Contacts from Entities
            </Button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-2xl bg-card p-6 space-y-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <h4 className="text-sm font-bold text-foreground">No matching contacts</h4>
          <p className="text-xs text-muted-foreground">
            No contacts match your current filter or search criteria.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery('');
              setSelectedStatus('all');
            }}
            className="rounded-xl font-bold text-xs h-10"
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/30 border-b border-border">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 pl-4 py-3">
                  <Checkbox
                    checked={allVisibleRemovableSelected}
                    onCheckedChange={handleToggleSelectAll}
                    disabled={visibleRemovableItems.length === 0}
                    aria-label="Select all removable contacts"
                  />
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Contact & Entity
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Phone & Email
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Queue Status
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Attempts
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground text-right pr-4">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/60">
              {filteredItems.map(item => {
                const isSelected = selectedIds.has(item.id);
                const isRemovable = REMOVABLE_STATUSES.includes(item.status);
                const isCopied = copiedPhoneId === item.id;
                const displayName = item.contactName || item.entityName || 'Unknown Contact';
                const hasSeparateContact = Boolean(item.contactName && item.contactName !== item.entityName);

                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      'hover:bg-muted/20 transition-colors',
                      isSelected && 'bg-primary/5 hover:bg-primary/10'
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell className="pl-4 py-3 align-middle">
                      {isRemovable ? (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelectItem(item.id)}
                          aria-label={`Select ${displayName}`}
                        />
                      ) : (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Checkbox disabled checked={false} className="opacity-30 cursor-not-allowed" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p className="text-[10px] font-bold">Completed calls are locked for reporting.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>

                    {/* Contact & Entity */}
                    <TableCell className="py-3">
                      <div className="flex flex-col min-w-[180px] max-w-[280px]">
                        {/* Contact Name & Role */}
                        <div className="flex items-center gap-1.5">
                          {hasSeparateContact ? (
                            <UserCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          ) : (
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-bold text-xs text-foreground truncate" title={displayName}>
                            {displayName}
                          </span>
                          {item.contactRole && (
                            <Badge variant="outline" className="text-[8px] font-semibold uppercase px-1 py-0 h-4 border-muted-foreground/20 text-muted-foreground shrink-0">
                              {item.contactRole}
                            </Badge>
                          )}
                        </div>

                        {/* Linked Parent Entity */}
                        {hasSeparateContact && item.entityName && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate">
                            <span className="text-muted-foreground/60 text-[10px]">at</span>
                            <Link
                              href={`/admin/entities/${item.entityId}`}
                              className="font-medium hover:text-primary transition-colors truncate hover:underline"
                              title={`View entity: ${item.entityName}`}
                            >
                              {item.entityName}
                            </Link>
                            {item.entityType && (
                              <Badge className="bg-muted text-muted-foreground border-none text-[8px] h-3.5 px-1 font-bold shrink-0">
                                {String(item.entityType)}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Reachable Info */}
                    <TableCell className="py-3">
                      <div className="flex flex-col gap-0.5 text-xs">
                        {item.entityPhone ? (
                          <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
                            <a
                              href={`tel:${item.entityPhone}`}
                              className="hover:text-primary transition-colors flex items-center gap-1"
                              title="Click to dial"
                            >
                              <Phone className="h-3 w-3 text-muted-foreground/70" />
                              <span>{item.entityPhone}</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(item.entityPhone, item.id)}
                              className="text-muted-foreground/50 hover:text-foreground p-0.5 rounded transition-colors"
                              title="Copy phone number"
                              aria-label="Copy phone"
                            >
                              {isCopied ? (
                                <Check className="h-2.5 w-2.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-2.5 w-2.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 italic">No phone</span>
                        )}

                        {item.entityEmail && (
                          <a
                            href={`mailto:${item.entityEmail}`}
                            className="text-[10px] text-muted-foreground/70 hover:text-primary transition-colors flex items-center gap-1 truncate max-w-[200px]"
                            title={item.entityEmail}
                          >
                            <Mail className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{item.entityEmail}</span>
                          </a>
                        )}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      {renderStatusBadge(item)}
                    </TableCell>

                    {/* Attempts & Activity */}
                    <TableCell className="py-3">
                      <div className="flex flex-col gap-0.5 text-xs font-mono text-muted-foreground">
                        <span className="font-bold text-foreground">
                          {item.attempts} {item.attempts === 1 ? 'attempt' : 'attempts'}
                        </span>
                        {item.lastAttemptAt ? (
                          <span className="text-[10px] text-muted-foreground/70">
                            {formatSafeRelativeTime(item.lastAttemptAt, 'recently')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 italic">Not called yet</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isRemovable ? (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setItemsPendingRemoval([item])}
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 active:scale-[0.97]"
                                  aria-label={`Remove ${displayName} from queue`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="text-[10px] font-bold">Remove from queue</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50 italic px-2">Archived</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Table Footer with Summary */}
          <div className="p-3 border-t border-border bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing <span className="font-bold text-foreground">{filteredItems.length}</span> of{' '}
              <span className="font-bold text-foreground">{queueItems.length}</span> contacts
            </span>
            {selectedIds.size > 0 && (
              <span className="font-bold text-primary">
                {selectedIds.size} selected
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Deletion Confirmation Modal ─────────────────────────── */}
      <Dialog
        open={Boolean(itemsPendingRemoval)}
        onOpenChange={open => {
          if (!open && !isRemoving) setItemsPendingRemoval(null);
        }}
      >
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-500" />
              Remove from Call Queue?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {itemsPendingRemoval && itemsPendingRemoval.length === 1 ? (
                <>
                  Are you sure you want to remove{' '}
                  <span className="font-bold text-foreground">
                    {itemsPendingRemoval[0].contactName || itemsPendingRemoval[0].entityName}
                  </span>{' '}
                  from the active call queue for{' '}
                  <span className="font-semibold text-foreground">{campaign.name}</span>?
                </>
              ) : (
                <>
                  Are you sure you want to remove{' '}
                  <span className="font-bold text-foreground">{itemsPendingRemoval?.length}</span> contacts
                  from the active call queue for{' '}
                  <span className="font-semibold text-foreground">{campaign.name}</span>?
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">What happens next:</p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              <li>The contact(s) will be taken off the campaign calling list.</li>
              <li>Campaign pending metrics will decrement accordingly.</li>
              <li>Underlying contact records and notes in the directory remain intact.</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              onClick={() => setItemsPendingRemoval(null)}
              disabled={isRemoving}
              className="rounded-xl font-bold h-11 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRemoval}
              disabled={isRemoving}
              className="rounded-xl font-bold h-11 text-xs gap-1.5 shadow-sm active:scale-[0.97]"
            >
              {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span>{isRemoving ? 'Removing...' : 'Confirm Removal'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
