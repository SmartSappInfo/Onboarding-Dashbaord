import { Suspense } from 'react';
import { Metadata } from 'next';
import { BarChart2 } from 'lucide-react';
import { listTrackedPages } from '@/lib/custom-page-analytics-actions';
import CustomPagesClient from './CustomPagesClient';

export const metadata: Metadata = {
  title: 'Custom Page Analytics | SmartSapp',
  description: 'Track visits, video engagement, and CTA clicks on custom landing pages.',
};

export const dynamic = 'force-dynamic';

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

// ─── Page list (async) ────────────────────────────────────────────────────────

async function PageList() {
  const pages = await listTrackedPages();

  if (pages.length === 0) return <EmptyState />;

  return <CustomPagesClient initialPages={pages} />;
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
