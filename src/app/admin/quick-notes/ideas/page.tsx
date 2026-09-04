'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lightbulb, Sparkles, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { IdeaStudioView } from '../components/ideas/IdeaStudioView';

export default function IdeaStudioPage() {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();

  if (!activeWorkspaceId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-3">
        <Lightbulb className="h-8 w-8 animate-pulse text-muted-foreground" />
        <p className="text-sm font-semibold text-muted-foreground">Select a workspace to open Idea Studio...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/quick-notes"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground hover:text-foreground transition-colors"
              title="Back to Quick Notes"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-primary" />
              Idea Intelligence Studio
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Structure raw thoughts into testable hypotheses, validate against CRM evidence, and prioritize with the ICE matrix.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/quick-notes/settings">
            <Button variant="outline" size="sm" className="h-9 text-xs font-semibold gap-1.5 rounded-xl">
              <Sliders className="h-3.5 w-3.5" />
              Studio Governance
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Studio View */}
      <IdeaStudioView
        workspaceId={activeWorkspaceId}
        userId={user?.uid || 'anonymous'}
        userName={user?.displayName || 'User'}
      />
    </div>
  );
}
