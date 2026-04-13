'use client';

import * as React from 'react';
import { use, useState, useEffect } from 'react';
import { collection, query, doc, getDoc, updateDoc, setDoc, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { 
    Layout, 
    ArrowLeft, 
    Loader2, 
    MonitorPlay, 
    Smartphone, 
    Globe, 
    Save, 
    Send,
    Type,
    Image as ImageIcon,
    PlusSquare,
    MousePointer2,
    Settings2,
    Zap,
    Users,
    ChevronRight,
    Check,
    MousePointerClick,
    ExternalLink,
    Play,
    ClipboardList,
    FileCheck,
    HelpCircle,
    Palette,
    FolderHeart,
    History,
    Pipette,
    Eye,
    TrendingUp,
    Target,
    ArrowRight,
    Trash2,
    ArrowUp,
    ArrowDown,
    PlusCircle,
    X
} from 'lucide-react';



import { 
    saveThemeAction, 
    getThemesAction 
} from '@/lib/theme-actions';
import { 
    saveSectionAction, 
    getSectionTemplatesAction 
} from '@/lib/section-actions';
import { 
    duplicatePageAction 
} from '@/lib/page-actions';

import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CampaignPage, CampaignPageVersion, CampaignPageStructure, PageSection, PageTrigger, PageTriggerAction } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

// Simple Builder Component Shell
export default function BuilderClient({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useUser();
    const { activeWorkspaceId, activeOrganizationId: organizationId } = useTenant();
    
    const [page, setPage] = useState<CampaignPage | null>(null);
    const [version, setVersion] = useState<CampaignPageVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [activeTab, setActiveTab] = useState<'add' | 'edit' | 'settings' | 'triggers' | 'theme' | 'library' | 'performance'>('add');
    const [leads, setLeads] = useState<any[]>([]);
    const [isLoadingLeads, setIsLoadingLeads] = useState(false);

    const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [automations, setAutomations] = useState<any[]>([]);
    const [surveys, setSurveys] = useState<any[]>([]);
    const [forms, setForms] = useState<any[]>([]);
    const [themes, setThemes] = useState<any[]>([]);
    const [savedSections, setSavedSections] = useState<any[]>([]);
    const [loadingResources, setLoadingResources] = useState(false);


    useEffect(() => {
        if (!firestore) return;

        const loadData = async () => {
            try {
                // Fetch Page
                const pageSnap = await getDoc(doc(firestore, 'campaign_pages', id));
                if (!pageSnap.exists()) throw new Error('Page not found');
                const pageData = pageSnap.data() as CampaignPage;
                setPage(pageData);

                // Fetch latest drafting version
                const vQuery = query(
                    collection(firestore, 'campaign_page_versions'),
                    where('pageId', '==', id),
                    orderBy('versionNumber', 'desc'),
                    limit(1)
                );
                const vSnap = await getDocs(vQuery);
                
                if (!vSnap.empty) {
                    setVersion(vSnap.docs[0].data() as CampaignPageVersion);
                } else {
                    throw new Error('No structure found for this page.');
                }
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'Error loading page', description: err.message });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [firestore, id, toast]);

    useEffect(() => {
        if (!firestore || (activeTab !== 'settings' && activeTab !== 'triggers')) return;

        const fetchAllResources = async () => {
            setLoadingResources(true);
            try {
                const [aSnap, sSnap, fSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'automations'), where('isActive', '==', true))),
                    getDocs(query(collection(firestore, 'surveys'), where('status', '==', 'published'))),
                    getDocs(query(collection(firestore, 'forms'), where('status', '==', 'published')))
                ]);
                setAutomations(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setSurveys(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setForms(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Failed to load resources", err);
            } finally {
                setLoadingResources(false);
            }
        };

        fetchAllResources();
    }, [firestore, activeTab]);

    // (Resource fetch consolidated above)

    const addTrigger = () => {
        if (!page) return;
        const newTrigger: PageTrigger = {
            id: `trig_${Date.now()}`,
            name: `Trigger ${(page.settings.triggers?.length || 0) + 1}`,
            event: 'page_load',
            actions: [{
                id: `act_${Date.now()}`,
                type: 'open_modal',
                config: {}
            }]
        };
        const triggers = [...(page.settings.triggers || []), newTrigger];
        updatePageSettings({ triggers });
    };

    const updateTrigger = (id: string, updates: Partial<PageTrigger>) => {
        if (!page || !page.settings.triggers) return;
        const triggers = page.settings.triggers.map(t => t.id === id ? { ...t, ...updates } : t);
        updatePageSettings({ triggers });
    };

    const removeTrigger = (id: string) => {
        if (!page || !page.settings.triggers) return;
        const triggers = page.settings.triggers.filter(t => t.id !== id);
        updatePageSettings({ triggers });
    };

    const addActionToTrigger = (triggerId: string) => {
        if (!page || !page.settings.triggers) return;
        const triggers = page.settings.triggers.map(t => {
            if (t.id !== triggerId) return t;
            return { ...t, actions: [...t.actions, { id: `act_${Date.now()}`, type: 'open_modal' as const, config: {} }] };
        });
        updatePageSettings({ triggers });
    };

    const updateAction = (triggerId: string, actionId: string, updates: Partial<PageTriggerAction>) => {
        if (!page || !page.settings.triggers) return;
        const triggers = page.settings.triggers.map(t => {
            if (t.id !== triggerId) return t;
            return { ...t, actions: t.actions.map(a => a.id === actionId ? { ...a, ...updates } : a) };
        });
        updatePageSettings({ triggers });
    };

    const removeAction = (triggerId: string, actionId: string) => {
        if (!page || !page.settings.triggers) return;
        const triggers = page.settings.triggers.map(t => {
            if (t.id !== triggerId) return t;
            return { ...t, actions: t.actions.filter(a => a.id !== actionId) };
        });
        updatePageSettings({ triggers });
    };

    const addBlock = (type: PageBlockType) => {
        if (!version) return;
        
        const newBlock: PageBlock = {
            id: `${type}_${Date.now()}`,
            type,
            props: type === 'hero' ? { title: 'New Hero', subtitle: 'Describe your campaign here.' } : {}
        };

        // For now, add to the first section (if exists) or create one
        let newSections = [...version.structureJson.sections];
        if (newSections.length === 0) {
            newSections.push({
                id: `sec_${Date.now()}`,
                type: 'section',
                props: { background: 'default' },
                blocks: [newBlock]
            });
        } else {
            newSections[0] = {
                ...newSections[0],
                blocks: [...newSections[0].blocks, newBlock]
            };
        }

        setVersion({
            ...version,
            structureJson: { ...version.structureJson, sections: newSections }
        });
        setSelectedBlockId(newBlock.id);
        setActiveTab('edit');
    };

    // ─── Phase 3: Resource Loading ──────────────────────────────────────────
    useEffect(() => {
        if (!organizationId) return;
        const loadResources = async () => {
            setLoadingResources(true);
            try {
                const [tList, sList] = await Promise.all([
                    getThemesAction(organizationId),
                    getSectionTemplatesAction(organizationId)
                ]);
                setThemes(tList);
                setSavedSections(sList);
            } finally {
                setLoadingResources(false);
            }
        };
        loadResources();
    }, [organizationId]);

    const handleSaveSectionAsTemplate = async (section: any) => {
        if (!organizationId || !activeWorkspaceId) return;
        const name = prompt('Enter a name for this section template:');
        if (!name) return;

        const res = await saveSectionAction({
            name,
            category: 'Custom',
            structure: section,
            organizationId,
            workspaceId: activeWorkspaceId
        });

        if (res.success) {
            toast({ title: 'Success', description: 'Section saved to your library.' });
            const sList = await getSectionTemplatesAction(organizationId);
            setSavedSections(sList);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: res.error });
        }
    };

    const applyTheme = (themeId: string) => {
        if (!page) return;
        setPage({ ...page, themeId });
        updatePageSettings({ triggers: page.settings.triggers }); // Force update doc
    };

    const updateThemeOverride = (key: string, value: string) => {
        if (!page) return;
        const newOverrides = { ...(page.settings.themeOverrides || {}), [key]: value };
        updatePageSettings({ themeOverrides: newOverrides });
    };


    const findBlock = (blockId: string) => {
        if (!version) return null;
        for (const section of version.structureJson.sections) {
            const block = section.blocks.find(b => b.id === blockId);
            if (block) return { block, section };
        }
        return null;
    };

    const updateBlockProps = (blockId: string, newProps: any) => {
        if (!version) return;
        const newSections = version.structureJson.sections.map(section => ({
            ...section,
            blocks: section.blocks.map(block => 
                block.id === blockId ? { ...block, props: { ...block.props, ...newProps } } : block
            )
        }));
        setVersion({
            ...version,
            structureJson: { ...version.structureJson, sections: newSections }
        });
    };

    const removeBlock = (blockId: string) => {
        if (!version) return;
        const newSections = version.structureJson.sections.map(section => ({
            ...section,
            blocks: section.blocks.filter(block => block.id !== blockId)
        }));
        setVersion({
            ...version,
            structureJson: { ...version.structureJson, sections: newSections }
        });
        if (selectedBlockId === blockId) setSelectedBlockId(null);
    };

    const removeSection = (sectionId: string) => {
        if (!version) return;
        const newSections = version.structureJson.sections.filter(section => section.id !== sectionId);
        setVersion({
            ...version,
            structureJson: { ...version.structureJson, sections: newSections }
        });
    };

    const moveSection = (sectionId: string, direction: 'up' | 'down') => {
        if (!version) return;
        const sections = [...version.structureJson.sections];
        const index = sections.findIndex(s => s.id === sectionId);
        if (index === -1) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === sections.length - 1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];

        setVersion({
            ...version,
            structureJson: { ...version.structureJson, sections }
        });
    };

    const moveBlock = (blockId: string, direction: 'up' | 'down') => {
        if (!version) return;
        const newSections = version.structureJson.sections.map(section => {
            const blocks = [...section.blocks];
            const index = blocks.findIndex(b => b.id === blockId);
            if (index === -1) return section;
            if (direction === 'up' && index === 0) return section;
            if (direction === 'down' && index === blocks.length - 1) return section;

            const newIndex = direction === 'up' ? index - 1 : index + 1;
            [blocks[index], blocks[newIndex]] = [blocks[newIndex], blocks[index]];

            return { ...section, blocks };
        });

        setVersion({
            ...version,
            structureJson: { ...version.structureJson, sections: newSections }
        });
    };

    const updateSectionProps = (sectionId: string, newProps: any) => {
        if (!version) return;
        const newSections = version.structureJson.sections.map(section => 
            section.id === sectionId ? { ...section, props: { ...section.props, ...newProps } } : section
        );
        setVersion({
            ...version,
            structureJson: { ...version.structureJson, sections: newSections }
        });
    };


    const updatePageSettings = async (updates: Partial<CampaignPage['settings']>) => {
        if (!page) return;
        const newSettings = { ...page.settings, ...updates };
        setPage({ ...page, settings: newSettings });

        // Auto-save settings to DB
        try {
            await updateDoc(doc(firestore!, 'campaign_pages', page.id), {
                settings: newSettings,
                updatedAt: new Date().toISOString()
            });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Setting Update Failed' });
        }
    };

    const handleSaveAsDraft = async () => {
        if (!firestore || !version) return;
        setSaving(true);
        try {
            await updateDoc(doc(firestore, 'campaign_page_versions', version.id), {
                structureJson: version.structureJson,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Draft Saved', description: 'Your progress has been saved.' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Save failed', description: err.message });
        } finally {
            setSaving(false);
        }
    };

    const addSection = (template?: any) => {
        if (!version) return;
        const newSection: PageSection = template ? {
            ...template.structure,
            id: `sec_${Date.now()}`
        } : {
            id: `sec_${Date.now()}`,
            type: 'section',
            props: { background: 'default' },
            blocks: []
        };

        const newSections = [...version.structureJson.sections, newSection];
        setVersion({
            ...version,
            structureJson: { ...version.structureJson, sections: newSections }
        });
        toast({ title: 'Section Added', description: template ? 'Template added to page.' : 'Empty section added.' });
    };

    const handlePublish = async () => {
        if (!firestore || !page || !version || !user) return;
        setPublishing(true);
        try {
            const timestamp = new Date().toISOString();
            
            // 1. Create a "published" snapshot version
            const newVersionNum = version.versionNumber + 1;
            const newVersionId = doc(collection(firestore, 'campaign_page_versions')).id;
            
            const publishedVersion: CampaignPageVersion = {
                id: newVersionId,
                pageId: id,
                organizationId: page.organizationId,
                versionNumber: newVersionNum,
                structureJson: version.structureJson,
                createdBy: user.uid,
                createdAt: timestamp,
                isPublishedVersion: true
            };

            await setDoc(doc(firestore, 'campaign_page_versions', newVersionId), publishedVersion);

            // 2. Update Page document to status = published && point to this new version
            await updateDoc(doc(firestore, 'campaign_pages', id), {
                status: 'published',
                publishedVersionId: newVersionId,
                updatedAt: timestamp
            });

            setPage(prev => prev ? { ...prev, status: 'published', publishedVersionId: newVersionId } : prev);
            
            toast({ 
                title: 'Page Published!', 
                description: 'The page is now live and public.',
                variant: 'default',
            });
            
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Publish failed', description: err.message });
        } finally {
            setPublishing(false);
        }
    };



    if (loading) {
        return <div className="h-screen bg-muted/20 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (!page || !version) return <div className="p-8 text-center">Error: Page data incomplete</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 border-t print:hidden">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-6 bg-white border-b shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button asChild variant="ghost" className="h-9 w-9 p-0 rounded-lg hover:bg-slate-100">
                        <Link href="/admin/pages"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold tracking-tight">{page.name}</span>
                        <span className="text-[10px] text-slate-500 font-medium">/{page.slug}</span>
                    </div>
                    {page.status === 'published' && (
                        <div className="ml-2 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">
                            Live
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setViewport('desktop')}
                        className={cn("h-8 px-3 rounded-lg text-xs font-semibold gap-2", viewport === 'desktop' ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-900")}
                    >
                        <MonitorPlay className="w-4 h-4" /> PC
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setViewport('mobile')}
                        className={cn("h-8 px-3 rounded-lg text-xs font-semibold gap-2", viewport === 'mobile' ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-900")}
                    >
                        <Smartphone className="w-4 h-4" /> Mobile
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    {page.status === 'published' && (
                        <Button asChild variant="ghost" className="h-9 font-semibold text-xs border border-border">
                            <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                                <Globe className="w-3.5 h-3.5 mr-1.5" /> View Live
                            </a>
                        </Button>
                    )}
                    <Button 
                        variant="outline" 
                        disabled={saving}
                        onClick={handleSaveAsDraft}
                        className="h-9 font-semibold text-xs min-w-[90px]"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                        Save Draft
                    </Button>
                    <Button 
                        onClick={handlePublish}
                        disabled={publishing}
                        className="h-9 font-bold bg-primary hover:bg-primary/90 text-xs shadow-md shadow-primary/20 min-w-[100px]"
                    >
                        {publishing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                        Publish
                    </Button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Blocks */}
                <aside className="w-80 bg-white border-r flex flex-col shrink-0 z-10 shadow-sm relative">
                    <div className="flex items-center gap-1 p-2 border-b bg-slate-50/50">
                        <Button 
                            variant="ghost" 
                            className={cn("flex-1 h-9 rounded-lg text-[11px] font-semibold", activeTab === 'add' ? "bg-white shadow-sm text-primary" : "text-slate-600")}
                            onClick={() => setActiveTab('add')}
                        >
                            <PlusSquare className="w-4 h-4 mr-2" /> Add Block
                        </Button>
                        <Button 
                            variant="ghost" 
                            className={cn("flex-1 h-9 rounded-lg text-[11px] font-semibold", activeTab === 'edit' ? "bg-white shadow-sm text-primary" : "text-slate-600")}
                            onClick={() => setActiveTab('edit')}
                        >
                            <Settings2 className="w-4 h-4 mr-2" /> Block
                        </Button>
                        <Button 
                            variant="ghost" 
                            className={cn("flex-1 h-9 rounded-lg text-[11px] font-semibold", activeTab === 'performance' ? "bg-white shadow-sm text-primary" : "text-slate-600")}
                            onClick={() => setActiveTab('performance')}
                        >
                            <TrendingUp className="w-4 h-4 mr-2" /> Stats
                        </Button>
                        <Button 
                            variant="ghost" 
                            className={cn("flex-1 h-9 rounded-lg text-[11px] font-semibold", activeTab === 'settings' ? "bg-white shadow-sm text-primary" : "text-slate-600")}
                            onClick={() => setActiveTab('settings')}
                        >
                            <Settings2 className="w-4 h-4 mr-2" /> Setup
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 placeholder-text text-left">
                        {activeTab === 'performance' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <section>
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 block">Overview</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                                            <span className="text-2xl font-black text-slate-900 leading-tight tracking-tight">
                                                {page?.stats?.views || 0}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <Eye className="w-3 h-3" />
                                                <span className="text-[9px] font-bold uppercase tracking-wider">Total Views</span>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                                            <span className="text-2xl font-black text-emerald-600 leading-tight tracking-tight">
                                                {page?.stats?.views ? ((page.stats.conversions / page.stats.views) * 100).toFixed(1) : '0'}%
                                            </span>
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <TrendingUp className="w-3 h-3" />
                                                <span className="text-[9px] font-bold uppercase tracking-wider">CVR</span>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                                            <span className="text-2xl font-black text-slate-900 leading-tight tracking-tight">
                                                {page?.stats?.conversions || 0}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <Target className="w-3 h-3" />
                                                <span className="text-[9px] font-bold uppercase tracking-wider">Conversions</span>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                                            <span className="text-2xl font-black text-slate-900 leading-tight tracking-tight">
                                                {page?.stats?.clicks || 0}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <MousePointerClick className="w-3 h-3" />
                                                <span className="text-[9px] font-bold uppercase tracking-wider">Clicks</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="pt-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Leads</Label>
                                        <Button asChild variant="link" className="h-auto p-0 text-[10px] font-bold uppercase tracking-widest text-primary">
                                            <Link href={`/admin/pages/${page.id}/leads`}>View All</Link>
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        {isLoadingLeads ? (
                                            Array.from({ length: 3 }).map((_, i) => (
                                                <div key={i} className="h-12 w-full bg-slate-50 animate-pulse rounded-xl" />
                                            ))
                                        ) : leads.length > 0 ? (
                                            leads.slice(0, 3).map((lead) => (
                                                <Link 
                                                    key={lead.id} 
                                                    href={`/admin/pages/${page.id}/leads`}
                                                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors group"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-slate-900 truncate">{lead.name}</p>
                                                        <p className="text-[10px] font-medium text-slate-400 truncate">{lead.email || lead.phone || 'No contact info'}</p>
                                                    </div>
                                                    <ArrowRight className="h-3 w-3 text-slate-300 group-hover:text-primary transition-colors" />
                                                </Link>
                                            ))
                                        ) : (
                                            <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                                                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No leads captured yet</p>
                                            </div>
                                        )}
                                    </div>
                                </section>


                                <section className="pt-4 border-t">
                                    <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50">
                                        <h5 className="text-[10px] font-bold text-blue-900 uppercase tracking-widest mb-1.5">Pro Tip</h5>
                                        <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
                                            High views but low conversion? Try changing your CTA color or moving your form higher in the page structure.
                                        </p>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'theme' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Active Theme</Label>
                                    <Select value={page?.themeId || ''} onValueChange={applyTheme}>
                                        <SelectTrigger className="h-10 rounded-xl bg-slate-50 text-xs font-semibold">
                                            <SelectValue placeholder="Select a theme..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {themes.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                            {themes.length === 0 && <SelectItem value="default" disabled>No themes found</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-4 pt-4 border-t">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Color Overrides</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['primary', 'secondary', 'background', 'accent'].map(key => (
                                            <div key={key} className="space-y-1.5">
                                                <Label className="text-[10px] font-medium text-slate-500 capitalize">{key}</Label>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        type="color" 
                                                        value={page?.settings.themeOverrides?.[key as any] || '#000000'}
                                                        onChange={(e) => updateThemeOverride(key, e.target.value)}
                                                        className="h-8 w-8 p-0 rounded-lg border-0 cursor-pointer overflow-hidden"
                                                    />
                                                    <Input 
                                                        value={page?.settings.themeOverrides?.[key as any] || ''}
                                                        placeholder="Hex code"
                                                        onChange={(e) => updateThemeOverride(key, e.target.value)}
                                                        className="h-8 text-[10px] items-center py-0 rounded-lg bg-slate-50"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Typography</Label>
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-medium text-slate-500">Primary Font</Label>
                                            <Select 
                                                value={page?.settings.themeOverrides?.typography?.primaryFont || 'Inter'} 
                                                onValueChange={(val) => {
                                                    const current = page?.settings.themeOverrides || {};
                                                    const typography = current.typography || {};
                                                    updatePageSettings({ 
                                                        themeOverrides: { 
                                                            ...current, 
                                                            typography: { ...typography, primaryFont: val } 
                                                        } 
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="h-10 rounded-xl bg-slate-50 text-xs font-semibold">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="Inter" className="font-sans">Inter (Modern Sans)</SelectItem>
                                                    <SelectItem value="Roboto" className="font-sans">Roboto (Clean Sans)</SelectItem>
                                                    <SelectItem value="Playfair Display" className="font-serif">Playfair (Elegant Serif)</SelectItem>
                                                    <SelectItem value="Outfit" className="font-sans">Outfit (Geometric Sans)</SelectItem>
                                                    <SelectItem value="Space Grotesk" className="font-sans">Space Grotesk (Tech)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            </div>
                        )}

                        {activeTab === 'library' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <section>
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Saved Sections</Label>
                                    {savedSections.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-3">
                                            {savedSections.map(s => (
                                                <Card 
                                                    key={s.id} 
                                                    className="p-3 cursor-pointer hover:border-primary/40 group transition-all rounded-xl"
                                                    onClick={() => {
                                                        const newSections = [...version!.structureJson.sections, { ...s.structure, id: `sec_${Date.now()}` }];
                                                        setVersion({ ...version!, structureJson: { ...version!.structureJson, sections: newSections } });
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold truncate pr-4">{s.name}</span>
                                                        <PlusCircle className="w-3 h-3 text-slate-300 group-hover:text-primary" />
                                                    </div>
                                                    <div className="mt-2 h-1 bg-slate-100 rounded-full w-2/3 overflow-hidden">
                                                        <div className="h-full bg-slate-200 w-1/2" />
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center border-2 border-dashed rounded-2xl bg-slate-50/50">
                                            <FolderHeart className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                            <p className="text-[10px] text-slate-400 font-medium px-4 leading-relaxed">Your library is empty. Save a section from the canvas to reuse it here.</p>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}
                        {activeTab === 'add' ? (

                            <div>
                                <section>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Layouts</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div 
                                            onClick={() => addBlock('container')}
                                            className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-pointer hover:border-primary/40 hover:bg-white transition-colors"
                                        >
                                            <Layout className="w-5 h-5 text-slate-400" />
                                            <span className="text-[10px] font-semibold text-slate-600">Container</span>
                                        </div>
                                        <div 
                                            onClick={() => addBlock('columns')}
                                            className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-pointer hover:border-primary/40 hover:bg-white transition-colors"
                                        >
                                            <div className="flex gap-1"><div className="w-2 h-4 bg-slate-400 rounded-sm"/><div className="w-2 h-4 bg-slate-400 rounded-sm"/></div>
                                            <span className="text-[10px] font-semibold text-slate-600">Columns</span>
                                        </div>
                                    </div>
                                </section>
                                <section>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Content</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div 
                                            onClick={() => addBlock('hero')}
                                            className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-pointer hover:border-primary/40 hover:bg-white transition-colors"
                                        >
                                            <Zap className="w-5 h-5 text-slate-400" />
                                            <span className="text-[10px] font-semibold text-slate-600">Hero</span>
                                        </div>
                                        <div 
                                            onClick={() => addBlock('text')}
                                            className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-pointer hover:border-primary/40 hover:bg-white transition-colors"
                                        >
                                            <Type className="w-5 h-5 text-slate-400" />
                                            <span className="text-[10px] font-semibold text-slate-600">Typography</span>
                                        </div>
                                        <div 
                                            onClick={() => addBlock('cta')}
                                            className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-pointer hover:border-primary/40 hover:bg-white transition-colors"
                                        >
                                            <MousePointer2 className="w-5 h-5 text-slate-400" />
                                            <span className="text-[10px] font-semibold text-slate-600">Button</span>
                                        </div>
                                        <div 
                                            onClick={() => addBlock('form')}
                                            className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-pointer hover:border-primary/40 hover:bg-white transition-colors col-span-2"
                                        >
                                            <div className="h-6 w-16 bg-blue-500 rounded text-[6px] text-white flex items-center justify-center font-bold">Submit</div>
                                            <span className="text-[10px] font-semibold text-slate-600">Form Embed</span>
                                        </div>
                                        <div 
                                            onClick={() => addBlock('survey')}
                                            className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-pointer hover:border-primary/40 hover:bg-white transition-colors"
                                        >
                                            <ClipboardList className="w-5 h-5 text-slate-400" />
                                            <span className="text-[10px] font-semibold text-slate-600">Survey</span>
                                        </div>
                                        <div 
                                            onClick={() => addBlock('agreement')}
                                            className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-pointer hover:border-primary/40 hover:bg-white transition-colors"
                                        >
                                            <FileCheck className="w-5 h-5 text-slate-400" />
                                            <span className="text-[10px] font-semibold text-slate-600">Agreement</span>
                                        </div>
                                        <div 
                                            onClick={() => addBlock('html')}
                                            className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-pointer hover:border-primary/40 hover:bg-white transition-colors"
                                        >
                                            <div className="flex gap-1 text-[8px] font-bold text-slate-400 border border-slate-300 px-1.5 py-0.5 rounded">HTML</div>
                                            <span className="text-[10px] font-semibold text-slate-600">Raw Code</span>
                                        </div>
                                    </div>
                                </section>
                                <section className="pt-4 border-t">
                                    <Button 
                                        onClick={() => addSection()}
                                        className="w-full h-10 rounded-xl border-dashed border-2 hover:border-primary hover:text-primary transition-all bg-transparent text-slate-400 font-bold text-xs"
                                        variant="outline"
                                    >
                                        <PlusCircle className="w-4 h-4 mr-2" /> Add Empty Section
                                    </Button>
                                </section>

                            </div>
                        ) : activeTab === 'edit' ? (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {selectedBlockId ? (
                                    (() => {
                                        const match = findBlock(selectedBlockId);
                                        if (!match) return <div className="text-center py-8 text-slate-400">Block not found</div>;
                                        const { block } = match;

                                        return (
                                            <div className="space-y-8">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{block.type} Block</h4>
                                                    <Badge variant="outline" className="text-[9px] uppercase">{block.id.split('_')[0]}</Badge>
                                                </div>

                                                <div className="space-y-4">
                                                    {block.type === 'hero' && (
                                                        <>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Headline</Label>
                                                                <Input 
                                                                    value={block.props.title || ''} 
                                                                    onChange={(e) => updateBlockProps(block.id, { title: e.target.value })}
                                                                    className="h-10 rounded-xl bg-slate-50 text-xs font-semibold"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Subtitle</Label>
                                                                <textarea 
                                                                    value={block.props.subtitle || ''} 
                                                                    onChange={(e) => updateBlockProps(block.id, { subtitle: e.target.value })}
                                                                    className="w-full min-h-[80px] rounded-xl bg-slate-50 border p-3 text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Background Image URL</Label>
                                                                <div className="flex gap-2">
                                                                    <Input 
                                                                        placeholder="https://images.unsplash.com/..."
                                                                        value={block.props.imageUrl || ''} 
                                                                        onChange={(e) => updateBlockProps(block.id, { imageUrl: e.target.value })}
                                                                        className="h-10 rounded-xl bg-slate-50 text-xs font-semibold flex-1"
                                                                    />
                                                                    {block.props.imageUrl && (
                                                                        <div className="h-10 w-10 rounded-lg border overflow-hidden bg-slate-100 flex-shrink-0">
                                                                            <img src={block.props.imageUrl} alt="preview" className="w-full h-full object-cover" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>

                                                    )}

                                                    {block.type === 'text' && (
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Content (HTML)</Label>
                                                            <textarea 
                                                                value={block.props.content || ''} 
                                                                onChange={(e) => updateBlockProps(block.id, { content: e.target.value })}
                                                                className="w-full min-h-[200px] rounded-xl bg-slate-50 border p-3 text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono"
                                                            />
                                                        </div>
                                                    )}

                                                    {block.type === 'cta' && (
                                                        <div className="space-y-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Button Label</Label>
                                                                <Input 
                                                                    value={block.props.label || ''} 
                                                                    onChange={(e) => updateBlockProps(block.id, { label: e.target.value })}
                                                                    className="h-10 rounded-xl bg-slate-50 text-xs font-semibold"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Redirect URL</Label>
                                                                <Input 
                                                                    placeholder="https://..."
                                                                    value={block.props.url || ''} 
                                                                    onChange={(e) => updateBlockProps(block.id, { url: e.target.value })}
                                                                    className="h-10 rounded-xl bg-slate-50 text-xs font-semibold"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Button Style</Label>
                                                                <Select 
                                                                    value={block.props.variant || 'primary'} 
                                                                    onValueChange={(val) => updateBlockProps(block.id, { variant: val })}
                                                                >
                                                                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 text-xs font-semibold">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        <SelectItem value="primary" className="font-bold">Primary (Solid)</SelectItem>
                                                                        <SelectItem value="secondary">Secondary (Outline)</SelectItem>
                                                                        <SelectItem value="glass">Glassmorphism</SelectItem>
                                                                        <SelectItem value="glow">Glow Pulse</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    )}



                                                    {block.type === 'form' && (
                                                        <div className="space-y-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Select Form</Label>
                                                                <Select 
                                                                    value={block.props.formId || ''} 
                                                                    onValueChange={(val) => updateBlockProps(block.id, { formId: val })}
                                                                >
                                                                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 text-xs font-semibold">
                                                                        <SelectValue placeholder="Chose a form..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        {forms.map(f => (
                                                                            <SelectItem key={f.id} value={f.id} className="text-xs">
                                                                                {f.internalName || f.title}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <p className="text-[9px] text-slate-400">Forms must be published to appear here.</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {block.type === 'survey' && (
                                                        <div className="space-y-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Select Survey</Label>
                                                                <Select 
                                                                    value={block.props.surveyId || ''} 
                                                                    onValueChange={(val) => updateBlockProps(block.id, { surveyId: val })}
                                                                >
                                                                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 text-xs font-semibold">
                                                                        <SelectValue placeholder="Chose a survey..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        {surveys.map(s => (
                                                                            <SelectItem key={s.id} value={s.id} className="text-xs">
                                                                                {s.title}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {block.type === 'agreement' && (
                                                        <div className="space-y-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Select Agreement</Label>
                                                                <Select 
                                                                    value={block.props.agreementId || ''} 
                                                                    onValueChange={(val) => updateBlockProps(block.id, { agreementId: val })}
                                                                >
                                                                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 text-xs font-semibold">
                                                                        <SelectValue placeholder="Chose an agreement..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        <SelectItem value="none" disabled className="text-xs">No agreements available</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {block.type === 'faq' && (
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">FAQ Items</Label>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    onClick={() => {
                                                                        const current = block.props.items || [];
                                                                        updateBlockProps(block.id, { 
                                                                            items: [...current, { id: Date.now().toString(), question: 'New Question', answer: 'New Answer' }]
                                                                        });
                                                                    }}
                                                                    className="h-7 text-[10px] font-bold text-primary"
                                                                >
                                                                    <PlusCircle className="w-3 h-3 mr-1" /> Add Item
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                                {(block.props.items || []).map((item: any, idx: number) => (
                                                                    <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 relative group/faq">
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="sm" 
                                                                            onClick={() => {
                                                                                const newItems = block.props.items.filter((i: any) => i.id !== item.id);
                                                                                updateBlockProps(block.id, { items: newItems });
                                                                            }}
                                                                            className="absolute top-1 right-1 h-5 w-5 p-0 text-slate-300 hover:text-red-500 opacity-0 group-hover/faq:opacity-100 transition-opacity"
                                                                        >
                                                                            <X className="w-3 h-3" />
                                                                        </Button>
                                                                        <div className="space-y-2">
                                                                            <Input 
                                                                                value={item.question} 
                                                                                onChange={(e) => {
                                                                                    const newItems = [...block.props.items];
                                                                                    newItems[idx].question = e.target.value;
                                                                                    updateBlockProps(block.id, { items: newItems });
                                                                                }}
                                                                                className="h-8 text-[11px] font-bold bg-white border-slate-200"
                                                                                placeholder="Question..."
                                                                            />
                                                                            <textarea 
                                                                                value={item.answer} 
                                                                                onChange={(e) => {
                                                                                    const newItems = [...block.props.items];
                                                                                    newItems[idx].answer = e.target.value;
                                                                                    updateBlockProps(block.id, { items: newItems });
                                                                                }}
                                                                                className="w-full min-h-[60px] p-2 text-[10px] bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-primary/20"
                                                                                placeholder="Answer..."
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {(!block.props.items || block.props.items.length === 0) && (
                                                                    <p className="text-[10px] text-slate-400 text-center py-4 italic">No items added yet</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {block.type === 'html' && (
                                                        <div className="space-y-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Raw HTML</Label>
                                                                <textarea 
                                                                    value={block.props.html || ''} 
                                                                    onChange={(e) => updateBlockProps(block.id, { html: e.target.value })}
                                                                    placeholder="<div>\n  <h1>Custom Content</h1>\n</div>"
                                                                    className="w-full min-h-[150px] rounded-xl bg-slate-50 border p-3 text-[11px] font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Custom CSS</Label>
                                                                <textarea 
                                                                    value={block.props.css || ''} 
                                                                    onChange={(e) => updateBlockProps(block.id, { css: e.target.value })}
                                                                    placeholder=".custom-class {\n  color: red;\n}"
                                                                    className="w-full min-h-[150px] rounded-xl bg-slate-50 border p-3 text-[11px] font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}



                                                </div>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60 py-20">
                                        <Settings2 className="w-8 h-8 text-slate-400" />
                                        <div>
                                            <p className="text-sm font-semibold">No block selected</p>
                                            <p className="text-[10px] text-slate-500 mt-1">Select a block on the canvas to edit its properties.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'triggers' ? (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-primary/10 rounded-lg">
                                                <MousePointerClick className="h-4 w-4 text-primary" />
                                            </div>
                                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Interactions</h4>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={addTrigger} className="h-7 text-[10px] font-bold text-primary hover:bg-primary/5">
                                            + Add
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {!page.settings.triggers || page.settings.triggers.length === 0 ? (
                                            <div className="text-center py-8 px-4 border-2 border-dashed rounded-2xl bg-slate-50/50">
                                                <MousePointerClick className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                                <p className="text-[10px] text-slate-400 font-medium">No triggers configured yet.</p>
                                                <p className="text-[9px] text-slate-300 mt-1">Use triggers to open modals, run automations, or redirect on events.</p>
                                            </div>
                                        ) : (
                                            page.settings.triggers.map((trigger) => (
                                                <div key={trigger.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4 relative group">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => removeTrigger(trigger.id)}
                                                        className="absolute top-2 right-2 h-6 w-6 p-0 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        ×
                                                    </Button>

                                                    {/* Trigger Name */}
                                                    <Input 
                                                        value={trigger.name} 
                                                        onChange={(e) => updateTrigger(trigger.id, { name: e.target.value })}
                                                        className="h-8 text-[11px] font-bold bg-transparent border-none p-0 focus-visible:ring-0 text-slate-800"
                                                        placeholder="Trigger name..."
                                                    />

                                                    {/* Event Selector */}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] font-bold text-slate-400 uppercase">When This Happens</Label>
                                                        <Select value={trigger.event} onValueChange={(val: any) => updateTrigger(trigger.id, { event: val })}>
                                                            <SelectTrigger className="h-8 text-[10px] font-semibold bg-slate-50 border-none rounded-lg">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                <SelectItem value="page_load" className="text-[10px]">Page Loaded</SelectItem>
                                                                <SelectItem value="block_click" className="text-[10px]">Block Clicked</SelectItem>
                                                                <SelectItem value="form_submitted" className="text-[10px]">Form Submitted</SelectItem>
                                                                <SelectItem value="on_exit" className="text-[10px]">Intent to Exit</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {(trigger.event === 'block_click' || trigger.event === 'form_submitted') && (
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-bold text-slate-400 uppercase">Target Block ID</Label>
                                                            <Input 
                                                                placeholder="e.g. hero_btn_1" 
                                                                value={trigger.targetBlockId || ''} 
                                                                onChange={(e) => updateTrigger(trigger.id, { targetBlockId: e.target.value })}
                                                                className="h-8 text-[10px] bg-slate-50 border-none font-semibold rounded-lg"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Actions List */}
                                                    <div className="space-y-2 pt-2 border-t border-slate-50">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-[9px] font-bold text-indigo-500 uppercase">Do These Actions</Label>
                                                            <Button variant="ghost" size="sm" onClick={() => addActionToTrigger(trigger.id)} className="h-6 text-[9px] font-bold text-indigo-500 p-0 px-2">
                                                                + Action
                                                            </Button>
                                                        </div>

                                                        {trigger.actions.map((action, aIdx) => (
                                                            <div key={action.id} className="p-3 bg-indigo-50/50 rounded-xl space-y-2 relative group/action">
                                                                {trigger.actions.length > 1 && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm"
                                                                        onClick={() => removeAction(trigger.id, action.id)}
                                                                        className="absolute top-1 right-1 h-5 w-5 p-0 text-slate-300 hover:text-red-500 opacity-0 group-hover/action:opacity-100 transition-opacity text-[10px]"
                                                                    >
                                                                        ×
                                                                    </Button>
                                                                )}
                                                                <div className="flex items-center gap-1 text-[8px] font-bold text-indigo-400 uppercase">
                                                                    <Play className="h-2.5 w-2.5" /> Action {aIdx + 1}
                                                                </div>

                                                                <Select value={action.type} onValueChange={(val: any) => updateAction(trigger.id, action.id, { type: val, config: {} })}>
                                                                    <SelectTrigger className="h-8 text-[10px] font-semibold bg-white border-none rounded-lg">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        <SelectItem value="open_modal" className="text-[10px]">Open Modal</SelectItem>
                                                                        <SelectItem value="trigger_automation" className="text-[10px]">Start Automation</SelectItem>
                                                                        <SelectItem value="redirect" className="text-[10px]">Go to URL</SelectItem>
                                                                        <SelectItem value="trigger_webhook" className="text-[10px]">Fire Webhook</SelectItem>
                                                                    </SelectContent>
                                                                </Select>

                                                                {/* Action-specific config */}
                                                                {action.type === 'open_modal' && (
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <Select value={action.config.modalType || ''} onValueChange={(val: any) => updateAction(trigger.id, action.id, { config: { ...action.config, modalType: val } })}>
                                                                            <SelectTrigger className="h-7 text-[9px] font-semibold bg-white border-none rounded-lg">
                                                                                <SelectValue placeholder="Type..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent className="rounded-xl">
                                                                                <SelectItem value="form" className="text-[9px]">Form</SelectItem>
                                                                                <SelectItem value="survey" className="text-[9px]">Survey</SelectItem>
                                                                                <SelectItem value="agreement" className="text-[9px]">Agreement</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <Select value={action.config.targetId || ''} onValueChange={(val: any) => updateAction(trigger.id, action.id, { config: { ...action.config, targetId: val } })}>
                                                                            <SelectTrigger className="h-7 text-[9px] font-semibold bg-white border-none rounded-lg">
                                                                                <SelectValue placeholder="Target..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent className="rounded-xl">
                                                                                {action.config.modalType === 'survey' && surveys.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px]">{s.title}</SelectItem>)}
                                                                                {action.config.modalType === 'form' && forms.map(f => <SelectItem key={f.id} value={f.id} className="text-[9px]">{f.internalName || f.title}</SelectItem>)}
                                                                                {(!action.config.modalType || action.config.modalType === 'agreement') && <SelectItem value="none" disabled className="text-[9px]">Select type first</SelectItem>}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                )}

                                                                {action.type === 'trigger_automation' && (
                                                                    <Select value={action.config.automationId || ''} onValueChange={(val: any) => updateAction(trigger.id, action.id, { config: { automationId: val } })}>
                                                                        <SelectTrigger className="h-7 text-[9px] font-semibold bg-white border-none rounded-lg">
                                                                            <SelectValue placeholder="Automation..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl">
                                                                            {automations.map(a => <SelectItem key={a.id} value={a.id} className="text-[9px]">{a.name}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                )}

                                                                {(action.type === 'redirect' || action.type === 'trigger_webhook') && (
                                                                    <Input 
                                                                        placeholder={action.type === 'redirect' ? 'https://...' : 'Webhook URL...'}
                                                                        value={action.config.url || ''} 
                                                                        onChange={(e) => updateAction(trigger.id, action.id, { config: { url: e.target.value } })}
                                                                        className="h-7 text-[9px] bg-white border-none font-semibold rounded-lg"
                                                                    />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {loadingResources && <div className="flex items-center justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
                                </section>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-primary/10 rounded-lg">
                                            <Settings2 className="h-4 w-4 text-primary" />
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Page Behavior</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                            <Label className="text-[11px] font-semibold">Show Header</Label>
                                            <input 
                                                type="checkbox" 
                                                checked={page.settings.showHeader} 
                                                onChange={(e) => updatePageSettings({ showHeader: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-300 text-primary"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                            <Label className="text-[11px] font-semibold">Show Footer</Label>
                                            <input 
                                                type="checkbox" 
                                                checked={page.settings.showFooter} 
                                                onChange={(e) => updatePageSettings({ showFooter: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-300 text-primary"
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                                            <Globe className="h-4 w-4 text-emerald-500" />
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">SEO & Search</h4>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase">Page Title</Label>
                                            <Input 
                                                value={page.seo.title || ''} 
                                                onChange={(e) => {
                                                    const newSeo = { ...page.seo, title: e.target.value };
                                                    setPage({ ...page, seo: newSeo });
                                                    updateDoc(doc(firestore!, 'campaign_pages', page.id), { seo: newSeo });
                                                }}
                                                className="h-8 text-[11px] font-semibold bg-slate-50 border-none rounded-lg"
                                                placeholder="Search result title..."
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase">Meta Description</Label>
                                            <textarea 
                                                value={page.seo.description || ''} 
                                                onChange={(e) => {
                                                    const newSeo = { ...page.seo, description: e.target.value };
                                                    setPage({ ...page, seo: newSeo });
                                                    updateDoc(doc(firestore!, 'campaign_pages', page.id), { seo: newSeo });
                                                }}
                                                className="w-full min-h-[60px] p-2 text-[10px] font-medium bg-slate-50 border-none rounded-lg outline-none focus:ring-1 focus:ring-primary/20"
                                                placeholder="Brief summary for search engines..."
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Hide from Search</Label>
                                            <input 
                                                type="checkbox" 
                                                checked={page.seo.noIndex || false} 
                                                onChange={(e) => {
                                                    const newSeo = { ...page.seo, noIndex: e.target.checked };
                                                    setPage({ ...page, seo: newSeo });
                                                    updateDoc(doc(firestore!, 'campaign_pages', page.id), { seo: newSeo });
                                                }}
                                                className="w-4 h-4 rounded border-slate-300 text-primary"
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-orange-500/10 rounded-lg">
                                            <PlusCircle className="h-4 w-4 text-orange-500" />
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Custom Scripts</h4>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase">Header Code (Inside &lt;head&gt;)</Label>
                                            <textarea 
                                                value={page.settings.customHead || ''} 
                                                onChange={(e) => updatePageSettings({ customHead: e.target.value })}
                                                className="w-full h-24 p-2 text-[9px] font-mono bg-slate-900 text-emerald-400 border-none rounded-lg outline-none"
                                                placeholder="<!-- Analytics, tracking pixels, etc. -->"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase">Body Code (End of &lt;body&gt;)</Label>
                                            <textarea 
                                                value={page.settings.customBody || ''} 
                                                onChange={(e) => updatePageSettings({ customBody: e.target.value })}
                                                className="w-full h-24 p-2 text-[9px] font-mono bg-slate-900 text-emerald-400 border-none rounded-lg outline-none"
                                                placeholder="<!-- Custom chat widgets, etc. -->"
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                                            <Users className="h-4 w-4 text-indigo-500" />
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">How It Works</h4>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                                        <div className="flex items-start gap-3">
                                            <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5"><Check className="h-3 w-3 text-white" /></div>
                                            <p className="text-[10px] font-medium text-slate-600 leading-normal">
                                                Embedded Forms and Surveys handle their own data — the page tracks conversions <span className="font-bold text-slate-900">indirectly</span>.
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5"><Check className="h-3 w-3 text-white" /></div>
                                            <p className="text-[10px] font-medium text-slate-600 leading-normal">
                                                Use the <span className="font-bold">Triggers</span> tab to configure automations, modals, and redirects.
                                            </p>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Center Canvas */}
                <main className="flex-1 overflow-y-auto bg-slate-100/50 p-6 flex justify-center custom-scrollbar">
                    <div 
                        className={cn(
                            "bg-white shadow-xl ring-1 ring-black/5 transition-all duration-300 origin-top overflow-hidden min-h-[800px]",
                            viewport === 'desktop' ? "w-full max-w-5xl rounded-lg" : "w-[390px] rounded-[2.5rem] border-[8px] border-slate-800"
                        )}
                    >
                        {/* Canvas Content Rendering */}
                        <div className="divide-y divide-slate-100">
                            {version.structureJson.sections?.length > 0 ? (
                                version.structureJson.sections.map((section, idx) => (
                                    <div key={section.id || idx} className="group relative p-12 hover:bg-primary/5 transition-colors border-2 border-transparent hover:border-primary/40 border-dashed">
                                        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                                            <div className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                                                Section {idx + 1}
                                            </div>
                                            <Button 
                                                variant="secondary" 
                                                size="icon" 
                                                className="h-6 w-6 rounded shadow-sm hover:text-primary transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSaveSectionAsTemplate(section);
                                                }}
                                            >
                                                <FolderHeart className="w-3 h-3" />
                                            </Button>
                                        </div>

                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            <Button 
                                                variant="secondary" 
                                                size="icon" 
                                                className="h-6 w-6 rounded shadow-sm hover:text-primary transition-all disabled:opacity-30"
                                                disabled={idx === 0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    moveSection(section.id, 'up');
                                                }}
                                            >
                                                <ArrowUp className="w-3 h-3" />
                                            </Button>
                                            <Button 
                                                variant="secondary" 
                                                size="icon" 
                                                className="h-6 w-6 rounded shadow-sm hover:text-primary transition-all disabled:opacity-30"
                                                disabled={idx === (version.structureJson.sections.length - 1)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    moveSection(section.id, 'down');
                                                }}
                                            >
                                                <ArrowDown className="w-3 h-3" />
                                            </Button>
                                            <Button 
                                                variant="secondary" 
                                                size="icon" 
                                                className="h-6 w-6 rounded shadow-sm hover:text-red-600 transition-all font-bold"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeSection(section.id);
                                                }}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>

                                        <div className="max-w-4xl mx-auto space-y-6">
                                            {section.blocks?.length > 0 ? (
                                                section.blocks.map((block, bIdx) => (
                                                    <div 
                                                        key={block.id || bIdx} 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedBlockId(block.id);
                                                            setActiveTab('edit');
                                                        }}
                                                        className={cn(
                                                            "p-4 bg-white ring-1 ring-slate-200 rounded-xl relative hover:ring-2 hover:ring-primary shadow-sm transition-all cursor-pointer group/block",
                                                            selectedBlockId === block.id && "ring-2 ring-primary bg-primary/5"
                                                        )}
                                                    >
                                                        {/* Block Actions */}
                                                        <div className="absolute -top-3 -right-2 opacity-0 group-hover/block:opacity-100 transition-opacity flex items-center gap-1 z-10 scale-90 origin-right">
                                                            <Button 
                                                                variant="secondary" 
                                                                size="icon" 
                                                                className="h-5 w-5 rounded-full shadow-md bg-white hover:text-primary border border-slate-100 disabled:opacity-30"
                                                                disabled={bIdx === 0}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    moveBlock(block.id, 'up');
                                                                }}
                                                            >
                                                                <ArrowUp className="w-2.5 h-2.5" />
                                                            </Button>
                                                            <Button 
                                                                variant="secondary" 
                                                                size="icon" 
                                                                className="h-5 w-5 rounded-full shadow-md bg-white hover:text-primary border border-slate-100 disabled:opacity-30"
                                                                disabled={bIdx === (section.blocks.length - 1)}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    moveBlock(block.id, 'down');
                                                                }}
                                                            >
                                                                <ArrowDown className="w-2.5 h-2.5" />
                                                            </Button>
                                                            <Button 
                                                                variant="secondary" 
                                                                size="icon" 
                                                                className="h-5 w-5 rounded-full shadow-md bg-white hover:text-red-600 border border-slate-100"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removeBlock(block.id);
                                                                }}
                                                            >
                                                                <Trash2 className="w-2.5 h-2.5" />
                                                            </Button>
                                                        </div>

                                                        {block.type === 'hero' && (
                                                            <div className="text-center space-y-4 py-8">
                                                                <input 
                                                                    className="w-full text-4xl font-bold tracking-tight text-slate-900 text-center bg-transparent border-none outline-none focus:ring-0 placeholder:opacity-30"
                                                                    value={block.props.title || ''}
                                                                    onChange={(e) => updateBlockProps(block.id, { title: e.target.value })}
                                                                    placeholder="Hero Title"
                                                                />
                                                                <textarea 
                                                                    className="w-full text-lg text-slate-500 text-center bg-transparent border-none outline-none focus:ring-0 resize-none placeholder:opacity-30 px-4"
                                                                    value={block.props.subtitle || ''}
                                                                    onChange={(e) => {
                                                                        updateBlockProps(block.id, { subtitle: e.target.value });
                                                                        e.target.style.height = 'auto';
                                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                                    }}
                                                                    placeholder="Hero Subtitle text goes here."
                                                                    rows={2}
                                                                />
                                                            </div>
                                                        )}

                                                        {block.type === 'text' && (
                                                            <div className="prose prose-slate max-w-none">
                                                                <textarea 
                                                                    className="w-full text-sm text-slate-600 bg-transparent border-none outline-none focus:ring-0 resize-none font-mono placeholder:opacity-30 p-2 rounded hover:bg-slate-50 transition-colors"
                                                                    value={block.props.content || ''}
                                                                    onChange={(e) => {
                                                                        updateBlockProps(block.id, { content: e.target.value });
                                                                        e.target.style.height = 'auto';
                                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                                    }}
                                                                    placeholder="Enter HTML or Text content..."
                                                                    rows={4}
                                                                />
                                                            </div>
                                                        )}

                                                        {block.type === 'cta' && (
                                                            <div className="flex justify-center py-4">
                                                                <Button 
                                                                    variant={block.props.variant === 'secondary' ? 'outline' : 'default'}
                                                                    className={cn(
                                                                        "h-12 px-8 rounded-xl font-bold gap-2",
                                                                        block.props.variant === 'glass' && "bg-white/20 backdrop-blur-md border border-white/30 text-slate-900",
                                                                        block.props.variant === 'glow' && "shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]"
                                                                    )}
                                                                >
                                                                    {block.props.label || 'Button Label'}
                                                                    <ArrowRight className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        )}

                                                        {block.type === 'form' && (
                                                            <div className="max-w-md mx-auto space-y-4 p-10 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                                                                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                                    <ClipboardList className="h-6 w-6 text-blue-600" />
                                                                </div>
                                                                <h3 className="text-lg font-bold">Embedded Form</h3>
                                                                {block.props.formId ? (
                                                                    <p className="text-xs text-slate-500">
                                                                        Linked: <span className="font-bold text-slate-900">{forms.find(f => f.id === block.props.formId)?.title || 'Selected Form'}</span>
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-xs text-amber-500 font-medium italic">No form selected</p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {block.type === 'html' && (
                                                            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700 text-slate-400 font-mono text-[9px] overflow-hidden opacity-80 relative group/html h-[120px]">
                                                                <code className="block whitespace-pre text-emerald-400/80">{block.props.html || '<!-- Write your HTML here -->'}</code>
                                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
                                                                <div className="absolute top-2 right-2 bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[8px] font-bold">CUSTOM CODE BLOCK</div>
                                                            </div>
                                                        )}

                                                        {(block.type === 'survey' || block.type === 'agreement') && (
                                                            <div className="max-w-md mx-auto space-y-4 p-10 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                                                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4", block.type === 'survey' ? "bg-indigo-100" : "bg-emerald-100")}>
                                                                    {block.type === 'survey' ? <HelpCircle className="h-6 w-6 text-indigo-600" /> : <FileCheck className="h-6 w-6 text-emerald-600" />}
                                                                </div>
                                                                <h3 className="text-lg font-bold">{block.type === 'survey' ? 'Embedded Survey' : 'Agreement Embed'}</h3>
                                                                <p className="text-xs text-slate-500 truncate">{block.props.surveyId || block.props.agreementId || 'None Selected'}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <div 
                                                    className="py-20 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-4 group/empty hover:border-primary/30 transition-all cursor-pointer" 
                                                    onClick={() => setActiveTab('add')}
                                                >
                                                    <div className="p-4 bg-slate-50 rounded-full group-hover/empty:scale-110 group-hover/empty:bg-primary/5 transition-all">
                                                        <PlusSquare className="w-8 h-8 text-slate-300 group-hover/empty:text-primary/40" />
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs font-bold text-slate-400 group-hover/empty:text-primary/60">Empty Section</p>
                                                        <p className="text-[10px] text-slate-300 mt-1">Click to add a block to this section</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-24 text-center space-y-4">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl mx-auto flex items-center justify-center border border-slate-200 border-dashed">
                                        <PlusSquare className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold">Start building your page</h3>
                                        <p className="text-xs text-slate-500 mt-1">Add sections from the sidebar or start with an empty layout.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}


