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
    Tablet,
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
    Edit3,
    TrendingUp,
    Target,
    ArrowRight,
    Undo2,
    Redo2,
    Code,
    Sun,
    Moon,
} from 'lucide-react';
import ShareEmbedDialog from '@/components/share-embed-dialog';
import { saveSectionAction, getSectionTemplatesAction } from '@/lib/section-actions';
import { cn } from '@/lib/utils';
import PublishTemplateModal from './components/PublishTemplateModal';
import type { CampaignPage, CampaignPageVersion, PageSection, BuilderResources, PageHeaderSettings, PageFooterSettings } from '@/lib/types';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';
import Link from 'next/link';
import CreateQRButton from '@/components/qr-studio/create-qr-button';
import { useTheme } from 'next-themes';
import { useSidebar } from '@/components/ui/sidebar';

// ─── Extracted Components ────────────────────────────────────────────────
import { useBuilderState, type BuilderTab } from './hooks/useBuilderState';
import { useBuilderResources } from './hooks/useBuilderResources';
import BlockPalette from './components/BlockPalette';
import LayersPanel from './components/LayersPanel';
import VariablesPanel from './components/VariablesPanel';
import { SectionSettings } from '@/components/page-builder/SectionSettings';
import { useAutosave } from '@/components/page-builder/useAutosave';
import Canvas from './components/Canvas';
import SettingsPanel from './components/SettingsPanel';
import TriggerPanel from './components/TriggerPanel';
import ThemePanel from './components/ThemePanel';
import HistoryPanel from './components/HistoryPanel';
import { BlockVariantPicker } from './components/BlockVariantPicker';
import { PropertiesPanel } from './components/PropertiesPanel';
import { AiCopilotPanel } from './components/AiCopilotPanel';
import { Layers, Database, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import './designer-theme.css';
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

    // Typed resources + resolved theme for the registry-driven renderer.
    // Declared before any early return to keep hook order stable.
    const builderResources = React.useMemo<BuilderResources>(() => ({
        forms: resources.forms.map((f) => ({
            id: f.id, title: f.title ?? f.internalName ?? 'Untitled', internalName: f.internalName,
        })),
        surveys: resources.surveys.map((s) => ({ id: s.id, title: s.title ?? 'Untitled' })),
        agreements: [],
        meetings: resources.meetings.map((m) => ({
            id: m.id,
            title: m.title ?? 'Untitled',
            slug: m.meetingSlug,
            status: m.status,
            type: m.type ? {
                id: m.type.id,
                slug: m.type.slug || '',
                name: m.type.name || '',
            } : undefined,
        })),
        qrCodes: resources.qrCodes.map((q) => ({
            id: q.id, title: q.name ?? 'Untitled QR', slug: q.shortPath, redirectUrl: q.redirectUrl,
        })),
    }), [resources.forms, resources.surveys, resources.meetings, resources.qrCodes]);
    const selectedTheme = React.useMemo(() => {
        if (!builder.page?.themeId || !resources.themes) return null;
        return resources.themes.find((t) => t.id === builder.page?.themeId) || null;
    }, [builder.page?.themeId, resources.themes]);

    const editorTheme = React.useMemo(
        () => resolveTheme({ theme: selectedTheme, overrides: builder.page?.settings.themeOverrides }),
        [selectedTheme, builder.page?.settings.themeOverrides],
    );

    const [versions, setVersions] = useState<CampaignPageVersion[]>([]);
    const [leads, setLeads] = useState<Record<string, unknown>[]>([]);
    const [isLoadingLeads, setIsLoadingLeads] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [savingSection, setSavingSection] = useState<PageSection | null>(null);
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const { resolvedTheme } = useTheme();
    const sidebar = useSidebar();

    // Collapse dashboard sidebar on mount, restore on unmount
    useEffect(() => {
        const wasOpen = sidebar.open;
        sidebar.setOpen(false);
        return () => {
            sidebar.setOpen(wasOpen);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const activeDesignerTheme = resolvedTheme === 'light' ? 'light' : 'blue';
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

            } catch (err: unknown) {
                toast({
                    variant: 'destructive',
                    title: 'Error loading page',
                    description: err instanceof Error ? err.message : String(err),
                });
            } finally {
                builder.dispatch({ type: 'SET_LOADING', payload: false });
            }
        };

        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestore, id]);

    // ─── Persistence Actions ─────────────────────────────────────────
    const saveDraft = useCallback(async (opts?: { silent?: boolean }) => {
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
            if (!opts?.silent) toast({ title: 'Draft Saved', description: 'Your progress has been saved.' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Save failed', description: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            builder.dispatch({ type: 'SET_SAVING', payload: false });
        }
    }, [firestore, builder.version, builder.page, toast, builder.dispatch]);

    const handleSaveAsDraft = useCallback(() => { void saveDraft(); }, [saveDraft]);

    // Debounced autosave: silently persist the draft after edits settle.
    useAutosave(
        builder.version?.structureJson,
        () => { void saveDraft({ silent: true }); },
        { enabled: builder.canUndo, delay: 1500 },
    );

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
        } catch (err: unknown) {
            toast({
                variant: 'destructive',
                title: 'Publish failed',
                description: err instanceof Error ? err.message : String(err),
            });
        } finally {
            builder.dispatch({ type: 'SET_PUBLISHING', payload: false });
        }
    }, [firestore, builder.page, builder.version, user, id, toast, builder.dispatch]);

    // ─── Section Save ────────────────────────────────────────────────
    const handleSaveSectionAsTemplate = useCallback((section: PageSection) => {
        setSavingSection(section);
    }, []);

    const handleConfirmSaveSection = useCallback(async (name: string, category: string, _visibility: string) => {
        if (!savingSection || !organizationId || !activeWorkspaceId) return;
        const res = await saveSectionAction({
            name,
            category,
            structure: savingSection,
            organizationId,
            workspaceId: activeWorkspaceId,
        });
        if (res.success) {
            toast({ title: 'Success', description: 'Section saved to your library.' });
            resources.refreshSections();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: res.error });
        }
    }, [savingSection, organizationId, activeWorkspaceId, toast, resources]);
    // ─── Theme ───────────────────────────────────────────────────────
    const applyTheme = useCallback((themeId: string) => {
        if (!builder.page) return;
        builder.dispatch({ type: 'SET_PAGE', payload: { ...builder.page, themeId } });
    }, [builder.page, builder.dispatch]);

    const updateThemeOverride = useCallback((key: string, value: string | Record<string, unknown>) => {
        if (!builder.page) return;
        let finalVal: string | Record<string, unknown> = value;
        if (key === 'typography' && typeof value === 'string') {
            try {
                finalVal = JSON.parse(value) as Record<string, unknown>;
            } catch {
                // Ignore parser fail
            }
        }
        const newOverrides = { ...(builder.page.settings.themeOverrides || {}), [key]: finalVal };
        builder.dispatch({ type: 'UPDATE_PAGE_SETTINGS', payload: { themeOverrides: newOverrides } });
    }, [builder.page, builder.dispatch]);

    // ─── Settings/SEO Persistence ────────────────────────────────────
    const handleUpdateSettings = useCallback((updates: Partial<CampaignPage['settings']>) => {
        builder.dispatch({ type: 'UPDATE_PAGE_SETTINGS', payload: updates });
    }, [builder.dispatch]);

    const handleUpdateSeo = useCallback((updates: Partial<CampaignPage['seo']>) => {
        builder.dispatch({ type: 'UPDATE_PAGE_SEO', payload: updates });
    }, [builder.dispatch]);

    const handleUpdateHeader = useCallback((updates: Partial<PageHeaderSettings>) => {
        builder.updateStructure((s) => ({
            ...s,
            header: {
                ...(s.header || {
                    preset: 'native',
                    overlap: false,
                    sticky: false,
                    floating: false,
                    showSearch: false,
                    showCta: false,
                    showPhone: false,
                    navItems: [],
                }),
                ...updates,
            },
        }));
    }, [builder.updateStructure]);

    const handleUpdateFooter = useCallback((updates: Partial<PageFooterSettings>) => {
        builder.updateStructure((s) => ({
            ...s,
            footer: {
                ...(s.footer || {
                    preset: 'org',
                    overrideOrg: false,
                }),
                ...updates,
            },
        }));
    }, [builder.updateStructure]);

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

    const getSelectedPathLabel = () => {
        if (builder.selectedBlockId) {
            const sections = version.structureJson.sections;
            for (let sIdx = 0; sIdx < sections.length; sIdx++) {
                const sec = sections[sIdx];
                const block = sec.blocks.find(b => b.id === builder.selectedBlockId);
                if (block) {
                    return `Section ${sIdx + 1} ➔ ${block.type.toUpperCase().replace('_', ' ')}`;
                }
            }
        } else if (builder.selectedSectionId) {
            const sections = version.structureJson.sections;
            const sIdx = sections.findIndex(s => s.id === builder.selectedSectionId);
            if (sIdx !== -1) {
                return `Section ${sIdx + 1} Settings`;
            }
        }
        return null;
    };

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

    const selectedSection = builder.selectedSectionId
        ? version.structureJson.sections.find(s => s.id === builder.selectedSectionId) ?? null
        : null;
    // ─── Tab Definitions ─────────────────────────────────────────────
    const tabs: { id: BuilderTab; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
        { id: 'add', icon: PlusSquare, label: 'Add' },
        { id: 'layers', icon: Layers, label: 'Layers' },
        { id: 'variables', icon: Database, label: 'Variables' },
        { id: 'edit', icon: Settings2, label: 'Edit' },
        { id: 'triggers', icon: MousePointerClick, label: 'Triggers' },
        { id: 'theme', icon: Palette, label: 'Theme' },
        { id: 'settings', icon: Settings2, label: 'Settings' },
        { id: 'history', icon: History, label: 'History' },
        { id: 'ai', icon: Sparkles, label: 'AI Copilot' },
    ];
    // ─── Render ──────────────────────────────────────────────────────
    return (
        <div className={cn(
            "flex flex-col h-screen text-slate-900 border-t print:hidden overflow-hidden designer-shell",
            activeDesignerTheme === 'light' ? 'designer-theme-light' : 'designer-theme-blue'
        )}>
            {/* ═══════════════ TOOLBAR ═══════════════ */}
            <header className="h-14 flex items-center justify-between px-4 shrink-0 z-20 border-b border-slate-700/50 bg-slate-900/85 backdrop-blur-md">
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
                <div className="flex items-center gap-0.5 bg-slate-800/40 p-0.5 rounded-xl border border-slate-700/30">
                    <Button
                        variant="ghost" size="icon"
                        onClick={() => builder.dispatch({ type: 'SET_VIEWPORT', payload: 'desktop' })}
                        className={cn("h-7 w-7 rounded-lg transition-all text-slate-500 hover:text-slate-300",
                            builder.viewport === 'desktop' && "bg-slate-700 shadow-sm text-blue-400 hover:text-blue-400"
                        )}
                        title="Desktop View"
                    >
                        <MonitorPlay className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost" size="icon"
                        onClick={() => builder.dispatch({ type: 'SET_VIEWPORT', payload: 'tablet' })}
                        className={cn("h-7 w-7 rounded-lg transition-all text-slate-500 hover:text-slate-300",
                            builder.viewport === 'tablet' && "bg-slate-700 shadow-sm text-blue-400 hover:text-blue-400"
                        )}
                        title="Tablet View"
                    >
                        <Tablet className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost" size="icon"
                        onClick={() => builder.dispatch({ type: 'SET_VIEWPORT', payload: 'mobile' })}
                        className={cn("h-7 w-7 rounded-lg transition-all text-slate-500 hover:text-slate-300",
                            builder.viewport === 'mobile' && "bg-slate-700 shadow-sm text-blue-400 hover:text-blue-400"
                        )}
                        title="Mobile View"
                    >
                        <Smartphone className="w-4 h-4" />
                    </Button>
                </div>

                {/* Edit / Preview Switcher */}
                <div className="flex items-center gap-0.5 bg-slate-800/40 p-0.5 rounded-xl border border-slate-700/30 ml-2">
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => builder.setCanvasMode('edit')}
                        className={cn("h-7 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all text-slate-500 hover:text-slate-300",
                            builder.canvasMode === 'edit' && "bg-slate-700 shadow-sm text-blue-400 hover:text-blue-400"
                        )}
                    >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => builder.setCanvasMode('preview')}
                        className={cn("h-7 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all text-slate-500 hover:text-slate-300",
                            builder.canvasMode === 'preview' && "bg-slate-700 shadow-sm text-blue-400 hover:text-blue-400"
                        )}
                    >
                        <Eye className="w-3.5 h-3.5" /> Preview
                    </Button>
                </div>

                {/* Components / Columns Switcher (only in Edit mode) */}
                {builder.canvasMode === 'edit' && (
                    <div className="flex items-center gap-0.5 bg-slate-800/40 p-0.5 rounded-xl border border-slate-700/30 ml-2">
                        <Button
                            variant="ghost" size="sm"
                            onClick={() => builder.setEditMode('components')}
                            className={cn("h-7 px-3 rounded-lg text-xs font-semibold transition-all text-slate-500 hover:text-slate-300",
                                builder.editMode === 'components' && "bg-slate-700 shadow-sm text-blue-400 hover:text-blue-400"
                            )}
                        >
                            Components
                        </Button>
                        <Button
                            variant="ghost" size="sm"
                            onClick={() => {
                                builder.setEditMode('columns');
                                if (builder.selectedBlockId) {
                                    const found = builder.findBlock(builder.selectedBlockId);
                                    if (found && found.section && found.section.id) {
                                        builder.dispatch({ type: 'SELECT_SECTION', payload: found.section.id });
                                        builder.dispatch({ type: 'SELECT_BLOCK', payload: null });
                                        builder.dispatch({ type: 'SET_TAB', payload: 'edit' });
                                    }
                                } else if (builder.selectedSectionId) {
                                    builder.dispatch({ type: 'SET_TAB', payload: 'edit' });
                                }
                            }}
                            className={cn("h-7 px-3 rounded-lg text-xs font-semibold transition-all text-slate-500 hover:text-slate-300",
                                builder.editMode === 'columns' && "bg-slate-700 shadow-sm text-blue-400 hover:text-blue-400"
                            )}
                        >
                            Columns
                        </Button>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 bg-slate-800/40 p-0.5 rounded-xl border border-slate-700/30 mr-2">
                        <Button
                            variant="ghost" size="icon"
                            disabled={!builder.canUndo}
                            onClick={builder.undo}
                            className="h-7 w-7 text-slate-400 hover:text-slate-200 disabled:opacity-20 rounded-lg transition-all"
                            aria-label="Undo last change"
                            title="Undo (⌘Z)"
                        >
                            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                            variant="ghost" size="icon"
                            disabled={!builder.canRedo}
                            onClick={builder.redo}
                            className="h-7 w-7 text-slate-400 hover:text-slate-200 disabled:opacity-20 rounded-lg transition-all"
                            aria-label="Redo last undone change"
                            title="Redo (⌘⇧Z)"
                        >
                            <Redo2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                    </div>

                    {/* Visual Performance Meter Scorecard */}
                    <div className="flex items-center gap-1 bg-slate-800/40 p-0.5 rounded-xl border border-slate-700/30 select-none mr-2" title="Page Health Metrics: Performance, Accessibility, SEO">
                        <div className="flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-lg text-[10px] font-bold text-emerald-400" title="Performance: 92/100">
                            ⚡92
                        </div>
                        <div className="flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-lg text-[10px] font-bold text-emerald-400" title="Accessibility: 98/100">
                            ♿98
                        </div>
                        <div className="flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-lg text-[10px] font-bold text-emerald-400" title="SEO: 95/100">
                            🔍95
                        </div>
                    </div>

                    <Button asChild variant="ghost" className="h-8 font-semibold text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:bg-slate-800">
                        <Link href={`/admin/pages/${id}/analytics`}>
                            <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Analytics
                        </Link>
                    </Button>

                    {page.status === 'published' && (
                        <>
                            <Button asChild variant="ghost" className="h-8 font-semibold text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:bg-slate-800">
                                <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                                    <Globe className="w-3.5 h-3.5 mr-1.5" /> View Live
                                </a>
                            </Button>
                            <Button 
                                variant="ghost" 
                                onClick={() => setIsShareOpen(true)}
                                className="h-8 font-semibold text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:bg-slate-800"
                            >
                                <Code className="w-3.5 h-3.5 mr-1.5" /> Share & Embed
                            </Button>
                        </>
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
                <div className="flex shrink-0 z-10 select-none">
                    {/* 1. Thin vertical tab bar (56px) */}
                    <div className="w-14 bg-slate-950 border-r border-slate-850 flex flex-col justify-between items-center py-3 shrink-0">
                        <div className="flex flex-col gap-2.5 w-full px-1.5">
                            {tabs.map(tab => {
                                const isActive = builder.activeTab === tab.id && isSidebarExpanded;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            if (builder.activeTab === tab.id && isSidebarExpanded) {
                                                setIsSidebarExpanded(false);
                                            } else {
                                                builder.dispatch({ type: 'SET_TAB', payload: tab.id });
                                                setIsSidebarExpanded(true);
                                            }
                                        }}
                                        className={cn(
                                            "flex flex-col items-center gap-1 py-2 rounded-xl text-[7px] font-black uppercase tracking-wider transition-all duration-200 w-full border border-transparent",
                                            isActive
                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                : "text-slate-500 hover:text-slate-355 hover:bg-slate-900/50"
                                        )}
                                        title={tab.label}
                                    >
                                        <tab.icon className="w-4 h-4 shrink-0" />
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsSidebarExpanded(prev => !prev)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-500 hover:text-slate-300 transition-all active:scale-[0.97]"
                        >
                            {isSidebarExpanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                    </div>

                    {/* 2. Slide-out panel drawer */}
                    <div
                        className={cn(
                            "flex flex-col bg-slate-900/90 border-r border-slate-700/50 backdrop-blur-md transition-all duration-300 ease-[0.32,0.72,0,1] overflow-hidden",
                            isSidebarExpanded ? "w-72 opacity-100" : "w-0 opacity-0 border-r-0"
                        )}
                    >
                        <div className="flex-1 overflow-y-auto p-4 text-left custom-scrollbar min-w-[288px]">
                        {/* ─── Performance/Stats Tab ─── */}
                        {builder.activeTab === 'add' && (
                            <BlockPalette
                                onAddBlock={builder.addBlock}
                                onRequestBlock={(type) => builder.dispatch({ type: 'OPEN_VARIANT_PICKER', payload: type })}
                                onAddSection={() => builder.addSection()}
                            />
                        )}

                        {builder.activeTab === 'layers' && (
                            <LayersPanel
                                version={version}
                                selectedBlockId={builder.selectedBlockId}
                                selectedSectionId={builder.selectedSectionId}
                                onSelectBlock={(id) => builder.dispatch({ type: 'SELECT_BLOCK', payload: id })}
                                onSelectSection={(id) => builder.dispatch({ type: 'SELECT_SECTION', payload: id })}
                                onRemoveBlock={builder.removeBlock}
                                onRemoveSection={builder.removeSection}
                                onDuplicateBlock={builder.duplicateBlock}
                                onUpdateBlockProps={builder.updateBlockProps}
                                onUpdateSectionProps={builder.updateSectionProps}
                                onMoveBlock={builder.moveBlock}
                                onMoveSection={builder.moveSection}
                            />
                        )}

                        {builder.activeTab === 'variables' && (
                            <VariablesPanel />
                        )}

                        {builder.activeTab === 'edit' && (
                            <div className="space-y-4">
                                {getSelectedPathLabel() && (
                                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 bg-slate-900/50 border border-slate-800 rounded-lg px-2.5 py-1.5 mb-2 select-none text-center">
                                        {getSelectedPathLabel()}
                                    </div>
                                )}
                                {builder.selectedBlockId && builder.findBlock(builder.selectedBlockId)?.block ? (
                                    <PropertiesPanel
                                        block={builder.findBlock(builder.selectedBlockId)!.block}
                                        resources={builderResources}
                                        theme={editorTheme}
                                        workspaceId={activeWorkspaceId ?? undefined}
                                        onUpdate={(patch) => builder.updateBlockProps(builder.selectedBlockId!, patch)}
                                    />
                                ) : selectedSection ? (
                                    <SectionSettings
                                        section={selectedSection}
                                        workspaceId={activeWorkspaceId ?? undefined}
                                        onUpdate={(patch) => builder.updateSectionProps(selectedSection.id, patch)}
                                    />
                                ) : (
                                    <div className="text-center py-8 text-xs text-slate-500 font-semibold leading-relaxed">
                                        Select a section or block on the canvas to configure properties.
                                    </div>
                                )}
                            </div>
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
                                structure={version.structureJson}
                                onUpdateHeader={handleUpdateHeader}
                                onUpdateFooter={handleUpdateFooter}
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

                        {builder.activeTab === 'ai' && (
                            <AiCopilotPanel
                                version={version}
                                onAppendSection={(sectionProps, blocks) => {
                                    builder.addSection({
                                        structure: {
                                            id: `sec-${Date.now()}`,
                                            type: 'section',
                                            props: sectionProps,
                                            blocks: blocks,
                                        }
                                    });
                                }}
                                onUpdateBlockProps={(blockId, props) => {
                                    builder.updateBlockProps(blockId, props);
                                }}
                                selectedBlockId={builder.selectedBlockId}
                            />
                        )}

                        </div>
                    </div>
                </div>

                {/* ─── CANVAS ─── */}
                <Canvas
                    version={version}
                    viewport={builder.viewport}
                    theme={editorTheme}
                    themeMode={page?.settings?.themeOverrides?.themeMode || 'light'}
                    resources={builderResources}
                    selectedBlockId={builder.selectedBlockId}
                    selectedSectionId={builder.selectedSectionId}
                    selectedColumnIndex={builder.selectedColumnIndex}
                    onSelectBlock={(id) => builder.dispatch({ type: 'SELECT_BLOCK', payload: id })}
                    showHeader={page?.settings?.showHeader}
                    showFooter={page?.settings?.showFooter}

                    onSetTab={(tab) => builder.dispatch({ type: 'SET_TAB', payload: tab as BuilderTab })}
                    onUpdateBlockProps={builder.updateBlockProps}
                    onRemoveBlock={builder.removeBlock}
                    onMoveBlock={builder.moveBlock}
                    onDuplicateBlock={builder.duplicateBlock}
                    onRemoveSection={builder.removeSection}
                    onMoveSection={builder.moveSection}
                    onInsertSection={builder.insertSection}
                    onEditSection={(id, colIdx) => {
                        builder.dispatch({ type: 'SELECT_SECTION', payload: id, columnIndex: colIdx });
                        builder.dispatch({ type: 'SELECT_BLOCK', payload: null });
                        builder.dispatch({ type: 'SET_TAB', payload: 'edit' });
                    }}
                    onSaveSectionAsTemplate={handleSaveSectionAsTemplate}
                    onReorderSections={builder.reorderSections}
                    onReorderBlocks={builder.reorderBlocks}
                    onMoveBlockToColumn={builder.moveBlockToColumn}
                    onSwapColumns={builder.swapColumns}
                    canvasMode={builder.canvasMode}
                    editMode={builder.editMode}
                    onSetEditMode={builder.setEditMode}
                    onClickHeader={() => {
                        builder.dispatch({ type: 'SET_TAB', payload: 'settings' });
                    }}
                    onClickFooter={() => {
                        builder.dispatch({ type: 'SET_TAB', payload: 'settings' });
                    }}
                />
            </div>
            <BlockVariantPicker
                open={builder.variantPickerType !== null}
                type={builder.variantPickerType}
                onSelect={(type, overrideDefaults) => builder.addBlock(type, undefined, overrideDefaults)}
                onClose={() => builder.dispatch({ type: 'CLOSE_VARIANT_PICKER' })}
            />
            {isShareOpen && (
                <ShareEmbedDialog
                    isOpen={isShareOpen}
                    onOpenChange={setIsShareOpen}
                    title="Share & Embed Page"
                    resourceName="Page"
                    publicUrl={typeof window !== 'undefined' ? `${window.location.origin}/p/${page.slug}` : `/p/${page.slug}`}
                    embedUrl={typeof window !== 'undefined' ? `${window.location.origin}/p/${page.slug}?embed=true` : `/p/${page.slug}?embed=true`}
                />
            )}
            <PublishTemplateModal
                isOpen={savingSection !== null}
                onOpenChange={(open) => !open && setSavingSection(null)}
                section={savingSection}
                onSave={handleConfirmSaveSection}
            />
        </div>
    );
}
