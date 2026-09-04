'use client';

/**
 * @fileOverview CompanyBrain 2.0: Global Knowledge Search Page
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Dedicated Semantic Search Surface (PRD Section 18 & UI Section 6):
 *    - Route: `/admin/quick-notes/search`
 *    - Connects workspace users to pre-filtered Qdrant vector retrieval.
 * 2. Strict Zero-`any` Standard:
 *    - Fully typed with TypeScript interfaces.
 * 3. Mobile & Accessibility First:
 *    - Uses responsive layout and touch targets >= 44px (`min-h-[44px]`).
 * 4. Suspense Boundary:
 *    - Wraps `useSearchParams()` in a React Suspense boundary to satisfy Next.js guidelines.
 *
 * @testability Tested via component rendering and semantic-search-actions unit tests.
 */

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Sparkles, Brain } from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { GlobalKnowledgeSearch } from '@/components/memory/search/GlobalKnowledgeSearch';

export default function GlobalKnowledgeSearchPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-12 px-6 max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      }
    >
      <SearchPageContent />
    </React.Suspense>
  );
}

function SearchPageContent() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get('q') || '';

  return (
    <div className="font-figtree min-h-screen bg-background">
      <PageContainerFluid className="py-6 px-4 md:px-8 max-w-6xl mx-auto space-y-6">
        {/* Top Navigation & Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/quick-notes">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 active:scale-[0.97] transition-transform min-h-[44px] sm:min-h-[36px]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Quick Notes</span>
              </Button>
            </Link>
            <div className="h-4 w-px bg-border/60 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  Global Knowledge Search
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/40">
                    <Sparkles className="h-2.5 w-2.5" />
                    Vector Engine
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground">
                  Pre-filtered semantic retrieval across institutional memories with verbatim evidence.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/admin/quick-notes/ask">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] sm:min-h-[36px] text-xs gap-1.5 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-900/40 hover:bg-violet-50 dark:hover:bg-violet-950/40 active:scale-[0.97]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ask Brain AI</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Global Semantic Search Component */}
        <div className="w-full">
          <GlobalKnowledgeSearch
            workspaceId={activeWorkspaceId || ''}
            organizationId={activeOrganizationId || ''}
            userId={user?.uid || ''}
            initialQuery={initialQuery}
          />
        </div>
      </PageContainerFluid>
    </div>
  );
}
