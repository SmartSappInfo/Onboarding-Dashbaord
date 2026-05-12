'use client';

import * as React from 'react';
import { use, useState, useEffect, useCallback } from 'react';
import { collection, query, doc, getDoc, updateDoc, setDoc, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import {
    ArrowLeft,
    Loader2,
    MonitorPlay,
    Smartphone,
    Globe,
    Save,
    Send,
    PlusSquare,
    Settings2,
    MousePointerClick,
    Palette,
    History,
    Eye,
    TrendingUp,
    Target,
    ArrowRight,
    Undo2,
    Redo2,
} from 'lucide-react';
import { saveSectionAction, getSectionTemplatesAction } from '@/lib/section-actions';
import { cn } from '@/lib/utils';
import type { CampaignPage, CampaignPageVersion, PageSection } from '@/lib/types';
import Link from 'next/link';
import CreateQRButton from '@/components/qr-studio/create-qr-button';

// ─── Extracted Components ────────────────────────────────────────────────
import { useBuilderState, type BuilderTab } from './hooks/useBuilderState';
import { useBuilderResources } from './hooks/useBuilderResources';
import BlockPalette from './components/BlockPalette';
import BlockEditor from './components/BlockEditor';
import Canvas from './components/Canvas';
import SettingsPanel from './components/SettingsPanel';
import TriggerPanel from './components/TriggerPanel';
import ThemePanel from './components/ThemePanel';
import HistoryPanel from './components/HistoryPanel';

export default function BuilderClient({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useUser();
    const { activeWorkspaceId, activeOrganizationId: organizationId } = useTenant();

    // ─── State Management ────────────────────────────────────────────
    const builder = useBuilderState();
    const resources = useBuilderResources();

    const [versions, setVersions] = useState<CampaignPageVersion[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [isLoadingLeads, setIsLoadingLeads] = useState(false);

    // ─── Data Loading ────────────────────────────────────────────────
    useEffect(() => {
        if (!firestore) return;

        const loadData = async () => {
            try {
                // Fetch Page
                const pageSnap = await getDoc(doc(firestore, 'campaign_pages', id));
                if (!pageSnap.exists()) throw new Error('Page not found');
                const pageData = pageSnap.data() as CampaignPage;
                builder.dispatch({ type: 'SET_PAGE', payload: pageData });

                // Fetch latest drafting version
                const vQuery = query(
                    collection(firestore, 'campaign_page_versions'),
                    where('pageId', '==', id),
                    orderBy('versionNumber', 'desc'),
                    limit(1)
                );
                const vSnap = await getDocs(vQuery);
                if (!vSnap.empty) {
                    builder.dispatch({ type: 'SET_VERSION', payload: vSnap.docs[0].data() as CampaignPageVersion });
                } else {
                    throw new Error('No structure found for this page.');
                }

                // Fetch all versions for history
                const allVQuery = query(
                    collection(firestore, 'campaign_page_versions'),
                    where('pageId', '==', id),
                    orderBy('versionNumber', 'desc')
                );
                const allVSnap = await getDocs(allVQuery);
                setVersions(allVSnap.docs.map(d => d.data() as CampaignPageVersion));

            } catch (err: any) {
                toast({ variant: 'destructive', title: 'Error loading page', description: err.message });
            } finally {
                builder.dispatch({ type: 'SET_LOADING', payload: false });
            }
        };

        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestore, id]);

    // ─── Persistence Actions ─────────────────────────────────────────
    const handleSaveAsDraft = useCallback(async () => {
        if (!firestore || !builder.version) return;
        builder.dispatch({ type: 'SET_SAVING', payload: true });
        try {
            await updateDoc(doc(firestore, 'campaign_page_versions', builder.version.id), {
                structureJson: builder.version.structureJson,
                updatedAt: new Date().toISOString()
            });
            // Also persist page settings
            if (builder.page) {
                await updateDoc(doc(firestore, 'campaign_pages', builder.page.id), {
                    settings: builder.page.settings,
                    seo: builder.page.seo,
                    themeId: builder.page.themeId,
                    updatedAt: new Date().toISOString()
                });
            }
            toast({ title: 'Draft Saved', description: 'Your progress has been saved.' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Save failed', description: err.message });
        } finally {
            builder.dispatch({ type: 'SET_SAVING', payload: false });
        }
    }, [firestore, builder.version, builder.page, toast, builder.dispatch]);

    const handlePublish = useCallback(async () => {
        if (!firestore || !builder.page || !builder.version || !user) return;
        builder.dispatch({ type: 'SET_PUBLISHING', payload: true });
        try {
            const timestamp = new Date().toISOString();
            const newVersionNum = builder.version.versionNumber + 1;
            const newVersionId = doc(collection(firestore, 'campaign_page_versions')).id;

            const publishedVersion: CampaignPageVersion = {
                id: newVersionId,
                pageId: id,
                organizationId: builder.page.organizationId,
                versionNumber: newVersionNum,
                structureJson: builder.version.structureJson,
                createdBy: user.uid,
                createdAt: timestamp,
                isPublishedVersion: true
            };

            await setDoc(doc(firestore, 'campaign_page_versions', newVersionId), publishedVersion);
            await updateDoc(doc(firestore, 'campaign_pages', id), {
                status: 'published',
                publishedVersionId: newVersionId,
                settings: builder.page.settings,
                seo: builder.page.seo,
                themeId: builder.page.themeId,
                updatedAt: timestamp
            });

            builder.dispatch({ type: 'SET_PAGE', payload: { ...builder.page, status: 'published', publishedVersionId: newVersionId } });
            toast({ title: 'Page Published!', description: 'The page is now live and public.' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Publish failed', description: err.message });
        } finally {
            builder.dispatch({ type: 'SET_PUBLISHING', payload: false });
        }
    }, [firestore, builder.page, builder.version, user, id, toast, builder.dispatch]);

    // ─── Section Save ────────────────────────────────────────────────
    const handleSaveSectionAsTemplate = useCallback(async (section: PageSection) => {
        if (!organizationId || !activeWorkspaceId) return;
        const name = prompt('Enter a name for this section template:');
        if (!name) return;
        const res = await saveSectionAction({ name, category: 'Custom', structure: section, organizationId, workspaceId: activeWorkspaceId });
        if (res.success) {
            toast({ title: 'Success', description: 'Section saved to your library.' });
            resources.refreshSections();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: res.error });
        }
    }, [organizationId, activeWorkspaceId, toast, resources]);

    // ─── Theme ───────────────────────────────────────────────────────
    const applyTheme = useCallback((themeId: string) => {
        if (!builder.page) return;
        builder.dispatch({ type: 'SET_PAGE', payload: { ...builder.page, themeId } });
    }, [builder.page, builder.dispatch]);

    const updateThemeOverride = useCallback((key: string, value: string) => {
        if (!builder.page) return;
        const newOverrides = { ...(builder.page.settings.themeOverrides || {}), [key]: value };
        builder.dispatch({ type: 'UPDATE_PAGE_SETTINGS', payload: { themeOverrides: newOverrides } });
    }, [builder.page, builder.dispatch]);

    // ─── Settings/SEO Persistence ────────────────────────────────────
    const handleUpdateSettings = useCallback((updates: Partial<CampaignPage['settings']>) => {
        builder.dispatch({ type: 'UPDATE_PAGE_SETTINGS', payload: updates });
    }, [builder.dispatch]);

    const handleUpdateSeo = useCallback((updates: Partial<CampaignPage['seo']>) => {
        builder.dispatch({ type: 'UPDATE_PAGE_SEO', payload: updates });
    }, [builder.dispatch]);

    // ─── Keyboard shortcut for save ──────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSaveAsDraft();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleSaveAsDraft]);

    // ─── Loading / Error States ──────────────────────────────────────
    if (builder.loading) {
        return (
            <div className="h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-400 relative" />
                    </div>
                    <p className="text-sm font-medium text-slate-400">Loading builder...</p>
                </div>
            </div>
        );
    }

    if (!builder.page || !builder.version) {
        return (
            <div className="h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
                <p className="text-slate-400">Error: Page data incomplete</p>
            </div>
        );
    }

    const { page, version } = builder;

    // ─── Tab Definitions ─────────────────────────────────────────────
    const tabs: { id: BuilderTab; icon: any; label: string }[] = [
        { id: 'add', icon: PlusSquare, label: 'Add' },
        { id: 'edit', icon: Settings2, label: 'Edit' },
        { id: 'triggers', icon: MousePointerClick, label: 'Triggers' },
        { id: 'theme', icon: Palette, label: 'Theme' },
        { id: 'settings', icon: Settings2, label: 'Settings' },
        { id: 'history', icon: History, label: 'History' },
    ];

    // ─── Render ──────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen text-slate-900 border-t print:hidden overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>

            {/* ═══════════════ TOOLBAR ═══════════════ */}
            <header className="h-14 flex items-center justify-between px-4 shrink-0 z-20 border-b border-slate-700/50" style={{ background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
                        <Link href="/admin/pages"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold tracking-tight text-slate-100">{page.name}</span>
                        <span className="text-[10px] text-slate-500 font-medium">/{page.slug}</span>
                    </div>
                    {page.status === 'published' && (
                        <div className="ml-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[9px] font-bold uppercase tracking-wider border border-emerald-500/20">
                            Live
                        </div>
                    )}
                </div>

                {/* Viewport Toggle */}
                <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => builder.dispatch({ type: 'SET_VIEWPORT', payload: 'desktop' })}
                        className={cn("h-7 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all",
                            builder.viewport === 'desktop' ? "bg-slate-700 shadow-sm text-emerald-400" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <MonitorPlay className="w-3.5 h-3.5" /> Desktop
                    </Button>
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => builder.dispatch({ type: 'SET_VIEWPORT', payload: 'mobile' })}
                        className={cn("h-7 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all",
                            builder.viewport === 'mobile' ? "bg-slate-700 shadow-sm text-emerald-400" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <Smartphone className="w-3.5 h-3.5" /> Mobile
                    </Button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {/* Undo/Redo */}
                    <div className="flex items-center gap-0.5 mr-2 border-r border-slate-700/50 pr-3">
                        <Button
                            variant="ghost" size="icon"
                            disabled={!builder.canUndo}
                            onClick={builder.undo}
                            className="h-7 w-7 text-slate-400 hover:text-slate-200 disabled:opacity-20 rounded-lg"
                            title="Undo (⌘Z)"
                        >
                            <Undo2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="ghost" size="icon"
                            disabled={!builder.canRedo}
                            onClick={builder.redo}
                            className="h-7 w-7 text-slate-400 hover:text-slate-200 disabled:opacity-20 rounded-lg"
                            title="Redo (⌘⇧Z)"
                        >
                            <Redo2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    {page.status === 'published' && (
                        <Button asChild variant="ghost" className="h-8 font-semibold text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:bg-slate-800">
                            <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                                <Globe className="w-3.5 h-3.5 mr-1.5" /> View Live
                            </a>
                        </Button>
                    )}
                    <CreateQRButton
                        resourceType="landing_page"
                        resourceId={id}
                        resourceName={page.name}
                        destinationUrl={typeof window !== 'undefined' ? `${window.location.origin}/p/${page.slug}` : `/p/${page.slug}`}
                        variant="icon"
                    />
                    <Button
                        variant="outline"
                        disabled={builder.saving}
                        onClick={handleSaveAsDraft}
                        className="h-8 font-semibold text-xs min-w-[90px] bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                    >
                        {builder.saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                        Save
                    </Button>
                    <Button
                        onClick={handlePublish}
                        disabled={builder.publishing}
                        className="h-8 font-bold text-xs min-w-[90px] bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    >
                        {builder.publishing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                        Publish
                    </Button>
                </div>
            </header>

            {/* ═══════════════ BODY ═══════════════ */}
            <div className="flex flex-1 overflow-hidden">

                {/* ─── SIDEBAR ─── */}
                <aside className="w-80 flex flex-col shrink-0 z-10 border-r border-slate-700/50" style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)' }}>
                    {/* Sidebar Tabs */}
                    <div className="grid grid-cols-6 gap-0.5 p-2 border-b border-slate-700/50">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => builder.dispatch({ type: 'SET_TAB', payload: tab.id })}
                                className={cn(
                                    "flex flex-col items-center gap-1 py-2 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all duration-200",
                                    builder.activeTab === tab.id
                                        ? "bg-emerald-500/10 text-emerald-400 shadow-sm shadow-emerald-500/5"
                                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Sidebar Content */}
                    <div className="flex-1 overflow-y-auto p-4 text-left custom-scrollbar">
                        {/* ─── Performance/Stats Tab ─── */}
                        {builder.activeTab === 'add' && (
                            <BlockPalette
                                onAddBlock={builder.addBlock}
                                onAddSection={() => builder.addSection()}
                            />
                        )}

                        {builder.activeTab === 'edit' && (
                            <BlockEditor
                                block={builder.selectedBlockId ? builder.findBlock(builder.selectedBlockId)?.block ?? null : null}
                                sectionId={builder.selectedBlockId ? builder.findBlock(builder.selectedBlockId)?.section.id ?? null : null}
                                onUpdateProps={builder.updateBlockProps}
                                forms={resources.forms}
                                surveys={resources.surveys}
                            />
                        )}

                        {builder.activeTab === 'triggers' && (
                            <TriggerPanel
                                triggers={page.settings.triggers || []}
                                version={version}
                                automations={resources.automations}
                                surveys={resources.surveys}
                                forms={resources.forms}
                                loadingResources={resources.loadingResources}
                                onAddTrigger={builder.addTrigger}
                                onUpdateTrigger={builder.updateTrigger}
                                onRemoveTrigger={builder.removeTrigger}
                                onAddAction={builder.addActionToTrigger}
                                onUpdateAction={builder.updateAction}
                                onRemoveAction={builder.removeAction}
                            />
                        )}

                        {builder.activeTab === 'theme' && (
                            <ThemePanel
                                page={page}
                                themes={resources.themes}
                                onApplyTheme={applyTheme}
                                onUpdateOverride={updateThemeOverride}
                            />
                        )}

                        {builder.activeTab === 'settings' && (
                            <SettingsPanel
                                page={page}
                                onUpdateSettings={handleUpdateSettings}
                                onUpdateSeo={handleUpdateSeo}
                            />
                        )}

                        {builder.activeTab === 'history' && (
                            <HistoryPanel
                                versions={versions}
                                currentVersionId={version.id}
                                savedSections={resources.savedSections}
                                isRestoring={builder.isRestoring}
                                onRestoreVersion={(v) => {
                                    builder.dispatch({ type: 'RESTORE_VERSION', payload: v });
                                    toast({ title: 'Version Restored', description: 'Save Draft to persist.' });
                                }}
                                onAddSectionFromTemplate={(template) => {
                                    builder.addSection(template);
                                    toast({ title: 'Section Added', description: 'Template added to page.' });
                                }}
                            />
                        )}
                    </div>
                </aside>

                {/* ─── CANVAS ─── */}
                <Canvas
                    version={version}
                    viewport={builder.viewport}
                    selectedBlockId={builder.selectedBlockId}
                    onSelectBlock={(id) => builder.dispatch({ type: 'SELECT_BLOCK', payload: id })}
                    onSetTab={(tab) => builder.dispatch({ type: 'SET_TAB', payload: tab as BuilderTab })}
                    onUpdateBlockProps={builder.updateBlockProps}
                    onRemoveBlock={builder.removeBlock}
                    onMoveBlock={builder.moveBlock}
                    onDuplicateBlock={builder.duplicateBlock}
                    onRemoveSection={builder.removeSection}
                    onMoveSection={builder.moveSection}
                    onSaveSectionAsTemplate={handleSaveSectionAsTemplate}
                    onReorderSections={builder.reorderSections}
                    onReorderBlocks={builder.reorderBlocks}
                />
            </div>
        </div>
    );
}
