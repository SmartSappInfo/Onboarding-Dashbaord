'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { listMediaSharesWithStatsAction, MediaPageStats } from '@/lib/media-analytics-actions';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  BarChart3, Film, Music, Eye, PlayCircle, CheckCircle, 
  MousePointerClick, Download, Search, ChevronRight,
  Loader2, ArrowUpDown, X, Filter
} from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { cn } from '@/lib/utils';

export type MetricFilterKey = 'views' | 'plays' | 'completions' | 'cta' | 'downloads' | 'engagement' | null;

export type SortOption = 
  | 'updated_desc' 
  | 'name_asc' 
  | 'name_desc' 
  | 'views_desc' 
  | 'plays_desc' 
  | 'completions_desc' 
  | 'cta_desc' 
  | 'downloads_desc' 
  | 'engagement_desc';

interface MediaShareStatsItem {
  shareId: string;
  customSlug?: string;
  title: string;
  assetName?: string;
  type: string;
  stats: MediaPageStats;
  updatedAt: string;
}

export default function MediaAnalyticsClient() {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const [shares, setShares] = React.useState<MediaShareStatsItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  // Interactive KPI metric filter & sort states
  const [activeMetric, setActiveMetric] = React.useState<MetricFilterKey>(null);
  const [sortOption, setSortOption] = React.useState<SortOption>('updated_desc');

  const loadData = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const result = await listMediaSharesWithStatsAction(activeWorkspaceId);
      setShares(result);
    } catch (err) {
      console.error('[MediaAnalyticsClient] Failed to load statistics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleMetricFilter = React.useCallback((key: MetricFilterKey) => {
    setActiveMetric(prev => (prev === key ? null : key));
  }, []);

  // Multi-dimensional Filter & Sort Pipeline
  const filteredShares = React.useMemo(() => {
    let result = [...shares];

    // 1. Text Search Filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(s => 
        s.title.toLowerCase().includes(term) || 
        (s.assetName && s.assetName.toLowerCase().includes(term)) ||
        (s.customSlug && s.customSlug.toLowerCase().includes(term)) ||
        s.shareId.toLowerCase().includes(term)
      );
    }

    // 2. KPI Metric Card Filter (> 0 count)
    if (activeMetric) {
      result = result.filter(s => {
        if (activeMetric === 'views') return (s.stats.views || 0) > 0;
        if (activeMetric === 'plays') return (s.stats.mediaPlays || 0) > 0;
        if (activeMetric === 'completions') return (s.stats.mediaCompletions || 0) > 0;
        if (activeMetric === 'cta') return (s.stats.ctaClicks || 0) > 0;
        if (activeMetric === 'downloads') return (s.stats.downloads || 0) > 0;
        if (activeMetric === 'engagement') {
          const rate = s.stats.mediaPlays > 0 ? (s.stats.mediaCompletions / s.stats.mediaPlays) : 0;
          return rate > 0;
        }
        return true;
      });
    }

    // 3. Effective Sort Key (Active KPI card overrides sort dropdown to arrange highest to lowest)
    const effectiveSort: SortOption = activeMetric
      ? activeMetric === 'views' ? 'views_desc'
        : activeMetric === 'plays' ? 'plays_desc'
        : activeMetric === 'completions' ? 'completions_desc'
        : activeMetric === 'cta' ? 'cta_desc'
        : activeMetric === 'downloads' ? 'downloads_desc'
        : 'engagement_desc'
      : sortOption;

    // 4. Sort Execution
    result.sort((a, b) => {
      const nameA = (a.assetName || a.title || '').toLowerCase();
      const nameB = (b.assetName || b.title || '').toLowerCase();

      if (effectiveSort === 'name_asc') {
        return nameA.localeCompare(nameB);
      }
      if (effectiveSort === 'name_desc') {
        return nameB.localeCompare(nameA);
      }
      if (effectiveSort === 'views_desc') {
        return (b.stats.views || 0) - (a.stats.views || 0);
      }
      if (effectiveSort === 'plays_desc') {
        return (b.stats.mediaPlays || 0) - (a.stats.mediaPlays || 0);
      }
      if (effectiveSort === 'completions_desc') {
        return (b.stats.mediaCompletions || 0) - (a.stats.mediaCompletions || 0);
      }
      if (effectiveSort === 'cta_desc') {
        return (b.stats.ctaClicks || 0) - (a.stats.ctaClicks || 0);
      }
      if (effectiveSort === 'downloads_desc') {
        return (b.stats.downloads || 0) - (a.stats.downloads || 0);
      }
      if (effectiveSort === 'engagement_desc') {
        const rateA = a.stats.mediaPlays > 0 ? (a.stats.mediaCompletions / a.stats.mediaPlays) : 0;
        const rateB = b.stats.mediaPlays > 0 ? (b.stats.mediaCompletions / b.stats.mediaPlays) : 0;
        return rateB - rateA;
      }
      // Default: updated_desc
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });

    return result;
  }, [shares, searchTerm, activeMetric, sortOption]);

  // Aggregate Metrics
  const summary = React.useMemo(() => {
    let totalViews = 0;
    let totalUniques = 0;
    let totalPlays = 0;
    let totalCompletions = 0;
    let totalCtaClicks = 0;
    let totalDownloads = 0;

    shares.forEach(s => {
      totalViews += s.stats.views || 0;
      totalUniques += s.stats.uniqueViews || 0;
      totalPlays += s.stats.mediaPlays || 0;
      totalCompletions += s.stats.mediaCompletions || 0;
      totalCtaClicks += s.stats.ctaClicks || 0;
      totalDownloads += s.stats.downloads || 0;
    });

    const completionRate = totalPlays > 0 ? Math.round((totalCompletions / totalPlays) * 100) : 0;
    const ctaRate = totalUniques > 0 ? Math.round((totalCtaClicks / totalUniques) * 100) : 0;

    return {
      totalViews,
      totalUniques,
      totalPlays,
      totalCompletions,
      totalCtaClicks,
      totalDownloads,
      completionRate,
      ctaRate
    };
  }, [shares]);

  if (isLoading) {
    return (
      <PageContainerFluid>
        <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading analytics hub...</p>
        </div>
      </PageContainerFluid>
    );
  }

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-20 w-full text-left">
        {/* Top Title & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" /> Media Link Analytics
            </h1>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Track engagement, views, completion rates, and automated CRM conversion metrics across all shared media.
            </p>
          </div>
        </div>

        {/* Aggregate KPI Grid - Interactive Tap-to-Filter & Sort */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card 
            onClick={() => handleToggleMetricFilter('views')}
            className={cn(
              "rounded-2xl border bg-card shadow-sm cursor-pointer transition-all active:scale-[0.98] min-h-[44px] select-none",
              activeMetric === 'views' 
                ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5 shadow-md" 
                : "border-border hover:border-primary/20"
            )}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block">Total Views</span>
                <span className="text-xl font-black text-foreground mt-0.5 block">{summary.totalViews}</span>
                <span className="text-[9px] text-slate-500 font-medium block">
                  {summary.totalUniques} Unique sessions
                </span>
              </div>
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                activeMetric === 'views' ? "bg-blue-500 text-white" : "bg-blue-500/10 text-blue-500"
              )}>
                <Eye className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card 
            onClick={() => handleToggleMetricFilter('plays')}
            className={cn(
              "rounded-2xl border bg-card shadow-sm cursor-pointer transition-all active:scale-[0.98] min-h-[44px] select-none",
              activeMetric === 'plays' 
                ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5 shadow-md" 
                : "border-border hover:border-primary/20"
            )}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block">Total Plays</span>
                <span className="text-xl font-black text-foreground mt-0.5 block">{summary.totalPlays}</span>
                <span className="text-[9px] text-slate-500 font-medium block">Started playback</span>
              </div>
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                activeMetric === 'plays' ? "bg-emerald-500 text-white" : "bg-emerald-500/10 text-emerald-500"
              )}>
                <PlayCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card 
            onClick={() => handleToggleMetricFilter('completions')}
            className={cn(
              "rounded-2xl border bg-card shadow-sm cursor-pointer transition-all active:scale-[0.98] min-h-[44px] select-none",
              activeMetric === 'completions' 
                ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/5 shadow-md" 
                : "border-border hover:border-primary/20"
            )}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block">Completions</span>
                <span className="text-xl font-black text-foreground mt-0.5 block">{summary.totalCompletions}</span>
                <span className="text-[9px] text-emerald-600 font-bold block">
                  {summary.completionRate}% Avg completion
                </span>
              </div>
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                activeMetric === 'completions' ? "bg-purple-500 text-white" : "bg-purple-500/10 text-purple-500"
              )}>
                <CheckCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card 
            onClick={() => handleToggleMetricFilter('cta')}
            className={cn(
              "rounded-2xl border bg-card shadow-sm cursor-pointer transition-all active:scale-[0.98] min-h-[44px] select-none",
              activeMetric === 'cta' 
                ? "border-violet-500 ring-2 ring-violet-500/20 bg-violet-500/5 shadow-md" 
                : "border-border hover:border-primary/20"
            )}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block">CTA Clicks</span>
                <span className="text-xl font-black text-foreground mt-0.5 block">{summary.totalCtaClicks}</span>
                <span className="text-[9px] text-violet-600 font-bold block">
                  {summary.ctaRate}% Click-through
                </span>
              </div>
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                activeMetric === 'cta' ? "bg-violet-500 text-white" : "bg-violet-500/10 text-violet-500"
              )}>
                <MousePointerClick className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card 
            onClick={() => handleToggleMetricFilter('downloads')}
            className={cn(
              "rounded-2xl border bg-card shadow-sm cursor-pointer transition-all active:scale-[0.98] min-h-[44px] select-none",
              activeMetric === 'downloads' 
                ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5 shadow-md" 
                : "border-border hover:border-primary/20"
            )}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block">Downloads</span>
                <span className="text-xl font-black text-foreground mt-0.5 block">{summary.totalDownloads}</span>
                <span className="text-[9px] text-slate-500 font-medium block">File saves</span>
              </div>
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                activeMetric === 'downloads' ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-500"
              )}>
                <Download className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card 
            onClick={() => handleToggleMetricFilter('engagement')}
            className={cn(
              "rounded-2xl border bg-card shadow-sm cursor-pointer transition-all active:scale-[0.98] min-h-[44px] select-none",
              activeMetric === 'engagement' 
                ? "border-orange-500 ring-2 ring-orange-500/20 bg-orange-500/5 shadow-md" 
                : "border-border hover:border-primary/20"
            )}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block">Engagement</span>
                <span className="text-xl font-black text-foreground mt-0.5 block">
                  {summary.completionRate}%
                </span>
                <span className="text-[9px] text-slate-500 font-medium block">
                  Average watch completion
                </span>
              </div>
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                activeMetric === 'engagement' ? "bg-orange-500 text-white" : "bg-orange-500/10 text-orange-500"
              )}>
                <BarChart3 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search Toolbar */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
              <Input 
                placeholder="Search shared pages by asset name, title, or slug..." 
                className="pl-11 h-11 rounded-xl border border-border shadow-sm font-bold text-sm focus:ring-1 focus:ring-primary/20" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>

            {/* Sort Controls Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                <SelectTrigger className="h-11 rounded-xl border border-border bg-card shadow-sm font-bold text-xs w-full sm:w-[220px] min-h-[44px]">
                  <div className="flex items-center gap-2 truncate">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Sort pages by..." />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl font-medium">
                  <SelectItem value="updated_desc" className="text-xs font-semibold">Recently Published / Updated</SelectItem>
                  <SelectItem value="name_asc" className="text-xs font-semibold">Media File Name (A to Z)</SelectItem>
                  <SelectItem value="name_desc" className="text-xs font-semibold">Media File Name (Z to A)</SelectItem>
                  <SelectItem value="views_desc" className="text-xs font-semibold">Highest Views</SelectItem>
                  <SelectItem value="plays_desc" className="text-xs font-semibold">Highest Plays</SelectItem>
                  <SelectItem value="completions_desc" className="text-xs font-semibold">Highest Completions</SelectItem>
                  <SelectItem value="cta_desc" className="text-xs font-semibold">Highest CTA Clicks</SelectItem>
                  <SelectItem value="downloads_desc" className="text-xs font-semibold">Highest Downloads</SelectItem>
                  <SelectItem value="engagement_desc" className="text-xs font-semibold">Highest Engagement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Metric Filter Badge Pill */}
          {activeMetric && (
            <div className="flex items-center gap-2 pt-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
                <Filter className="h-3.5 w-3.5" />
                <span>
                  Filtered by: {
                    activeMetric === 'views' ? 'Total Views (Highest to Lowest)' :
                    activeMetric === 'plays' ? 'Total Plays (Highest to Lowest)' :
                    activeMetric === 'completions' ? 'Completions (Highest to Lowest)' :
                    activeMetric === 'cta' ? 'CTA Clicks (Highest to Lowest)' :
                    activeMetric === 'downloads' ? 'Downloads (Highest to Lowest)' :
                    'Engagement (Highest to Lowest)'
                  }
                </span>
                <button
                  onClick={() => setActiveMetric(null)}
                  className="p-0.5 rounded-full hover:bg-primary/20 transition-colors ml-1 text-primary cursor-pointer min-h-[24px] min-w-[24px] flex items-center justify-center"
                  title="Clear metric filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {filteredShares.length === 0 ? (
            <Card className="rounded-2xl border border-border bg-card text-center py-16">
              <CardContent className="flex flex-col items-center justify-center space-y-3">
                <BarChart3 className="h-12 w-12 text-muted-foreground opacity-30" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {searchTerm || activeMetric ? 'No matching media pages found' : 'No media analytics logged'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                  {searchTerm || activeMetric 
                    ? 'No shared media pages match your current search or active KPI metric filter.' 
                    : 'Shared media pages will display analytics summary panels here as soon as viewers open links.'
                  }
                </p>
                {(searchTerm || activeMetric) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setActiveMetric(null);
                    }}
                    className="mt-2 h-9 px-4 rounded-xl text-xs font-bold min-h-[44px] active:scale-[0.97] cursor-pointer"
                  >
                    Reset All Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredShares.map((item) => {
                const isVideo = item.type === 'video';
                const hasPlayback = item.stats.mediaPlays > 0;
                const singleCompletionRate = hasPlayback 
                  ? Math.round((item.stats.mediaCompletions / item.stats.mediaPlays) * 100)
                  : 0;

                return (
                  <Card 
                    key={item.shareId}
                    onClick={() => router.push(`/admin/media/analytics/${item.shareId}`)}
                    className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer overflow-hidden group active:scale-[0.995]"
                  >
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left Block */}
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                          isVideo ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                        )}>
                          {isVideo ? <Film className="h-5 w-5" /> : <Music className="h-5 w-5" />}
                        </div>
                        <div className="space-y-0.5 text-left">
                          {item.assetName ? (
                            <>
                              <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight group-hover:text-primary transition-colors">
                                {item.assetName}
                              </h4>
                              <p className="text-xs font-semibold text-muted-foreground leading-snug">
                                {item.title}
                              </p>
                            </>
                          ) : (
                            <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight group-hover:text-primary transition-colors">
                              {item.title}
                            </h4>
                          )}
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border inline-block mt-0.5">
                            /m/{item.customSlug || item.shareId}
                          </span>
                        </div>
                      </div>

                      {/* Middle Metrics - Right Aligned */}
                      <div className="grid grid-cols-4 gap-6 text-right sm:ml-auto shrink-0 items-center">
                        <div className="space-y-0.5 flex flex-col items-end text-right">
                          <span className="text-[8px] font-black uppercase text-muted-foreground tracking-wider block text-right">Views</span>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 text-right block">
                            {item.stats.views} <span className="text-[10px] font-normal text-muted-foreground">({item.stats.uniqueViews})</span>
                          </span>
                        </div>

                        <div className="space-y-0.5 flex flex-col items-end text-right">
                          <span className="text-[8px] font-black uppercase text-muted-foreground tracking-wider block text-right">Plays</span>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 text-right block">
                            {item.stats.mediaPlays}
                          </span>
                        </div>

                        <div className="space-y-0.5 flex flex-col items-end text-right">
                          <span className="text-[8px] font-black uppercase text-muted-foreground tracking-wider block text-right">Complete</span>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 text-right block">
                            {singleCompletionRate}%
                          </span>
                        </div>

                        <div className="space-y-0.5 flex flex-col items-end text-right">
                          <span className="text-[8px] font-black uppercase text-muted-foreground tracking-wider block text-right">CTA Clicks</span>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 text-right block">
                            {item.stats.ctaClicks}
                          </span>
                        </div>
                      </div>

                      {/* Right Indicator */}
                      <div className="flex justify-end items-center shrink-0">
                        <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageContainerFluid>
  );
}
