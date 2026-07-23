'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { listMediaSharesWithStatsAction, MediaPageStats } from '@/lib/media-analytics-actions';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  BarChart3, Film, Music, Eye, PlayCircle, CheckCircle, 
  MousePointerClick, Download, Search, ChevronRight,
  Loader2, Sparkles
} from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { cn } from '@/lib/utils';

interface MediaShareStatsItem {
  shareId: string;
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

  const filteredShares = React.useMemo(() => {
    if (!searchTerm.trim()) return shares;
    const term = searchTerm.toLowerCase();
    return shares.filter(s => 
      s.title.toLowerCase().includes(term) || 
      (s.assetName && s.assetName.toLowerCase().includes(term)) ||
      s.shareId.toLowerCase().includes(term)
    );
  }, [shares, searchTerm]);

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

        {/* Aggregate KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="rounded-2xl border border-border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block">Total Views</span>
                <span className="text-xl font-black text-foreground mt-0.5 block">{summary.totalViews}</span>
                <span className="text-[9px] text-slate-500 font-medium block">
                  {summary.totalUniques} Unique sessions
                </span>
              </div>
              <div className="h-10 w-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                <Eye className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block">Total Plays</span>
                <span className="text-xl font-black text-foreground mt-0.5 block">{summary.totalPlays}</span>
                <span className="text-[9px] text-slate-500 font-medium block">Started playback</span>
              </div>
              <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                <PlayCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block">Completions</span>
                <span className="text-xl font-black text-foreground mt-0.5 block">{summary.totalCompletions}</span>
                <span className="text-[9px] text-emerald-600 font-bold block">
                  {summary.completionRate}% Avg completion
                </span>
              </div>
              <div className="h-10 w-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 shrink-0">
                <CheckCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block">CTA Clicks</span>
                <span className="text-xl font-black text-foreground mt-0.5 block">{summary.totalCtaClicks}</span>
                <span className="text-[9px] text-violet-600 font-bold block">
                  {summary.ctaRate}% Click-through
                </span>
              </div>
              <div className="h-10 w-10 bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-500 shrink-0">
                <MousePointerClick className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block">Downloads</span>
                <span className="text-xl font-black text-foreground mt-0.5 block">{summary.totalDownloads}</span>
                <span className="text-[9px] text-slate-500 font-medium block">File saves</span>
              </div>
              <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
                <Download className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm">
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
              <div className="h-10 w-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 shrink-0">
                <Download className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and List */}
        <div className="space-y-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
            <Input 
              placeholder="Search shared pages by asset name, title, or slug..." 
              className="pl-11 h-11 rounded-xl border border-border shadow-sm font-bold text-sm focus:ring-1 focus:ring-primary/20" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>

          {filteredShares.length === 0 ? (
            <Card className="rounded-2xl border border-border bg-card text-center py-16">
              <CardContent className="flex flex-col items-center justify-center space-y-3">
                <BarChart3 className="h-12 w-12 text-muted-foreground opacity-30" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No media analytics logged</h3>
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                  Shared media pages will display analytics summary panels here as soon as viewers open links.
                </p>
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
                              <h4 className="text-sm font-black text-foreground tracking-tight group-hover:text-primary transition-colors flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span>{item.assetName}</span>
                              </h4>
                              <p className="text-xs font-semibold text-muted-foreground leading-snug">
                                {item.title}
                              </p>
                            </>
                          ) : (
                            <h4 className="text-sm font-black text-foreground tracking-tight group-hover:text-primary transition-colors">
                              {item.title}
                            </h4>
                          )}
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border inline-block mt-0.5">
                            /m/{item.shareId}
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
