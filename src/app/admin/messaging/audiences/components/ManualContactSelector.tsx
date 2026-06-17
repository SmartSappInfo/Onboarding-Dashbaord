'use client';

/**
 * @fileOverview Manual contact picker for messaging audiences (Phase 6.4).
 *
 * Reads the `workspace_contacts` projection via `useContactSearch` (paged, never
 * the whole set) instead of flattening every entity in the browser. "Select All
 * Match" is resolved SERVER-side via `resolveSegmentRecipients` (capped, with a
 * truncation warning), so a huge audience is never materialized client-first.
 * The `onChange(array)` contract is unchanged, so the downstream send pipeline
 * is untouched.
 */

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useContactSearch } from '@/hooks/use-contact-search';
import { resolveSegmentRecipients } from '@/lib/contacts/contact-repository';
import type { AudienceSegment, ContactDoc } from '@/lib/contacts/contact-projection-domain';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type Channel = 'email' | 'sms' | 'call';

/** The selected-contact payload — unchanged from the previous contract. */
export interface PickedContact {
  entityId: string;
  contactId: string;
  name?: string;
  email?: string;
  phone?: string;
  entityName?: string;
}

export interface ManualContactSelectorProps {
  channel: Channel;
  selectedContacts: PickedContact[];
  onChange: (selected: PickedContact[]) => void;
}

/** Display row = the picked payload + derived display fields. */
interface Row extends PickedContact {
  contactVal: string;
  isPrimary: boolean;
}

const ContactRow = React.memo(
  ({ row, isSelected, onToggle }: { row: Row; isSelected: boolean; onToggle: (row: Row) => void }) => {
    return (
      <div
        onClick={() => onToggle(row)}
        className={cn(
          'flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none',
          isSelected
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-border/50 bg-card/30 hover:bg-card/60 hover:border-primary/20',
        )}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggle(row)}
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg h-5 w-5 mt-1 border-border/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
          />
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-[10px] text-primary uppercase shrink-0 mt-0.5">
            {row.name ? row.name.substring(0, 2) : 'C'}
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground truncate">{row.name}</p>
            <p className="text-[10px] font-medium text-muted-foreground truncate">{row.entityName}</p>
            <p className="text-[10px] font-semibold text-muted-foreground font-mono truncate">{row.contactVal}</p>
          </div>
        </div>
        {row.isPrimary && (
          <div className="shrink-0 ml-3">
            <Badge
              variant="outline"
              className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-primary/5 text-primary border-primary/20 uppercase tracking-wider"
            >
              Primary
            </Badge>
          </div>
        )}
      </div>
    );
  },
);
ContactRow.displayName = 'ContactRow';

function keyOf(c: { entityId: string; contactId: string }): string {
  return `${c.entityId}:${c.contactId}`;
}

export function ManualContactSelector({ channel, selectedContacts, onChange }: ManualContactSelectorProps) {
  const { activeWorkspaceId } = useTenant();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSelectedOnly, setShowSelectedOnly] = React.useState(false);
  const [isSelectingAll, setIsSelectingAll] = React.useState(false);

  // Latest-ref pattern so the toggle/select-all callbacks stay stable.
  const onChangeRef = React.useRef(onChange);
  const selectedRef = React.useRef(selectedContacts);
  React.useEffect(() => {
    onChangeRef.current = onChange;
    selectedRef.current = selectedContacts;
  });

  const segment: AudienceSegment = React.useMemo(
    () => ({ channel, search: searchQuery.trim() || undefined }),
    [channel, searchQuery],
  );

  const { results, isLoading, hasMore, loadMore, totalCount } = useContactSearch({
    segment,
    pageSize: 20,
    enabled: !showSelectedOnly,
    withCount: true,
  });

  const valOf = React.useCallback(
    (email?: string | null, phone?: string | null) => (channel === 'email' ? email || '' : phone || ''),
    [channel],
  );

  const toRowFromDoc = React.useCallback(
    (d: ContactDoc): Row => ({
      entityId: d.entityId,
      contactId: d.contactId,
      name: d.name,
      email: d.email || undefined,
      phone: d.phone || undefined,
      entityName: d.entityName,
      contactVal: valOf(d.email, d.phone),
      isPrimary: d.isPrimary,
    }),
    [valOf],
  );

  const toRowFromPicked = React.useCallback(
    (p: PickedContact): Row => ({
      ...p,
      contactVal: valOf(p.email, p.phone),
      isPrimary: false,
    }),
    [valOf],
  );

  const selectedKeysSet = React.useMemo(
    () => new Set(selectedContacts.map(keyOf)),
    [selectedContacts],
  );

  const displayRows: Row[] = React.useMemo(
    () => (showSelectedOnly ? selectedContacts.map(toRowFromPicked) : results.map(toRowFromDoc)),
    [showSelectedOnly, selectedContacts, results, toRowFromPicked, toRowFromDoc],
  );

  const handleToggle = React.useCallback((row: Row) => {
    const selected = selectedRef.current;
    const key = keyOf(row);
    if (selected.some((s) => keyOf(s) === key)) {
      onChangeRef.current(selected.filter((s) => keyOf(s) !== key));
    } else {
      const picked: PickedContact = {
        entityId: row.entityId,
        contactId: row.contactId,
        name: row.name,
        email: row.email,
        phone: row.phone,
        entityName: row.entityName,
      };
      onChangeRef.current([...selected, picked]);
    }
  }, []);

  const handleSelectAllMatch = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsSelectingAll(true);
    try {
      const { recipients, truncated } = await resolveSegmentRecipients(activeWorkspaceId, segment);
      const existing = selectedRef.current;
      const have = new Set(existing.map(keyOf));
      const additions = recipients
        .filter((r) => !have.has(`${r.entityId}:${r.contactId}`))
        .map<PickedContact>((r) => ({
          entityId: r.entityId,
          contactId: r.contactId,
          name: r.name,
          email: r.email || undefined,
          phone: r.phone || undefined,
          entityName: r.entityName,
        }));
      onChangeRef.current([...existing, ...additions]);
      toast({
        title: `Selected ${recipients.length.toLocaleString()} matching contacts`,
        description: truncated
          ? 'Result was capped — refine the filter to capture the remainder.'
          : undefined,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Select all failed', description: e.message });
    } finally {
      setIsSelectingAll(false);
    }
  }, [activeWorkspaceId, segment, toast]);

  const clearSelection = React.useCallback(() => onChangeRef.current([]), []);

  return (
    <div className="space-y-3">
      {/* Search + bulk controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={showSelectedOnly}
              className="pl-10 h-11 rounded-xl text-xs font-semibold bg-card/50 border-border/50 focus-visible:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleSelectAllMatch}
            disabled={isSelectingAll || showSelectedOnly}
            className="w-full sm:w-auto h-11 px-4 rounded-xl text-xs font-bold border-border/50 hover:bg-accent/30"
          >
            {isSelectingAll ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : null}
            {totalCount != null ? `Select all ${totalCount.toLocaleString()} match` : 'Select all match'}
          </Button>
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-selected-chk"
              checked={showSelectedOnly}
              onCheckedChange={(checked) => setShowSelectedOnly(!!checked)}
              className="rounded-md border-border/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label htmlFor="show-selected-chk" className="text-xs font-bold cursor-pointer select-none">
              Show Selected Only ({selectedContacts.length} selected)
            </Label>
          </div>
          {selectedContacts.length > 0 && (
            <button
              onClick={clearSelection}
              className="text-[10px] font-bold text-muted-foreground hover:text-destructive hover:underline"
            >
              Clear selection
            </button>
          )}
        </div>
      </div>

      {/* Contact list */}
      {isLoading && displayRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/50 bg-card/20 rounded-2xl gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted-foreground">Searching contacts…</p>
        </div>
      ) : displayRows.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/50 bg-card/10 rounded-2xl">
          <p className="text-xs font-bold text-muted-foreground">
            {showSelectedOnly ? 'No selected contacts' : 'No contacts found matching your query'}
          </p>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto pr-1 border border-border/40 bg-card/10 rounded-2xl p-2.5 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {displayRows.map((row) => (
              <ContactRow
                key={keyOf(row)}
                row={row}
                isSelected={selectedKeysSet.has(keyOf(row))}
                onToggle={handleToggle}
              />
            ))}
          </div>
          {!showSelectedOnly && hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoading}
              className="w-full py-2.5 text-center text-[10px] font-bold text-primary hover:bg-primary/5 rounded-lg disabled:opacity-50"
            >
              {isLoading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
