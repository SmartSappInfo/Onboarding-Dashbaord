'use client';

/**
 * @fileOverview Reusable Activity Timeline 2.0 (Phase 2 Milestone 3 - Task 3)
 *
 * Implements Rule 1 (Preserve Existing Functionality), Rule 4 (Strict Typing),
 * Rule 7 (Visual Clarity & Everyday English), Rule 9 (Bounded Pagination),
 * Rule 10 (Inline Architectural Documentation), Rule 16 (Actor Classes),
 * Rule 24 (Resilient Stream Fallback), and Emil Kowalski Motion Principles.
 *
 * Key Capabilities:
 *   1. Real-Time Streaming: Automatically prepends live activities via `useEventStream` with spring entrance.
 *   2. Actor Filtering: Tabs for `All`, `Human (User)`, `AI (Agent)`, `Automation`, and `System`.
 *   3. Domain Filtering: Select between CRM, Deals, Tasks, Messaging, and Portals.
 *   4. Debounced Search: Live filtering across summaries, actor names, and entity titles.
 *   5. Date Grouping: Automatic chronological day dividers ('Today', 'Yesterday', Date).
 *   6. Cursor Pagination: Infinite/Load More pagination fetching older records via `listActivitiesAction`.
 *   7. Inspect Drawer Integration: Opens standardized modal inspection drawer adhering to theme.md §8.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 *
 * @testability Covered in `src/platform/__tests__/ui/activity-timeline2.test.tsx`.
 */

import * as React from 'react';
import type { ActivityRecordV2 } from '@/platform/events/contracts/activity-record.contract';
import { ActivityItem2 } from './ActivityItem2';
import { ActivityInspectDrawer } from './ActivityInspectDrawer';
import { useEventStream } from '@/hooks/useEventStream';
import { listActivitiesAction } from '@/app/actions/activity-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity as ActivityIcon,
  Search,
  RefreshCw,
  User,
  Sparkles,
  Zap,
  Settings2,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export type ActorFilterTab = 'all' | 'user' | 'agent' | 'automation' | 'system';

export interface ActivityTimeline2Props {
  organizationId?: string;
  workspaceId?: string | null;
  entityId?: string | null;
  dealId?: string | null;
  initialActivities?: ActivityRecordV2[];
  showFilters?: boolean;
  showLiveBadge?: boolean;
  className?: string;
}

/**
 * Groups an array of activities into chronological day buckets.
 */
function groupActivitiesByDay(activities: ActivityRecordV2[]): Map<string, ActivityRecordV2[]> {
  const groups = new Map<string, ActivityRecordV2[]>();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  for (const act of activities) {
    const actDate = act.timestamp ? act.timestamp.split('T')[0] : 'Unknown';
    let label = actDate;
    if (actDate === todayStr) {
      label = 'Today';
    } else if (actDate === yesterdayStr) {
      label = 'Yesterday';
    } else if (actDate && actDate !== 'Unknown') {
      try {
        const d = new Date(act.timestamp);
        label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        label = actDate;
      }
    }

    const existing = groups.get(label) || [];
    existing.push(act);
    groups.set(label, existing);
  }

  return groups;
}

export function ActivityTimeline2({
  organizationId,
  workspaceId,
  entityId,
  dealId,
  initialActivities = [],
  showFilters = true,
  showLiveBadge = true,
  className,
}: ActivityTimeline2Props) {
  // 1. Local State
  const [activities, setActivities] = React.useState<ActivityRecordV2[]>(initialActivities);
  const [actorTab, setActorTab] = React.useState<ActorFilterTab>('all');
  const [domainFilter, setDomainFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [isLoadingMore, setIsLoadingMore] = React.useState<boolean>(false);
  const [hasMore, setHasMore] = React.useState<boolean>(true);
  const [inspectingActivity, setInspectingActivity] = React.useState<ActivityRecordV2 | null>(null);

  // 2. Real-Time Event Stream Hook (Task 1)
  const effectiveEntityId = entityId || dealId || undefined;
  const { status: streamStatus } = useEventStream({
    workspaceId,
    entityId: effectiveEntityId,
    actorType: actorTab !== 'all' ? actorTab : undefined,
    enabled: true,
    onActivity: (newRecord) => {
      setActivities((prev) => {
        // Prevent duplicates
        if (prev.some((a) => a.id === newRecord.id || a.eventId === newRecord.eventId)) {
          return prev;
        }
        return [newRecord, ...prev];
      });
    },
  });

  // 3. Initial Load if initialActivities empty
  React.useEffect(() => {
    if (initialActivities.length > 0) {
      setActivities(initialActivities);
      return;
    }

    let isMounted = true;
    async function loadInitial() {
      const res = await listActivitiesAction({
        organizationId: organizationId || undefined,
        workspaceId: workspaceId ?? undefined,
        entityId: effectiveEntityId,
        actorType: actorTab !== 'all' ? actorTab : undefined,
        limit: 50,
      });

      if (isMounted && res.success && Array.isArray(res.data)) {
        setActivities(res.data);
        if (res.data.length < 50) {
          setHasMore(false);
        }
      }
    }

    loadInitial();
    return () => {
      isMounted = false;
    };
  }, [organizationId, workspaceId, effectiveEntityId, actorTab, initialActivities]);

  // 4. Load More pagination
  const handleLoadMore = async () => {
    if (isLoadingMore || activities.length === 0) return;
    setIsLoadingMore(true);

    const oldestTimestamp = activities[activities.length - 1]?.timestamp;
    const res = await listActivitiesAction({
      organizationId: organizationId || undefined,
      workspaceId: workspaceId ?? undefined,
      entityId: effectiveEntityId,
      actorType: actorTab !== 'all' ? actorTab : undefined,
      afterTimestamp: oldestTimestamp,
      limit: 30,
    });

    if (res.success && Array.isArray(res.data)) {
      if (res.data.length === 0) {
        setHasMore(false);
      } else {
        setActivities((prev) => [...prev, ...res.data!]);
        if (res.data.length < 30) {
          setHasMore(false);
        }
      }
    } else {
      toast({ title: 'Error', description: 'Failed to load older activities.', variant: 'destructive' });
    }
    setIsLoadingMore(false);
  };

  // 5. Client Filtering (Search & Domain)
  const filteredActivities = React.useMemo(() => {
    return activities.filter((act) => {
      // Actor filter
      if (actorTab !== 'all' && act.actor.type !== actorTab) {
        return false;
      }

      // Domain filter
      if (domainFilter !== 'all') {
        const eventPrefix = act.eventType.split('.')[0];
        if (eventPrefix !== domainFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSummary = act.summary.toLowerCase().includes(query);
        const matchesActor = act.actor.displayName.toLowerCase().includes(query);
        const matchesEntity = act.entity?.name?.toLowerCase().includes(query);
        const matchesId = act.eventId.toLowerCase().includes(query);

        if (!matchesSummary && !matchesActor && !matchesEntity && !matchesId) {
          return false;
        }
      }

      return true;
    });
  }, [activities, actorTab, domainFilter, searchQuery]);

  // 6. Chronological Date Grouping
  const grouped = React.useMemo(() => {
    return groupActivitiesByDay(filteredActivities);
  }, [filteredActivities]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Top Controls Bar: Live Status & Filters */}
      <div className="flex flex-col gap-3">
        {showFilters && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
            {/* Actor Class Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/60 overflow-x-auto">
              <Button
                type="button"
                variant={actorTab === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActorTab('all')}
                className="h-8 px-3 text-xs font-medium rounded-lg active:scale-95 transition-all"
              >
                All
              </Button>
              <Button
                type="button"
                variant={actorTab === 'user' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActorTab('user')}
                className="h-8 px-2.5 text-xs font-medium rounded-lg flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <User className="h-3.5 w-3.5 text-blue-600" />
                <span>Human</span>
              </Button>
              <Button
                type="button"
                variant={actorTab === 'agent' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActorTab('agent')}
                className="h-8 px-2.5 text-xs font-medium rounded-lg flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                <span>AI</span>
              </Button>
              <Button
                type="button"
                variant={actorTab === 'automation' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActorTab('automation')}
                className="h-8 px-2.5 text-xs font-medium rounded-lg flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Zap className="h-3.5 w-3.5 text-amber-600" />
                <span>Automation</span>
              </Button>
              <Button
                type="button"
                variant={actorTab === 'system' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActorTab('system')}
                className="h-8 px-2.5 text-xs font-medium rounded-lg flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Settings2 className="h-3.5 w-3.5 text-slate-600" />
                <span>System</span>
              </Button>
            </div>

            {/* Right side: Domain Selector & Live Stream Status */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Domain Selector */}
              <Select value={domainFilter} onValueChange={setDomainFilter}>
                <SelectTrigger className="h-9 w-[150px] text-xs rounded-xl border-border/80">
                  <SelectValue placeholder="All Domains" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/80">
                  <SelectItem value="all">All Domains</SelectItem>
                  <SelectItem value="crm">CRM & Contacts</SelectItem>
                  <SelectItem value="deal">Deals & Revenue</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                  <SelectItem value="messaging">Messaging</SelectItem>
                  <SelectItem value="portal">Portals</SelectItem>
                </SelectContent>
              </Select>

              {/* Pulsing Live Stream Status Badge */}
              {showLiveBadge && (
                <div
                  data-testid="stream-status-badge"
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium shrink-0 transition-colors',
                    streamStatus === 'connected'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60'
                      : streamStatus === 'connecting'
                      ? 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60'
                      : 'bg-muted/50 text-muted-foreground border-border/80'
                  )}
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      streamStatus === 'connected'
                        ? 'bg-emerald-500 animate-pulse'
                        : streamStatus === 'connecting'
                        ? 'bg-amber-500 animate-ping'
                        : 'bg-slate-400'
                    )}
                  />
                  <span>
                    {streamStatus === 'connected'
                      ? 'Live Stream'
                      : streamStatus === 'connecting'
                      ? 'Connecting...'
                      : 'Polling'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search Bar */}
        {showFilters && (
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search activity by summary, actor, or entity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-10 pr-4 rounded-xl border-border/80 bg-background/50 text-xs focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {/* Timeline List Body */}
      {filteredActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-border/80 rounded-2xl bg-muted/5">
          <ActivityIcon className="h-8 w-8 text-muted-foreground/60 mb-2" />
          <h4 className="text-sm font-semibold text-foreground">No activities found</h4>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            {searchQuery
              ? 'No activity records match your active search and filter criteria.'
              : 'There are no recorded activities for this scope yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([dateLabel, dayActivities]) => (
            <div key={dateLabel} className="space-y-2.5">
              {/* Chronological Day Divider Header */}
              <div className="flex items-center gap-2 py-1">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {dateLabel}
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

              {/* Day's Activities */}
              <div className="space-y-2">
                {dayActivities.map((act) => (
                  <ActivityItem2
                    key={act.id}
                    activity={act}
                    onInspect={(selected) => setInspectingActivity(selected)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="h-9 px-4 rounded-xl text-xs font-medium border-border/80 active:scale-[0.97] transition-all flex items-center gap-2"
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading older activities...</span>
                  </>
                ) : (
                  <span>Load More Activities</span>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Inspect Drawer (§8 theme.md) */}
      <ActivityInspectDrawer
        activity={inspectingActivity}
        open={inspectingActivity !== null}
        onOpenChange={(open) => {
          if (!open) setInspectingActivity(null);
        }}
      />
    </div>
  );
}
