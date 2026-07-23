'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { 
    collection, doc, getDocs, query, where, setDoc 
} from 'firebase/firestore';
import { 
    Loader2, Share2, Copy, Check, Globe, Code, 
    Sparkles, RefreshCw, Layers, Save, Film 
} from 'lucide-react';
import { SlashInput, SlashTextarea } from '@/components/messaging/SlashInput';
import { getVariablesAction } from '@/lib/services/fields-variables-service';
import type { MediaAsset } from '@/lib/types';
import type { TemplateVariable } from '@/lib/types';
import { cn } from '@/lib/utils';
import { checkSlugAvailabilityAction } from '@/lib/media-analytics-actions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OutcomeAutomationsEditor } from '@/app/admin/messaging/call-centre/scripts/components/OutcomeAutomationsEditor';
import { useWorkspaceScopedQueries } from '@/app/admin/automations/hooks/useWorkspaceScopedQueries';
import type { ActionConfigDataSources } from '@/app/admin/messaging/call-centre/scripts/components/ActionConfigFields';
import type { CallOutcomeAutomation } from '@/lib/types';

interface ShareMediaDialogProps {
    asset: MediaAsset;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ShareConfig {
    id: string;
    assetId: string;
    workspaceId: string;
    title: string;
    description: string;
    ctaText: string;
    ctaType: 'none' | 'survey' | 'form' | 'page' | 'external';
    ctaTargetId: string;
    ctaTargetUrl: string;
    ctaMode?: 'modal' | 'redirect' | 'replace';
    ctaPretext?: string;
    ctaPopoverEnabled?: boolean;
    ctaActivationGate?: 'immediate' | 'quarter' | 'half' | 'threequarters' | 'complete';
    slug?: string;
    createdAt?: string;
    updatedAt?: string;
    automationRules?: Record<string, CallOutcomeAutomation[]>;
}

interface SurveyDoc {
    id: string;
    internalName?: string;
    name?: string;
    slug?: string;
}

interface PdfDoc {
    id: string;
    name?: string;
}

interface PageDoc {
    id: string;
    name?: string;
    slug?: string;
}

export default function ShareMediaDialog({ asset, open, onOpenChange }: ShareMediaDialogProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace();

    const [shareId, setShareId] = React.useState<string>('');
    const [title, setTitle] = React.useState<string>(asset.name);
    const [description, setDescription] = React.useState<string>('');
    const [ctaText, setCtaText] = React.useState<string>('');
    const [ctaType, setCtaType] = React.useState<'none' | 'survey' | 'form' | 'page' | 'external'>('none');
    const [ctaTargetId, setCtaTargetId] = React.useState<string>('');
    const [ctaTargetUrl, setCtaTargetUrl] = React.useState<string>('');
    const [ctaMode, setCtaMode] = React.useState<'modal' | 'redirect' | 'replace'>('redirect');
    const [ctaPretext, setCtaPretext] = React.useState<string>('');
    const [ctaPopoverEnabled, setCtaPopoverEnabled] = React.useState<boolean>(false);
    const [ctaActivationGate, setCtaActivationGate] = React.useState<'immediate' | 'quarter' | 'half' | 'threequarters' | 'complete'>('immediate');
    const [slug, setSlug] = React.useState<string>('');
    const [isSlugChecking, setIsSlugChecking] = React.useState<boolean>(false);
    const [slugStatus, setSlugStatus] = React.useState<'idle' | 'available' | 'conflict' | 'too-short'>('idle');
    
    const [isSaving, setIsSaving] = React.useState<boolean>(false);
    const [isLoading, setIsLoading] = React.useState<boolean>(false);
    const [isSaved, setIsSaved] = React.useState<boolean>(false);
    
    const scopedData = useWorkspaceScopedQueries();
    
    // Event-based automations
    const [automationRules, setAutomationRules] = React.useState<Record<string, CallOutcomeAutomation[]>>({});
    const [activeTrigger, setActiveTrigger] = React.useState<string>('on_view');

    const actionData = React.useMemo<ActionConfigDataSources>(() => ({
        tags: (scopedData.allTags || []).map(t => ({ id: t.id, name: t.name })),
        stages: (scopedData.stages || []).map(s => ({ id: s.id, name: s.name, pipelineId: s.pipelineId })),
        pipelines: (scopedData.pipelines || []).map(p => ({ id: p.id, name: p.name })),
        meetings: (scopedData.meetingTypes || []).map(m => ({ id: m.id, title: m.name })),
        activeMeetings: [],
        callCampaigns: (scopedData.callCampaigns || []).map(c => ({ id: c.id, name: c.name })),
        workspaceUsers: (scopedData.users || []).map(u => ({ id: u.id, name: u.name || '', email: u.email || '' })),
    }), [scopedData]);

    const handleRulesChange = React.useCallback((nextRules: CallOutcomeAutomation[]) => {
        setAutomationRules(prev => ({
            ...prev,
            [activeTrigger]: nextRules
        }));
    }, [activeTrigger]);
    
    // Lists of options
    const [surveys, setSurveys] = React.useState<SurveyDoc[]>([]);
    const [pdfs, setPdfs] = React.useState<PdfDoc[]>([]);
    const [pages, setPages] = React.useState<PageDoc[]>([]);
    const [variables, setVariables] = React.useState<TemplateVariable[]>([]);

    // Copied flags
    const [copiedDirect, setCopiedDirect] = React.useState<boolean>(false);
    const [copiedPublic, setCopiedPublic] = React.useState<boolean>(false);
    const [copiedIframe, setCopiedIframe] = React.useState<boolean>(false);

    // Active tab in link output
    const [activeLinkTab, setActiveLinkTab] = React.useState<'links' | 'embed'>('links');

    // Fetch existing configuration
    const loadConfig = React.useCallback(async () => {
        if (!firestore || !activeWorkspaceId || !asset.id) return;
        setIsLoading(true);
        try {
            const q = query(
                collection(firestore, 'media_shares'),
                where('assetId', '==', asset.id),
                where('workspaceId', '==', activeWorkspaceId)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                const configDoc = snap.docs[0];
                const data = configDoc.data() as ShareConfig;
                setShareId(configDoc.id);
                setTitle(data.title || asset.name);
                setDescription(data.description || '');
                setCtaText(data.ctaText || '');
                setCtaType(data.ctaType || 'none');
                setCtaTargetId(data.ctaTargetId || '');
                setCtaTargetUrl(data.ctaTargetUrl || '');
                setCtaMode(data.ctaMode || 'redirect');
                setCtaPretext(data.ctaPretext || '');
                setCtaPopoverEnabled(data.ctaPopoverEnabled || false);
                setCtaActivationGate(data.ctaActivationGate || 'immediate');
                setSlug(data.slug || '');
                setAutomationRules(data.automationRules || {});
                setIsSaved(true);
            } else {
                // Generate a fresh random doc ID
                const freshId = doc(collection(firestore, 'media_shares')).id;
                setShareId(freshId);
                setTitle(asset.name);
                
                let defaultDesc = '';
                if (asset.type === 'video') {
                    defaultDesc = "Click to watch this video. It's Super Important";
                } else if (asset.type === 'audio') {
                    defaultDesc = "Click to listen to this audio, It's Super Important";
                } else if (asset.type === 'document') {
                    defaultDesc = "Kindly find document below for your perusal";
                }
                
                setDescription(defaultDesc);
                setCtaText('');
                setCtaType('none');
                setCtaTargetId('');
                setCtaTargetUrl('');
                setCtaMode('redirect');
                setCtaPretext('');
                setCtaPopoverEnabled(false);
                setCtaActivationGate('immediate');
                setSlug('');
                setAutomationRules({});
                setIsSaved(false);
            }
        } catch (err: unknown) {
            console.error('[ShareMediaDialog] Failed to load share config:', err);
        } finally {
            setIsLoading(false);
        }
    }, [firestore, activeWorkspaceId, asset.id, asset.name, asset.type]);

    React.useEffect(() => {
        if (!slug.trim()) {
            setSlugStatus('idle');
            return;
        }
        if (slug.trim().length < 3) {
            setSlugStatus('too-short');
            return;
        }
        setIsSlugChecking(true);
        const delay = setTimeout(async () => {
            try {
                const available = await checkSlugAvailabilityAction(slug, shareId);
                setSlugStatus(available ? 'available' : 'conflict');
            } catch {
                setSlugStatus('conflict');
            } finally {
                setIsSlugChecking(false);
            }
        }, 500);

        return () => clearTimeout(delay);
    }, [slug, shareId]);

    // Fetch surveys, forms, pages, variables
    const loadResources = React.useCallback(async () => {
        if (!firestore || !activeWorkspaceId) return;
        try {
            // 1. Fetch variables
            const unifiedVars = await getVariablesAction({ workspaceId: activeWorkspaceId, featureContext: 'all' });
            const mapped = unifiedVars.map((v) => ({
                id: v.key,
                name: v.key,
                label: v.label,
                context: v.category,
                description: v.description || '',
                dataType: (v.dataType === 'boolean' ? 'string' : v.dataType) as 'string' | 'number' | 'html' | 'date' | 'url',
                exampleValue: v.exampleValue || '',
                isDynamic: v.source !== 'static',
                isComputed: false,
            }));
            setVariables(mapped);

            // 2. Fetch surveys
            const surveySnap = await getDocs(
                query(collection(firestore, 'surveys'), where('workspaceIds', 'array-contains', activeWorkspaceId))
            );
            const fetchedSurveys = surveySnap.docs.map((d) => {
                const data = d.data();
                return {
                    id: d.id,
                    internalName: (data.internalName as string) || (data.name as string) || '',
                    name: (data.name as string) || '',
                    slug: (data.slug as string) || '',
                };
            });
            setSurveys(fetchedSurveys);

            // 3. Fetch PDFs
            const pdfSnap = await getDocs(
                query(collection(firestore, 'pdfs'), where('workspaceIds', 'array-contains', activeWorkspaceId))
            );
            const fetchedPdfs = pdfSnap.docs.map((d) => ({
                id: d.id,
                name: (d.data().name as string) || '',
            }));
            setPdfs(fetchedPdfs);

            // 4. Fetch Pages
            const pageSnap = await getDocs(
                query(collection(firestore, 'campaign_pages'), where('workspaceIds', 'array-contains', activeWorkspaceId))
            );
            const fetchedPages = pageSnap.docs.map((d) => {
                const data = d.data();
                return {
                    id: d.id,
                    name: (data.name as string) || '',
                    slug: (data.slug as string) || '',
                };
            });
            setPages(fetchedPages);
        } catch (err: unknown) {
            console.error('[ShareMediaDialog] Failed to load resources:', err);
        }
    }, [firestore, activeWorkspaceId]);

    React.useEffect(() => {
        if (open) {
            loadConfig();
            loadResources();
        }
    }, [open, loadConfig, loadResources]);

    // Handle target url resolution
    React.useEffect(() => {
        if (ctaType === 'survey') {
            const match = surveys.find((s) => s.id === ctaTargetId);
            if (match) setCtaTargetUrl(`/surveys/${match.slug || match.id}`);
        } else if (ctaType === 'form') {
            if (ctaTargetId) setCtaTargetUrl(`/forms/${ctaTargetId}`);
        } else if (ctaType === 'page') {
            const match = pages.find((p) => p.id === ctaTargetId);
            if (match) setCtaTargetUrl(`/p/${match.slug || match.id}`);
        } else if (ctaType === 'external') {
            setCtaTargetUrl(ctaTargetId);
        } else {
            setCtaTargetUrl('');
        }
    }, [ctaType, ctaTargetId, surveys, pages]);

    // Handle Save / Submit
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !activeWorkspaceId || !shareId) return;

        setIsSaving(true);
        try {
            const sanitizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');

            if (sanitizedSlug) {
                // 1. Conflict Check: check if another document in media_shares has this ID as its document ID
                const directSnap = await getDocs(
                    query(
                        collection(firestore, 'media_shares'),
                        where('__name__', '==', sanitizedSlug)
                    )
                );
                if (!directSnap.empty && directSnap.docs[0].id !== shareId) {
                    toast({
                        variant: 'destructive',
                        title: 'Conflict Detected',
                        description: 'This URL slug conflicts with an existing shared link ID.',
                    });
                    setIsSaving(false);
                    return;
                }

                // 2. Conflict Check: check if another document has this slug field
                const slugSnap = await getDocs(
                    query(
                        collection(firestore, 'media_shares'),
                        where('slug', '==', sanitizedSlug)
                    )
                );
                const conflictDoc = slugSnap.docs.find((d) => d.id !== shareId);
                if (conflictDoc) {
                    toast({
                        variant: 'destructive',
                        title: 'Conflict Detected',
                        description: 'This URL slug is already in use by another media share page.',
                    });
                    setIsSaving(false);
                    return;
                }
            }

            const shareConfig: ShareConfig = {
                id: shareId,
                assetId: asset.id,
                workspaceId: activeWorkspaceId,
                title: title.trim() || asset.name,
                description: description.trim(),
                ctaText: ctaText.trim(),
                ctaType,
                ctaTargetId,
                ctaTargetUrl,
                ctaMode,
                ctaPretext: ctaPretext.trim(),
                ctaPopoverEnabled,
                ctaActivationGate,
                slug: sanitizedSlug,
                automationRules,
                updatedAt: new Date().toISOString(),
            };

            // If it's a new doc, add createdAt
            if (!isSaved) {
                shareConfig.createdAt = new Date().toISOString();
            }

            await setDoc(doc(firestore, 'media_shares', shareId), shareConfig);
            setIsSaved(true);
            toast({ title: 'Sharing Options Saved', description: 'Your links and embed codes have been updated.' });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown database error';
            toast({ variant: 'destructive', title: 'Saving Failed', description: msg });
        } finally {
            setIsSaving(false);
        }
    };

    // Public links
    const publicUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/m/${slug.trim() || shareId}` 
        : `/m/${slug.trim() || shareId}`;

    const iframeCode = `<iframe src="${publicUrl}?embed=true" width="100%" height="500px" frameborder="0" allowfullscreen></iframe>`;

    const copyText = (text: string, type: 'direct' | 'public' | 'iframe') => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Copied to Clipboard', description: 'Copied successfully!' });
        if (type === 'direct') {
            setCopiedDirect(true);
            setTimeout(() => setCopiedDirect(false), 2000);
        } else if (type === 'public') {
            setCopiedPublic(true);
            setTimeout(() => setCopiedPublic(false), 2000);
        } else if (type === 'iframe') {
            setCopiedIframe(true);
            setTimeout(() => setCopiedIframe(false), 2000);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-screen h-[100dvh] max-w-none p-0 m-0 border-none rounded-none flex flex-col shadow-2xl overflow-hidden bg-background">
                <DialogHeader className="p-6 md:p-8 bg-muted/30 border-b shrink-0 text-left">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm">
                            <Share2 className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary mb-0.5">
                                <Sparkles className="h-3 w-3" aria-hidden="true" />
                                <span>Asset: {asset.name}</span>
                            </div>
                            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">Share Media Asset</DialogTitle>
                            <DialogDescription className="text-xs font-bold text-muted-foreground opacity-90">
                                Configure public links, personalized context mapping, and iframe embed targets.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {isLoading ? (
                    <div className="h-96 flex items-center justify-center bg-background">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col bg-background text-left overflow-hidden">
                        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/40 overflow-y-auto md:overflow-hidden">
                            {/* Configuration Side */}
                            <div className="p-6 md:p-8 md:overflow-y-auto md:h-full text-left">
                                <Tabs defaultValue="general" className="w-full flex flex-col h-full">
                                    <TabsList className="grid grid-cols-2 bg-muted/40 p-1 rounded-xl mb-6 shrink-0">
                                        <TabsTrigger value="general" className="rounded-lg text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm active:scale-[0.97]">General Settings</TabsTrigger>
                                        <TabsTrigger value="automations" className="rounded-lg text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm active:scale-[0.97]">CRM Automations</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="general" className="space-y-6 outline-none mt-0">
                                        <div className="space-y-4">
                                            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-xs font-semibold text-muted-foreground flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                                                    <Film className="h-3.5 w-3.5" /> Media Asset Reference
                                                </span>
                                                <span className="font-extrabold text-foreground truncate max-w-[280px]">{asset.name}</span>
                                            </div>

                                            <h3 className="text-xs font-black uppercase text-foreground tracking-wider flex items-center gap-2 pt-2">
                                                <Sparkles className="h-3.5 w-3.5 text-primary" /> Personalized Content
                                            </h3>

                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Custom Title</Label>
                                                <SlashInput 
                                                    value={title}
                                                    onChange={setTitle}
                                                    variables={variables}
                                                    placeholder="Enter shared media title..."
                                                    className="h-11 rounded-xl font-semibold text-sm bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Custom Description</Label>
                                                <SlashTextarea 
                                                    value={description}
                                                    onChange={setDescription}
                                                    variables={variables}
                                                    placeholder="Add descriptive content supporting variables..."
                                                    className="min-h-[100px] rounded-xl font-semibold text-sm bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center ml-1">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground">Custom URL Slug (Optional)</Label>
                                                    {isSlugChecking && (
                                                        <span className="text-[9px] font-bold text-primary flex items-center gap-1">
                                                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Verifying...
                                                        </span>
                                                    )}
                                                    {!isSlugChecking && slugStatus === 'available' && (
                                                        <span className="text-[9px] font-bold text-emerald-500">
                                                            ✓ Slug available
                                                        </span>
                                                    )}
                                                    {!isSlugChecking && slugStatus === 'conflict' && (
                                                        <span className="text-[9px] font-bold text-destructive">
                                                            ✗ Slug already in use
                                                        </span>
                                                    )}
                                                    {!isSlugChecking && slugStatus === 'too-short' && (
                                                        <span className="text-[9px] font-bold text-amber-500">
                                                            ⚠ Too short (min 3 chars)
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <span className="text-xs font-bold text-muted-foreground bg-muted/40 px-3 h-11 flex items-center rounded-xl border border-border">/m/</span>
                                                    <Input 
                                                        value={slug}
                                                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                                                        placeholder="custom-link-name"
                                                        className={cn(
                                                            "h-11 rounded-xl font-semibold text-sm bg-muted/20 border-none shadow-none focus:ring-1 w-full",
                                                            slugStatus === 'available' && "focus:ring-emerald-500/20 focus:border-emerald-500 border border-emerald-500/20 bg-emerald-500/5",
                                                            slugStatus === 'conflict' && "focus:ring-destructive/20 focus:border-destructive border border-destructive/20 bg-destructive/5",
                                                            slugStatus === 'too-short' && "focus:ring-amber-500/20 focus:border-amber-500 border border-amber-500/20 bg-amber-500/5"
                                                        )}
                                                    />
                                                </div>
                                                <p className="text-[9px] font-medium text-slate-500 ml-1 font-sans">Customize the back half of the viewing URL. Only lowercase alphanumeric, hyphens, and underscores are allowed.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-4 border-t border-dashed border-border/60">
                                            <h3 className="text-xs font-black uppercase text-foreground tracking-wider flex items-center gap-2">
                                                <Layers className="h-3.5 w-3.5 text-primary" /> Call-To-Action Button
                                            </h3>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5 text-left">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Action Type</Label>
                                                    <select
                                                        value={ctaType}
                                                        onChange={(e) => {
                                                            setCtaType(e.target.value as 'none' | 'survey' | 'form' | 'page' | 'external');
                                                            setCtaTargetId('');
                                                        }}
                                                        className="w-full h-11 px-3 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                    >
                                                        <option value="none">None</option>
                                                        <option value="survey">Survey</option>
                                                        <option value="form">Form (PDF)</option>
                                                        <option value="page">Landing Page</option>
                                                        <option value="external">External Link</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Button Text</Label>
                                                    <Input
                                                        value={ctaText}
                                                        onChange={(e) => setCtaText(e.target.value)}
                                                        placeholder="e.g. Get Started"
                                                        disabled={ctaType === 'none'}
                                                        className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-semibold text-xs px-3"
                                                    />
                                                </div>
                                            </div>

                                            {ctaType !== 'none' && (
                                                <>
                                                    <div className="space-y-1.5 text-left">
                                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                            {ctaType === 'external' ? 'Destination URL' : 'Target Resource'}
                                                        </Label>
                                                        {ctaType === 'external' ? (
                                                            <Input
                                                                value={ctaTargetId}
                                                                onChange={(e) => setCtaTargetId(e.target.value)}
                                                                placeholder="https://example.com"
                                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-semibold text-xs px-3"
                                                            />
                                                        ) : (
                                                            <select
                                                                value={ctaTargetId}
                                                                onChange={(e) => setCtaTargetId(e.target.value)}
                                                                className="w-full h-11 px-3 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                            >
                                                                <option value="">Select resource...</option>
                                                                {ctaType === 'survey' && surveys.map((s) => (
                                                                    <option key={s.id} value={s.id}>{s.internalName}</option>
                                                                ))}
                                                                {ctaType === 'form' && pdfs.map((f) => (
                                                                    <option key={f.id} value={f.id}>{f.name}</option>
                                                                ))}
                                                                {ctaType === 'page' && pages.map((p) => (
                                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>

                                                    <div className={`grid gap-4 ${asset.type === 'video' || asset.type === 'audio' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                        <div className="space-y-1.5 text-left">
                                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Trigger Mode</Label>
                                                            <select
                                                                value={ctaMode}
                                                                onChange={(e) => setCtaMode(e.target.value as 'modal' | 'redirect' | 'replace')}
                                                                className="w-full h-11 px-3 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                            >
                                                                <option value="modal">Popup Overlay</option>
                                                                <option value="redirect">Direct Redirect</option>
                                                                <option value="replace">Inline Replacement</option>
                                                            </select>
                                                        </div>

                                                        {(asset.type === 'video' || asset.type === 'audio') && (
                                                            <div className="space-y-1.5 text-left">
                                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Unlock Milestone</Label>
                                                                <select
                                                                    value={ctaActivationGate}
                                                                    onChange={(e) => setCtaActivationGate(e.target.value as 'immediate' | 'quarter' | 'half' | 'threequarters' | 'complete')}
                                                                    className="w-full h-11 px-3 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                                >
                                                                    <option value="immediate">Show Immediately</option>
                                                                    <option value="quarter">Watch 25%</option>
                                                                    <option value="half">Watch 50%</option>
                                                                    <option value="threequarters">Watch 75%</option>
                                                                    <option value="complete">Watch 100%</option>
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-3 text-left">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">CTA Pretext (Above Button)</Label>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Popover when done playing</span>
                                                                <button
                                                                    type="button"
                                                                    role="switch"
                                                                    aria-checked={ctaPopoverEnabled}
                                                                    onClick={() => setCtaPopoverEnabled(!ctaPopoverEnabled)}
                                                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none active:scale-[0.97] transition-transform ${ctaPopoverEnabled ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}
                                                                >
                                                                    <span
                                                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${ctaPopoverEnabled ? 'translate-x-4' : 'translate-x-0'}`}
                                                                    />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <SlashTextarea 
                                                            value={ctaPretext}
                                                            onChange={setCtaPretext}
                                                            variables={variables}
                                                            placeholder="Enter pretext layout above button supporting variables..."
                                                            className="min-h-[70px] rounded-xl font-semibold text-sm bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="automations" className="space-y-4 outline-none mt-0">
                                        <div className="space-y-4">
                                            <div className="flex flex-col gap-1.5 text-left">
                                                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Event Trigger</Label>
                                                <select
                                                    value={activeTrigger}
                                                    onChange={(e) => setActiveTrigger(e.target.value)}
                                                    className="w-full h-11 px-3 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                >
                                                    <option value="on_view">Recipient Lands on Page</option>
                                                    {(asset.type === 'video' || asset.type === 'audio') && (
                                                        <>
                                                            <option value="on_play">Recipient Clicks Play</option>
                                                            <option value="on_progress_25">Recipient Watches 25%</option>
                                                            <option value="on_progress_50">Recipient Watches 50% (Halfway)</option>
                                                            <option value="on_progress_75">Recipient Watches 75%</option>
                                                            <option value="on_complete">Recipient Completes Playback</option>
                                                        </>
                                                    )}
                                                    <option value="on_cta_click">Recipient Clicks CTA Button</option>
                                                    <option value="on_download">Recipient Downloads/Saves Asset</option>
                                                </select>
                                                <p className="text-[9px] font-medium text-slate-500 ml-1 font-sans">
                                                    Configure actions to execute automatically when this trigger event is registered.
                                                </p>
                                            </div>

                                            <div className="border-t border-dashed border-border/60 pt-4 text-left">
                                                <Label className="text-[10px] font-bold text-muted-foreground ml-1 mb-2 block">
                                                    Trigger Actions List
                                                </Label>
                                                <OutcomeAutomationsEditor
                                                    automations={automationRules[activeTrigger] || []}
                                                    onChange={handleRulesChange}
                                                    data={actionData}
                                                />
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>

                            {/* Links & Embed Codes Side */}
                            <div className="p-6 md:p-8 bg-muted/15 md:overflow-y-auto md:h-full">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 border-b pb-3 border-border/40">
                                        <button
                                            type="button"
                                            onClick={() => setActiveLinkTab('links')}
                                            className={`pb-1 px-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${activeLinkTab === 'links' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                                        >
                                            Share Links
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveLinkTab('embed')}
                                            className={`pb-1 px-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${activeLinkTab === 'embed' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                                        >
                                            Embed Codes
                                        </button>
                                    </div>

                                    {!isSaved ? (
                                        <div className="py-12 text-center space-y-4">
                                            <div className="p-4 bg-muted rounded-3xl w-fit mx-auto text-muted-foreground">
                                                <RefreshCw className="h-6 w-6 animate-pulse" />
                                            </div>
                                            <p className="text-xs font-bold text-muted-foreground">Save the configuration on the left to activate sharing channels.</p>
                                        </div>
                                    ) : activeLinkTab === 'links' ? (
                                        <div className="space-y-6">
                                            {/* Direct Gateway URL */}
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                                    <Globe className="h-3.5 w-3.5 text-blue-500" /> Direct File URL
                                                </Label>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        readOnly 
                                                        value={asset.url}
                                                        className="h-10 rounded-xl bg-card border-none shadow-none font-bold text-[10px] truncate select-all px-3 w-full"
                                                    />
                                                    <Button 
                                                        type="button"
                                                        size="icon" 
                                                        onClick={() => copyText(asset.url, 'direct')} 
                                                        className="h-10 w-10 shrink-0 rounded-xl bg-card border hover:bg-muted active:scale-[0.97] transition-transform duration-100"
                                                    >
                                                        {copiedDirect ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Dedicated Public Page */}
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                                    <Globe className="h-3.5 w-3.5 text-emerald-500" /> Public Viewing Page
                                                </Label>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        readOnly 
                                                        value={publicUrl}
                                                        className="h-10 rounded-xl bg-card border-none shadow-none font-bold text-[10px] truncate select-all px-3 w-full"
                                                    />
                                                    <Button 
                                                        type="button"
                                                        size="icon" 
                                                        onClick={() => copyText(publicUrl, 'public')} 
                                                        className="h-10 w-10 shrink-0 rounded-xl bg-card border hover:bg-muted active:scale-[0.97] transition-transform duration-100"
                                                    >
                                                        {copiedPublic ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-1.5 text-left">
                                                <p className="text-[10px] font-bold text-primary flex items-center gap-1">
                                                    <Sparkles className="h-3 w-3" /> Parameter Propagation Tutorial
                                                </p>
                                                <p className="text-[9px] text-muted-foreground leading-relaxed">
                                                    Append parameters like <code className="bg-muted px-1 py-0.5 rounded font-mono text-[85%]">?contactId=123</code> to feed recipient data and resolve double-brace variables in your CRM workflows dynamically.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 text-left">
                                            <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                                <Code className="h-3.5 w-3.5 text-purple-500" /> HTML IFrame Embed Code
                                            </Label>
                                            <textarea
                                                readOnly
                                                value={iframeCode}
                                                className="w-full min-h-[80px] p-3 text-[10px] font-mono font-bold bg-card border border-border/80 rounded-2xl resize-none select-all focus:outline-none"
                                            />
                                            <Button
                                                type="button"
                                                onClick={() => copyText(iframeCode, 'iframe')}
                                                className="w-full h-11 rounded-xl bg-card border hover:bg-muted font-bold text-xs gap-2 active:scale-[0.97] transition-transform duration-100"
                                            >
                                                {copiedIframe ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                                                {copiedIframe ? 'Copied Code' : 'Copy Embed Code'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-6 bg-background border-t border-border/40 shrink-0 flex justify-between items-center sm:justify-between">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving} className="rounded-xl font-bold h-12 px-8 cursor-pointer active:scale-[0.97] transition-transform duration-100">Discard</Button>
                            <Button 
                                type="submit" 
                                disabled={isSaving || !title.trim() || isSlugChecking || slugStatus === 'conflict' || slugStatus === 'too-short'} 
                                className="rounded-xl font-bold h-12 px-10 shadow-lg cursor-pointer transition-all active:scale-[0.97] gap-2"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                                Save Config
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
