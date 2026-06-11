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
import { getEffectiveContactTypes } from '@/lib/contact-type-actions';
import { previewCampaignAudience } from '@/lib/messaging-actions';
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
    ArrowLeft, ArrowRight, Check, ChevronRight, Loader2, Mail, Smartphone,
    Users, Save, Send, Tag, Target, FileText, Calendar, Eye, Megaphone, Zap, X, Plus,
    Sparkles, Wand2, Pencil, PlusCircle
} from 'lucide-react';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { MessagingTemplateSelector } from '../../../components/MessagingTemplateSelector';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import { useEntityCache } from '@/context/EntityCacheContext';
import { motion, AnimatePresence } from 'framer-motion';

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
                {roles.length > 0 && (
                    <>
                        <Separator className="my-1 opacity-50" />
                        <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Role Based</SelectLabel>
                            {roles.map(r => (
                                <SelectItem key={r.value} value={r.value} className="text-xs font-semibold">{r.label}</SelectItem>
                            ))}
                        </SelectGroup>
                    </>
                )}
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
    styleId: string;
    audienceMode: AudienceDefinition['mode'];
    tagIds: string[];
    tagLogic: 'any' | 'all';
    excludeTagIds: string[];
    entityIds: string[];
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
            contentMode: campaign.contentMode || 'rich_builder',
            templateId: campaign.templateId || '',
            templateName: campaign.templateName || '',
            customSubject: campaign.customSubject || '',
            customBody: campaign.customBody || '',
            styleId: campaign.styleId || '',
            audienceMode: campaign.audienceDefinition?.mode || 'all',
            tagIds: campaign.audienceDefinition?.tagIds || [],
            tagLogic: campaign.audienceDefinition?.tagLogic || 'any',
            excludeTagIds: campaign.audienceDefinition?.excludeTagIds || [],
            entityIds: campaign.audienceDefinition?.entityIds || [],
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
        contentMode: 'rich_builder', templateId: '', templateName: '', customSubject: '',
        customBody: '', styleId: '', audienceMode: 'all', tagIds: [], tagLogic: 'any',
        excludeTagIds: [], entityIds: [], contactScope: 'primary', senderProfileId: '',
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

function StepIndicator({ current }: { current: number }) {
    return (
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STEPS.map((s, i) => (
                <React.Fragment key={s.num}>
                    <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition-colors",
                        s.num === current ? "bg-primary text-primary-foreground" :
                        s.num < current ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                        {s.num < current ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
                        {s.label}
                    </div>
                    {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                </React.Fragment>
            ))}
        </div>
    );
}

// ─── Main Wizard Component ────────────────────────────────────────────────────

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

    const [state, dispatch] = React.useReducer(wizardReducer, campaign, createInitialState);

    // ── Audience Preview State ────────────────────────────────────────────────
    const [isPreviewing, setIsPreviewing] = React.useState(false);
    const [previewResult, setPreviewResult] = React.useState<{
        count: number;
        contactCount: number;
        preview: { id: string; name: string; tags: string[] }[];
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
                if (state.audienceMode === 'manual') {
                    filters = [{ id: '_manual', field: 'entityId', operator: 'any_of', value: state.entityIds }];
                }

                const result = await previewCampaignAudience({
                    workspaceId: activeWorkspaceId,
                    filters: filters as any,
                    filterLogic: state.filterLogic,
                    groups: state.audienceMode === 'advanced' || state.audienceMode === 'saved' ? state.groups : [],
                    limit: 10,
                    contactScope: state.contactScope,
                    channel: state.channel === 'email' || state.channel === 'sms' ? state.channel : undefined,
                });
                
                if (result.success) {
                    setPreviewResult({ 
                        count: result.count ?? 0, 
                        contactCount: result.contactCount ?? 0, 
                        preview: result.preview ?? [] 
                    });
                }
            } catch (err) {
                console.error('[WizardPreview] Failed:', err);
            } finally {
                setIsPreviewing(false);
            }
        }, 800);
    }, [activeWorkspaceId, state.filters, state.filterLogic, state.contactScope, state.channel, state.audienceMode, state.entityIds]);

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

    // ── Step Validation (R6 fix: narrow deps) ─────────────────────────────────
    const canAdvance = React.useMemo(() => {
        switch (state.step) {
            case 1: return state.internalName.trim().length >= 3 && !!state.senderProfileId;
            case 2: {
                if (state.abTestEnabled) {
                    const varA = state.variants.find(v => v.id === 'A');
                    const varB = state.variants.find(v => v.id === 'B');
                    const isEmail = state.channel === 'email';
                    if (isEmail) {
                        return !!(varA?.customSubject?.trim() && varA?.customBody?.trim() && varB?.customSubject?.trim() && varB?.customBody?.trim());
                    } else {
                        return !!(varA?.customBody?.trim() && varB?.customBody?.trim());
                    }
                }
                return state.customBody.trim().length > 0 || state.customSubject.trim().length > 0;
            }
            case 3: return state.audienceMode === 'all' || state.tagIds.length > 0 || state.entityIds.length > 0 || (state.audienceMode === 'advanced' && state.filters.length > 0) || (state.audienceMode === 'saved' && !!state.savedAudienceId);
            case 4: return !state.isScheduled || (state.scheduledAt && state.scheduledAt > new Date());
            case 5: return true;
            default: return false;
        }
    }, [state.step, state.internalName, state.senderProfileId, state.customBody, state.customSubject, state.audienceMode, state.tagIds, state.entityIds, state.isScheduled, state.scheduledAt, state.filters, state.savedAudienceId, state.abTestEnabled, state.variants]);

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
                customSubject: state.customSubject,
                customBody: state.customBody,
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
                customSubject: state.customSubject,
                customBody: state.customBody,
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
                                        if (ch.value === 'sms') setField('contentMode', 'plain_text');
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
                const activeVariant = state.variants.find(v => v.id === activeVariantTab) || state.variants[0];
                const subjectValue = isAb ? (activeVariant.customSubject || '') : state.customSubject;
                const bodyValue = isAb ? (activeVariant.customBody || '') : state.customBody;

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
                                onCheckedChange={v => setField('abTestEnabled', v)}
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

                        {/* Template Picker Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
                            <div>
                                <p className="text-sm font-bold">Start from Template</p>
                                <p className="text-[9px] font-semibold text-muted-foreground">Load content from a saved template</p>
                            </div>
                            <Switch
                                checked={state.contentMode === 'template'}
                                onCheckedChange={v => setField('contentMode', v ? 'template' as ContentMode : 'plain_text' as ContentMode)}
                            />
                        </div>

                        {/* Template Picker (when template mode is on) */}
                        {state.contentMode === 'template' ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <Label className="text-[10px] font-semibold text-muted-foreground">Select a Template</Label>
                                    <div className="flex items-center gap-1">
                                        {((!isAb && state.templateId) || (isAb && activeVariant.templateId)) ? (
                                            <Button type="button" variant="ghost" className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg" onClick={() => setQuickCreateOpen(true)}>
                                                <Pencil className="h-3 w-3" /> Edit
                                            </Button>
                                        ) : null}
                                        <Button type="button" variant="ghost" className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg" onClick={() => { 
                                            if (isAb) {
                                                updateActiveVariant({ templateId: '' });
                                            } else {
                                                setField('templateId', '');
                                            }
                                            setQuickCreateOpen(true); 
                                        }}>
                                            <PlusCircle className="h-3 w-3" /> New
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
                                                    customBlocks: template.blocks || []
                                                });
                                            } else {
                                                setField('templateName', template.name);
                                                setField('customSubject', template.subject || '');
                                                setField('customBody', template.body || '');
                                            }
                                        }
                                    }}
                                    placeholder="Choose campaign blueprint..."
                                    className="rounded-xl bg-card border-border/50 font-bold transition-all text-xs"
                                />
                                
                                {(!isAb && state.templateId) || (isAb && activeVariant.templateId) ? (
                                    <Badge variant="outline" className="text-[9px] font-bold">
                                        Using: {isAb ? activeVariant.templateName : state.templateName}
                                    </Badge>
                                ) : null}
                            </div>
                        ) : null}

                        {/* Subject (email only) */}
                        {state.channel === 'email' ? (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Subject Line</Label>
                                <Input
                                    value={subjectValue}
                                    onChange={e => {
                                        if (isAb) {
                                            updateActiveVariant({ customSubject: e.target.value });
                                        } else {
                                            setField('customSubject', e.target.value);
                                        }
                                    }}
                                    placeholder="Enter email subject..."
                                    className="h-12 rounded-xl bg-card border-border/50 font-bold"
                                />
                            </div>
                        ) : null}

                        {/* Body */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                {state.channel === 'sms' ? 'Message Body' : 'Email Body'}
                            </Label>
                            <Textarea
                                value={bodyValue}
                                onChange={e => {
                                    if (isAb) {
                                        updateActiveVariant({ customBody: e.target.value });
                                    } else {
                                        setField('customBody', e.target.value);
                                    }
                                }}
                                placeholder={state.channel === 'sms' ? 'Type your SMS message...' : 'Type your email content...'}
                                className="min-h-[250px] rounded-xl bg-card border-border/50 font-semibold text-sm"
                            />
                            {state.channel === 'sms' ? (
                                <p className="text-[9px] font-bold text-muted-foreground text-right tabular-nums">
                                    {bodyValue.length} / {bodyValue.length <= 160 ? 160 : Math.ceil(bodyValue.length / 153) * 153} chars
                                    ({bodyValue.length <= 160 ? 1 : Math.ceil(bodyValue.length / 153)} segment{bodyValue.length > 160 ? 's' : ''})
                                </p>
                            ) : null}
                        </div>

                        {/* Variable reference */}
                        <div className="rounded-xl bg-muted/20 border border-border/30 p-3 space-y-2">
                            <p className="text-[9px] font-bold text-primary/70">Available Variables</p>
                            <div className="flex flex-wrap gap-1.5">
                                {['entity_name', 'entity_email', 'entity_phone', 'workspace_name', 'sender_name'].map(v => (
                                    <Badge key={v} variant="outline" className="text-[8px] font-mono cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => {
                                        const addition = `{{${v}}}`;
                                        if (isAb) {
                                            updateActiveVariant({ customBody: bodyValue + addition });
                                        } else {
                                            setField('customBody', state.customBody + addition);
                                        }
                                    }}>
                                        {`{{${v}}}`}
                                    </Badge>
                                ))}
                            </div>
                            <p className="text-[8px] font-semibold text-muted-foreground">Click to insert at end · Variables resolve per-recipient at send time</p>
                        </div>

                        {/* Phase 6 Story 6: AI Copy Assistant */}
                        <div className="rounded-2xl border bg-card overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setShowAiPanel(!showAiPanel)}
                                className="w-full p-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-violet-500" />
                                    <div className="text-left">
                                        <p className="text-xs font-bold">AI Copy Assistant</p>
                                        <p className="text-[9px] font-semibold text-muted-foreground">Generate or refine content with AI</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-[8px] font-bold bg-violet-50 text-violet-600 border-violet-200">
                                    Gemini
                                </Badge>
                            </button>

                            {showAiPanel ? (
                                <div className="p-4 pt-0 space-y-4 border-t">
                                    {/* Generate from scratch */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Context (optional)</Label>
                                        <Input
                                            value={aiPrompt}
                                            onChange={e => setAiPrompt(e.target.value)}
                                            placeholder="e.g., End-of-year thank you message for school principals..."
                                            className="h-9 rounded-xl bg-muted/20 border-border/30 text-xs font-semibold"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={isGenerating || !state.internalName.trim()}
                                            className="rounded-xl font-bold text-xs gap-1.5 w-full border-violet-200 text-violet-600 hover:bg-violet-50"
                                            onClick={async () => {
                                                setIsGenerating(true);
                                                try {
                                                    const res = await generateCampaignCopy({
                                                        channel: state.channel as 'email' | 'sms',
                                                        target: state.target,
                                                        campaignName: state.internalName,
                                                        context: aiPrompt || undefined,
                                                        organizationId: activeOrganizationId || undefined,
                                                    });
                                                    if (res.success && res.result) {
                                                        if (isAb) {
                                                            updateActiveVariant({
                                                                customSubject: res.result.subject,
                                                                customBody: res.result.body
                                                            });
                                                        } else {
                                                            setField('customSubject', res.result.subject);
                                                            setField('customBody', res.result.body);
                                                        }
                                                        setAiVariants(res.result.subjectVariants || []);
                                                        toast({ title: 'Content Generated', description: 'AI-generated copy applied. Edit as needed.' });
                                                    } else {
                                                        toast({ variant: 'destructive', title: 'AI Error', description: res.error || 'Generation failed' });
                                                    }
                                                } catch (e: any) {
                                                    toast({ variant: 'destructive', title: 'AI Error', description: e.message || 'Generation failed' });
                                                } finally {
                                                    setIsGenerating(false);
                                                }
                                            }}
                                        >
                                            {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                            {isGenerating ? 'Generating...' : 'Generate Copy'}
                                        </Button>
                                    </div>

                                    {/* Subject variants */}
                                    {aiVariants.length > 0 && state.channel === 'email' ? (
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Subject Line Variants</Label>
                                            <div className="space-y-1.5">
                                                {aiVariants.map((variant, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isAb) {
                                                                updateActiveVariant({ customSubject: variant });
                                                            } else {
                                                                setField('customSubject', variant);
                                                            }
                                                        }}
                                                        className={cn(
                                                            "w-full text-left p-2.5 rounded-lg border text-[10px] font-semibold transition-all",
                                                            (isAb ? activeVariant.customSubject === variant : state.customSubject === variant)
                                                                ? "border-violet-400 bg-violet-50 text-violet-700"
                                                                : "border-border/30 hover:border-violet-200 hover:bg-violet-50/50 text-foreground"
                                                        )}
                                                    >
                                                        <span className="text-[8px] font-bold text-muted-foreground mr-1.5">#{i + 1}</span>
                                                        {variant}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Refine existing copy */}
                                    {(state.customSubject || state.customBody) ? (
                                        <div className="space-y-2 pt-2 border-t border-border/30">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Refine Existing Copy</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={aiPrompt}
                                                    onChange={e => setAiPrompt(e.target.value)}
                                                    placeholder="e.g., Make it more formal, shorten the body..."
                                                    className="h-9 rounded-xl bg-muted/20 border-border/30 text-xs font-semibold flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isGenerating || !aiPrompt.trim()}
                                                    className="rounded-xl font-bold text-xs gap-1.5 border-amber-200 text-amber-600 hover:bg-amber-50 shrink-0"
                                                    onClick={async () => {
                                                        setIsGenerating(true);
                                                        try {
                                                            const res = await refineCampaignCopy({
                                                                 organizationId: activeOrganizationId || undefined,
                                                                original: isAb ? activeVariant.customBody : state.customBody,
                                                                instruction: aiPrompt,
                                                                field: 'body',
                                                            });
                                                            if (res.success && res.refined) {
                                                                if (isAb) {
                                                                    updateActiveVariant({ customBody: res.refined });
                                                                } else {
                                                                    setField('customBody', res.refined);
                                                                }
                                                                toast({ title: 'Copy Refined' });
                                                            } else {
                                                                toast({ variant: 'destructive', title: 'AI Error', description: res.error || 'Refinement failed' });
                                                            }
                                                        } catch (e: any) {
                                                            toast({ variant: 'destructive', title: 'AI Error', description: e.message || 'Refinement failed' });
                                                        } finally {
                                                            setIsGenerating(false);
                                                        }
                                                    }}
                                                >
                                                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                                                    Refine
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </div>
                );

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
                                {state.savedAudienceId && (state.filters.length > 0 || (state.groups && state.groups.length > 0)) ? (
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

                            {previewResult?.preview && previewResult.preview.length > 0 && (
                                <div className="pt-2 border-t border-border/50">
                                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-tight mb-2">Sample Recipients</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {previewResult.preview.slice(0, 3).map(p => (
                                            <Badge key={p.id} variant="outline" className="text-[9px] font-medium bg-card border-border/50 py-0 px-2 rounded-lg">
                                                {p.name}
                                            </Badge>
                                        ))}
                                        {previewResult.preview.length > 3 && (
                                            <span className="text-[9px] font-semibold text-muted-foreground">+{previewResult.preview.length - 3} more</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Contact scope */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Contact Scope</Label>
                            <ContactScopeSelector 
                                value={state.contactScope} 
                                onChange={v => setField('contactScope', v as any)} 
                            />
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

                                                        {state.abTestEnabled && (
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
                                                                        <div className="space-y-2">
                                                                            <div className="flex justify-between items-center">
                                                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                                                    Test Group Size: {state.abTestConfig.testSizePercentage}%
                                                                                </Label>
                                                                                <span className="text-[9px] font-bold text-violet-600">
                                                                                    ({state.abTestConfig.testSizePercentage / 2}% A, {state.abTestConfig.testSizePercentage / 2}% B, {100 - state.abTestConfig.testSizePercentage}% Remainder)
                                                                                </span>
                                                                            </div>
                                                                            <Input
                                                                                type="range"
                                                                                min={2}
                                                                                max={100}
                                                                                step={2}
                                                                                value={state.abTestConfig.testSizePercentage}
                                                                                onChange={e => {
                                                                                    const val = parseInt(e.target.value) || 20;
                                                                                    setField('abTestConfig', {
                                                                                        ...state.abTestConfig,
                                                                                        testSizePercentage: val
                                                                                    });
                                                                                }}
                                                                                className="h-2 bg-violet-200 rounded-lg appearance-none cursor-pointer"
                                                                            />
                                                                        </div>

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
                                                        )}

                        <Separator className="opacity-50" />

                        <div className="space-y-4">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-2">
                                <Zap className="h-3 w-3" /> Post-Send Automation Rules
                            </Label>
                            
                            <div className="space-y-3">
                                {state.postSendTagRules.map((rule, idx) => (
                                    <div key={idx} className="p-4 rounded-xl border bg-card/50 flex items-center gap-3">
                                        <div className="flex-1 space-y-1">
                                            <p className="text-[10px] font-bold text-primary">WHEN {rule.appliesTo?.replace('_', ' ').toUpperCase()}</p>
                                            <div className="flex flex-wrap gap-1">
                                                <Badge variant="secondary" className="text-[8px] font-bold">
                                                    {rule.tagName || rule.tagId}
                                                </Badge>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => {
                                            const next = [...state.postSendTagRules];
                                            next.splice(idx, 1);
                                            setField('postSendTagRules', next);
                                        }}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-10 rounded-xl border-dashed border-2 hover:border-primary/50 text-xs font-bold gap-2"
                                    onClick={() => {
                                        setField('postSendTagRules', [
                                            ...state.postSendTagRules,
                                            { appliesTo: 'delivered', tagId: 'new', tagName: 'New Tag' }
                                        ]);
                                    }}
                                >
                                    <Plus className="h-3 w-3" /> Add Behavior Rule
                                </Button>
                            </div>
                        </div>
                    </div>
                );

            case 5:
                const senderProfile = senderProfiles?.find(p => p.id === state.senderProfileId);
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
                                        <p className="text-[10px] font-semibold">{senderProfile?.name || 'Not selected'}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl border-none shadow-sm bg-muted/20">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Audience</CardDescription>
                                    <CardTitle className="text-sm font-bold">{state.audienceMode.replace('_', ' ').toUpperCase()}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Scope</p>
                                        <p className="text-[10px] font-semibold capitalize">{state.contactScope}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Targeting</p>
                                        <p className="text-[10px] font-semibold">
                                            {state.audienceMode === 'all' ? 'All Entities' :
                                             state.audienceMode === 'advanced' ? `${state.filters.length} rules` :
                                             state.audienceMode === 'saved' ? state.savedAudienceId :
                                             `${state.tagIds.length} tags`}
                                        </p>
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
                                                <div className="p-3 bg-violet-500/5 border-b border-violet-500/10 flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-violet-700">Variant {varId}</span>
                                                    {variant.templateName && (
                                                        <Badge variant="secondary" className="text-[8px] font-bold bg-violet-100 text-violet-800">
                                                            {variant.templateName}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {state.channel === 'email' ? (
                                                    <div className="p-3.5 border-b bg-muted/10">
                                                        <p className="text-[9px] font-bold text-muted-foreground mb-0.5">Subject</p>
                                                        <p className="text-xs font-bold text-foreground truncate">{variant.customSubject || '(No subject)'}</p>
                                                    </div>
                                                ) : null}
                                                <div className="p-5 flex-1 max-h-[250px] overflow-y-auto bg-card">
                                                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans text-xs">
                                                        {variant.customBody || '(No content)'}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Content Preview</Label>
                                    {state.templateName && <Badge variant="secondary" className="text-[8px] font-bold">Template: {state.templateName}</Badge>}
                                </div>
                                <div className="rounded-2xl border bg-card overflow-hidden">
                                    {state.channel === 'email' ? (
                                        <div className="p-4 border-b bg-muted/10">
                                            <p className="text-[10px] font-bold text-muted-foreground mb-1">Subject</p>
                                            <p className="text-xs font-bold">{state.customSubject || '(No subject)'}</p>
                                        </div>
                                    ) : null}
                                    <div className="p-6 max-h-[300px] overflow-y-auto">
                                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans">
                                            {state.customBody || '(No content)'}
                                        </div>
                                    </div>
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

            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300 flex items-center justify-center p-4">
            <Card className="w-full max-w-3xl h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl border-none overflow-hidden animate-in zoom-in-95 duration-500">
                <CardHeader className="p-8 pb-0 shrink-0">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                                <Megaphone className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold tracking-tight">Campaign Wizard</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
                                    {campaign ? 'Update Blueprint' : 'Initialize Dispatch'}
                                </CardDescription>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-2xl h-10 w-10">
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                    <StepIndicator current={state.step} />
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
        </div>
    );
}
