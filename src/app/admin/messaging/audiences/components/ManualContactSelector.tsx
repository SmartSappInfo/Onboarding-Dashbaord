'use client';

/**
 * @fileOverview Manual contact picker for messaging audiences.
 *
 * Reads workspace entities via `useEntitySearch` (paged from `workspace_entities`)
 * and flattens each entity's `entityContacts` into selectable contact rows.
 * Client-side filtering by channel, search, and pagination.
 *
 * The `onChange(array)` contract is unchanged so the downstream send pipeline
 * is untouched.
 */

import * as React from 'react';
import { useEntitySearch, type SearchedEntity } from '@/hooks/use-entity-search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ManualContactSelectorProps {
    channel: 'email' | 'sms' | 'call';
    selectedContacts: Array<{
        entityId: string;
        contactId: string;
        name?: string;
        email?: string;
        phone?: string;
        entityName?: string;
    }>;
    onChange: (selected: Array<{
        entityId: string;
        contactId: string;
        name?: string;
        email?: string;
        phone?: string;
        entityName?: string;
    }>) => void;
}

/** Also exported for type compatibility with AudienceSelector. */
export type PickedContact = ManualContactSelectorProps['selectedContacts'][number];

interface FlatContact {
    id: string;
    entityId: string;
    entityName: string;
    name: string;
    email?: string;
    phone?: string;
    contactVal: string;
    isPrimary: boolean;
    isSignatory: boolean;
    typeKey: string;
    typeLabel?: string;
}

const ContactRow = React.memo(({
    contact,
    isSelected,
    onToggle
}: {
    contact: FlatContact;
    isSelected: boolean;
    onToggle: (contact: FlatContact) => void;
}) => {
    return (
        <div
            onClick={() => onToggle(contact)}
            className={cn(
                "flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none",
                isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/50 bg-card/30 hover:bg-card/60 hover:border-primary/20"
            )}
        >
            <div className="flex items-start gap-3 flex-1 min-w-0">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(contact)}
                    onClick={(e) => e.stopPropagation()}
                    id={`contact-chk-${contact.entityId}-${contact.id}`}
                    className="rounded-lg h-5 w-5 mt-1 border-border/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
                />

                {/* Initial Avatar */}
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-[10px] text-primary uppercase shrink-0 mt-0.5">
                    {contact.name ? contact.name.substring(0, 2) : 'C'}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate">{contact.name}</p>
                    <p className="text-[10px] font-medium text-muted-foreground truncate">{contact.entityName}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground font-mono truncate">{contact.contactVal}</p>
                </div>
            </div>

            {contact.isPrimary && (
                <div className="shrink-0 ml-3">
                    <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-primary/5 text-primary border-primary/20 uppercase tracking-wider">
                        Primary
                    </Badge>
                </div>
            )}
        </div>
    );
});
ContactRow.displayName = 'ContactRow';

export function ManualContactSelector({
    channel,
    selectedContacts,
    onChange
}: ManualContactSelectorProps) {
    const [searchQuery, setSearchQuery] = React.useState('');
    const [visibleCount, setVisibleCount] = React.useState(20);
    const [showSelectedOnly, setShowSelectedOnly] = React.useState(false);
    const PAGE_INCREMENT = 20;

    // Latest-ref pattern to prevent effect dependency recreation
    const onChangeRef = React.useRef(onChange);
    const selectedContactsRef = React.useRef(selectedContacts);
    React.useEffect(() => {
        onChangeRef.current = onChange;
        selectedContactsRef.current = selectedContacts;
    });

    // Load entities using the proven useEntitySearch hook (queries workspace_entities)
    const { results: entities, isLoading, hasMore, loadMore } = useEntitySearch({
        search: '', // We do client-side filtering for contact-level search
        pageSize: 100,
        filters: [{ field: 'status', value: 'active' }],
    });

    // Auto-load more entities to build a fuller contact list
    const hasLoadedAll = React.useRef(false);
    React.useEffect(() => {
        if (hasMore && !isLoading && !hasLoadedAll.current) {
            // Load up to ~500 entities (5 pages of 100) for a good contact pool
            if (entities.length < 500) {
                loadMore();
            } else {
                hasLoadedAll.current = true;
            }
        }
    }, [hasMore, isLoading, entities.length, loadMore]);

    // Reset hasLoadedAll when search changes
    React.useEffect(() => {
        hasLoadedAll.current = false;
    }, [searchQuery]);

    // Reset visible count on filter, channel, or view changes
    React.useEffect(() => {
        setVisibleCount(20);
    }, [searchQuery, channel, showSelectedOnly]);

    // Extract all available contacts matching the channel from loaded entities
    const workspaceContacts = React.useMemo(() => {
        if (!entities) return [];
        const contactsList: FlatContact[] = [];

        entities.forEach(ent => {
            const entityName = ent.displayName || ent.entityName || '';
            const entityId = ent.entityId || ent.id;
            const sourceContacts = ent.entityContacts || [];

            if (sourceContacts.length > 0) {
                sourceContacts.forEach(c => {
                    const email = c.email || '';
                    const phone = c.phone || '';
                    const contactVal = channel === 'email' ? email : phone;
                    if (contactVal) {
                        contactsList.push({
                            id: c.id || Math.random().toString(),
                            entityId,
                            entityName,
                            name: c.name || entityName,
                            email,
                            phone,
                            contactVal,
                            isPrimary: !!c.isPrimary,
                            isSignatory: !!c.isSignatory,
                            typeKey: c.typeKey || 'custom',
                            typeLabel: c.typeLabel,
                        });
                    }
                });
            } else {
                const email = ent.primaryEmail || (ent as any).email || '';
                const phone = ent.primaryPhone || (ent as any).phone || '';
                const contactVal = channel === 'email' ? email : phone;
                if (contactVal) {
                    contactsList.push({
                        id: 'primary-fallback-' + entityId,
                        entityId,
                        entityName,
                        name: ent.primaryContactName || ent.displayName || '',
                        email,
                        phone,
                        contactVal,
                        isPrimary: true,
                        isSignatory: false,
                        typeKey: 'primary',
                        typeLabel: 'Primary',
                    });
                }
            }
        });
        return contactsList;
    }, [entities, channel]);

    // Search query filtering
    const filteredContacts = React.useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return workspaceContacts;
        return workspaceContacts.filter(c => {
            return (
                c.contactVal.toLowerCase().includes(query) ||
                c.name.toLowerCase().includes(query) ||
                c.entityName.toLowerCase().includes(query)
            );
        });
    }, [workspaceContacts, searchQuery]);

    // O(1) Selected keys check
    const selectedKeysSet = React.useMemo(() => {
        return new Set(selectedContacts.map(sc => `${sc.entityId}:${sc.contactId}`));
    }, [selectedContacts]);

    // Filter contactsToDisplay: showSelectedOnly vs all filtered
    const contactsToDisplay = React.useMemo(() => {
        let list = filteredContacts;
        if (showSelectedOnly) {
            list = list.filter(c => selectedKeysSet.has(`${c.entityId}:${c.id}`));
        }
        return list;
    }, [filteredContacts, showSelectedOnly, selectedKeysSet]);

    // Derive visible slice for "Load More" pattern
    const visibleContacts = React.useMemo(() => {
        return contactsToDisplay.slice(0, visibleCount);
    }, [contactsToDisplay, visibleCount]);

    const hasMoreContacts = visibleCount < contactsToDisplay.length;

    const handleToggle = React.useCallback((contact: FlatContact) => {
        const selected = selectedContactsRef.current;
        const isSelected = selected.some(sc => sc.entityId === contact.entityId && sc.contactId === contact.id);

        if (isSelected) {
            const updated = selected.filter(
                sc => !(sc.entityId === contact.entityId && sc.contactId === contact.id)
            );
            onChangeRef.current(updated);
        } else {
            const updated = [...selected, {
                entityId: contact.entityId,
                contactId: contact.id,
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
                entityName: contact.entityName
            }];
            onChangeRef.current(updated);
        }
    }, []);

    // Select All / Deselect All for FILTERED list
    const filteredSelectedCount = React.useMemo(() => {
        return filteredContacts.filter(c => selectedKeysSet.has(`${c.entityId}:${c.id}`)).length;
    }, [filteredContacts, selectedKeysSet]);

    const handleSelectAllToggle = () => {
        const allFilteredSelected = filteredSelectedCount === filteredContacts.length;
        if (allFilteredSelected) {
            // Deselect only the filtered items
            const filteredKeys = new Set(filteredContacts.map(c => `${c.entityId}:${c.id}`));
            const updated = selectedContacts.filter(sc => !filteredKeys.has(`${sc.entityId}:${sc.contactId}`));
            onChange(updated);
        } else {
            // Select all filtered items (merge with existing selected items, keeping it unique)
            const updated = [...selectedContacts];
            filteredContacts.forEach(c => {
                const key = `${c.entityId}:${c.id}`;
                if (!selectedKeysSet.has(key)) {
                    updated.push({
                        entityId: c.entityId,
                        contactId: c.id,
                        name: c.name,
                        email: c.email,
                        phone: c.phone,
                        entityName: c.entityName
                    });
                }
            });
            onChange(updated);
        }
    };

    if (isLoading && workspaceContacts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/50 bg-card/20 rounded-2xl gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs font-semibold text-muted-foreground">Loading workspace contacts...</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Search and control header */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, email, or entity..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
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

                    {filteredContacts.length > 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleSelectAllToggle}
                            className="w-full sm:w-auto h-11 px-4 rounded-xl text-xs font-bold border-border/50 hover:bg-accent/30"
                        >
                            {filteredSelectedCount === filteredContacts.length ? "Deselect All" : `Select All Match (${filteredContacts.length})`}
                        </Button>
                    )}
                </div>

                {/* View toggles & selected counts */}
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
                            onClick={() => onChange([])}
                            className="text-[10px] font-bold text-muted-foreground hover:text-destructive hover:underline"
                        >
                            Clear selection
                        </button>
                    )}
                </div>
            </div>

            {/* Load more entities banner */}
            {hasMore && !isLoading && (
                <button
                    type="button"
                    onClick={loadMore}
                    className="w-full py-2 text-center text-[10px] font-bold text-primary hover:bg-primary/5 rounded-lg border border-dashed border-primary/30"
                >
                    Load more entities ({workspaceContacts.length} contacts loaded so far)
                </button>
            )}
            {isLoading && workspaceContacts.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-[10px] font-bold text-muted-foreground">Loading more contacts...</span>
                </div>
            )}

            {/* Contacts list */}
            {contactsToDisplay.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border/50 bg-card/10 rounded-2xl">
                    <p className="text-xs font-bold text-muted-foreground">
                        {showSelectedOnly ? "No selected contacts found" : "No contacts found matching your query"}
                    </p>
                </div>
            ) : (
                <div className="max-h-[28rem] overflow-y-auto pr-1 border border-border/40 bg-card/10 rounded-2xl p-2.5 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {visibleContacts.map(c => (
                            <ContactRow
                                key={`${c.entityId}-${c.id}`}
                                contact={c}
                                isSelected={selectedKeysSet.has(`${c.entityId}:${c.id}`)}
                                onToggle={handleToggle}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Load More + Count Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border/30 mt-1 text-xs">
                <p className="text-muted-foreground font-medium">
                    Showing <span className="font-bold text-foreground">{Math.min(visibleCount, contactsToDisplay.length)}</span>{" "}
                    of <span className="font-bold text-foreground">{contactsToDisplay.length}</span> contacts
                </p>
                {hasMoreContacts && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleCount(prev => prev + PAGE_INCREMENT)}
                        className="h-8 px-4 rounded-lg text-xs font-bold border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-all"
                    >
                        Load More ({contactsToDisplay.length - visibleCount} remaining)
                    </Button>
                )}
            </div>
        </div>
    );
}
