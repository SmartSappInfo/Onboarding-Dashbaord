'use client';

import * as React from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { createCampaign, updateCampaign } from '@/lib/campaign-hooks';
import { dispatchCampaign } from '@/lib/campaign-dispatch';
import { useToast } from '@/hooks/use-toast';
import type { MessageCampaign, MessageChannel, TemplateTarget, ContentMode, AudienceDefinition, SenderProfile, AudienceFilter, PostSendTagRule, MessageTemplate } from '@/lib/types';
import { FilterBuilder } from '@/app/admin/messaging/audiences/components/filter-builder';
import { useAudiences } from '@/lib/audience-hooks';
import { legacyAudienceToFilters } from '@/lib/audience-hooks';
import { TagSelector } from '@/components/tags/TagSelector';
import { ABTestSlider } from './ABTestSlider';
import { getEffectiveContactTypes } from '@/lib/contact-type-actions';
import { previewCampaignAudience } from '@/lib/messaging-actions';
import { renderBlocksToHtml, resolveVariables, plainTextToHtml } from '@/lib/messaging-utils';
import { parseMarkdownLinksToHtml } from '@/lib/utils/markdown-link-parser';
import { generateCampaignCopy, refineCampaignCopy } from '@/lib/campaign-ai';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, ArrowRight, Check, ChevronRight, ChevronLeft, Loader2, Mail, Smartphone,
    Users, Save, Send, Tag, Target, FileText, Calendar, Eye, Megaphone, Zap, X, Plus,
    Sparkles, Wand2, Pencil, PlusCircle, Search
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { MessagingTemplateSelector } from '../../../components/MessagingTemplateSelector';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import { useEntityCache } from '@/context/EntityCacheContext';
import { motion, AnimatePresence } from 'framer-motion';
import { EmailHygieneBadge } from '@/app/admin/components/EmailHygieneBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { createTagAction } from '@/lib/tag-actions';
import { ChevronsUpDown } from 'lucide-react';

// ─── Contact Scope Selector ───────────────────────────────────────────────────

function ContactScopeSelector({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
    const [roles, setRoles] = React.useState<{label: string, value: string}[]>([]);
    const { entities } = useEntityCache();

    React.useEffect(() => {
        if (!activeWorkspaceId || !entities) return;
        const currentEntities = entities;
        async function fetchRoles() {
            try {
                const activeEntityTypes = new Set<string>();
                currentEntities.slice(0, 100).forEach(d => {
                    const type = d.entityType;
                    if (type) activeEntityTypes.add(type);
                });

                // Fallback to all types if workspace is empty (for new workspaces)
                const typesToFetch = activeEntityTypes.size > 0 
                    ? Array.from(activeEntityTypes) as any[]
                    : ['institution', 'family', 'person'];

                const rolePromises = typesToFetch.map(type => 
                    getEffectiveContactTypes(type, activeOrganizationId, activeWorkspaceId)
                );
                
                const roleResults = await Promise.all(rolePromises);
                const uniqueRoles = new Map<string, string>();
                
                roleResults.flat().forEach(r => {
                    if (r.active) uniqueRoles.set(r.key, r.label);
                });
                
                setRoles(Array.from(uniqueRoles.entries()).map(([v, label]) => ({ label, value: `role:${v}` })));
            } catch (error) {
                console.error('[ContactScopeSelector] Failed to fetch roles:', error);
            }
        }
        fetchRoles();
    }, [activeWorkspaceId, activeOrganizationId, entities]);

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-10 rounded-xl font-bold text-xs bg-card border-border/50">
                <SelectValue placeholder="Select contact scope" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
                <SelectGroup>
                    <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Broad Scope</SelectLabel>
                    <SelectItem value="primary" className="text-xs font-semibold">Primary Contact Only</SelectItem>
                    <SelectItem value="signatories" className="text-xs font-semibold">All Registered Signatories</SelectItem>
                    <SelectItem value="all" className="text-xs font-semibold">Broadcast to All Known Contacts</SelectItem>
                </SelectGroup>
                {roles.length > 0 ? (
                    <>
                        <Separator className="my-1 opacity-50" />
                        <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Role Based</SelectLabel>
                            {roles.map(r => (
                                <SelectItem key={r.value} value={r.value} className="text-xs font-semibold">{r.label}</SelectItem>
                            ))}
                        </SelectGroup>
                    </>
                ) : null}
            </SelectContent>
        </Select>
    );
}

// ─── Wizard State (R4 fix: useReducer instead of 25+ useState) ───────────────

interface WizardState {
    step: number;
    internalName: string;
    channel: MessageChannel;
    target: TemplateTarget;
    contentMode: ContentMode;
    templateId: string;
    templateName: string;
    customSubject: string;
    customBody: string;
    customBlocks: Array<any>;
    styleId: string;
    audienceMode: AudienceDefinition['mode'];
    tagIds: string[];
    tagLogic: 'any' | 'all';
    excludeTagIds: string[];
    entityIds: string[];
    selectedContacts: Array<{ entityId: string; contactId: string; name?: string; email?: string; phone?: string; entityName?: string }>;
    contactScope: 'primary' | 'signatories' | 'all' | (string & {});
    senderProfileId: string;
    isScheduled: boolean;
    scheduledAt: Date | null;
    isSaving: boolean;
    isSending: boolean;
    // Phase 4 advanced filters
    filters: AudienceFilter[];
    filterLogic: 'AND' | 'OR';
    groups?: any[];
    savedAudienceId: string;
    // Phase 6 post-send behavior
    postSendTagRules: PostSendTagRule[];
    // Phase 7 engagement tracking
    trackLinks: boolean;
    // A/B testing properties
    abTestEnabled: boolean;
    abTestConfig: {
      testSizePercentage: number;
      testDurationHours: number;
      winnerMetric: 'open_rate' | 'click_rate' | 'low_unsubscribe_rate';
    };
    variants: any[];
}

type WizardAction =
    | { type: 'SET_FIELD'; field: keyof WizardState; value: any }
    | { type: 'SET_STEP'; step: number }
    | { type: 'NEXT_STEP' }
    | { type: 'PREV_STEP' }
    | { type: 'RESET' };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.value };
        case 'SET_STEP':
            return { ...state, step: action.step };
        case 'NEXT_STEP':
            return { ...state, step: Math.min(state.step + 1, 5) };
        case 'PREV_STEP':
            return { ...state, step: Math.max(state.step - 1, 1) };
        case 'RESET':
            return createInitialState(null);
        default:
            return state;
    }
}

function createInitialState(campaign: MessageCampaign | null): WizardState {
    const defaultStats = { totalTargeted: 0, totalSent: 0, totalFailed: 0, totalOpened: 0, totalClicked: 0, totalUnsubscribed: 0 };
    if (campaign) {
        // R6 fix: migrate legacy tag-based audience to filters if mode is tags
        let filters = campaign.audienceDefinition?.filters || [];
        if (filters.length === 0 && campaign.audienceDefinition?.mode === 'tags' && campaign.audienceDefinition.tagIds?.length) {
            filters = legacyAudienceToFilters(campaign.audienceDefinition);
        }
        return {
            step: campaign.lastCompletedStep ? Math.min(campaign.lastCompletedStep + 1, 5) : 1,
            internalName: campaign.internalName || '',
            channel: campaign.channel || 'email',
            target: campaign.target || 'external_client',
            contentMode: campaign.contentMode || 'template',
            templateId: campaign.templateId || '',
            templateName: campaign.templateName || '',
            customSubject: campaign.customSubject || '',
            customBody: campaign.customBody || '',
            customBlocks: (campaign as any).customBlocks || [],
            styleId: campaign.styleId || '',
            audienceMode: campaign.audienceDefinition?.mode || 'all',
            tagIds: campaign.audienceDefinition?.tagIds || [],
            tagLogic: campaign.audienceDefinition?.tagLogic || 'any',
            excludeTagIds: campaign.audienceDefinition?.excludeTagIds || [],
            entityIds: campaign.audienceDefinition?.entityIds || [],
            selectedContacts: campaign.audienceDefinition?.selectedContacts || [],
            contactScope: campaign.audienceDefinition?.contactScope || 'primary',
            senderProfileId: campaign.senderProfileId || '',
            isScheduled: !!campaign.scheduledAt,
            scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt) : null,
            isSaving: false,
            isSending: false,
            filters,
            filterLogic: campaign.audienceDefinition?.filterLogic || 'AND',
            groups: campaign.audienceDefinition?.groups || [],
            savedAudienceId: campaign.audienceDefinition?.savedAudienceId || '',
            postSendTagRules: campaign.postSendTagRules || [],
            trackLinks: campaign.trackLinks !== false, // default to true
            abTestEnabled: campaign.abTestEnabled || false,
            abTestConfig: campaign.abTestConfig || {
                testSizePercentage: 20,
                testDurationHours: 4,
                winnerMetric: 'open_rate',
            },
            variants: campaign.variants || [
                { id: 'A', templateId: campaign.templateId || null, templateName: campaign.templateName || null, customSubject: campaign.customSubject || '', customBody: campaign.customBody || '', ratio: 50, stats: { ...defaultStats } },
                { id: 'B', templateId: null, templateName: null, customSubject: '', customBody: '', ratio: 50, stats: { ...defaultStats } }
            ],
        };
    }
    return {
        step: 1, internalName: '', channel: 'email', target: 'external_client',
        contentMode: 'template', templateId: '', templateName: '', customSubject: '',
        customBody: '', customBlocks: [], styleId: '', audienceMode: 'all', tagIds: [], tagLogic: 'any',
        excludeTagIds: [], entityIds: [], selectedContacts: [], contactScope: 'primary', senderProfileId: '',
        isScheduled: false, scheduledAt: null, isSaving: false, isSending: false,
        filters: [], filterLogic: 'AND' as const, savedAudienceId: '',
        groups: [],
        postSendTagRules: [],
        trackLinks: true,
        abTestEnabled: false,
        abTestConfig: {
            testSizePercentage: 20,
            testDurationHours: 4,
            winnerMetric: 'open_rate',
        },
        variants: [
            { id: 'A', templateId: null, templateName: null, customSubject: '', customBody: '', ratio: 50, stats: { ...defaultStats } },
            { id: 'B', templateId: null, templateName: null, customSubject: '', customBody: '', ratio: 50, stats: { ...defaultStats } }
        ],
    };
}

// ─── Step Indicators ──────────────────────────────────────────────────────────

const STEPS = [
    { num: 1, label: 'Identity', icon: Megaphone },
    { num: 2, label: 'Content', icon: FileText },
    { num: 3, label: 'Audience', icon: Users },
    { num: 4, label: 'Schedule & Behavior', icon: Calendar },
    { num: 5, label: 'Review', icon: Eye },
];

function StepIndicator({ 
    current, 
    onStepClick,
    canNavigateToStep 
}: { 
    current: number; 
    onStepClick?: (step: number) => void;
    canNavigateToStep: (step: number) => boolean;
}) {
    return (
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STEPS.map((s, i) => {
                const clickable = canNavigateToStep(s.num);
                const StepComponent = onStepClick && clickable ? 'button' : 'div';
                return (
                    <React.Fragment key={s.num}>
                        <StepComponent
                            type={StepComponent === 'button' ? 'button' : undefined}
                            onClick={onStepClick && clickable ? () => onStepClick(s.num) : undefined}
                            disabled={StepComponent === 'button' ? !clickable : undefined}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                s.num === current ? "bg-primary text-primary-foreground" :
                                s.num < current ? "bg-primary/10 text-primary hover:bg-primary/25" : "bg-muted text-muted-foreground",
                                clickable && s.num !== current ? "cursor-pointer" : "cursor-default opacity-80"
                            )}
                        >
                            {s.num < current ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
                            {s.label}
                        </StepComponent>
                        {i < STEPS.length - 1 ? <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" /> : null}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

const MOCK_VARIABLES = {
    entity_name: 'John Doe Entity',
    entity_email: 'john.doe@example.com',
    entity_phone: '+15551234567',
    contact_name: 'John Doe',
    tags: 'New, Active',
};

// ─── Main Wizard Component ────────────────────────────────────────────────────

interface ManualContactSelectorProps {
    channel: MessageChannel;
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

const ContactRow = React.memo(({
    contact,
    isSelected,
    onToggle
}: {
    contact: any;
    isSelected: boolean;
    onToggle: (contact: any) => void;
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
    const { entities, isLoading } = useEntityCache();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [currentPage, setCurrentPage] = React.useState(1);
    const [showSelectedOnly, setShowSelectedOnly] = React.useState(false);
    const pageSize = 20;

    const onChangeRef = React.useRef(onChange);
    onChangeRef.current = onChange;
    const selectedContactsRef = React.useRef(selectedContacts);
    selectedContactsRef.current = selectedContacts;

    // Reset pagination to page 1 on filter, channel, or view changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, channel, showSelectedOnly]);

    // Extract all available contacts matching the channel
    const workspaceContacts = React.useMemo(() => {
        if (!entities) return [];
        const contactsList: Array<{
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
        }> = [];

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

    // Clamped active page index
    const totalPages = Math.ceil(contactsToDisplay.length / pageSize);
    const clampedPage = Math.min(currentPage, totalPages || 1);

    // Derived paginated slice
    const paginatedContacts = React.useMemo(() => {
        const start = (clampedPage - 1) * pageSize;
        return contactsToDisplay.slice(start, start + pageSize);
    }, [contactsToDisplay, clampedPage, pageSize]);

    const handleToggle = React.useCallback((contact: typeof workspaceContacts[0]) => {
        const selected = selectedContactsRef.current;
        const key = `${contact.entityId}:${contact.id}`;
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

    if (isLoading) {
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
                            {filteredSelectedCount === filteredContacts.length ? "Deselect All" : "Select All Match"}
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
                            Show Selected Only ({selectedContacts.length} contacts selected)
                        </Label>
                    </div>
                </div>
            </div>

            {/* Contacts list */}
            {contactsToDisplay.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border/50 bg-card/10 rounded-2xl">
                    <p className="text-xs font-bold text-muted-foreground">
                        {showSelectedOnly ? "No selected contacts found" : "No contacts found matching your query"}
                    </p>
                </div>
            ) : (
                <div className="max-h-72 overflow-y-auto pr-1 border border-border/40 bg-card/10 rounded-2xl p-2.5 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {paginatedContacts.map(c => (
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border/30 mt-3 text-xs">
                    <p className="text-muted-foreground font-medium">
                        Showing <span className="font-bold text-foreground">{(clampedPage - 1) * pageSize + 1}</span> to{" "}
                        <span className="font-bold text-foreground">
                            {Math.min(clampedPage * pageSize, contactsToDisplay.length)}
                        </span>{" "}
                        of <span className="font-bold text-foreground">{contactsToDisplay.length}</span> contacts
                    </p>
                    <div className="flex items-center gap-1.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={clampedPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            className="h-8 w-8 p-0 rounded-lg border-border/50 bg-card/40 hover:bg-accent/30 disabled:opacity-40"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="sr-only">Previous page</span>
                        </Button>
                        <div className="flex items-center gap-1">
                            {(() => {
                                const pages: (number | string)[] = [];
                                if (totalPages <= 5) {
                                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                                } else {
                                    pages.push(1);
                                    if (clampedPage > 3) pages.push('ellipsis-start');
                                    const start = Math.max(2, clampedPage - 1);
                                    const end = Math.min(totalPages - 1, clampedPage + 1);
                                    for (let i = start; i <= end; i++) pages.push(i);
                                    if (clampedPage < totalPages - 2) pages.push('ellipsis-end');
                                    pages.push(totalPages);
                                }
                                return pages.map((page, idx) => {
                                    if (typeof page === 'string') {
                                        return <span key={`ell-${idx}`} className="px-1 text-muted-foreground font-bold text-[10px]">...</span>;
                                    }
                                    return (
                                        <Button
                                            key={page}
                                            type="button"
                                            variant={clampedPage === page ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setCurrentPage(page)}
                                            className={cn(
                                                "h-8 w-8 p-0 rounded-lg text-xs font-bold transition-all",
                                                clampedPage === page
                                                    ? "bg-primary text-primary-foreground hover:bg-primary/95"
                                                    : "border-border/50 bg-card/40 hover:bg-accent/30"
                                            )}
                                        >
                                            {page}
                                        </Button>
                                    );
                                });
                            })()}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={clampedPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            className="h-8 w-8 p-0 rounded-lg border-border/50 bg-card/40 hover:bg-accent/30 disabled:opacity-40"
                        >
                            <ChevronRight className="h-4 w-4" />
                            <span className="sr-only">Next page</span>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

interface CampaignWizardProps {
    campaign?: MessageCampaign | null;
    onClose: () => void;
}

export function CampaignWizard({ campaign = null, onClose }: CampaignWizardProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
    const { toast } = useToast();
    const [showExitDialog, setShowExitDialog] = React.useState(false);

    // Phase 6 Story 6: AI Copy Assistant
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [showAiPanel, setShowAiPanel] = React.useState(false);
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [aiVariants, setAiVariants] = React.useState<string[]>([]);
    
    // Quick Create Template state
    const [quickCreateOpen, setQuickCreateOpen] = React.useState(false);
    const [activeVariantTab, setActiveVariantTab] = React.useState<'A' | 'B'>('A');

    // Post-Send Rule Tag Search/Create State
    const [openRuleTagIdx, setOpenRuleTagIdx] = React.useState<number | null>(null);
    const [ruleTagInputValue, setRuleTagInputValue] = React.useState('');
    const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);

    const [state, dispatch] = React.useReducer(wizardReducer, campaign, createInitialState);
    const activeVariant = state.variants.find(v => v.id === activeVariantTab) || state.variants[0];

    // ── Audience Preview State ────────────────────────────────────────────────
    const [isPreviewing, setIsPreviewing] = React.useState(false);
    const [previewResult, setPreviewResult] = React.useState<{
        count: number;
        contactCount: number;
        preview: { id: string; name: string; tags: string[] }[];
        contactsPreview?: {
            id: string;
            name: string;
            email?: string;
            phone?: string;
            contactVal: string;
            verified?: boolean;
            verificationStatus?: string;
            entityName: string;
        }[];
    } | null>(null);
    const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

    const fetchPreview = React.useCallback(() => {
        if (!activeWorkspaceId) {
            setPreviewResult(null);
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setIsPreviewing(true);
            try {
                // Determine which filters to use based on audience mode
                let filters = state.filters;
                if (state.audienceMode === 'all') filters = [];

                const result = await previewCampaignAudience({
                    workspaceId: activeWorkspaceId,
                    filters: state.audienceMode === 'manual' ? [] : (filters as any),
                    filterLogic: state.filterLogic,
                    groups: state.audienceMode === 'advanced' || state.audienceMode === 'saved' ? state.groups : [],
                    limit: 10,
                    contactScope: state.contactScope,
                    channel: state.channel === 'email' || state.channel === 'sms' ? state.channel : undefined,
                    selectedContacts: state.selectedContacts,
                    audienceMode: state.audienceMode,
                    includeTagIds: state.tagIds,
                    excludeTagIds: state.excludeTagIds,
                    includeLogic: state.tagLogic === 'all' ? 'AND' : 'OR',
                });
                
                if (result.success) {
                    setPreviewResult({ 
                        count: result.count ?? 0, 
                        contactCount: result.contactCount ?? 0, 
                        preview: result.preview ?? [],
                        contactsPreview: result.contactsPreview ?? []
                    });
                }
            } catch (err) {
                console.error('[WizardPreview] Failed:', err);
            } finally {
                setIsPreviewing(false);
            }
        }, 800);
    }, [activeWorkspaceId, state.filters, state.filterLogic, state.contactScope, state.channel, state.audienceMode, state.entityIds, state.selectedContacts, state.tagIds, state.tagLogic, state.excludeTagIds, state.groups]);

    React.useEffect(() => {
        // Only run preview on Audience step (step 3)
        if (state.step === 3) {
            fetchPreview();
        }
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [fetchPreview, state.step]);

    const setField = <K extends keyof WizardState>(field: K, value: WizardState[K]) => {
        dispatch({ type: 'SET_FIELD', field, value });
    };

    const handleCreateTagForRule = async (tagName: string, idx: number) => {
        if (!tagName.trim() || !user || !activeWorkspaceId || !activeOrganizationId) return;
        try {
            const result = await createTagAction({
                name: tagName.trim(),
                workspaceId: activeWorkspaceId,
                organizationId: activeOrganizationId,
                category: 'custom',
                color: '#10B981', // green for created tags
                userId: user.uid,
                userName: user.displayName || undefined
            });

            if (result.success && result.data) {
                toast({ title: 'Tag created', description: `"${tagName}" is now available and selected.` });
                const next = [...state.postSendTagRules];
                next[idx] = { 
                    ...next[idx], 
                    tagId: result.data.id, 
                    tagName: result.data.name 
                };
                setField('postSendTagRules', next);
            } else {
                toast({ variant: 'destructive', title: 'Failed to create tag', description: result.error || 'Could not create tag.' });
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    const updateActiveVariant = (updates: Record<string, any>) => {
        const updatedVariants = state.variants.map(v => {
            if (v.id === activeVariantTab) {
                return { ...v, ...updates };
            }
            return v;
        });
        dispatch({ type: 'SET_FIELD', field: 'variants', value: updatedVariants });
    };

    // ── Sender Profiles (R5/R7 fix) ────────────────────────────────────────────
    const profilesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'sender_profiles'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            where('isActive', '==', true),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: senderProfiles } = useCollection<SenderProfile>(profilesQuery);

    // Auto-select default sender when channel changes
    React.useEffect(() => {
        if (!senderProfiles || state.senderProfileId) return;
        const match = senderProfiles.find(p => p.channel === state.channel && p.isDefault)
            || senderProfiles.find(p => p.channel === state.channel);
        if (match) setField('senderProfileId', match.id);
    }, [senderProfiles, state.channel]);

    // ── Saved Audiences (Story 5: for audience picker) ─────────────────────
    const { audiences: savedAudiences } = useAudiences(activeWorkspaceId);

    // ── Workspace Tags (Story 2 Phase 6: for post-send tag rules) ─────────
    const tagsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'tags'),
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: allTags } = useCollection<any>(tagsQuery);

    // ── Workspace Pipelines (for post-send deal rules) ───────────────────
    const pipelinesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'pipelines'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: pipelines } = useCollection<any>(pipelinesQuery);

    // ── Workspace Stages (for post-send deal rules) ──────────────────────
    const stagesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'onboardingStages'),
            orderBy('order', 'asc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: stages } = useCollection<any>(stagesQuery);

    // ── Workspace Styles (for email preview rendering) ───────────────────
    const stylesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_styles'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: messageStyles } = useCollection<any>(stylesQuery);

    const isStepValid = React.useCallback((stepNum: number) => {
        switch (stepNum) {
            case 1: return state.internalName.trim().length >= 3 && !!state.senderProfileId;
            case 2: {
                if (state.abTestEnabled) {
                    const varA = state.variants.find(v => v.id === 'A');
                    const varB = state.variants.find(v => v.id === 'B');
                    return !!varA?.templateId && !!varB?.templateId;
                }
                return !!state.templateId;
            }
            case 3: {
                if (state.audienceMode === 'all') return true;
                if (state.audienceMode === 'manual') return !!state.selectedContacts && state.selectedContacts.length > 0;
                if (state.audienceMode === 'saved') return !!state.savedAudienceId;
                if (state.audienceMode === 'advanced') return !!state.filters && state.filters.length > 0;
                return state.tagIds.length > 0 || state.entityIds.length > 0;
            }
            case 4: return !state.isScheduled || (state.scheduledAt && state.scheduledAt > new Date());
            case 5: return true;
            default: return false;
        }
    }, [state.internalName, state.senderProfileId, state.customBody, state.customSubject, state.audienceMode, state.tagIds, state.entityIds, state.selectedContacts, state.isScheduled, state.scheduledAt, state.filters, state.savedAudienceId, state.abTestEnabled, state.variants]);

    const canNavigateToStep = React.useCallback((targetStep: number) => {
        if (targetStep <= state.step) return true;
        for (let s = 1; s < targetStep; s++) {
            if (!isStepValid(s)) return false;
        }
        return true;
    }, [state.step, isStepValid]);

    const canAdvance = React.useMemo(() => {
        return isStepValid(state.step);
    }, [state.step, isStepValid]);

    const getResolvedHtml = React.useCallback((bodyText: string, blocks: any[], styleIdToUse?: string, isRichBuilder?: boolean) => {
        const styleDoc = messageStyles?.find((s: any) => s.id === styleIdToUse) || messageStyles?.find((s: any) => s.isDefault);
        const styleWrapper = styleDoc?.htmlWrapper || '{{content}}';
        
        if (isRichBuilder) {
            return renderBlocksToHtml(blocks || [], MOCK_VARIABLES, {
                wrapper: styleWrapper || undefined,
                style: styleDoc || undefined
            });
        }
        
        let resolved = resolveVariables(bodyText || '', MOCK_VARIABLES);
        if (styleWrapper && styleWrapper.includes('{{content}}')) {
            let contentHtml = resolved;
            const escaped = contentHtml
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            const withLinks = parseMarkdownLinksToHtml(escaped);
            contentHtml = withLinks.replace(/\n/g, '<br>\n');
            
            resolved = resolveVariables(styleWrapper, MOCK_VARIABLES).replace('{{content}}', contentHtml);
        } else {
            resolved = plainTextToHtml(resolved);
        }
        return resolved;
    }, [messageStyles]);

    // ── Save Draft (explicit save, not auto-save — R4 fix) ────────────────────
    const handleSaveDraft = async () => {
        if (!firestore || !user) return;
        setField('isSaving', true);
        try {
            const audienceDefinition: AudienceDefinition = {
                mode: state.audienceMode,
                tagIds: state.tagIds,
                tagLogic: state.tagLogic,
                excludeTagIds: state.excludeTagIds,
                entityIds: state.entityIds,
                selectedContacts: state.selectedContacts || [],
                contactScope: state.contactScope,
                filters: state.filters,
                filterLogic: state.filterLogic,
                groups: state.groups || [],
                savedAudienceId: state.savedAudienceId || undefined,
            };

            const data: any = {
                workspaceId: activeWorkspaceId,
                organizationId: activeOrganizationId || '',
                internalName: state.internalName.trim(),
                channel: state.channel,
                target: state.target,
                contentMode: state.contentMode,
                templateId: state.templateId || null,
                templateName: state.templateName || null,
                customBody: state.customBody,
                customBlocks: state.customBlocks || [],
                styleId: state.styleId || null,
                audienceDefinition,
                senderProfileId: state.senderProfileId || null,
                status: 'draft',
                lastCompletedStep: state.step,
                scheduledAt: state.isScheduled && state.scheduledAt ? state.scheduledAt.toISOString() : null,
                createdBy: user.uid,
                postSendTagRules: state.postSendTagRules,
                trackLinks: state.trackLinks,
                abTestEnabled: state.abTestEnabled,
                abTestConfig: state.abTestConfig,
                variants: state.variants,
            };

            if (campaign?.id) {
                await updateCampaign(firestore, campaign.id, data);
                toast({ title: 'Draft Updated' });
            } else {
                await createCampaign(firestore, data);
                toast({ title: 'Draft Saved' });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setField('isSaving', false);
        }
    };

    // ── Dispatch Campaign (R1 fix — send button must dispatch, not save) ──────
    const handleDispatch = async () => {
        if (!firestore || !user) return;
        setField('isSending', true);
        try {
            // Save first to ensure all data is persisted
            const audienceDefinition: AudienceDefinition = {
                mode: state.audienceMode,
                tagIds: state.tagIds,
                tagLogic: state.tagLogic,
                excludeTagIds: state.excludeTagIds,
                entityIds: state.entityIds,
                selectedContacts: state.selectedContacts || [],
                contactScope: state.contactScope,
                filters: state.filters,
                filterLogic: state.filterLogic,
                groups: state.groups || [],
                savedAudienceId: state.savedAudienceId || undefined,
            };

            const data: any = {
                workspaceId: activeWorkspaceId,
                organizationId: activeOrganizationId || '',
                internalName: state.internalName.trim(),
                channel: state.channel,
                target: state.target,
                contentMode: state.contentMode,
                templateId: state.templateId || null,
                templateName: state.templateName || null,
                customBody: state.customBody,
                customBlocks: state.customBlocks || [],
                styleId: state.styleId || null,
                audienceDefinition,
                senderProfileId: state.senderProfileId,
                scheduledAt: state.isScheduled && state.scheduledAt ? state.scheduledAt.toISOString() : null,
                createdBy: user.uid,
                lastCompletedStep: 5,
                postSendTagRules: state.postSendTagRules,
                trackLinks: state.trackLinks,
                abTestEnabled: state.abTestEnabled,
                abTestConfig: state.abTestConfig,
                variants: state.variants,
            };

            let id = campaign?.id;
            if (id) {
                await updateCampaign(firestore, id, data);
            } else {
                id = await createCampaign(firestore, { ...data, status: 'draft' });
            }

            if (!id) throw new Error('Failed to save campaign');

            // Now dispatch
            const result = await dispatchCampaign(id);
            if (!result.success) throw new Error(result.error || 'Dispatch failed');

            toast({ title: state.isScheduled ? 'Campaign Scheduled' : 'Campaign Sending', description: `Job ${result.jobId} created.` });
            onClose();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Dispatch Failed', description: e.message });
        } finally {
            setField('isSending', false);
        }
    };

    // ── beforeunload guard (deferred Story 8) ─────────────────────────────────
    React.useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (state.internalName.trim() || state.customBody.trim()) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [state.internalName, state.customBody]);

    // ── Close with unsaved changes guard ──────────────────────────────────────
    const handleClose = () => {
        if (state.internalName.trim() || state.customBody.trim()) {
            setShowExitDialog(true);
        } else {
            onClose();
        }
    };

    // ── Render Steps ──────────────────────────────────────────────────────────
    const renderStep = () => {
        switch (state.step) {
            case 1:
                return (
                    <div className="space-y-8">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Campaign Name</Label>
                            <Input
                                value={state.internalName}
                                onChange={e => setField('internalName', e.target.value)}
                                placeholder="e.g. Q2 Newsletter, Welcome Series..."
                                className="h-12 rounded-xl bg-card border-border/50 font-bold"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Channel</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: 'email' as const, icon: Mail, label: 'Email', desc: 'Rich content with tracking' },
                                    { value: 'sms' as const, icon: Smartphone, label: 'SMS', desc: 'Short text messages' },
                                ].map(ch => (
                                    <button key={ch.value} type="button" onClick={() => {
                                        setField('channel', ch.value);
                                    }} className={cn(
                                        "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                                        state.channel === ch.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/20"
                                    )}>
                                        <ch.icon className={cn("h-5 w-5", state.channel === ch.value ? "text-primary" : "text-muted-foreground")} />
                                        <div>
                                            <p className="text-sm font-bold">{ch.label}</p>
                                            <p className="text-[9px] font-semibold text-muted-foreground">{ch.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Audience</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: 'external_client' as const, icon: Target, label: 'External Client' },
                                    { value: 'internal_team' as const, icon: Users, label: 'Team / Staff' },
                                ].map(t => (
                                    <button key={t.value} type="button" onClick={() => setField('target', t.value)} className={cn(
                                        "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                                        state.target === t.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/20"
                                    )}>
                                        <t.icon className={cn("h-5 w-5", state.target === t.value ? "text-primary" : "text-muted-foreground")} />
                                        <p className="text-sm font-bold">{t.label}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sender Profile (R5/R7 fix) */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Sender Profile</Label>
                            <Select value={state.senderProfileId} onValueChange={v => setField('senderProfileId', v)}>
                                <SelectTrigger className="h-12 rounded-xl bg-card border-border/50 font-bold">
                                    <SelectValue placeholder="Select sender..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {(senderProfiles || []).filter(p => p.channel === state.channel).map(p => (
                                        <SelectItem key={p.id} value={p.id} className="text-xs font-semibold">
                                            {p.name} ({p.identifier})
                                        </SelectItem>
                                    ))}
                                    {!(senderProfiles || []).some(p => p.channel === state.channel) ? (
                                        <SelectItem value="_none" disabled className="text-xs text-muted-foreground">
                                            No {state.channel} profiles available
                                        </SelectItem>
                                    ) : null}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                );

            case 2: {
                const isAb = state.abTestEnabled;

                return (
                    <div className="space-y-6">
                        {/* A/B Testing Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl border bg-card/60 backdrop-blur-md border-violet-200/50 shadow-sm">
                            <div>
                                <p className="text-sm font-bold text-violet-700 flex items-center gap-1.5">
                                    <Sparkles className="h-4 w-4 text-violet-500" /> A/B Testing
                                </p>
                                <p className="text-[9px] font-semibold text-muted-foreground">Test two different variants to optimize engagement</p>
                            </div>
                            <Switch
                                checked={state.abTestEnabled}
                                onCheckedChange={v => {
                                    setField('abTestEnabled', v);
                                    if (v) {
                                        const varA = state.variants.find(item => item.id === 'A');
                                        const varB = state.variants.find(item => item.id === 'B');
                                        // Copy template reference if B is currently empty
                                        if (varB && !varB.templateId) {
                                            const updated = state.variants.map(item => {
                                                if (item.id === 'B') {
                                                    return {
                                                        ...item,
                                                        templateId: varA?.templateId || null,
                                                        templateName: varA?.templateName || null,
                                                        customSubject: varA?.customSubject || '',
                                                        customBody: varA?.customBody || '',
                                                        customBlocks: varA?.customBlocks || []
                                                    };
                                                }
                                                return item;
                                            });
                                            setField('variants', updated);
                                        }
                                    }
                                }}
                            />
                        </div>

                        {isAb ? (
                            <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
                                {['A', 'B'].map((tab) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setActiveVariantTab(tab as 'A' | 'B')}
                                        className={cn(
                                            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                                            activeVariantTab === tab
                                                ? "bg-background text-foreground shadow-sm border border-border/30"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        Variant {tab} Content
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {/* Template Picker */}
                        <div className="space-y-4 p-6 rounded-2xl border bg-card/40 backdrop-blur-sm shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-bold text-foreground">Select a messaging blueprint</Label>
                                    <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">Pick a template for this campaign</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {((!isAb && state.templateId) || (isAb && activeVariant.templateId)) ? (
                                        <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs font-bold gap-1" onClick={() => setQuickCreateOpen(true)}>
                                            <Pencil className="h-3.5 w-3.5" /> Edit Template
                                        </Button>
                                    ) : null}
                                    <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs font-bold gap-1 border-dashed hover:border-primary/50" onClick={() => { 
                                        if (isAb) {
                                            updateActiveVariant({ templateId: '' });
                                        } else {
                                            setField('templateId', '');
                                        }
                                        setQuickCreateOpen(true); 
                                    }}>
                                        <PlusCircle className="h-3.5 w-3.5" /> New Template
                                    </Button>
                                </div>
                            </div>
                            
                            <MessagingTemplateSelector 
                                category="campaigns"
                                recipientType={state.target === 'external_client' ? 'entity' : 'internal_alert'}
                                channel={state.channel}
                                value={isAb ? (activeVariant.templateId || '') : state.templateId}
                                onValueChange={(val) => {
                                    if (isAb) {
                                        updateActiveVariant({ templateId: val });
                                    } else {
                                        setField('templateId', val);
                                    }
                                }}
                                onSelect={(template) => {
                                    if (template) {
                                        if (isAb) {
                                            updateActiveVariant({
                                                templateId: template.id,
                                                templateName: template.name,
                                                customSubject: template.subject || '',
                                                customBody: template.body || '',
                                                customBlocks: template.blocks || [],
                                                styleId: template.styleId || '',
                                                contentMode: template.contentMode || 'plain_text'
                                            });
                                        } else {
                                            setField('templateName', template.name);
                                            setField('customSubject', template.subject || '');
                                            setField('customBody', template.body || '');
                                            setField('customBlocks', template.blocks || []);
                                            setField('styleId', template.styleId || '');
                                            setField('contentMode', template.contentMode || 'plain_text');
                                        }
                                    }
                                }}
                                placeholder="Choose campaign blueprint..."
                                className="rounded-xl bg-card border-border/50 font-bold transition-all text-xs"
                            />
                            
                            {((!isAb && state.templateId) || (isAb && activeVariant.templateId)) ? (
                                <div className="space-y-4 pt-4 border-t border-border/50 animate-in fade-in duration-300">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Selected Template Info</Label>
                                        <Badge variant="outline" className="text-[9px] font-bold text-violet-600 bg-violet-50 border-violet-200">
                                            {isAb ? activeVariant.templateName : state.templateName}
                                        </Badge>
                                    </div>
                                    
                                </div>
                            ) : null}
                        </div>
                    </div>
                );
            }

            case 3:
                return (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Audience Selection</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { value: 'all' as const, icon: Users, label: 'All Entities', desc: 'Target everyone' },
                                    { value: 'advanced' as const, icon: Tag, label: 'By Filters', desc: 'Advanced rules' },
                                    { value: 'saved' as const, icon: Target, label: 'Saved Audience', desc: 'Reuse a segment' },
                                    { value: 'manual' as const, icon: Target, label: 'Manual Pick', desc: 'Select specific' },
                                ].map(m => (
                                    <button key={m.value} type="button" onClick={() => setField('audienceMode', m.value)} className={cn(
                                        "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                                        state.audienceMode === m.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/20"
                                    )}>
                                        <m.icon className={cn("h-4 w-4", state.audienceMode === m.value ? "text-primary" : "text-muted-foreground")} />
                                        <p className="text-[10px] font-bold">{m.label}</p>
                                        <p className="text-[8px] font-semibold text-muted-foreground">{m.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* All mode */}
                        {state.audienceMode === 'all' ? (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                                <Users className="h-5 w-5 text-emerald-600 shrink-0" />
                                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">All entities in your workspace will receive this campaign.</p>
                            </div>
                        ) : null}

                        {/* Advanced filter mode */}
                        {state.audienceMode === 'advanced' ? (
                            <FilterBuilder
                                contactScope={state.contactScope}
                                channel={state.channel === 'email' || state.channel === 'sms' ? state.channel : undefined}
                                filters={state.filters}
                                filterLogic={state.filterLogic}
                                groups={state.groups}
                                showPreview={false}
                                onChange={(f, l, g) => { 
                                    setField('filters', f); 
                                    setField('filterLogic', l); 
                                    if (g) setField('groups', g);
                                }}
                            />
                        ) : null}

                        {/* Saved audience mode */}
                        {state.audienceMode === 'saved' ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Select Saved Audience</Label>
                                    <Select value={state.savedAudienceId} onValueChange={v => {
                                        setField('savedAudienceId', v);
                                        // Load filters from saved audience
                                        const aud = savedAudiences.find(a => a.id === v);
                                        if (aud) {
                                            setField('filters', aud.filters);
                                            setField('filterLogic', aud.filterLogic);
                                            setField('groups', aud.groups || []);
                                        }
                                    }}>
                                        <SelectTrigger className="h-10 rounded-xl font-bold text-xs bg-card border-border/50">
                                            <SelectValue placeholder="Choose an audience..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            {savedAudiences.map(a => (
                                                <SelectItem key={a.id} value={a.id} className="text-xs font-semibold">
                                                    {a.name} ({a.filters?.length || 0} filters)
                                                </SelectItem>
                                            ))}
                                            {savedAudiences.length === 0 ? (
                                                <SelectItem value="_none" disabled className="text-xs text-muted-foreground">No saved audiences</SelectItem>
                                            ) : null}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ) : null}

                        {/* Manual Pick mode */}
                        {state.audienceMode === 'manual' ? (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Select Contacts</Label>
                                <ManualContactSelector
                                    channel={state.channel}
                                    selectedContacts={state.selectedContacts || []}
                                    onChange={updated => setField('selectedContacts', updated)}
                                />
                            </div>
                        ) : null}

                        {/* Contact scope */}
                        {state.audienceMode !== 'saved' && state.audienceMode !== 'manual' ? (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Contact Scope</Label>
                                <ContactScopeSelector 
                                    value={state.contactScope} 
                                    onChange={v => setField('contactScope', v as any)} 
                                />
                            </div>
                        ) : null}

                        {/* Projected Reach Summary */}
                        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-primary/10">
                                        <Users className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <p className="text-xs font-bold">Projected Reach</p>
                                </div>
                                {isPreviewing ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                ) : (
                                    <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border-none">
                                        {previewResult?.contactCount || 0} Recipients
                                    </Badge>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-tight">Entities Matched</p>
                                    <p className="text-sm font-bold">{previewResult?.count || 0}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-tight">Scope Coverage</p>
                                    <p className="text-sm font-bold">
                                        {previewResult?.count ? Math.round(((previewResult.contactCount || 0) / previewResult.count) * 100) : 0}%
                                    </p>
                                </div>
                            </div>

                            {previewResult?.contactsPreview && previewResult.contactsPreview.length > 0 ? (
                                <div className="pt-2 border-t border-border/50 space-y-2">
                                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-tight">Sample Targets (Resolved Contacts)</p>
                                    <div className="space-y-2">
                                        {previewResult.contactsPreview.slice(0, 5).map(cp => {
                                            const initials = cp.name
                                                ? cp.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                                                : '?';
                                            return (
                                                <div key={cp.id} className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/30 hover:border-border/60 transition-all">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-[10px] uppercase shrink-0">
                                                            {initials}
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <p className="text-xs font-bold text-foreground">{cp.name}</p>
                                                            <p className="text-[9px] font-semibold text-muted-foreground">{cp.entityName}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-muted-foreground">{cp.contactVal}</span>
                                                        {state.channel === 'email' ? (
                                                            <EmailHygieneBadge status={cp.verificationStatus as any} size="sm" />
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {previewResult.contactsPreview.length > 5 ? (
                                            <p className="text-[9px] font-semibold text-muted-foreground text-center">
                                                +{previewResult.contactsPreview.length - 5} more recipients matching scope
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
                                <div>
                                    <p className="text-sm font-bold">Schedule for Later</p>
                                    <p className="text-[9px] font-semibold text-muted-foreground">Otherwise, campaign sends immediately upon approval</p>
                                </div>
                                <Switch
                                    checked={state.isScheduled}
                                    onCheckedChange={v => setField('isScheduled', v)}
                                />
                            </div>

                            {state.isScheduled ? (
                                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Dispatch Time</Label>
                                    <DateTimePicker
                                        value={state.scheduledAt || undefined}
                                        onChange={v => setField('scheduledAt', v || null)}
                                    />
                                </div>
                            ) : null}
                        </div>

                        <Separator className="opacity-50" />

                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
                                                                <div>
                                                                    <p className="text-sm font-bold">Track Link Engagement</p>
                                                                    <p className="text-[9px] font-semibold text-muted-foreground">Wraps all URLs to measure click-through rates</p>
                                                                </div>
                                                                <Switch
                                                                    checked={state.trackLinks}
                                                                    onCheckedChange={v => setField('trackLinks', v)}
                                                                />
                                                            </div>
                                                        </div>

                                                        {state.abTestEnabled ? (
                                                            <>
                                                                <Separator className="opacity-50" />
                                                                <div className="space-y-6 p-6 rounded-2xl border bg-violet-500/5 border-violet-500/20 animate-in slide-in-from-top-2 duration-300">
                                                                    <div className="flex items-center gap-2">
                                                                        <Sparkles className="h-5 w-5 text-violet-500" />
                                                                        <div>
                                                                            <p className="text-sm font-bold text-violet-900">A/B Testing Configuration</p>
                                                                            <p className="text-[10px] font-semibold text-violet-600/80">Configure split size, duration, and evaluation criteria</p>
                                                                        </div>
                                                                    </div>
                                                                    <Separator className="bg-violet-500/20" />
                                                                    
                                                                    <div className="space-y-4">
                                                                        <ABTestSlider
                                                                            value={state.abTestConfig.testSizePercentage}
                                                                            onChange={(val) => {
                                                                                setField('abTestConfig', {
                                                                                    ...state.abTestConfig,
                                                                                    testSizePercentage: val
                                                                                });
                                                                            }}
                                                                        />

                                                                        {state.abTestConfig.testSizePercentage < 100 ? (
                                                                            <>
                                                                                <div className="space-y-2">
                                                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                                                        Test Duration (Hours)
                                                                                    </Label>
                                                                                    <Input
                                                                                        type="number"
                                                                                        min={1}
                                                                                        max={168}
                                                                                        value={state.abTestConfig.testDurationHours}
                                                                                        onChange={e => {
                                                                                            const val = Math.min(168, Math.max(1, parseInt(e.target.value) || 4));
                                                                                            setField('abTestConfig', {
                                                                                                ...state.abTestConfig,
                                                                                                testDurationHours: val
                                                                                            });
                                                                                        }}
                                                                                        placeholder="Hours to wait before declaring winner"
                                                                                        className="h-10 rounded-xl bg-card border border-border/50 font-semibold text-xs px-3"
                                                                                    />
                                                                                    <p className="text-[9px] font-semibold text-muted-foreground ml-1">
                                                                                        Evaluation job runs after this duration to automatically declare the winner and send the winning variant to the remaining {100 - state.abTestConfig.testSizePercentage}% of the audience.
                                                                                    </p>
                                                                                </div>

                                                                                <div className="space-y-2">
                                                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                                                        Winner Selection Metric
                                                                                    </Label>
                                                                                    <Select
                                                                                        value={state.abTestConfig.winnerMetric}
                                                                                        onValueChange={v => {
                                                                                            setField('abTestConfig', {
                                                                                                ...state.abTestConfig,
                                                                                                winnerMetric: v as any
                                                                                            });
                                                                                        }}
                                                                                    >
                                                                                        <SelectTrigger className="h-10 rounded-xl bg-card border border-border/50 font-bold text-xs">
                                                                                            <SelectValue placeholder="Select winning metric..." />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent className="rounded-xl">
                                                                                            <SelectItem value="open_rate" className="text-xs font-semibold">Open Rate (Highest percentage of messages opened)</SelectItem>
                                                                                            <SelectItem value="click_rate" className="text-xs font-semibold">Click-Through Rate (Highest percentage of clicks on tracked links)</SelectItem>
                                                                                            <SelectItem value="low_unsubscribe_rate" className="text-xs font-semibold">Lowest Unsubscribe Rate (Fewest unsubscriptions)</SelectItem>
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                                                                                Test size is 100%. The audience will be split 50/50 between Variant A and Variant B. No remainder dispatch will be scheduled.
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        ) : null}

                        <Separator className="opacity-50" />

                        <div className="space-y-4">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-2">
                                <Zap className="h-3 w-3" /> Post-Send Automation Rules
                            </Label>
                            
                            <div className="space-y-4">
                                {state.postSendTagRules.map((rule, idx) => {
                                    const actionType = rule.actionType || 'add_tag';
                                    const activeStages = stages?.filter((s: any) => s.pipelineId === rule.dealPipelineId) || [];

                                    return (
                                        <div key={idx} className="p-5 rounded-2xl border bg-card/40 backdrop-blur-sm shadow-sm space-y-4 relative group hover:border-violet-500/20 transition-all duration-300">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                                                    Rule #{idx + 1}
                                                </span>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors duration-200" 
                                                    onClick={() => {
                                                        const next = [...state.postSendTagRules];
                                                        next.splice(idx, 1);
                                                        setField('postSendTagRules', next);
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* WHEN COHORT */}
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] font-bold text-muted-foreground uppercase">When Recipient Outcome is</Label>
                                                    <Select
                                                        value={rule.appliesTo}
                                                        onValueChange={(val: any) => {
                                                            const next = [...state.postSendTagRules];
                                                            next[idx] = { ...next[idx], appliesTo: val };
                                                            setField('postSendTagRules', next);
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-10 rounded-xl bg-card border-border/50 font-semibold text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            <SelectItem value="delivered" className="text-xs font-semibold">Delivered Successfully</SelectItem>
                                                            <SelectItem value="failed" className="text-xs font-semibold">Failed to Deliver</SelectItem>
                                                            <SelectItem value="not_delivered" className="text-xs font-semibold">Not Delivered (Wait / Out of bounds)</SelectItem>
                                                            <SelectItem value="all_targeted" className="text-xs font-semibold">All Targeted Contacts</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* THEN ACTION */}
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] font-bold text-muted-foreground uppercase">Then Action is</Label>
                                                    <Select
                                                        value={actionType}
                                                        onValueChange={(val: any) => {
                                                            const next = [...state.postSendTagRules];
                                                            next[idx] = { 
                                                                ...next[idx], 
                                                                actionType: val,
                                                                // Reset action-specific fields to avoid dirty payload
                                                                tagId: '',
                                                                tagName: '',
                                                                dealPipelineId: '',
                                                                dealStageId: '',
                                                                dealTitleTemplate: '',
                                                                taskTitleTemplate: '',
                                                                taskDueDateOffsetDays: 3
                                                            };
                                                            setField('postSendTagRules', next);
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-10 rounded-xl bg-card border-border/50 font-semibold text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            <SelectItem value="add_tag" className="text-xs font-semibold">Apply Tag</SelectItem>
                                                            <SelectItem value="create_deal" className="text-xs font-semibold">Create Deal</SelectItem>
                                                            <SelectItem value="create_task" className="text-xs font-semibold">Assign Follow-Up Task</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {/* ACTION PARAMETERS */}
                                            {actionType === 'add_tag' && (() => {
                                                const selectedTag = allTags?.find((t: any) => t.id === rule.tagId);
                                                return (
                                                    <div className="space-y-1.5 animate-in fade-in duration-200">
                                                        <Label className="text-[9px] font-bold text-muted-foreground uppercase">Select Workspace Tag</Label>
                                                        <Popover 
                                                            open={openRuleTagIdx === idx} 
                                                            onOpenChange={(open) => {
                                                                setOpenRuleTagIdx(open ? idx : null);
                                                                if (!open) setRuleTagInputValue('');
                                                            }} 
                                                            modal={false}
                                                        >
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    aria-expanded={openRuleTagIdx === idx}
                                                                    className="w-full h-10 rounded-xl bg-card border-border/50 font-semibold text-xs justify-between px-3"
                                                                >
                                                                    {rule.tagId ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <div 
                                                                                className="h-2 w-2 rounded-full shrink-0" 
                                                                                style={{ backgroundColor: selectedTag?.color || '#cbd5e1' }} 
                                                                            />
                                                                            <span>{rule.tagName || selectedTag?.name}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">Select a tag...</span>
                                                                    )}
                                                                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 border-none shadow-2xl rounded-xl overflow-hidden" align="start">
                                                                <Command className="w-full" shouldFilter={true}>
                                                                    <CommandInput 
                                                                        placeholder="Search or type to create tag..." 
                                                                        className="font-bold text-xs h-10" 
                                                                        value={ruleTagInputValue}
                                                                        onValueChange={setRuleTagInputValue}
                                                                    />
                                                                    <CommandList className="max-h-60 overflow-y-auto scrollbar-thin">
                                                                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No tags found.</CommandEmpty>
                                                                        <CommandGroup className="p-1">
                                                                            {allTags?.map((tag: any) => (
                                                                                <CommandItem
                                                                                    key={tag.id}
                                                                                    value={tag.name}
                                                                                    onSelect={() => {
                                                                                        const next = [...state.postSendTagRules];
                                                                                        next[idx] = { 
                                                                                            ...next[idx], 
                                                                                            tagId: tag.id, 
                                                                                            tagName: tag.name 
                                                                                        };
                                                                                        setField('postSendTagRules', next);
                                                                                        setOpenRuleTagIdx(null);
                                                                                        setRuleTagInputValue('');
                                                                                    }}
                                                                                    className="cursor-pointer rounded-lg p-2 gap-2 text-xs font-semibold flex items-center justify-between"
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div 
                                                                                            className="h-2 w-2 rounded-full shrink-0" 
                                                                                            style={{ backgroundColor: tag.color || '#cbd5e1' }} 
                                                                                        />
                                                                                        <span>{tag.name}</span>
                                                                                    </div>
                                                                                    {rule.tagId === tag.id && (
                                                                                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                                                                    )}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                        {ruleTagInputValue.trim() !== '' && !allTags?.some((tag: any) => tag.name.toLowerCase() === ruleTagInputValue.trim().toLowerCase()) && (
                                                                            <CommandGroup className="p-1 border-t border-border/30" forceMount>
                                                                                <CommandItem
                                                                                    value={ruleTagInputValue}
                                                                                    onSelect={() => {
                                                                                        handleCreateTagForRule(ruleTagInputValue.trim(), idx);
                                                                                        setOpenRuleTagIdx(null);
                                                                                        setRuleTagInputValue('');
                                                                                    }}
                                                                                    className="cursor-pointer rounded-lg p-2 gap-2 text-xs text-primary font-bold flex items-center"
                                                                                    forceMount
                                                                                >
                                                                                    <Plus className="h-3.5 w-3.5 shrink-0" />
                                                                                    <span>Create &quot;{ruleTagInputValue.trim()}&quot;</span>
                                                                                </CommandItem>
                                                                            </CommandGroup>
                                                                        )}
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                );
                                            })()}

                                            {actionType === 'create_deal' && (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
                                                    {/* PIPELINE */}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] font-bold text-muted-foreground uppercase">Sales Pipeline</Label>
                                                        <Select
                                                            value={rule.dealPipelineId || ''}
                                                            onValueChange={(val) => {
                                                                const next = [...state.postSendTagRules];
                                                                next[idx] = { 
                                                                    ...next[idx], 
                                                                    dealPipelineId: val,
                                                                    dealStageId: '' // reset stage when pipeline changes
                                                                };
                                                                setField('postSendTagRules', next);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-10 rounded-xl bg-card border-border/50 font-semibold text-xs">
                                                                <SelectValue placeholder="Select pipeline..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                {pipelines?.map((pipe: any) => (
                                                                    <SelectItem key={pipe.id} value={pipe.id} className="text-xs font-semibold">
                                                                        {pipe.name}
                                                                    </SelectItem>
                                                                ))}
                                                                {(!pipelines || pipelines.length === 0) && (
                                                                    <SelectItem value="none" disabled className="text-xs">No pipelines found</SelectItem>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {/* STAGE */}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] font-bold text-muted-foreground uppercase">Pipeline Stage</Label>
                                                        <Select
                                                            value={rule.dealStageId || ''}
                                                            disabled={!rule.dealPipelineId}
                                                            onValueChange={(val) => {
                                                                const next = [...state.postSendTagRules];
                                                                next[idx] = { ...next[idx], dealStageId: val };
                                                                setField('postSendTagRules', next);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-10 rounded-xl bg-card border-border/50 font-semibold text-xs">
                                                                <SelectValue placeholder={rule.dealPipelineId ? "Select stage..." : "Select pipeline first"} />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                {activeStages.map((stage: any) => (
                                                                    <SelectItem key={stage.id} value={stage.id} className="text-xs font-semibold">
                                                                        {stage.name}
                                                                    </SelectItem>
                                                                ))}
                                                                {activeStages.length === 0 && (
                                                                    <SelectItem value="none" disabled className="text-xs">No stages</SelectItem>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {/* DEAL TITLE */}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] font-bold text-muted-foreground uppercase">Deal Title Template</Label>
                                                        <Input
                                                            type="text"
                                                            placeholder="e.g. {{entityName}} Deal"
                                                            value={rule.dealTitleTemplate || ''}
                                                            onChange={(e) => {
                                                                const next = [...state.postSendTagRules];
                                                                next[idx] = { ...next[idx], dealTitleTemplate: e.target.value };
                                                                setField('postSendTagRules', next);
                                                            }}
                                                            className="h-10 rounded-xl bg-card border border-border/50 font-semibold text-xs px-3"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {actionType === 'create_task' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                                                    {/* TASK TITLE */}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] font-bold text-muted-foreground uppercase">Task Title Template</Label>
                                                        <Input
                                                            type="text"
                                                            placeholder="e.g. Follow up with {{entityName}}"
                                                            value={rule.taskTitleTemplate || ''}
                                                            onChange={(e) => {
                                                                const next = [...state.postSendTagRules];
                                                                next[idx] = { ...next[idx], taskTitleTemplate: e.target.value };
                                                                setField('postSendTagRules', next);
                                                            }}
                                                            className="h-10 rounded-xl bg-card border border-border/50 font-semibold text-xs px-3"
                                                        />
                                                    </div>

                                                    {/* DUE DATE OFFSET */}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] font-bold text-muted-foreground uppercase">Due Date Offset (Days)</Label>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={365}
                                                            value={rule.taskDueDateOffsetDays ?? 3}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 3;
                                                                const next = [...state.postSendTagRules];
                                                                next[idx] = { ...next[idx], taskDueDateOffsetDays: val };
                                                                setField('postSendTagRules', next);
                                                            }}
                                                            placeholder="e.g. 3"
                                                            className="h-10 rounded-xl bg-card border border-border/50 font-semibold text-xs px-3"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-10 rounded-xl border-dashed border-2 hover:border-violet-500/50 hover:text-violet-600 text-xs font-bold gap-2 transition-all"
                                    onClick={() => {
                                        setField('postSendTagRules', [
                                            ...state.postSendTagRules,
                                            { appliesTo: 'delivered', actionType: 'add_tag', tagId: '', tagName: '' }
                                        ]);
                                    }}
                                >
                                    <Plus className="h-3 w-3" /> Add Post-Send Automation Rule
                                </Button>
                            </div>
                        </div>
                    </div>
                );

            case 5: {
                const senderProfile = senderProfiles?.find(p => p.id === state.senderProfileId);
                const resolvedHtml = state.channel === 'email' 
                    ? getResolvedHtml(state.customBody, state.customBlocks || [], state.styleId, state.contentMode === 'rich_builder')
                    : '';
                const variantA = state.variants.find(v => v.id === 'A') || { customBody: '', customBlocks: [], styleId: '', contentMode: 'plain_text', customSubject: '' };
                const htmlA = state.channel === 'email'
                    ? getResolvedHtml(variantA.customBody, variantA.customBlocks || [], variantA.styleId || state.styleId, variantA.contentMode === 'rich_builder')
                    : '';
                const variantB = state.variants.find(v => v.id === 'B') || { customBody: '', customBlocks: [], styleId: '', contentMode: 'plain_text', customSubject: '' };
                const htmlB = state.channel === 'email'
                    ? getResolvedHtml(variantB.customBody, variantB.customBlocks || [], variantB.styleId || state.styleId, variantB.contentMode === 'rich_builder')
                    : '';

                return (
                    <div className="space-y-8">
                        <div className={cn("grid grid-cols-1 gap-4", state.abTestEnabled ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                            <Card className="rounded-2xl border-none shadow-sm bg-muted/20">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Metadata</CardDescription>
                                    <CardTitle className="text-sm font-bold truncate">{state.internalName}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[8px] font-bold uppercase">{state.channel}</Badge>
                                        <Badge variant="outline" className="text-[8px] font-bold uppercase">{state.target.replace('_', ' ')}</Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Sender</p>
                                        <p className="text-[10px] font-semibold truncate">{senderProfile?.name || 'Not selected'} ({senderProfile?.identifier || state.senderProfileId || 'No ID'})</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border-none shadow-sm bg-muted/20">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Audience Summary</CardDescription>
                                    <CardTitle className="text-sm font-bold">Estimated Recipients</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black">{previewResult?.count ?? 0}</span>
                                        <span className="text-[10px] font-semibold text-muted-foreground">contacts targeted</span>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Mode / Scope</p>
                                        <p className="text-[10px] font-semibold capitalize">{state.audienceMode.replace('_', ' ')} / {state.contactScope}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            {state.abTestEnabled ? (
                                <Card className="rounded-2xl border-none shadow-sm bg-violet-500/5 border border-violet-500/10">
                                    <CardHeader className="pb-2">
                                        <CardDescription className="text-[9px] font-bold uppercase tracking-widest text-violet-600">A/B Testing</CardDescription>
                                        <CardTitle className="text-sm font-bold text-violet-900">Winner-Take-All</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-bold text-violet-500 uppercase">Test Group Size</p>
                                            <p className="text-[10px] font-semibold text-violet-800">{state.abTestConfig.testSizePercentage}% ({state.abTestConfig.testSizePercentage / 2}% A / {state.abTestConfig.testSizePercentage / 2}% B)</p>
                                        </div>
                                        {state.abTestConfig.testSizePercentage < 100 ? (
                                            <>
                                                <div className="space-y-1">
                                                    <p className="text-[8px] font-bold text-violet-500 uppercase">Duration</p>
                                                    <p className="text-[10px] font-semibold text-violet-800">{state.abTestConfig.testDurationHours} hours</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[8px] font-bold text-violet-500 uppercase">Winning Metric</p>
                                                    <p className="text-[10px] font-semibold text-violet-800 capitalize">
                                                        {state.abTestConfig.winnerMetric.replace('_', ' ')}
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-bold text-amber-600 uppercase">Mode</p>
                                                <p className="text-[10px] font-semibold text-amber-800">50/50 Split Send</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : null}
                        </div>

                        {state.abTestEnabled ? (
                            <div className="space-y-4">
                                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Content Preview (Variants A & B)</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {['A', 'B'].map((varId) => {
                                        const variant = state.variants.find(v => v.id === varId) || { customSubject: '', customBody: '' };
                                        return (
                                            <motion.div
                                                key={varId}
                                                initial={{ opacity: 0, y: 15 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.4, delay: varId === 'A' ? 0 : 0.1 }}
                                                className="rounded-2xl border border-violet-200/50 bg-card overflow-hidden flex flex-col h-full shadow-sm"
                                            >
                                                {state.channel === 'email' ? (
                                                    <>
                                                        <div className="p-3 bg-violet-500/5 border-b border-violet-500/10 flex items-center justify-between">
                                                            <div>
                                                                <span className="text-[10px] font-bold text-violet-700">Variant {varId}</span>
                                                                {variant.templateName && (
                                                                    <Badge variant="secondary" className="text-[8px] font-bold bg-violet-100 text-violet-800 ml-2">
                                                                        {variant.templateName}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <Button 
                                                                type="button" 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="rounded-lg h-6 px-2 text-[8px] font-bold text-violet-700 hover:bg-violet-100"
                                                                onClick={() => setPreviewHtml(varId === 'A' ? htmlA : htmlB)}
                                                            >
                                                                <Eye className="h-3 w-3 mr-1" /> Fullscreen
                                                            </Button>
                                                        </div>
                                                        <div className="p-3.5 border-b bg-muted/10">
                                                            <p className="text-[9px] font-bold text-muted-foreground mb-0.5">Subject</p>
                                                            <p className="text-xs font-bold text-foreground truncate">{variant.customSubject || '(No subject)'}</p>
                                                        </div>
                                                        <div className="p-0 h-[220px] bg-white overflow-hidden">
                                                            <iframe
                                                                title={`Variant ${varId} Preview`}
                                                                srcDoc={varId === 'A' ? htmlA : htmlB}
                                                                className="w-full h-full border-0 animate-in fade-in"
                                                                sandbox="allow-popups allow-popups-to-escape-sandbox"
                                                            />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="p-3 bg-violet-500/5 border-b border-violet-500/10 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-violet-700">Variant {varId}</span>
                                                        </div>
                                                        <div className="p-5 flex-1 max-h-[250px] overflow-y-auto bg-card">
                                                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans text-xs">
                                                                {variant.customBody || '(No content)'}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Content Preview</Label>
                                    {state.templateName ? <Badge variant="secondary" className="text-[8px] font-bold">Template: {state.templateName}</Badge> : null}
                                </div>
                                <div className="rounded-2xl border bg-card overflow-hidden">
                                    {state.channel === 'email' ? (
                                        <>
                                            <div className="p-4 border-b bg-muted/10 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground mb-0.5">Subject</p>
                                                    <p className="text-xs font-bold">{state.customSubject || '(No subject)'}</p>
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="rounded-xl h-8 text-[10px] font-bold border-border hover:bg-muted/50"
                                                    onClick={() => setPreviewHtml(resolvedHtml)}
                                                >
                                                    <Eye className="h-3.5 w-3.5 mr-1" /> Fullscreen
                                                </Button>
                                            </div>
                                            <div className="p-0 h-[300px] overflow-hidden bg-white">
                                                <iframe
                                                    title="Email Preview"
                                                    srcDoc={resolvedHtml}
                                                    className="w-full h-full border-0 animate-in fade-in"
                                                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-6 max-h-[300px] overflow-y-auto">
                                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans">
                                                {state.customBody || '(No content)'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {state.isScheduled ? (
                            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="text-xs font-bold">Scheduled Dispatch</p>
                                    <p className="text-[10px] font-semibold text-muted-foreground">
                                        {state.scheduledAt?.toLocaleString() || 'Invalid date'}
                                    </p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                );
            }

            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300 flex items-center justify-center p-4">
            <Card className="w-full max-w-3xl h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl border-none overflow-hidden animate-in zoom-in-95 duration-500">
                <CardHeader className="p-8 pb-0 shrink-0 relative">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                                <Megaphone className="h-6 w-6" />
                            </div>
                            <CardTitle className="text-xl font-bold tracking-tight">Campaign Wizard</CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleClose} className="absolute top-8 right-8 rounded-2xl h-10 w-10 hover:bg-accent/50 transition-colors">
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                    <StepIndicator 
                        current={state.step} 
                        onStepClick={(step) => dispatch({ type: 'SET_STEP', step })}
                        canNavigateToStep={canNavigateToStep}
                    />
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-8 pt-6">
                    {renderStep()}
                </CardContent>

                <CardFooter className="p-8 pt-4 border-t bg-muted/10 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {state.step > 1 ? (
                            <Button variant="ghost" onClick={() => dispatch({ type: 'PREV_STEP' })} className="rounded-xl font-bold h-12 px-6">
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back
                            </Button>
                        ) : null}
                        <Button variant="ghost" onClick={handleSaveDraft} disabled={state.isSaving || state.isSending || !state.internalName} className="rounded-xl font-bold h-12 px-6 text-primary">
                            {state.isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            {campaign ? 'Update Draft' : 'Save as Draft'}
                        </Button>
                    </div>

                    <div className="flex items-center gap-3">
                        {state.step < 5 ? (
                            <Button onClick={() => dispatch({ type: 'NEXT_STEP' })} disabled={!canAdvance} className="rounded-xl font-bold h-12 px-8 shadow-lg shadow-primary/20">
                                Next Step <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        ) : (
                            <Button onClick={handleDispatch} disabled={state.isSending || state.isSaving} className="rounded-xl font-bold h-12 px-10 shadow-xl shadow-primary/30">
                                {state.isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                                {state.isScheduled ? 'Schedule Campaign' : 'Launch Dispatch'}
                            </Button>
                        )}
                    </div>
                </CardFooter>
            </Card>

            <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
                <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Unsaved Progress</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-semibold text-muted-foreground">
                            You have unsaved campaign data. Exiting will lose all changes since your last draft save.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 mt-4">
                        <AlertDialogCancel className="rounded-2xl font-bold h-12 px-6 border-none bg-muted hover:bg-muted/80">Keep Editing</AlertDialogCancel>
                        <AlertDialogAction onClick={onClose} className="rounded-2xl font-bold h-12 px-8 bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/20">Discard & Exit</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {quickCreateOpen ? (
                <TemplateWorkshopSheet 
                    open={quickCreateOpen}
                    onOpenChange={setQuickCreateOpen}
                    templateId={state.abTestEnabled ? (activeVariant.templateId || undefined) : (state.templateId || undefined)}
                    initialContext={{
                        channel: state.channel,
                        category: 'campaigns',
                        recipientType: state.target === 'external_client' ? 'entity' : 'internal_alert'
                    }}
                    onCreated={(template: any) => {
                        if (state.abTestEnabled) {
                            updateActiveVariant({
                                templateId: template.id,
                                templateName: template.name,
                                customSubject: template.subject || '',
                                customBody: template.body || '',
                            });
                        } else {
                            setField('templateId', template.id);
                            if (template.name) setField('templateName', template.name);
                            if (template.subject !== undefined) setField('customSubject', template.subject);
                            if (template.body !== undefined) setField('customBody', template.body);
                        }
                        if (template.contentMode) setField('contentMode', template.contentMode);
                        setQuickCreateOpen(false);
                    }}
                />
            ) : null}

            {previewHtml ? (
                <AlertDialog open={!!previewHtml} onOpenChange={(open) => { if (!open) setPreviewHtml(null); }}>
                    <AlertDialogContent className="max-w-5xl w-[90vw] h-[90vh] flex flex-col rounded-[2.5rem] border-none p-6 bg-card">
                        <AlertDialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                            <AlertDialogTitle className="text-base font-bold">Email Preview</AlertDialogTitle>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setPreviewHtml(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </AlertDialogHeader>
                        <div className="flex-1 w-full bg-white rounded-2xl overflow-hidden mt-4 border border-border/50">
                            <iframe
                                title="Fullscreen Email Preview"
                                srcDoc={previewHtml}
                                className="w-full h-full border-0"
                                sandbox="allow-popups allow-popups-to-escape-sandbox"
                            />
                        </div>
                        <AlertDialogFooter className="pt-4 border-t border-border/50">
                            <AlertDialogCancel className="rounded-xl font-bold h-10 px-5" onClick={() => setPreviewHtml(null)}>Close</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            ) : null}
        </div>
    );
}
