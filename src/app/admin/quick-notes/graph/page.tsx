'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { PageContainerFluid } from '@/components/ui/page-container';
import { KnowledgeGraphView } from '../components/graph/KnowledgeGraphView';

export default function KnowledgeGraphPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">
          Loading Knowledge Graph Network…
        </div>
      }
    >
      <KnowledgeGraphPageContent />
    </React.Suspense>
  );
}

function KnowledgeGraphPageContent() {
  const searchParams = useSearchParams();
  const initialFocus = searchParams?.get('focus') || undefined;

  return (
    <div className="font-figtree">
      <PageContainerFluid className="py-4 px-4 md:px-6 max-w-[1700px]">
        <KnowledgeGraphView initialFocusNodeId={initialFocus} />
      </PageContainerFluid>
    </div>
  );
}
