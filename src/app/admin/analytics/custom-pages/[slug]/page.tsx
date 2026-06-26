import { Suspense } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCustomPageAnalytics } from '@/lib/custom-page-analytics-actions';
import { AnalyticsDrilldownClient } from './analytics-drilldown-client';

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  return {
    title: `${decoded} — Page Analytics | SmartSapp`,
  };
}

export const dynamic = 'force-dynamic';

// ─── Data fetcher (async server component) ────────────────────────────────────

async function DrilldownData({ slug }: { slug: string }) {
  const data = await getCustomPageAnalytics(slug);

  // If no document exists yet, the stats will be zeroed — still render the page.
  // Only 404 if someone passes a completely invalid/empty slug.
  if (!slug) notFound();

  return <AnalyticsDrilldownClient slug={slug} data={data} />;
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default async function CustomPageDrilldownPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Back link */}
      <Link
        href="/admin/analytics/custom-pages"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        All pages
      </Link>

      <div className="mb-8">
        <h1 className="text-xl font-bold text-slate-900 break-all">{decoded}</h1>
        <p className="text-slate-500 text-sm mt-1 font-mono">/{decoded}</p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
            <div className="h-64 rounded-2xl bg-slate-100 animate-pulse mt-4" />
          </div>
        }
      >
        <DrilldownData slug={decoded} />
      </Suspense>
    </div>
  );
}
