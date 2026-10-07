'use client';

/**
 * @fileOverview Global Activity & Audit Console Client (Phase 2 Milestone 3 - Task 6)
 *
 * Implements Three-Zone Layout, Rule 4 (Strict Typing), Rule 10 (Inline Architectural Documentation),
 * Rule 47 (Multi-Tenant Isolation), Rule 61 (Operator Console), and Rule 69 (Zero Regressions).
 *
 * Layout Structure:
 *   - Zone 1: Demarcated Header, Live Stream Health Indicator, DLQ Operator Console Trigger.
 *   - Zone 2: Actor Categorization Tabs, Domain Filters, Entity Scope Selection (via ActivityTimeline2).
 *   - Zone 3: Chronological & Live-Prepending Activity Feed with OpenTelemetry Trace Inspector.
 *
 * @testability Covered in `src/platform/__tests__/ui/global-activity-page.test.tsx`.
 */

import * as React from 'react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { ActivityTimeline2 } from '@/components/activity/ActivityTimeline2';
import { DeadLetterQueueDrawer } from '@/components/activity/DeadLetterQueueDrawer';
import Link from 'next/link';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/context/WorkspaceContext';
import { listDeadLetterEventsAction } from '@/app/actions/activity-actions';
import { Activity as ActivityIcon, ShieldAlert, Wifi, ArrowLeft } from 'lucide-react';

export function GlobalActivityClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const [dlqOpen, setDlqOpen] = React.useState<boolean>(false);
  const [dlqCount, setDlqCount] = React.useState<number>(0);

  const fetchDlqCount = React.useCallback(async () => {
    try {
      const res = await listDeadLetterEventsAction({
        organizationId: activeOrganizationId || undefined,
        workspaceId: activeWorkspaceId || undefined,
      });
      if (res.success && res.data) {
        setDlqCount(res.data.length);
      }
    } catch {
      // Background counter swallows transient errors
    }
  }, [activeOrganizationId, activeWorkspaceId]);

  React.useEffect(() => {
    void fetchDlqCount();
  }, [fetchDlqCount]);

  const handleDlqOpenChange = (open: boolean) => {
    setDlqOpen(open);
    if (!open) {
      void fetchDlqCount();
    }
  };

  return (
    <div className="h-full overflow-y-auto w-full">
      <PageContainerFluid>
        <div className="space-y-6 pb-28 w-full max-w-7xl mx-auto">
          {/* Zone 1: Demarcated Header & Operator Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
            <div className="flex items-center gap-2.5">
              <Link
                href="/admin"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                aria-label="Back to Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <ActivityIcon className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Global Activity & Audit Console
              </h1>
              <CardInfoTooltip text="Unified real-time activity timeline, actor attribution, distributed tracing, and operator recovery tools." />
            </div>

            {/* Operator Actions & Live Indicators */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Real-time SSE indicator */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <Wifi className="h-3 w-3" />
                <span>Live Feed</span>
              </div>

              {/* DLQ Drawer Trigger Button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setDlqOpen(true)}
                className="rounded-xl min-h-[44px] px-3.5 border-border/80 active:scale-[0.97] transition-transform text-xs font-semibold flex items-center gap-2"
                aria-label="Open Dead-Letter Queue Operator Console"
              >
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                <span>DLQ Console</span>
                {dlqCount > 0 ? (
                  <Badge
                    variant="destructive"
                    className="ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded-md"
                  >
                    {dlqCount}
                  </Badge>
                ) : (
                  <span className="text-[11px] text-muted-foreground font-mono font-normal">
                    (0)
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Zone 2 & 3: Timeline Component with Filters, Actor Tabs & Event Feed */}
          <div className="w-full">
            <ActivityTimeline2
              workspaceId={activeWorkspaceId || undefined}
              organizationId={activeOrganizationId || undefined}
            />
          </div>

          {/* Dead-Letter Queue Operator Drawer */}
          <DeadLetterQueueDrawer
            open={dlqOpen}
            onOpenChange={handleDlqOpenChange}
          />
        </div>
      </PageContainerFluid>
    </div>
  );
}

export default GlobalActivityClient;
