'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { createCampaign, updateCampaign } from '@/lib/campaign-hooks';
import { dispatchCampaign } from '@/lib/campaign-dispatch';
import { useToast } from '@/hooks/use-toast';
import type { MessageCampaign, MessageChannel, TemplateTarget, ContentMode, AudienceDefinition, SenderProfile, AudienceFilter, PostSendTagRule } from '@/lib/types';
import { FilterBuilder } from '@/app/admin/messaging/audiences/components/filter-builder';
import { useAudiences } from '@/lib/audience-hooks';
import { legacyAudienceToFilters } from '@/lib/audience-hooks';
import { TagSelector } from '@/components/tags/TagSelector';
import { generateCampaignCopy, refineCampaignCopy } from '@/lib/campaign-ai';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import {
    ArrowLeft, ArrowRight, Check, ChevronRight, Loader2, Mail, Smartphone,
    Users, Save, Send, Tag, Target, FileText, Calendar, Eye, Megaphone, Zap, X, Plus,
    Sparkles, Wand2,
} from 'lucide-react';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

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
    contactScope: 'primary' | 'signatories' | 'all';
    senderProfileId: string;
    isScheduled: boolean;
    scheduledAt: Date | null;
    isSaving: boolean;
    isSending: boolean;
    // Phase 4 advanced filters
    filters: AudienceFilter[];
    filterLogic: 'AND' | 'OR';
    savedAudienceId: string;
    // Phase 6 post-send behavior
    postSendTagRules: PostSendTagRule[];
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
            savedAudienceId: campaign.audienceDefinition?.savedAudienceId || '',
            postSendTagRules: campaign.postSendTagRules || [],
        };
    }
    return {
        step: 1, internalName: '', channel: 'email', target: 'external_client',
        contentMode: 'rich_builder', templateId: '', templateName: '', customSubject: '',
        customBody: '', styleId: '', audienceMode: 'all', tagIds: [], tagLogic: 'any',
        excludeTagIds: [], entityIds: [], contactScope: 'primary', senderProfileId: '',
        isScheduled: false, scheduledAt: null, isSaving: false, isSending: false,
        filters: [], filterLogic: 'AND' as const, savedAudienceId: '',
        postSendTagRules: [],
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

    const [state, dispatch] = React.useReducer(wizardReducer, campaign, createInitialState);

    const setField = <K extends keyof WizardState>(field: K, value: WizardState[K]) => {
        dispatch({ type: 'SET_FIELD', field, value });
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

    // ── Templates (Story 6: template picker in Step 2) ────────────────────
    const templatesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_templates'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: templates } = useCollection<any>(templatesQuery);

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
            case 2: return state.customBody.trim().length > 0 || state.customSubject.trim().length > 0;
            case 3: return state.audienceMode === 'all' || state.tagIds.length > 0 || state.entityIds.length > 0 || (state.audienceMode === 'advanced' && state.filters.length > 0) || (state.audienceMode === 'saved' && !!state.savedAudienceId);
            case 4: return !state.isScheduled || (state.scheduledAt && state.scheduledAt > new Date());
            case 5: return true;
            default: return false;
        }
    }, [state.step, state.internalName, state.senderProfileId, state.customBody, state.customSubject, state.audienceMode, state.tagIds, state.entityIds, state.isScheduled, state.scheduledAt, state.filters, state.savedAudienceId]);

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
                                    {!(senderProfiles || []).some(p => p.channel === state.channel) && (
                                        <SelectItem value="_none" disabled className="text-xs text-muted-foreground">
                                            No {state.channel} profiles available
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6">
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

                        {/* Template Gallery (when template mode is on) */}
                        {state.contentMode === 'template' && (
                            <div className="space-y-3">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Select a Template</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-1">
                                    {(templates || [])
                                        .filter(t => t.channel === state.channel)
                                        .map(t => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => {
                                                    setField('templateId', t.id);
                                                    setField('templateName', t.name);
                                                    setField('customSubject', t.subject || '');
                                                    setField('customBody', t.body || '');
                                                }}
                                                className={cn(
                                                    "text-left p-3 rounded-xl border-2 transition-all hover:border-primary/30",
                                                    state.templateId === t.id ? "border-primary bg-primary/5" : "border-border/50"
                                                )}
                                            >
                                                <p className="text-xs font-bold truncate">{t.name}</p>
                                                <p className="text-[9px] font-semibold text-muted-foreground mt-0.5 capitalize">
                                                    {t.channel} · {t.category || 'General'}
                                                </p>
                                            </button>
                                        ))}
                                    {!(templates || []).some(t => t.channel === state.channel) && (
                                        <p className="text-xs text-muted-foreground col-span-2 text-center py-8">
                                            No {state.channel} templates available
                                        </p>
                                    )}
                                </div>
                                {state.templateId && (
                                    <Badge variant="outline" className="text-[9px] font-bold">
                                        Using: {state.templateName}
                                    </Badge>
                                )}
                            </div>
                        )}

                        {/* Subject (email only) */}
                        {state.channel === 'email' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Subject Line</Label>
                                <Input
                                    value={state.customSubject}
                                    onChange={e => setField('customSubject', e.target.value)}
                                    placeholder="Enter email subject..."
                                    className="h-12 rounded-xl bg-card border-border/50 font-bold"
                                />
                            </div>
                        )}

                        {/* Body */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                {state.channel === 'sms' ? 'Message Body' : 'Email Body'}
                            </Label>
                            <Textarea
                                value={state.customBody}
                                onChange={e => setField('customBody', e.target.value)}
                                placeholder={state.channel === 'sms' ? 'Type your SMS message...' : 'Type your email content...'}
                                className="min-h-[250px] rounded-xl bg-card border-border/50 font-semibold text-sm"
                            />
                            {state.channel === 'sms' && (
                                <p className="text-[9px] font-bold text-muted-foreground text-right tabular-nums">
                                    {state.customBody.length} / {state.customBody.length <= 160 ? 160 : Math.ceil(state.customBody.length / 153) * 153} chars
                                    ({state.customBody.length <= 160 ? 1 : Math.ceil(state.customBody.length / 153)} segment{state.customBody.length > 160 ? 's' : ''})
                                </p>
                            )}
                        </div>

                        {/* Variable reference */}
                        <div className="rounded-xl bg-muted/20 border border-border/30 p-3 space-y-2">
                            <p className="text-[9px] font-bold text-primary/70">Available Variables</p>
                            <div className="flex flex-wrap gap-1.5">
                                {['entity_name', 'entity_email', 'entity_phone', 'workspace_name', 'sender_name'].map(v => (
                                    <Badge key={v} variant="outline" className="text-[8px] font-mono cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => {
                                        setField('customBody', state.customBody + `{{${v}}}`);
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

                            {showAiPanel && (
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
                                                    });
                                                    if (res.success && res.result) {
                                                        setField('customSubject', res.result.subject);
                                                        setField('customBody', res.result.body);
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
                                    {aiVariants.length > 0 && state.channel === 'email' && (
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Subject Line Variants</Label>
                                            <div className="space-y-1.5">
                                                {aiVariants.map((variant, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => setField('customSubject', variant)}
                                                        className={cn(
                                                            "w-full text-left p-2.5 rounded-lg border text-[10px] font-semibold transition-all",
                                                            state.customSubject === variant
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
                                    )}

                                    {/* Refine existing copy */}
                                    {(state.customSubject || state.customBody) && (
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
                                                                original: state.customBody,
                                                                instruction: aiPrompt,
                                                                field: 'body',
                                                            });
                                                            if (res.success && res.refined) {
                                                                setField('customBody', res.refined);
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
                                    )}
                                </div>
                            )}
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
                        {state.audienceMode === 'all' && (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                                <Users className="h-5 w-5 text-emerald-600 shrink-0" />
                                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">All entities in your workspace will receive this campaign.</p>
                            </div>
                        )}

                        {/* Advanced filter mode */}
                        {state.audienceMode === 'advanced' && (
                            <FilterBuilder
                                filters={state.filters}
                                filterLogic={state.filterLogic}
                                onChange={(f, l) => { setField('filters', f); setField('filterLogic', l); }}
                            />
                        )}

                        {/* Saved audience mode */}
                        {state.audienceMode === 'saved' && (
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
                                            {savedAudiences.length === 0 && (
                                                <SelectItem value="_none" disabled className="text-xs text-muted-foreground">No saved audiences</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {state.savedAudienceId && state.filters.length > 0 && (
                                    <FilterBuilder
                                        filters={state.filters}
                                        filterLogic={state.filterLogic}
                                        onChange={(f, l) => { setField('filters', f); setField('filterLogic', l); }}
                                    />
                                )}
                            </div>
                        )}

                        {/* Contact scope */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Contact Scope</Label>
                            <Select value={state.contactScope} onValueChange={v => setField('contactScope', v as any)}>
                                <SelectTrigger className="h-10 rounded-xl font-bold text-xs bg-card border-border/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="primary" className="text-xs font-semibold">Primary Contact</SelectItem>
                                    <SelectItem value="signatories" className="text-xs font-semibold">Signatories Only</SelectItem>
                                    <SelectItem value="all" className="text-xs font-semibold">All Contacts</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-6">
                        {/* Schedule toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
                            <div>
                                <p className="text-sm font-bold">Schedule for later?</p>
                                <p className="text-[9px] font-semibold text-muted-foreground">Or send immediately when you confirm</p>
                            </div>
                            <Switch checked={state.isScheduled} onCheckedChange={v => setField('isScheduled', v)} />
                        </div>
                        {state.isScheduled && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Send Date & Time</Label>
                                <DateTimePicker
                                    value={state.scheduledAt || undefined}
                                    onChange={(d: any) => setField('scheduledAt', d)}
                                />
                            </div>
                        )}

                        {/* ── Phase 6: Post-Send Behavior ─────────────────────── */}
                        <div className="rounded-2xl border bg-card overflow-hidden">
                            <div className="p-4 border-b bg-muted/10 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-amber-500" />
                                <div>
                                    <p className="text-xs font-bold">Post-Send Behavior</p>
                                    <p className="text-[9px] font-semibold text-muted-foreground">Automatically tag entities based on delivery outcome</p>
                                </div>
                            </div>
                            <div className="p-4 space-y-3">
                                {/* Existing rules */}
                                {state.postSendTagRules.map((rule, idx) => (
                                    <div key={`${rule.tagId}-${idx}`} className="flex items-center gap-2 p-3 rounded-xl border bg-muted/5">
                                        <Tag className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold truncate">{rule.tagName}</p>
                                            <p className="text-[8px] font-semibold text-muted-foreground">
                                                Apply to: <span className="text-primary">{rule.appliesTo.replace('_', ' ')}</span>
                                            </p>
                                        </div>
                                        <Select
                                            value={rule.appliesTo}
                                            onValueChange={(v) => {
                                                const updated = [...state.postSendTagRules];
                                                updated[idx] = { ...updated[idx], appliesTo: v as PostSendTagRule['appliesTo'] };
                                                setField('postSendTagRules', updated);
                                            }}
                                        >
                                            <SelectTrigger className="h-7 w-32 rounded-lg text-[9px] font-bold">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="all_targeted" className="text-[10px] font-semibold">All targeted</SelectItem>
                                                <SelectItem value="delivered" className="text-[10px] font-semibold">Delivered</SelectItem>
                                                <SelectItem value="failed" className="text-[10px] font-semibold">Failed</SelectItem>
                                                <SelectItem value="not_delivered" className="text-[10px] font-semibold">Not delivered</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                            onClick={() => {
                                                const updated = state.postSendTagRules.filter((_, i) => i !== idx);
                                                setField('postSendTagRules', updated);
                                            }}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}

                                {/* Add new rule */}
                                {allTags && allTags.length > 0 ? (
                                    <Select
                                        value=""
                                        onValueChange={(tagId) => {
                                            const tag = allTags.find((t: any) => t.id === tagId);
                                            if (!tag) return;
                                            // Don't add duplicate
                                            if (state.postSendTagRules.some(r => r.tagId === tagId)) return;
                                            const newRule: PostSendTagRule = {
                                                tagId,
                                                tagName: tag.name,
                                                appliesTo: 'delivered',
                                            };
                                            setField('postSendTagRules', [...state.postSendTagRules, newRule]);
                                        }}
                                    >
                                        <SelectTrigger className="h-9 rounded-xl text-[10px] font-bold border-dashed">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Plus className="h-3 w-3" />
                                                Add post-send tag rule
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl max-h-48">
                                            {allTags.filter((t: any) => !state.postSendTagRules.some(r => r.tagId === t.id)).map((tag: any) => (
                                                <SelectItem key={tag.id} value={tag.id} className="text-[10px] font-semibold">
                                                    {tag.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="text-[9px] text-muted-foreground italic text-center py-2">
                                        No workspace tags available. Create tags in Entity Management first.
                                    </p>
                                )}

                                {state.postSendTagRules.length === 0 && (
                                    <p className="text-[9px] text-muted-foreground text-center py-1">
                                        No tag rules configured. Tags will not be applied after sending.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 5:
                return (
                    <div className="space-y-6">
                        <div className="rounded-2xl border bg-card overflow-hidden">
                            <div className="p-5 border-b bg-muted/20">
                                <p className="text-sm font-bold">Campaign Summary</p>
                            </div>
                            <div className="p-5 space-y-3">
                                {[
                                    { label: 'Name', value: state.internalName },
                                    { label: 'Channel', value: state.channel.toUpperCase() },
                                    { label: 'Target', value: state.target === 'internal_team' ? 'Team / Staff' : 'External Client' },
                                    { label: 'Subject', value: state.customSubject || '—' },
                                    { label: 'Audience', value: state.audienceMode === 'all' ? 'All workspace entities' : state.audienceMode === 'tags' ? `${state.tagIds.length} tag(s)` : `${state.entityIds.length} selected` },
                                    { label: 'Schedule', value: state.isScheduled && state.scheduledAt ? state.scheduledAt.toLocaleString() : 'Immediately' },
                                ].map(row => (
                                    <div key={row.label} className="flex items-center justify-between py-1.5">
                                        <span className="text-[10px] font-bold text-muted-foreground">{row.label}</span>
                                        <span className="text-xs font-semibold text-right max-w-[60%] truncate">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {state.customBody && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Content Preview</Label>
                                <div className="rounded-xl border bg-card p-4 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto font-mono text-xs">
                                    {state.customBody}
                                </div>
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
            {/* Back button */}
            <Button variant="ghost" size="sm" onClick={handleClose} className="gap-2 text-xs font-bold rounded-xl">
                <ArrowLeft className="h-4 w-4" /> Back to Campaigns
            </Button>

            {/* Step indicator */}
            <StepIndicator current={state.step} />

            {/* Step content */}
            <Card className="rounded-2xl border-border/50 shadow-lg overflow-hidden">
                <CardHeader className="bg-muted/20 border-b p-6">
                    <CardTitle className="text-lg font-semibold">{STEPS[state.step - 1]?.label}</CardTitle>
                    <CardDescription className="text-[10px] font-bold text-muted-foreground">
                        Step {state.step} of 5
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    {renderStep()}
                </CardContent>
                <CardFooter className="p-6 border-t bg-muted/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {state.step > 1 && (
                            <Button variant="outline" onClick={() => dispatch({ type: 'PREV_STEP' })} className="rounded-xl h-10 font-bold text-xs gap-1">
                                <ArrowLeft className="h-3.5 w-3.5" /> Previous
                            </Button>
                        )}
                        <Button variant="ghost" onClick={handleSaveDraft} disabled={state.isSaving || !state.internalName.trim()} className="rounded-xl h-10 font-bold text-xs gap-1">
                            {state.isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Save Draft
                        </Button>
                    </div>
                    {state.step < 5 ? (
                        <Button onClick={() => dispatch({ type: 'NEXT_STEP' })} disabled={!canAdvance} className="rounded-xl h-10 font-bold text-xs gap-1 px-6 shadow-lg">
                            Next <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    ) : (
                        <Button onClick={handleDispatch} disabled={state.isSending} className="rounded-xl h-10 font-bold text-xs gap-1 px-6 shadow-lg bg-emerald-600 hover:bg-emerald-700">
                            {state.isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state.isScheduled ? <Calendar className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                            {state.isSending ? 'Dispatching...' : state.isScheduled ? 'Schedule Campaign' : 'Send Campaign'}
                        </Button>
                    )}
                </CardFooter>
            </Card>

            {/* Exit confirmation */}
            <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-semibold">
                            You have unsaved changes. Would you like to save as a draft before leaving?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold text-xs">Keep Editing</AlertDialogCancel>
                        <Button variant="outline" onClick={() => { setShowExitDialog(false); onClose(); }} className="rounded-xl font-bold text-xs">Discard</Button>
                        <AlertDialogAction onClick={async () => { await handleSaveDraft(); setShowExitDialog(false); onClose(); }} className="rounded-xl font-bold text-xs">Save & Exit</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
