'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, Download, Search, ArrowUpDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Form, FormSubmission } from '@/lib/types';
import { computeSubmissionStats, getSubmissionPreview } from '@/lib/forms-utils';
import { getFormSubmissionsAction } from '@/lib/forms-actions';
import SubmissionStatsStrip from './components/SubmissionStatsStrip';
import SubmissionsTable from './components/SubmissionsTable';
import SubmissionDrawer from './components/SubmissionDrawer';
import ExportButton from './components/ExportButton';

interface Props {
  form: Form;
  initialSubmissions: FormSubmission[];
  initialNextCursor: string | null;
}

export default function SubmissionsClient({ form, initialSubmissions, initialNextCursor }: Props) {
  const [submissions, setSubmissions] = React.useState(initialSubmissions);
  const [nextCursor, setNextCursor] = React.useState(initialNextCursor);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeSubmission, setActiveSubmission] = React.useState<FormSubmission | null>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  // Client-side search filtering (no re-fetch for fast UX)
  const filtered = React.useMemo(() => {
    if (!searchTerm.trim()) return submissions;
    const q = searchTerm.toLowerCase();
    return submissions.filter(s => {
      const dataStr = JSON.stringify(s.data).toLowerCase();
      return dataStr.includes(q) || s.id.includes(q) || (s.entityId ?? '').includes(q);
    });
  }, [submissions, searchTerm]);

  const stats = React.useMemo(() => computeSubmissionStats(submissions), [submissions]);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await getFormSubmissionsAction(form.id, { limit: 50, cursor: nextCursor });
      setSubmissions(prev => [...prev, ...result.submissions]);
      setNextCursor(result.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border/40 px-6 py-4">
        <div className="flex items-center justify-between gap-4 max-w-screen-xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1.5 text-muted-foreground">
              <Link href="/admin/forms">
                <ChevronLeft className="h-4 w-4" />
                Forms
              </Link>
            </Button>
            <span className="text-muted-foreground/40 font-light">/</span>
            <span className="font-semibold truncate">{form.internalName}</span>
            <Badge variant="secondary" className="shrink-0 font-mono text-xs">
              {stats.total} submission{stats.total !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="outline" size="sm" className="gap-2 rounded-lg font-medium">
              <Link href={`/admin/forms/${form.id}/edit`}>
                <FileText className="h-3.5 w-3.5" />
                Edit Form
              </Link>
            </Button>
            <ExportButton formId={form.id} />
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Strip */}
        <SubmissionStatsStrip stats={stats} />

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search submissions…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 rounded-lg bg-card border-border/50 focus-visible:ring-primary/30"
            />
          </div>
          {searchTerm && (
            <span className="text-sm text-muted-foreground">
              {filtered.length} of {submissions.length}
            </span>
          )}
        </div>

        {/* Table */}
        <SubmissionsTable
          submissions={filtered}
          form={form}
          onSelect={setActiveSubmission}
        />

        {/* Load More */}
        {nextCursor && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              className="rounded-xl font-medium"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </main>

      {/* Detail Drawer */}
      <SubmissionDrawer
        submission={activeSubmission}
        form={form}
        onClose={() => setActiveSubmission(null)}
      />
    </div>
  );
}
