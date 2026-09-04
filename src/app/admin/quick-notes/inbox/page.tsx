'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Inbox, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { KnowledgeInboxView } from '../components/inbox/KnowledgeInboxView';

export default function KnowledgeInboxPage() {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();

  if (!activeWorkspaceId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-3">
        <Inbox className="h-8 w-8 animate-pulse text-muted-foreground" />
        <p className="text-sm font-semibold text-muted-foreground">Select a workspace to open Knowledge Inbox...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Breadcrumbs & Direct Settings Link */}
      <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/quick-notes"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground hover:text-foreground transition-colors"
            title="Back to Quick Notes"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-xs font-semibold text-muted-foreground">
            Company Brain / Knowledge Inbox
          </span>
        </div>

        <Link href="/admin/quick-notes/settings">
          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1.5 rounded-xl">
            <Sliders className="h-3.5 w-3.5" />
            Inbox Governance
          </Button>
        </Link>
      </div>

      {/* Main Inbox View */}
      <KnowledgeInboxView
        workspaceId={activeWorkspaceId}
        userId={user?.uid || 'anonymous'}
      />
    </div>
  );
}
