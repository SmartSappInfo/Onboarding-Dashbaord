'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Survey, PDFForm, Meeting } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Search,
  ClipboardList,
  FileText,
  Calendar,
  Zap,
  LayoutList,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
import { useEntityLookup } from '@/context/EntityCacheContext';
import { PageContainerFluid } from '@/components/ui/page-container';
import { PortalCard } from './components/PortalCard';

// ─── Skeleton grid — hoisted to module level (rerender-hoist-jsx) ─────────────

const SKELETON_KEYS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function PortalsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {SKELETON_KEYS.map(i => (
        <Skeleton key={i} className="w-full aspect-square rounded-2xl" />
      ))}
    </div>
  );
}

// ─── Section header — module-level (rerender-no-inline-components) ────────────

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

// ─── Stat card — module-level ─────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden text-left transition-all hover:shadow-md">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="p-3 bg-muted/20 rounded-xl text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[9px] font-semibold text-muted-foreground leading-none mb-1.5">Total {label}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tighter">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Empty state — module-level ───────────────────────────────────────────────

function EmptyState({ searchTerm, workspaceId }: { searchTerm: string; workspaceId?: string }) {
  return (
    <div className="py-20 text-center border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 opacity-60">
      <LayoutList className="h-16 w-16" />
      <p className="font-semibold text-lg">
        {searchTerm
          ? 'No portals matched your search'
          : `No active portals in the ${workspaceId ?? 'current'} hub`}
      </p>
    </div>
  );
}

// ─── PortalsClient ────────────────────────────────────────────────────────────

export default function PortalsClient() {
  const firestore             = useFirestore();
  const { toast }             = useToast();
  const { activeWorkspaceId } = useTenant();
  const { byEntityId }        = useEntityLookup();

  const [searchTerm, setSearchTerm] = React.useState('');

  // ── Queries ───────────────────────────────────────────────────────────────

  const surveysQuery = useMemoFirebase(
    () => firestore && activeWorkspaceId
      ? query(collection(firestore, 'surveys'), where('workspaceIds', 'array-contains', activeWorkspaceId), where('status', '==', 'published'), orderBy('createdAt', 'desc'))
      : null,
    [firestore, activeWorkspaceId],
  );

  const pdfsQuery = useMemoFirebase(
    () => firestore && activeWorkspaceId
      ? query(collection(firestore, 'pdfs'), where('workspaceIds', 'array-contains', activeWorkspaceId), where('status', '==', 'published'), orderBy('createdAt', 'desc'))
      : null,
    [firestore, activeWorkspaceId],
  );

  const meetingsQuery = useMemoFirebase(
    () => firestore && activeWorkspaceId
      ? query(collection(firestore, 'meetings'), where('workspaceIds', 'array-contains', activeWorkspaceId), orderBy('meetingTime', 'desc'))
      : null,
    [firestore, activeWorkspaceId],
  );

  const { data: surveys,  isLoading: isLoadingSurveys  } = useCollection<Survey>(surveysQuery);
  const { data: pdfs,     isLoading: isLoadingPdfs     } = useCollection<PDFForm>(pdfsQuery);
  const { data: meetings, isLoading: isLoadingMeetings } = useCollection<Meeting>(meetingsQuery);

  const isLoading = isLoadingSurveys || isLoadingPdfs || isLoadingMeetings;

  // ── Filtered lists — derived during render (rerender-derived-state-no-effect) ─

  const filteredSurveys = React.useMemo(
    () => surveys?.filter(s =>
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.internalName?.toLowerCase().includes(searchTerm.toLowerCase()),
    ) ?? [],
    [surveys, searchTerm],
  );

  const filteredPdfs = React.useMemo(
    () => pdfs?.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.publicTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.entityName?.toLowerCase().includes(searchTerm.toLowerCase()),
    ) ?? [],
    [pdfs, searchTerm],
  );

  const filteredMeetings = React.useMemo(
    () => meetings?.filter(m =>
      m.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.type?.name?.toLowerCase().includes(searchTerm.toLowerCase()),
    ) ?? [],
    [meetings, searchTerm],
  );

  // ── Stable handler (rerender-memo) ────────────────────────────────────────

  const handleCopy = React.useCallback(
    (path: string) => {
      if (typeof window === 'undefined') return;
      const url = `${window.location.origin}${path}`;
      navigator.clipboard.writeText(url);
      toast({ title: 'Link Copied', description: 'Public portal URL is ready to share.' });
    },
    [toast],
  );

  // ── Derived booleans ──────────────────────────────────────────────────────

  const allEmpty =
    !isLoading &&
    filteredSurveys.length === 0 &&
    filteredPdfs.length === 0 &&
    filteredMeetings.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageContainerFluid>
      <div className="space-y-8 pb-32 w-full">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Public Launchpad</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Live system entry points for the <strong>{activeWorkspaceId || 'global'}</strong> track.
            </p>
          </div>
          <div className="relative w-full md:w-[380px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
            <Input
              placeholder="Filter by entity or portal title..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-11 h-11 rounded-xl bg-background border-border shadow-sm ring-1 ring-border focus:ring-primary/20 font-bold transition-all text-sm"
            />
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Live Surveys"   value={isLoading ? '…' : (surveys?.length  ?? 0)} icon={ClipboardList} />
          <StatCard label="Doc Portals"    value={isLoading ? '…' : (pdfs?.length     ?? 0)} icon={FileText} />
          <StatCard label="Meeting Rooms"  value={isLoading ? '…' : (meetings?.length ?? 0)} icon={Calendar} />
          <StatCard label="Public Portals" value={isLoading ? '…' : (surveys?.length ?? 0) + (pdfs?.length ?? 0) + (meetings?.length ?? 0)} icon={Globe} />
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {isLoading ? (
          <PortalsSkeleton />
        ) : (
          <div className="space-y-16">

            {/* Custom Pages — only shown when not searching */}
            {!searchTerm && (
              <section>
                <SectionHeader title="Core Custom Pages" icon={Zap} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <PortalCard
                    kind="custom"
                    title="Public Homepage"
                    path="/"
                    pageKey="/"
                    themeColor="#3B5FFF"
                    onCopy={handleCopy}
                  />
                  <PortalCard
                    kind="custom"
                    title="/collect-fees-within-four-weeks"
                    path="/collect-fees-within-four-weeks"
                    pageKey="/collect-fees-within-four-weeks"
                    themeColor="#5f30e2"
                    onCopy={handleCopy}
                  />
                  <PortalCard
                    kind="custom"
                    title="Demo Thank You"
                    path="/thank-you"
                    pageKey="/thank-you"
                    themeColor="#10b981"
                    onCopy={handleCopy}
                  />
                  {activeWorkspaceId === 'onboarding' && (
                    <>
                      <PortalCard kind="custom" title="Campaign Landing"    path="/campaign/school-comparison"            pageKey="/campaign/school-comparison"            themeColor="#6366f1" onCopy={handleCopy} />
                      <PortalCard kind="custom" title="Campaign Stats"       path="/campaign/school-comparison/statistics" pageKey="/campaign/school-comparison/statistics" themeColor="#10b981" onCopy={handleCopy} />
                      <PortalCard kind="custom" title="Subscription Payment" path="/p/subscription-payment"               pageKey="/p/subscription-payment"               themeColor="#6366f1" onCopy={handleCopy} />
                      <PortalCard kind="custom" title="New School Signup"    path="/register-new-signup"                  pageKey="/register-new-signup"                  themeColor="#10b981" onCopy={handleCopy} />
                      <PortalCard kind="custom" title="Results Directory"    path="/forms/results"                        pageKey="/forms/results"                        themeColor="#6366f1" onCopy={handleCopy} />
                    </>
                  )}
                </div>
              </section>
            )}

            {/* Surveys */}
            {filteredSurveys.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <SectionHeader title="Intelligent Surveys" badge={filteredSurveys.length} icon={ClipboardList} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredSurveys.map(s => (
                    <PortalCard
                      key={s.id}
                      kind="survey"
                      title={s.title}
                      description={s.description}
                      entityName={s.entityName ?? undefined}
                      logoUrl={s.logoUrl ?? (s.entityId ? byEntityId.get(s.entityId)?.logoUrl : undefined)}
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

            {/* PDFs */}
            {filteredPdfs.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <SectionHeader title="Doc Signing Portals" badge={filteredPdfs.length} icon={FileText} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredPdfs.map(p => (
                    <PortalCard
                      key={p.id}
                      kind="pdf"
                      title={p.publicTitle || p.name}
                      entityName={p.entityName ?? undefined}
                      logoUrl={p.logoUrl ?? (p.entityId ? byEntityId.get(p.entityId)?.logoUrl : undefined)}
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

            {/* Meetings */}
            {filteredMeetings.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
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
                        logoUrl={m.logoUrl ?? (m.entityId ? byEntityId.get(m.entityId)?.logoUrl : undefined)}
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

            {/* Empty */}
            {allEmpty && <EmptyState searchTerm={searchTerm} workspaceId={activeWorkspaceId} />}
          </div>
        )}
      </div>
    </PageContainerFluid>
  );
}