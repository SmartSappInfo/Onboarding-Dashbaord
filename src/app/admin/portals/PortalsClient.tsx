'use client';

/**
 * {{Org_name}} Experience Platform — Admin Portals Hub & Launchpad
 *
 * Unified administration hub combining first-class Experience Portals with
 * the live system entry points (Surveys, PDFs, Meetings, Custom Landing Pages).
 *
 * Rules:
 * - Dynamic {{Org_name}} Experience Platform branding.
 * - Strictly typed (Zero any / any[]).
 * - Multi-workspace scoped with reactive filtering.
 * - Preserves all pre-existing launchpad functionality.
 * - Conforms to vercel-react-best-practices, next-best-practices, and emilkowal-animations.
 */

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Survey, PDFForm, Meeting, CampaignPage } from '@/lib/types';
import type { Portal, PortalMode, PortalStatus } from '@/lib/types/portal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Globe,
  Search,
  ClipboardList,
  FileText,
  Calendar,
  Zap,
  LayoutList,
  Plus,
  Sparkles,
  Layers,
  Rocket,
  SlidersHorizontal,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
import { useEntityResolver } from '@/context/EntityCacheContext';
import { PageContainerFluid } from '@/components/ui/page-container';
import { PortalCard } from './components/PortalCard';
import { ExperiencePortalCard } from './components/ExperiencePortalCard';
import { CreatePortalModal } from './components/CreatePortalModal';
import { PortalMarketplaceHub } from './components/PortalMarketplaceHub';
import { CustomPageSeoDialog } from './components/CustomPageSeoDialog';
import { CustomPageWorkspaceDialog } from './components/CustomPageWorkspaceDialog';
import {
  publishPortalAction,
  suspendPortalAction,
  archivePortalAction,
  duplicatePortalAction,
  deletePortalAction,
  runMasterExperienceSeederAction,
} from '@/app/actions/portal-actions';

interface HardcodedPage {
  slug: string;
  title: string;
  path: string;
  themeColor: string;
  defaultWorkspaceIds: string[];
}

const HARDCODED_PAGES: HardcodedPage[] = [
  {
    slug: 'homepage',
    title: 'Public Homepage',
    path: '/',
    themeColor: '#3B5FFF',
    defaultWorkspaceIds: ['onboarding', 'prospect'],
  },
  {
    slug: 'collect-fees-within-four-weeks',
    title: '/collect-fees-within-four-weeks',
    path: '/collect-fees-within-four-weeks',
    themeColor: '#5f30e2',
    defaultWorkspaceIds: ['onboarding'],
  },
  {
    slug: 'collecting-fees-without-delays-and-parental-confrontations',
    title: 'How We Collect Fees Without Delays',
    path: '/collecting-fees-without-delays-and-parental-confrontations',
    themeColor: '#5f30e2',
    defaultWorkspaceIds: ['onboarding', 'prospect'],
  },
  {
    slug: 'school-enrollment',
    title: 'School Enrollment',
    path: '/school-enrollment',
    themeColor: '#3B5FFF',
    defaultWorkspaceIds: ['prospect'],
  },
  {
    slug: 'number-one-choice',
    title: '/number-one-choice',
    path: '/number-one-choice',
    themeColor: '#ec4899',
    defaultWorkspaceIds: ['onboarding', 'prospect'],
  },
  {
    slug: 'thank-you',
    title: 'Demo Thank You',
    path: '/thank-you',
    themeColor: '#10b981',
    defaultWorkspaceIds: ['onboarding', 'prospect'],
  },
  {
    slug: 'school-comparison',
    title: 'Campaign Landing',
    path: '/campaign/school-comparison',
    themeColor: '#6366f1',
    defaultWorkspaceIds: ['onboarding'],
  },
  {
    slug: 'school-comparison-statistics',
    title: 'Campaign Stats',
    path: '/campaign/school-comparison/statistics',
    themeColor: '#10b981',
    defaultWorkspaceIds: ['onboarding'],
  },
  {
    slug: 'subscription-payment',
    title: 'Subscription Payment',
    path: '/p/subscription-payment',
    themeColor: '#6366f1',
    defaultWorkspaceIds: ['onboarding'],
  },
  {
    slug: 'subscription-renewal',
    title: 'Subscription Renewal',
    path: '/subscription-renewal',
    themeColor: '#3A86FF',
    defaultWorkspaceIds: ['onboarding'],
  },
  {
    slug: 'register-new-signup',
    title: 'New School Signup',
    path: '/register-new-signup',
    themeColor: '#10b981',
    defaultWorkspaceIds: ['onboarding'],
  },
  {
    slug: 'forms-results',
    title: 'Results Directory',
    path: '/forms/results',
    themeColor: '#6366f1',
    defaultWorkspaceIds: ['onboarding'],
  },
];

// ─── Skeleton grid ────────────────────────────────────────────────────────────

const SKELETON_KEYS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function PortalsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {SKELETON_KEYS.map(i => (
        <Skeleton key={i} className="w-full h-80 rounded-2xl" />
      ))}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  badge?: number;
  icon: React.ComponentType<{ className?: string }>;
}

function SectionHeader({ title, badge, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {badge !== undefined && (
        <Badge variant="secondary" className="rounded-full h-6 px-3 font-semibold tabular-nums">
          {badge}
        </Badge>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left transition-all hover:shadow-md">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="p-3 bg-muted/20 rounded-xl text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1.5">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tighter">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PortalsClient Main Component ─────────────────────────────────────────────

export default function PortalsClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeWorkspaceId, activeOrganizationId, activeOrganization } = useTenant();
  const { entitiesById, resolveIds } = useEntityResolver();

  const [activeTab, setActiveTab] = React.useState<'experience' | 'launchpad'>('experience');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedModeFilter, setSelectedModeFilter] = React.useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

  const [editingSeoPage, setEditingSeoPage] = React.useState<{
    pageKey: string;
    title: string;
    path: string;
  } | null>(null);

  const [assigningWorkspacesPage, setAssigningWorkspacesPage] = React.useState<{
    pageKey: string;
    title: string;
    workspaceIds: string[];
  } | null>(null);
  const [isMarketplaceOpen, setIsMarketplaceOpen] = React.useState(false);
  const [isSeeding, setIsSeeding] = React.useState(false);

  const orgName = activeOrganization?.name || 'Organization';

  // ── Queries ───────────────────────────────────────────────────────────────

  // 1. Experience Portals Query
  const portalsQuery = useMemoFirebase(
    () => {
      if (!firestore || !activeOrganizationId) return null;
      if (activeWorkspaceId && activeWorkspaceId !== 'global') {
        return query(
          collection(firestore, 'portals'),
          where('organizationId', '==', activeOrganizationId),
          where('workspaceIds', 'array-contains', activeWorkspaceId),
          orderBy('updatedAt', 'desc')
        );
      }
      return query(
        collection(firestore, 'portals'),
        where('organizationId', '==', activeOrganizationId),
        orderBy('updatedAt', 'desc')
      );
    },
    [firestore, activeOrganizationId, activeWorkspaceId]
  );

  // 2. Launchpad Assets Queries
  const surveysQuery = useMemoFirebase(
    () =>
      firestore && activeWorkspaceId
        ? query(
            collection(firestore, 'surveys'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc')
          )
        : null,
    [firestore, activeWorkspaceId]
  );

  const pdfsQuery = useMemoFirebase(
    () =>
      firestore && activeWorkspaceId
        ? query(
            collection(firestore, 'pdfs'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc')
          )
        : null,
    [firestore, activeWorkspaceId]
  );

  const meetingsQuery = useMemoFirebase(
    () =>
      firestore && activeWorkspaceId
        ? query(
            collection(firestore, 'meetings'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('meetingTime', 'desc')
          )
        : null,
    [firestore, activeWorkspaceId]
  );

  const campaignPagesQuery = useMemoFirebase(
    () =>
      firestore && activeOrganizationId
        ? query(
            collection(firestore, 'campaign_pages'),
            where('organizationId', '==', activeOrganizationId)
          )
        : null,
    [firestore, activeOrganizationId]
  );

  const { data: portals, isLoading: isLoadingPortals } = useCollection<Portal>(portalsQuery);
  const { data: surveys, isLoading: isLoadingSurveys } = useCollection<Survey>(surveysQuery);
  const { data: pdfs, isLoading: isLoadingPdfs } = useCollection<PDFForm>(pdfsQuery);
  const { data: meetings, isLoading: isLoadingMeetings } = useCollection<Meeting>(meetingsQuery);
  const { data: campaignPages, isLoading: isLoadingCampaignPages } = useCollection<CampaignPage>(campaignPagesQuery);

  const isLoading = isLoadingPortals || isLoadingSurveys || isLoadingPdfs || isLoadingMeetings || isLoadingCampaignPages;

  // Resolve entity logos for launchpad cards
  React.useEffect(() => {
    const ids = [
      ...(surveys ?? []),
      ...(pdfs ?? []),
      ...(meetings ?? []),
    ]
      .map(p => p.entityId)
      .filter((x): x is string => !!x);
    if (ids.length > 0) resolveIds(ids);
  }, [surveys, pdfs, meetings, resolveIds]);

  // ── Filtered Portals ──────────────────────────────────────────────────────

  const filteredPortals = React.useMemo(() => {
    return (portals ?? []).filter(portal => {
      const matchesSearch =
        portal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        portal.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (portal.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMode =
        selectedModeFilter === 'all' || portal.primaryMode === selectedModeFilter;

      return matchesSearch && matchesMode;
    });
  }, [portals, searchTerm, selectedModeFilter]);

  // ── Filtered Launchpad Items ──────────────────────────────────────────────

  const filteredSurveys = React.useMemo(
    () =>
      surveys?.filter(
        s =>
          s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.internalName?.toLowerCase().includes(searchTerm.toLowerCase())
      ) ?? [],
    [surveys, searchTerm]
  );

  const filteredPdfs = React.useMemo(
    () =>
      pdfs?.filter(
        p =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.publicTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.entityName?.toLowerCase().includes(searchTerm.toLowerCase())
      ) ?? [],
    [pdfs, searchTerm]
  );

  const filteredMeetings = React.useMemo(
    () =>
      meetings?.filter(
        m =>
          m.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.type?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      ) ?? [],
    [meetings, searchTerm]
  );

  // ── Action Handlers ───────────────────────────────────────────────────────

  const handleCopy = React.useCallback(
    (path: string) => {
      if (typeof window === 'undefined') return;
      const url = `${window.location.origin}${path}`;
      navigator.clipboard.writeText(url);
      toast({ title: 'Link Copied', description: 'Public URL ready to share.' });
    },
    [toast]
  );

  const handleDuplicatePortal = React.useCallback(
    async (sourcePortal: Portal) => {
      try {
        const newName = `${sourcePortal.name} (Copy)`;
        const res = await duplicatePortalAction(sourcePortal.id, newName);
        if (!res.success) throw new Error(res.error || 'Duplication failed.');
        toast({ title: 'Portal Duplicated', description: `Created draft copy: ${newName}` });
      } catch (err) {
        toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to duplicate.' });
      }
    },
    [toast]
  );

  const handlePublishPortal = React.useCallback(
    async (portalId: string) => {
      try {
        const res = await publishPortalAction(portalId);
        if (!res.success) throw new Error(res.error || 'Publish failed.');
        toast({ title: 'Portal Published Live! 🚀', description: 'Portal is now accessible.' });
      } catch (err) {
        toast({ title: 'Publish Error', description: err instanceof Error ? err.message : 'Failed to publish.' });
      }
    },
    [toast]
  );

  const handleSuspendPortal = React.useCallback(
    async (portalId: string) => {
      try {
        const res = await suspendPortalAction(portalId, 'Maintenance');
        if (!res.success) throw new Error(res.error || 'Suspend failed.');
        toast({ title: 'Portal Suspended', description: 'Portal placed in offline maintenance.' });
      } catch (err) {
        toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to suspend.' });
      }
    },
    [toast]
  );

  const handleArchivePortal = React.useCallback(
    async (portalId: string) => {
      try {
        const res = await archivePortalAction(portalId);
        if (!res.success) throw new Error(res.error || 'Archive failed.');
        toast({ title: 'Portal Archived', description: 'Moved to archive.' });
      } catch (err) {
        toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to archive.' });
      }
    },
    [toast]
  );

  const handleDeletePortal = React.useCallback(
    async (portalId: string) => {
      if (!confirm('Are you sure you want to permanently delete this experience portal?')) return;
      try {
        const res = await deletePortalAction(portalId);
        if (!res.success) throw new Error(res.error || 'Delete failed.');
        toast({ title: 'Portal Deleted', description: 'Experience portal removed.' });
      } catch (err) {
        toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete.' });
      }
    },
    [toast]
  );

  const handleEditSeo = React.useCallback((pageKey: string, title: string, path: string) => {
    setEditingSeoPage({ pageKey, title, path });
  }, []);

  const handleAssignWorkspaces = React.useCallback((pageKey: string, workspaceIds: string[]) => {
    const pageObj = HARDCODED_PAGES.find(p => p.path === pageKey);
    setAssigningWorkspacesPage({
      pageKey,
      title: pageObj?.title || pageKey,
      workspaceIds,
    });
  }, []);

  const handleRunMasterSeed = React.useCallback(async () => {
    if (!activeOrganizationId) return;
    setIsSeeding(true);
    toast({
      title: 'Initializing Experience Platform Demo...',
      description: 'Seeding all 12 phases including flagship School Bursar Academy.',
    });

    try {
      const res = await runMasterExperienceSeederAction(activeOrganizationId);
      if (res.success) {
        toast({
          title: 'Master Seeding Complete! 🌟',
          description: 'All 12 phases, courses, community spaces, and credentials have been seeded.',
        });
      } else {
        toast({
          title: 'Seeding Notice',
          description: res.error || 'Failed to seed demo platform.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to trigger master seeder.',
        variant: 'destructive',
      });
    } finally {
      setIsSeeding(false);
    }
  }, [activeOrganizationId, toast]);

  const totalExperiencePortals = portals?.length ?? 0;
  const publishedExperiencePortals = portals?.filter(p => p.status === 'published').length ?? 0;

  return (
    <PageContainerFluid>
      <div className="space-y-8 pb-32 w-full">
        {/* ── Header Bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 text-primary">
              <Sparkles className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {orgName} Experience Platform
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Experience Portals</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Design, publish, and manage intelligent branded portals for the{' '}
              <strong className="text-foreground">{activeWorkspaceId || 'global'}</strong> track.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-[320px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
              <Input
                placeholder="Search portals by title or slug..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-background border-border shadow-xs font-medium text-xs"
              />
            </div>

            <Button
              variant="outline"
              onClick={handleRunMasterSeed}
              disabled={isSeeding}
              className="h-11 px-4 rounded-xl font-bold text-xs gap-2 shrink-0 bg-background border-border shadow-2xs hover:bg-muted/60"
            >
              <Zap className={cn('w-4 h-4 text-amber-500', isSeeding && 'animate-spin')} />
              {isSeeding ? 'Seeding Demo...' : 'Seed Demo Data'}
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsMarketplaceOpen(true)}
              className="h-11 px-4 rounded-xl font-bold text-xs gap-2 shrink-0 bg-background border-border shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-primary" /> Template Marketplace
            </Button>

            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="h-11 px-5 rounded-xl font-bold text-xs gap-2 bg-primary text-white hover:bg-primary/90 shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" /> Create Portal
            </Button>
          </div>
        </div>

        {/* ── Stats Summary Row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Experience Portals"
            value={isLoading ? '…' : totalExperiencePortals}
            icon={Globe}
          />
          <StatCard
            label="Live Published"
            value={isLoading ? '…' : publishedExperiencePortals}
            icon={Rocket}
          />
          <StatCard
            label="Surveys & Doc Portals"
            value={isLoading ? '…' : (surveys?.length ?? 0) + (pdfs?.length ?? 0)}
            icon={ClipboardList}
          />
          <StatCard
            label="Meeting Session Rooms"
            value={isLoading ? '…' : meetings?.length ?? 0}
            icon={Calendar}
          />
        </div>

        {/* ── Hub Tabs (Experience Portals vs Quick Launchpad) ───────────── */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <TabsList className="h-11 p-1 bg-muted/60 rounded-xl border border-border">
              <TabsTrigger
                value="experience"
                className="rounded-lg text-xs font-bold px-4 py-2 gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                <Globe className="w-4 h-4" /> Experience Portals ({totalExperiencePortals})
              </TabsTrigger>
              <TabsTrigger
                value="launchpad"
                className="rounded-lg text-xs font-bold px-4 py-2 gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                <Rocket className="w-4 h-4" /> Quick Launchpad
              </TabsTrigger>
            </TabsList>

            {activeTab === 'experience' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Mode:
                </span>
                {[
                  { id: 'all', label: 'All Modes' },
                  { id: 'academy', label: 'Academy' },
                  { id: 'documentation', label: 'Docs' },
                  { id: 'membership', label: 'Membership' },
                  { id: 'community', label: 'Community' },
                  { id: 'resource_center', label: 'Resources' },
                  { id: 'blog', label: 'Blog' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedModeFilter(tab.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                      selectedModeFilter === tab.id
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-card text-muted-foreground border border-border hover:border-primary/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Tab 1: Experience Portals Grid ──────────────────────────── */}
          <TabsContent value="experience" className="pt-6 space-y-6">
            {isLoadingPortals ? (
              <PortalsSkeleton />
            ) : filteredPortals.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 bg-muted/20">
                <div className="p-4 rounded-2xl bg-primary/10 text-primary">
                  <Globe className="w-10 h-10" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="font-bold text-lg text-foreground">
                    {searchTerm ? 'No portals match your search' : 'No experience portals configured yet'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {searchTerm
                      ? 'Try adjusting your search keyword or mode filter.'
                      : `Create your first branded academy, help center, or membership hub for ${orgName}.`}
                  </p>
                </div>
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="rounded-xl font-bold text-xs gap-2 bg-primary text-white hover:bg-primary/90 mt-2"
                >
                  <Plus className="w-4 h-4" /> Create Experience Portal
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredPortals.map(portal => (
                  <ExperiencePortalCard
                    key={portal.id}
                    portal={portal}
                    onCopy={handleCopy}
                    onDuplicate={handleDuplicatePortal}
                    onPublish={handlePublishPortal}
                    onSuspend={handleSuspendPortal}
                    onArchive={handleArchivePortal}
                    onDelete={handleDeletePortal}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Tab 2: Quick Launchpad (Surveys, PDFs, Meetings, Pages) ───── */}
          <TabsContent value="launchpad" className="pt-6 space-y-16">
            {/* Core Custom Pages */}
            {!searchTerm && (
              <section>
                <SectionHeader title="Core System Landing Pages" icon={Zap} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {HARDCODED_PAGES.filter(p => {
                    const dbPage = campaignPages?.find(
                      db => db.slug === p.slug || db.slug === p.path.replace(/^\//, '')
                    );
                    const workspaceIds = dbPage ? dbPage.workspaceIds || [] : p.defaultWorkspaceIds;
                    return workspaceIds.includes(activeWorkspaceId);
                  }).map(p => {
                    const dbPage = campaignPages?.find(
                      db => db.slug === p.slug || db.slug === p.path.replace(/^\//, '')
                    );
                    const workspaceIds = dbPage ? dbPage.workspaceIds || [] : p.defaultWorkspaceIds;
                    return (
                      <PortalCard
                        key={p.slug}
                        kind="custom"
                        title={p.title}
                        path={p.path}
                        pageKey={p.path}
                        themeColor={p.themeColor}
                        onCopy={handleCopy}
                        onEditSeo={handleEditSeo}
                        workspaceIds={workspaceIds}
                        onAssignWorkspaces={handleAssignWorkspaces}
                        pageId={dbPage?.id}
                        pageSettings={dbPage?.settings}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* Intelligent Surveys */}
            {filteredSurveys.length > 0 && (
              <section>
                <SectionHeader title="Intelligent Surveys" badge={filteredSurveys.length} icon={ClipboardList} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredSurveys.map(s => (
                    <PortalCard
                      key={s.id}
                      kind="survey"
                      title={s.title}
                      description={s.description}
                      entityName={s.entityName ?? undefined}
                      logoUrl={s.logoUrl ?? (s.entityId ? entitiesById.get(s.entityId)?.logoUrl : undefined)}
                      entityId={s.entityId ?? undefined}
                      path={`/surveys/${s.slug}`}
                      backgroundColor={s.backgroundColor}
                      questionCount={s.elements?.length ?? 0}
                      onCopy={handleCopy}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Document Signing Portals */}
            {filteredPdfs.length > 0 && (
              <section>
                <SectionHeader title="Doc Signing Portals" badge={filteredPdfs.length} icon={FileText} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredPdfs.map(p => (
                    <PortalCard
                      key={p.id}
                      kind="pdf"
                      title={p.publicTitle || p.name}
                      entityName={p.entityName ?? undefined}
                      logoUrl={p.logoUrl ?? (p.entityId ? entitiesById.get(p.entityId)?.logoUrl : undefined)}
                      entityId={p.entityId ?? undefined}
                      path={`/forms/${p.slug || p.id}`}
                      backgroundColor={p.backgroundColor}
                      fieldCount={p.fields?.length ?? 0}
                      onCopy={handleCopy}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Meeting Session Rooms */}
            {filteredMeetings.length > 0 && (
              <section>
                <SectionHeader title="Meeting Session Rooms" badge={filteredMeetings.length} icon={Calendar} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredMeetings.map(m => {
                    let typeSlug = m.type?.slug || 'parent-engagement';
                    if ((typeSlug as string) === 'parent') typeSlug = 'parent-engagement';
                    return (
                      <PortalCard
                        key={m.id}
                        kind="meeting"
                        title={m.type?.name || 'Session'}
                        description={m.heroDescription}
                        entityName={m.entityName ?? undefined}
                        logoUrl={m.logoUrl ?? (m.entityId ? entitiesById.get(m.entityId)?.logoUrl : undefined)}
                        entityId={m.entityId}
                        path={`/meetings/${typeSlug}/${m.entitySlug}`}
                        meetingTime={m.meetingTime}
                        onCopy={handleCopy}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <CreatePortalModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        defaultWorkspaceId={activeWorkspaceId}
      />

      <PortalMarketplaceHub
        organizationId={activeOrganizationId || ''}
        isOpen={isMarketplaceOpen}
        onOpenChange={setIsMarketplaceOpen}
      />

      {editingSeoPage && (
        <CustomPageSeoDialog
          open={!!editingSeoPage}
          onOpenChange={open => !open && setEditingSeoPage(null)}
          pageKey={editingSeoPage.pageKey}
          currentTitle={editingSeoPage.title}
          currentPath={editingSeoPage.path}
        />
      )}

      {assigningWorkspacesPage && (
        <CustomPageWorkspaceDialog
          open={!!assigningWorkspacesPage}
          onOpenChange={open => !open && setAssigningWorkspacesPage(null)}
          pageKey={assigningWorkspacesPage.pageKey}
          currentTitle={assigningWorkspacesPage.title}
          currentWorkspaceIds={assigningWorkspacesPage.workspaceIds}
        />
      )}
    </PageContainerFluid>
  );
}