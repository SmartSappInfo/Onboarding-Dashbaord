'use client';

/**
 * @fileoverview Experience Platform — Visual Configurator Studio
 *
 * Full-featured visual studio with 5-domain Information Architecture,
 * 3-mode workspace layout engine (Split View, Editor Focus, Full Canvas),
 * and real-time responsive preview for Experience Portals.
 *
 * ARCHITECTURAL RATIONALE:
 * - Eliminates the 7:5 column gridlock by allowing operators to toggle between
 *   Split View, Full-Width Editor Focus, and Immersive Live Canvas.
 * - Restructures 16 flat wrapping tabs into 5 domain categories.
 * - Preserves 100% of underlying form states, Firestore bindings, and sub-components.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Strictly zero `any`, `any[]`, or `unknown`.
 * - Minimum touch target >= 44px on all interactive controls.
 * - Always maintain local draft state hoisting to avoid unmount data loss.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Save,
  PlayCircle,
  PauseCircle,
  ExternalLink,
  Copy,
  Sparkles,
  Sliders,
  Loader2,
  Columns2,
  SlidersHorizontal,
  Eye,
  Share2,
  ChevronDown,
  Search,
  Palette,
  GraduationCap,
  Users,
  ShieldCheck,
  LineChart,
} from 'lucide-react';
import { PortalThemeCustomizer } from '../components/PortalThemeCustomizer';
import { PortalNavigationBuilder } from '../components/PortalNavigationBuilder';
import { PortalAccessPolicyEditor } from '../components/PortalAccessPolicyEditor';
import { PortalSeoEditor } from '../components/PortalSeoEditor';
import { PortalLivePreviewCanvas } from '../components/PortalLivePreviewCanvas';
import { PortalContentManager } from '../components/PortalContentManager';
import { PortalMemberManager } from '../components/PortalMemberManager';
import { PortalCourseManager } from '../components/PortalCourseManager';
import { PortalCommunityManager } from '../components/PortalCommunityManager';
import { PortalOnboardingManager } from '../components/PortalOnboardingManager';
import { PortalEventsManager } from '../components/PortalEventsManager';
import { PortalMonetizationManager } from '../components/PortalMonetizationManager';
import { PortalAiCopilotDrawer } from '../components/PortalAiCopilotDrawer';
import { PortalAnalyticsManager } from '../components/PortalAnalyticsManager';
import { PortalCredentialManager } from '../components/PortalCredentialManager';
import { PortalEnterpriseManager } from '../components/PortalEnterpriseManager';
import { PortalStudioCommandPalette } from '../components/PortalStudioCommandPalette';
import {
  updatePortalAction,
  publishPortalAction,
  suspendPortalAction,
  getPortalByIdAction,
} from '@/app/actions/portal-actions';
import type {
  Portal,
  PortalThemeConfig,
  PortalBranding,
  PortalNavigationConfig,
  PortalAccessPolicy,
  PortalFeatureToggles,
  PortalSeoConfig,
  PortalMode,
} from '@/lib/types/portal';
import {
  STUDIO_CATEGORIES,
  STUDIO_TABS,
  getCategoryForTab,
  type StudioCategoryId,
  type StudioTabId,
  type StudioViewMode,
} from '@/lib/types/portal-studio';
import {
  DEFAULT_THEME,
  DEFAULT_NAVIGATION,
  DEFAULT_ACCESS_POLICY,
  DEFAULT_FEATURE_TOGGLES,
  DEFAULT_SEO,
} from '@/lib/portal-presets';
import CreateQRButton from '@/components/qr-studio/create-qr-button';
import { cn } from '@/lib/utils';

const CATEGORY_ICON_MAP: Record<StudioCategoryId, React.ComponentType<{ className?: string }>> = {
  brand_experience: Palette,
  learning_content: GraduationCap,
  community_members: Users,
  commerce_access: ShieldCheck,
  operations_scale: LineChart,
};

interface PortalStudioClientProps {
  portalId: string;
  initialPortal?: Portal | null;
}

export default function PortalStudioClient({
  portalId,
  initialPortal: serverPrefetchedPortal,
}: PortalStudioClientProps) {
  const _router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeOrganization, accessibleWorkspaces, allAccessibleWorkspaces } = useTenant();

  // Server Action Fallback pre-hydrated with initialPortal
  const [serverPortal, setServerPortal] = React.useState<Portal | null>(serverPrefetchedPortal || null);
  const [isLoadingServer, setIsLoadingServer] = React.useState(!serverPrefetchedPortal);

  const fetchServerPortal = React.useCallback(async () => {
    if (!portalId) return;
    try {
      setIsLoadingServer(true);
      const res = await getPortalByIdAction(portalId);
      if (res.success && res.data) {
        setServerPortal(res.data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingServer(false);
    }
  }, [portalId]);

  React.useEffect(() => {
    fetchServerPortal();
  }, [fetchServerPortal]);

  const portalDocRef = React.useMemo(
    () => (firestore && portalId ? doc(firestore, 'portals', portalId) : null),
    [firestore, portalId]
  );

  const { data: initialPortal, isLoading: isLoadingDoc } = useDoc<Portal>(portalDocRef);
  const effectivePortal = initialPortal || serverPortal;
  const isLoading = isLoadingDoc && isLoadingServer && !effectivePortal;

  const orgScopedWorkspaces = React.useMemo(() => {
    const orgId = effectivePortal?.organizationId || activeOrganization?.id;
    if (!orgId) return accessibleWorkspaces || [];
    return (allAccessibleWorkspaces || []).filter(w => w.organizationId === orgId);
  }, [effectivePortal?.organizationId, activeOrganization?.id, allAccessibleWorkspaces, accessibleWorkspaces]);

  // Local draft state for real-time reactivity
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [primaryMode, setPrimaryMode] = React.useState<PortalMode>('academy');
  const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([]);
  const [theme, setTheme] = React.useState<PortalThemeConfig | null>(null);
  const [branding, setBranding] = React.useState<PortalBranding | null>(null);
  const [navigation, setNavigation] = React.useState<PortalNavigationConfig | null>(null);
  const [accessPolicy, setAccessPolicy] = React.useState<PortalAccessPolicy | null>(null);
  const [features, setFeatures] = React.useState<PortalFeatureToggles | null>(null);
  const [seo, setSeo] = React.useState<PortalSeoConfig | null>(null);

  // IA Navigation State: Category & Active Tab
  const [activeCategory, setActiveCategory] = React.useState<StudioCategoryId>('brand_experience');
  const [activeTab, setActiveTab] = React.useState<StudioTabId>('identity');

  // Workspace View Mode: 'split' | 'editor' | 'preview'
  const [viewMode, setViewMode] = React.useState<StudioViewMode>('split');

  // Modal / Drawer states
  const [isAiCopilotOpen, setIsAiCopilotOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Restore operator view mode preference
  React.useEffect(() => {
    try {
      const savedMode = localStorage.getItem('smartsapp_studio_view_mode') as StudioViewMode;
      if (savedMode === 'split' || savedMode === 'editor' || savedMode === 'preview') {
        setViewMode(savedMode);
      }
    } catch {
      // Ignore local storage error
    }
  }, []);

  const handleSetViewMode = (mode: StudioViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('smartsapp_studio_view_mode', mode);
    } catch {
      // Ignore local storage error
    }
  };

  // Initialize draft state from Firestore or Server Action with robust defaults
  React.useEffect(() => {
    if (effectivePortal) {
      setName(effectivePortal.name || '');
      setSlug(effectivePortal.slug || '');
      setDescription(effectivePortal.description || '');
      setPrimaryMode(effectivePortal.primaryMode || 'academy');
      setWorkspaceIds(effectivePortal.workspaceIds || []);
      setTheme(effectivePortal.theme || DEFAULT_THEME);
      setBranding(
        effectivePortal.branding || {
          brandName: effectivePortal.name || 'Portal',
          tagline: '',
          copyrightText: `© ${new Date().getFullYear()} ${effectivePortal.name || 'Portal'}. All rights reserved.`,
        }
      );
      setNavigation(effectivePortal.navigation || DEFAULT_NAVIGATION);
      setAccessPolicy(effectivePortal.accessPolicy || DEFAULT_ACCESS_POLICY);
      setFeatures(effectivePortal.features || DEFAULT_FEATURE_TOGGLES);
      setSeo(effectivePortal.seo || DEFAULT_SEO);
      setHasChanges(false);
    }
  }, [effectivePortal]);

  const markDirty = () => {
    setHasChanges(true);
  };

  // Browser Unload Guard when dirty
  React.useEffect(() => {
    if (!hasChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Category Switch Handler
  const handleSelectCategory = (catId: StudioCategoryId) => {
    setActiveCategory(catId);
    const category = STUDIO_CATEGORIES.find(c => c.id === catId);
    if (category && !category.tabIds.includes(activeTab)) {
      setActiveTab(category.tabIds[0]);
    }
  };

  // Tab Switch Handler (synchronizes active category)
  const handleSelectTab = (tabId: StudioTabId) => {
    setActiveTab(tabId);
    setActiveCategory(getCategoryForTab(tabId));
  };

  // Keyboard shortcut listener for Command Palette (Cmd+K)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSave = async () => {
    if (!portalId || !theme || !branding || !navigation || !accessPolicy || !features || !seo) {
      return;
    }

    try {
      setIsSaving(true);
      await updatePortalAction(portalId, {
        name,
        slug,
        description,
        primaryMode,
        workspaceIds,
        theme,
        branding,
        navigation,
        accessPolicy,
        features,
        seo,
      });

      setHasChanges(false);
      toast({
        title: 'Portal Saved Successfully',
        description: 'Your studio customizations are now updated.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes';
      toast({
        title: 'Save Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      setIsSaving(true);
      await publishPortalAction(portalId);
      toast({
        title: 'Portal Published Live! 🚀',
        description: 'Your portal is now live and accessible to users.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publish failed';
      toast({ title: 'Publish Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuspend = async () => {
    try {
      setIsSaving(true);
      await suspendPortalAction(portalId);
      toast({
        title: 'Portal Suspended',
        description: 'Public traffic to this portal is temporarily restricted.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Suspend failed';
      toast({ title: 'Suspend Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const publicPath = `/portal/${slug || effectivePortal?.slug || portalId}`;

  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}${publicPath}`;
    navigator.clipboard.writeText(fullUrl);
    toast({
      title: 'Portal Link Copied',
      description: fullUrl,
    });
  };

  if (isLoading || !effectivePortal || !theme || !branding || !navigation || !accessPolicy || !features || !seo) {
    if (!isLoading && !effectivePortal) {
      return (
        <PageContainerFluid>
          <div className="flex h-full min-h-[400px] w-full flex-col items-center justify-center p-6 text-center">
            <div className="rounded-3xl border border-border bg-card p-8 shadow-sm max-w-md w-full space-y-4">
              <h2 className="text-lg font-bold text-foreground">Portal Not Found</h2>
              <p className="text-xs text-muted-foreground">The Experience Portal with ID {portalId} could not be loaded.</p>
              <Button asChild className="h-10 min-h-[44px] px-5 rounded-xl font-bold text-xs active:scale-[0.97]">
                <Link href="/admin/portals">Back to Experience Portals</Link>
              </Button>
            </div>
          </div>
        </PageContainerFluid>
      );
    }

    return (
      <PageContainerFluid>
        <div className="space-y-6 py-6">
          <Skeleton className="h-20 w-full rounded-3xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="h-[600px] lg:col-span-7 rounded-3xl" />
            <Skeleton className="h-[600px] lg:col-span-5 rounded-3xl" />
          </div>
        </div>
      </PageContainerFluid>
    );
  }

  const orgName = activeOrganization?.name || 'SmartSapp';
  const currentCategoryObj = STUDIO_CATEGORIES.find(c => c.id === activeCategory) || STUDIO_CATEGORIES[0];

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-24 w-full">
        {/* ── Studio Header Bar ─────────────────────────────────────────── */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-3xl bg-card border-2 border-border shadow-xs">
          {/* Left: Brand Identity & Breadcrumbs */}
          <div className="flex items-center gap-3.5">
            <Link href="/admin/portals">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl active:scale-[0.97]"
                title="Back to Portals"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  {orgName} Experience Studio
                </span>
                <Badge
                  variant={effectivePortal.status === 'published' ? 'default' : 'secondary'}
                  className={cn(
                    'rounded-full text-[10px] uppercase font-bold px-2.5 py-0.5',
                    effectivePortal.status === 'published'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  )}
                >
                  {effectivePortal.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2.5 pt-0.5">
                <h1 className="text-xl font-black text-foreground tracking-tight">{name}</h1>
                <button
                  type="button"
                  onClick={() => setIsCommandPaletteOpen(true)}
                  className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-medium text-muted-foreground bg-muted hover:bg-muted/80 border border-border rounded-lg transition-colors active:scale-[0.97]"
                  title="Search studio tools (Cmd+K)"
                >
                  <Search className="w-3 h-3 text-muted-foreground" />
                  <span>Cmd+K</span>
                </button>
              </div>
            </div>
          </div>

          {/* Center: Workspace View Mode Selector */}
          <div className="flex items-center justify-center self-start xl:self-center">
            <div className="flex items-center bg-muted/70 p-1 rounded-2xl border border-border shadow-2xs">
              <button
                type="button"
                onClick={() => handleSetViewMode('split')}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[38px] active:scale-[0.97]',
                  viewMode === 'split'
                    ? 'bg-background shadow-xs text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Split View: Editor and live canvas side-by-side"
              >
                <Columns2 className="w-4 h-4" />
                <span className="hidden sm:inline">Split View</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetViewMode('editor')}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[38px] active:scale-[0.97]',
                  viewMode === 'editor'
                    ? 'bg-background shadow-xs text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Editor Focus: Full width for deep data and curriculum entry"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Editor Focus</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetViewMode('preview')}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[38px] active:scale-[0.97]',
                  viewMode === 'preview'
                    ? 'bg-background shadow-xs text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Full Canvas: Immersive live simulator canvas"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Live Canvas</span>
              </button>
            </div>
          </div>

          {/* Right: Actions, Share Menu, AI Copilot & Save CTA */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* AI Copilot Launcher */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAiCopilotOpen(true)}
              className="h-10 min-h-[44px] px-3.5 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20 gap-1.5 shadow-2xs active:scale-[0.97]"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">AI Copilot</span>
            </Button>

            {/* Share & View Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 min-h-[44px] px-3 rounded-xl font-bold text-xs gap-1.5 active:scale-[0.97]"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-2xl shadow-xl">
                <DropdownMenuItem
                  onClick={handleCopyLink}
                  className="gap-2.5 rounded-xl text-xs font-semibold py-2.5 cursor-pointer min-h-[40px]"
                >
                  <Copy className="w-4 h-4 text-muted-foreground" /> Copy Public URL
                </DropdownMenuItem>

                <DropdownMenuItem asChild className="gap-2.5 rounded-xl text-xs font-semibold py-2.5 cursor-pointer min-h-[40px]">
                  <a href={publicPath} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 text-muted-foreground" /> Open in New Tab
                  </a>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

                <div className="p-1">
                  <CreateQRButton
                    resourceType="public_portal"
                    resourceId={portalId}
                    resourceName={name}
                    destinationUrl={typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath}
                    variant="button"
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Lifecycle Toggle */}
            {effectivePortal.status === 'published' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSuspend}
                disabled={isSaving}
                className="h-10 min-h-[44px] rounded-xl font-bold text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10 gap-1.5 active:scale-[0.97]"
              >
                <PauseCircle className="w-4 h-4" /> Suspend
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePublish}
                disabled={isSaving}
                className="h-10 min-h-[44px] rounded-xl font-bold text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 gap-1.5 active:scale-[0.97]"
              >
                <PlayCircle className="w-4 h-4" /> Publish Live
              </Button>
            )}

            {/* Primary Save CTA with Dirty State Indicator */}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                'h-10 min-h-[44px] px-5 rounded-xl font-bold text-xs gap-2 shadow-sm transition-all active:scale-[0.97]',
                hasChanges
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20 shadow-md ring-2 ring-amber-500/40'
                  : 'bg-primary text-white hover:bg-primary/90'
              )}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasChanges ? (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{hasChanges ? 'Save Changes *' : 'Save Changes'}</span>
            </Button>
          </div>
        </div>

        {/* ── Main Dynamic Workspace ────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          {/* Configurator Pane (visible in 'split' and 'editor' modes) */}
          <div
            className={cn(
              'space-y-6 transition-all duration-300',
              viewMode === 'preview' ? 'hidden' : 'w-full',
              viewMode === 'split' ? 'lg:w-[58%] shrink-0' : 'max-w-5xl mx-auto'
            )}
          >
            {/* ── Tier 1: Domain Category Selector ───────────────────────── */}
            <div className="p-1.5 rounded-2xl bg-card border-2 border-border shadow-xs overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1.5 min-w-max">
                {STUDIO_CATEGORIES.map(category => {
                  const Icon = CATEGORY_ICON_MAP[category.id] || Palette;
                  const isCatActive = activeCategory === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleSelectCategory(category.id)}
                      className={cn(
                        'flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] active:scale-[0.97]',
                        isCatActive
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{category.label}</span>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-md font-mono font-medium',
                          isCatActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {category.tabIds.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Tier 2: Sub-Feature Segmented Selector ─────────────────── */}
            <div className="p-1 rounded-2xl bg-muted/50 border border-border overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1 min-w-max">
                {currentCategoryObj.tabIds.map(tabId => {
                  const tab = STUDIO_TABS[tabId];
                  const isTabActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleSelectTab(tab.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all min-h-[40px] active:scale-[0.97]',
                        isTabActive
                          ? 'bg-background text-foreground shadow-xs border border-border'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Active Configurator View ───────────────────────────────── */}
            <div className="w-full">
              {/* 1. Identity */}
              {activeTab === 'identity' && (
                <Card className="rounded-3xl border-2 border-border shadow-xs">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-bold">General Identity & Scoping</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-name" className="text-xs font-bold">
                        Portal Name
                      </Label>
                      <Input
                        id="edit-name"
                        value={name}
                        onChange={e => (setName(e.target.value), markDirty())}
                        className="h-10 min-h-[44px] rounded-xl text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="edit-slug" className="text-xs font-bold">
                        URL Slug
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-3 py-2 rounded-xl border border-border">
                          /portal/
                        </span>
                        <Input
                          id="edit-slug"
                          value={slug}
                          onChange={e => (setSlug(e.target.value), markDirty())}
                          className="h-10 min-h-[44px] rounded-xl text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="edit-desc" className="text-xs font-bold">
                        Tagline / Summary
                      </Label>
                      <Textarea
                        id="edit-desc"
                        value={description}
                        onChange={e => (setDescription(e.target.value), markDirty())}
                        className="rounded-xl text-xs min-h-[84px] resize-none"
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border">
                      <Label className="text-xs font-bold">Workspace Scoping & Sharing</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Select which workspaces can manage and access this portal:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(orgScopedWorkspaces || []).map(ws => {
                          const isSelected = workspaceIds.includes(ws.id);
                          return (
                            <button
                              key={ws.id}
                              type="button"
                              onClick={() => {
                                setWorkspaceIds(prev =>
                                  prev.includes(ws.id)
                                    ? prev.length > 1
                                      ? prev.filter(id => id !== ws.id)
                                      : prev
                                    : [...prev, ws.id]
                                );
                                markDirty();
                              }}
                              className={cn(
                                'text-xs px-3.5 py-2 rounded-xl font-semibold border min-h-[44px] transition-all active:scale-[0.97]',
                                isSelected
                                  ? 'bg-primary text-white border-primary shadow-xs'
                                  : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                              )}
                            >
                              {ws.name || ws.id}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 2. Theme */}
              {activeTab === 'theme' && (
                <PortalThemeCustomizer
                  theme={theme}
                  branding={branding}
                  onChangeTheme={t => (setTheme(t), markDirty())}
                  onChangeBranding={b => (setBranding(b), markDirty())}
                />
              )}

              {/* 3. Navigation */}
              {activeTab === 'navigation' && (
                <PortalNavigationBuilder
                  navigation={navigation}
                  onChangeNavigation={n => (setNavigation(n), markDirty())}
                  portalSlug={slug || effectivePortal?.slug}
                  portalId={portalId}
                />
              )}

              {/* 4. Modules & Spaces */}
              {activeTab === 'modules' && (
                <Card className="rounded-3xl border-2 border-border shadow-xs">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 text-primary font-bold text-sm">
                      <Sliders className="w-4 h-4" /> Active Experience Spaces & Modules
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    {[
                      { key: 'enableCourses', label: 'Curriculum & Courses', desc: 'Structured learning modules with lessons and tracking' },
                      { key: 'enableDocs', label: 'Documentation & Help Base', desc: 'Technical documentation, articles, and searchable knowledge' },
                      { key: 'enableCommunity', label: 'Community Feed & Groups', desc: 'Social discussion posts, comments, and member spaces' },
                      { key: 'enableResources', label: 'Resource Library & Downloads', desc: 'Downloadable templates, toolkits, and PDFs' },
                      { key: 'enableEvents', label: 'Live Events & Coaching Calls', desc: 'Google Meet & Zoom workshop sessions' },
                      { key: 'enableGamification', label: 'Badges & Certificates', desc: 'Verifiable credentials and milestones' },
                      { key: 'enableAiTutor', label: 'AI Learning Tutor', desc: 'Grounded AI assistant answering questions on portal materials' },
                      { key: 'enableAffiliates', label: 'Affiliate & Referral Engine', desc: 'Partner links and revenue tracking' },
                    ].map(mod => (
                      <div key={mod.key} className="flex items-center justify-between p-3.5 rounded-2xl border border-border">
                        <div>
                          <p className="text-xs font-bold text-foreground">{mod.label}</p>
                          <p className="text-[11px] text-muted-foreground">{mod.desc}</p>
                        </div>
                        <Switch
                          checked={Boolean(features[mod.key as keyof PortalFeatureToggles])}
                          onCheckedChange={checked => {
                            setFeatures({ ...features, [mod.key]: checked });
                            markDirty();
                          }}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 5. Access Policies */}
              {activeTab === 'access' && (
                <PortalAccessPolicyEditor
                  accessPolicy={accessPolicy}
                  onChangeAccessPolicy={p => (setAccessPolicy(p), markDirty())}
                />
              )}

              {/* 6. SEO & Social */}
              {activeTab === 'seo' && (
                <PortalSeoEditor
                  seo={seo}
                  branding={branding}
                  portalName={name}
                  slug={slug}
                  onChangeSeo={s => (setSeo(s), markDirty())}
                />
              )}

              {/* 7. Content Vault */}
              {activeTab === 'content' && (
                <PortalContentManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={effectivePortal.organizationId}
                  workspaceIds={workspaceIds}
                />
              )}

              {/* 8. Masterclass Courses */}
              {activeTab === 'courses' && (
                <PortalCourseManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={effectivePortal.organizationId}
                  workspaceIds={workspaceIds}
                />
              )}

              {/* 9. Live Events */}
              {activeTab === 'events' && (
                <PortalEventsManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={effectivePortal.organizationId}
                  workspaceIds={workspaceIds}
                />
              )}

              {/* 10. Community Feed */}
              {activeTab === 'community' && (
                <PortalCommunityManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={effectivePortal.organizationId}
                  workspaceIds={workspaceIds}
                />
              )}

              {/* 11. Onboarding Checklist */}
              {activeTab === 'onboarding' && (
                <PortalOnboardingManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={effectivePortal.organizationId}
                  workspaceIds={workspaceIds}
                />
              )}

              {/* 12. Monetization */}
              {activeTab === 'monetization' && (
                <PortalMonetizationManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={effectivePortal.organizationId}
                  workspaceIds={workspaceIds}
                />
              )}

              {/* 13. Analytics */}
              {activeTab === 'analytics' && (
                <PortalAnalyticsManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={effectivePortal.organizationId}
                />
              )}

              {/* 14. Credentials & Badges */}
              {activeTab === 'credentials' && (
                <PortalCredentialManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={effectivePortal.organizationId}
                  workspaceIds={workspaceIds}
                />
              )}

              {/* 15. Enterprise SSO */}
              {activeTab === 'enterprise' && (
                <PortalEnterpriseManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={effectivePortal.organizationId}
                  workspaceIds={workspaceIds}
                />
              )}

              {/* 16. Member Directory */}
              {activeTab === 'members' && (
                <PortalMemberManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={effectivePortal.organizationId}
                  workspaceIds={workspaceIds}
                />
              )}
            </div>
          </div>

          {/* Live Responsive Preview Canvas Pane (visible in 'split' and 'preview' modes) */}
          <div
            className={cn(
              'transition-all duration-300',
              viewMode === 'editor' ? 'hidden' : 'w-full',
              viewMode === 'split' ? 'hidden lg:flex lg:w-[42%] lg:sticky lg:top-6 lg:h-[calc(100vh-140px)]' : 'h-[calc(100vh-140px)]'
            )}
          >
            <PortalLivePreviewCanvas
              portal={effectivePortal}
              theme={theme}
              branding={branding}
              navigation={navigation}
              features={features}
              primaryMode={primaryMode}
              portalName={name}
              slug={slug}
            />
          </div>
        </div>

        {/* ── Mobile View Toggle Pill (<1024px) ─────────────────────────── */}
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card/90 backdrop-blur-md border-2 border-border shadow-xl rounded-full p-1 flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            onClick={() => handleSetViewMode('editor')}
            className={cn(
              'rounded-full px-4 text-xs font-bold min-h-[44px] transition-all active:scale-[0.97]',
              viewMode !== 'preview' ? 'bg-primary text-white shadow-xs' : 'bg-transparent text-muted-foreground'
            )}
          >
            <SlidersHorizontal className="w-4 h-4 mr-1.5" /> Configure
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSetViewMode('preview')}
            className={cn(
              'rounded-full px-4 text-xs font-bold min-h-[44px] transition-all active:scale-[0.97]',
              viewMode === 'preview' ? 'bg-primary text-white shadow-xs' : 'bg-transparent text-muted-foreground'
            )}
          >
            <Eye className="w-4 h-4 mr-1.5" /> Preview
          </Button>
        </div>
      </div>

      {/* ── AI Studio Copilot Drawer ─────────────────────────────────── */}
      <PortalAiCopilotDrawer
        isOpen={isAiCopilotOpen}
        onClose={() => setIsAiCopilotOpen(false)}
        portalId={portalId}
        portalSlug={slug}
        organizationId={effectivePortal.organizationId}
      />

      {/* ── Command Palette (Cmd+K) ──────────────────────────────────── */}
      <PortalStudioCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={handleSelectTab}
        onSave={handleSave}
        onSetViewMode={handleSetViewMode}
      />
    </PageContainerFluid>
  );
}
