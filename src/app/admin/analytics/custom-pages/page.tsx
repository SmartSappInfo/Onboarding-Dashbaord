import { Suspense } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { listTrackedPages } from '@/lib/custom-page-analytics-actions';
import type { CustomPageStats } from '@/lib/types';
import { BarChart2, Eye, Users, Play, CheckCircle2, RotateCcw, MousePointerClick, ArrowRight, Globe } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Custom Page Analytics | SmartSapp',
  description: 'Track visits, video engagement, and CTA clicks on custom landing pages.',
};

export const dynamic = 'force-dynamic';

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold tabular-nums">
      {label}
      <span className="text-slate-900 font-bold">{value.toLocaleString()}</span>
    </span>
  );
}

// ─── Page row ─────────────────────────────────────────────────────────────────

function PageRow({
  slug,
  stats,
  updatedAt,
}: {
  slug: string;
  stats: CustomPageStats;
  updatedAt: string;
}) {
  const completionRate =
    stats.videoStarts > 0
      ? Math.round((stats.videoCompletions / stats.videoStarts) * 100)
      : 0;

  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <Link
      href={`/admin/analytics/custom-pages/${encodeURIComponent(slug)}`}
      className="group flex flex-col gap-4 p-5 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-[0_4px_20px_-4px_rgba(59,95,255,0.15)] transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Globe className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate text-sm group-hover:text-blue-600 transition-colors">
              {slug}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Last activity: {formattedDate}</p>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5 text-slate-400 group-hover:text-blue-500 transition-colors">
          <span className="text-xs font-medium">View</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatPill label="Views" value={stats.views} />
        <StatPill label="Unique" value={stats.uniqueViews} />
        <StatPill label="Plays" value={stats.videoStarts} />
        <StatPill label="Completions" value={stats.videoCompletions} />
        <StatPill label="CTA Clicks" value={stats.ctaClicks} />
        {stats.videoStarts > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
            {completionRate}% completion
          </span>
        )}
      </div>
    </Link>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <BarChart2 className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">No tracked pages yet</h3>
      <p className="text-slate-500 text-sm max-w-sm">
        Pages appear here once visitors land on them, or once you register them via{' '}
        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">seedKnownCustomPages()</code>.
      </p>
    </div>
  );
}

// ─── Header stats bar ─────────────────────────────────────────────────────────

function SummaryBar({ pages }: { pages: { stats: CustomPageStats }[] }) {
  const totals = pages.reduce(
    (acc, p) => ({
      views: acc.views + p.stats.views,
      uniqueViews: acc.uniqueViews + p.stats.uniqueViews,
      videoStarts: acc.videoStarts + p.stats.videoStarts,
      videoCompletions: acc.videoCompletions + p.stats.videoCompletions,
      videoReplays: acc.videoReplays + p.stats.videoReplays,
      ctaClicks: acc.ctaClicks + p.stats.ctaClicks,
    }),
    { views: 0, uniqueViews: 0, videoStarts: 0, videoCompletions: 0, videoReplays: 0, ctaClicks: 0 }
  );

  const cards = [
    { label: 'Total Views', value: totals.views, icon: Eye },
    { label: 'Unique Visitors', value: totals.uniqueViews, icon: Users },
    { label: 'Video Plays', value: totals.videoStarts, icon: Play },
    { label: 'Completions', value: totals.videoCompletions, icon: CheckCircle2 },
    { label: 'Replays', value: totals.videoReplays, icon: RotateCcw },
    { label: 'CTA Clicks', value: totals.ctaClicks, icon: MousePointerClick },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {cards.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="flex flex-col gap-1.5 p-4 rounded-2xl bg-white border border-slate-200"
        >
          <Icon className="h-4 w-4 text-slate-400" />
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {value.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Page list (async) ────────────────────────────────────────────────────────

async function PageList() {
  const pages = await listTrackedPages();

  if (pages.length === 0) return <EmptyState />;

  return (
    <>
      <SummaryBar pages={pages} />
      <div className="space-y-3">
        {pages.map((page) => (
          <PageRow key={page.slug} slug={page.slug} stats={page.stats} updatedAt={page.updatedAt} />
        ))}
      </div>
    </>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function CustomPagesAnalyticsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Custom Page Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">
          Track visits, video engagement, and CTA conversions on landing pages.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        }
      >
        <PageList />
      </Suspense>
    </div>
  );
}
