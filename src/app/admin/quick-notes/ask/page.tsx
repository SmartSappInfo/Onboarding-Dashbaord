'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { PageContainerFluid } from '@/components/ui/page-container';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import AskSmartSappView from '../components/ask/AskSmartSappView';

export default function AskKnowledgePage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading Knowledge Engine...</div>}>
      <AskKnowledgePageContent />
    </React.Suspense>
  );
}

function AskKnowledgePageContent() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useUser();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get('q') || '';
  const entityId = searchParams.get('entityId') || undefined;
  const entityName = searchParams.get('entityName') || undefined;

  return (
    <div className="font-figtree">
      <PageContainerFluid className="py-6 px-4 md:px-8">
        <AskSmartSappView
          workspaceId={currentWorkspace?.id}
          userId={user?.uid}
          initialQuery={initialQuery}
          entityId={entityId}
          entityName={entityName}
        />
      </PageContainerFluid>
    </div>
  );
}
