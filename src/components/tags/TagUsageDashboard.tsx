'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { TagUsageStats } from '@/lib/types';
import { getTagUsageStatsAction } from '@/lib/tag-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3, Users, Tag as TagIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagUsageDashboardProps {
  /** Refresh trigger — increment to force a reload */
  refreshKey?: number;
}

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'stable' }) {
  if (direction === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (direction === 'down') return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function UsageBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function TagUsageDashboard({ refreshKey }: TagUsageDashboardProps) {
  const { activeWorkspaceId } = useWorkspace() as any;

  const [stats, setStats] = useState<TagUsageStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getTagUsageStatsAction(activeWorkspaceId);
      if (result.success && result.data) {
        setStats(result.data);
      } else {
        setError(result.error || 'Failed to load stats');
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshKey]);

  const totalTags = stats.length;
  const totalContacts = stats.reduce((sum, s) => sum + s.contactCount, 0);
  const unusedCount = stats.filter(s => s.contactCount === 0).length;
  const topTags = stats.slice(0, 10);
  const maxCount = topTags[0]?.contactCount || 1;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <TagIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Tags</p>
                <p className="text-2xl font-black tabular-nums">{isLoading ? '—' : totalTags}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tag Usages</p>
                <p className="text-2xl font-black tabular-nums">{isLoading ? '—' : totalContacts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl">
                <BarChart3 className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg / Tag</p>
                <p className="text-2xl font-black tabular-nums">
                  {isLoading ? '—' : totalTags > 0 ? Math.round(totalContacts / totalTags) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl">
                <AlertCircle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unused</p>
                <p className="text-2xl font-black tabular-nums">{isLoading ? '—' : unusedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Most used tags chart */}
      <Card className="border-none shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Most Used Tags
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStats}
              disabled={isLoading}
              className="h-7 rounded-xl text-[10px] font-black uppercase tracking-widest gap-1"
            >
              <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-xs text-destructive font-medium">{error}</p>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
          ) : topTags.length === 0 ? (
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 text-center">
              No tag usage data yet
            </p>
          ) : (
            <div className="space-y-3">
              {topTags.map((stat, idx) => (
                <div key={stat.tagId} className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-muted-foreground w-4 shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold flex-1 truncate">{stat.tagName}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <TrendIcon direction={stat.trendDirection} />
                      <span className="text-xs font-black tabular-nums">{stat.contactCount}</span>
                      <span className="text-[9px] text-muted-foreground">contacts</span>
                    </div>
                  </div>
                  <UsageBar value={stat.contactCount} max={maxCount} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unused tags */}
      {!isLoading && unusedCount > 0 && (
        <Card className="border-none shadow-sm rounded-2xl border-dashed border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              Unused Tags ({unusedCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats
                .filter(s => s.contactCount === 0)
                .map(s => (
                  <Badge
                    key={s.tagId}
                    variant="outline"
                    className="text-[9px] font-black border-dashed text-muted-foreground"
                  >
                    {s.tagName}
                  </Badge>
                ))}
            </div>
            <p className="text-[10px] text-muted-foreground font-medium mt-3">
              Use the Cleanup Tools tab to remove unused tags.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
