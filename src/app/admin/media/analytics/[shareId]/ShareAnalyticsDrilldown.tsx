'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { 
  getMediaShareDrilldownAction, 
  MediaAnalyticsResult, 
  MediaPageEventWithContact 
} from '@/lib/media-analytics-actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, User, Loader2, CheckCircle2, XCircle, BarChart3, ListCollapse, Sparkles
} from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

interface DrilldownProps {
  shareId: string;
}

export default function ShareAnalyticsDrilldown({ shareId }: DrilldownProps) {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const [data, setData] = React.useState<MediaAnalyticsResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadDrilldown = React.useCallback(async () => {
    if (!activeWorkspaceId || !shareId) return;
    setIsLoading(true);
    try {
      const result = await getMediaShareDrilldownAction(shareId, activeWorkspaceId);
      setData(result);
    } catch (err) {
      console.error('[ShareAnalyticsDrilldown] Failed to load drilldown metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [shareId, activeWorkspaceId]);

  React.useEffect(() => {
    loadDrilldown();
  }, [loadDrilldown]);

  const formatSessionTime = (seconds: number) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getEventDescription = (event: MediaPageEventWithContact) => {
    const name = event.contactName || 'Anonymous Visitor';
    const elapsed = event.sessionTimeSeconds ? ` (at ${formatSessionTime(event.sessionTimeSeconds)})` : '';
    switch (event.type) {
      case 'view':
        return `${name} loaded the shared page`;
      case 'media_play':
        return `${name} clicked play`;
      case 'media_progress':
        if (event.progressPercent !== null && event.progressPercent !== undefined) {
          return `${name} reached ${event.progressPercent}% completion${elapsed}`;
        }
        return `${name} watched up to ${formatSessionTime(event.sessionTimeSeconds || 0)}`;
      case 'media_complete':
        return `${name} watched the entire media${elapsed}`;
      case 'cta_click':
        return `${name} clicked the Call-To-Action button${elapsed}`;
      case 'download':
        return `${name} clicked the Download/Save button${elapsed}`;
      default:
        return `${name} triggered event: ${event.type}${elapsed}`;
    }
  };

  const funnelData = React.useMemo(() => {
    if (!data) return [];
    const stats = data.stats;
    return [
      { name: 'Views', value: stats.views || 0, color: '#3b82f6' },
      { name: 'Plays', value: stats.mediaPlays || 0, color: '#10b981' },
      { name: 'Halfway', value: stats.mediaHalfway || 0, color: '#f59e0b' },
      { name: 'Completed', value: stats.mediaCompletions || 0, color: '#8b5cf6' },
    ];
  }, [data]);

  if (isLoading) {
    return (
      <PageContainerFluid>
        <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading shared link metrics...</p>
        </div>
      </PageContainerFluid>
    );
  }

  if (!data) {
    return (
      <PageContainerFluid>
        <div className="flex flex-col items-center justify-center min-h-[500px] text-center gap-3">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Shared page not found</h3>
          <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
            This shared page configuration might have been removed, or you do not have permission to view its stats.
          </p>
          <Button onClick={() => router.push('/admin/media/analytics')} className="rounded-xl font-bold text-xs h-10 mt-2">
            Return to Analytics Hub
          </Button>
        </div>
      </PageContainerFluid>
    );
  }

  const completionRate = data.stats.mediaPlays > 0 
    ? Math.round((data.stats.mediaCompletions / data.stats.mediaPlays) * 100)
    : 0;

  const clickRate = data.stats.uniqueViews > 0
    ? Math.round((data.stats.ctaClicks / data.stats.uniqueViews) * 100)
    : 0;

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-20 w-full text-left">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex flex-col items-start">
            {data.assetName && (
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary mb-1 pl-1">
                <Sparkles className="h-3 w-3" />
                <span>Asset: {data.assetName}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mb-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.push('/admin/media/analytics')}
                className="h-8 w-8 p-0 rounded-lg active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
                {data.title || 'Link Engagement Drilldown'}
              </h1>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed pl-1 font-mono">
              Link ID: /m/{shareId}
            </p>
          </div>
        </div>

        {/* Aggregated Mini Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 text-left">
            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Views</span>
            <span className="text-xl font-black text-foreground mt-1 block">{data.stats.views}</span>
            <span className="text-[8px] text-muted-foreground font-medium">{data.stats.uniqueViews} Unique visits</span>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 text-left">
            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Plays</span>
            <span className="text-xl font-black text-foreground mt-1 block">{data.stats.mediaPlays}</span>
            <span className="text-[8px] text-muted-foreground font-medium">Started playback</span>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 text-left">
            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Completed</span>
            <span className="text-xl font-black text-foreground mt-1 block">{data.stats.mediaCompletions}</span>
            <span className="text-[8px] text-emerald-500 font-bold">{completionRate}% Completion</span>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 text-left">
            <span className="text-[9px] font-bold text-muted-foreground uppercase block">CTA Clicks</span>
            <span className="text-xl font-black text-foreground mt-1 block">{data.stats.ctaClicks}</span>
            <span className="text-[8px] text-violet-500 font-bold">{clickRate}% CTR</span>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 text-left">
            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Downloads</span>
            <span className="text-xl font-black text-foreground mt-1 block">{data.stats.downloads}</span>
            <span className="text-[8px] text-muted-foreground font-medium">Saves triggered</span>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 text-left">
            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Leads Captured</span>
            <span className="text-xl font-black text-foreground mt-1 block">{data.totalKnownContacts}</span>
            <span className="text-[8px] text-muted-foreground font-medium">{data.anonymousCount} Anonymous sessions</span>
          </Card>
        </div>

        {/* Chart Arena */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversion Funnel */}
          <Card className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-sm p-5 flex flex-col justify-between">
            <div className="mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-primary" /> View-to-Watch Funnel Chart
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Conversion funnel highlighting drops between visitor load, video plays, halfway watch, and full completion.
              </p>
            </div>
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} 
                    contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={45}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Quick Summary Insights */}
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Quick Insights</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Automated analytics review</p>
            </div>
            <div className="space-y-3.5 my-4 flex-1 flex flex-col justify-center text-xs">
              <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                <div className="h-5 w-5 bg-blue-500/10 text-blue-500 rounded-md flex items-center justify-center shrink-0">1</div>
                <p className="leading-relaxed">
                  <strong>{clickRate}%</strong> of unique visitors clicked the primary Call-To-Action button.
                </p>
              </div>
              <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                <div className="h-5 w-5 bg-emerald-500/10 text-emerald-500 rounded-md flex items-center justify-center shrink-0">2</div>
                <p className="leading-relaxed">
                  <strong>{completionRate}%</strong> of users who played the media watched it until the final completion stage.
                </p>
              </div>
              <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                <div className="h-5 w-5 bg-purple-500/10 text-purple-500 rounded-md flex items-center justify-center shrink-0">3</div>
                <p className="leading-relaxed">
                  Total viewer traffic generated <strong>{data.totalKnownContacts}</strong> tracked CRM profiles.
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-dashed border-border flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
              <span>Status: Active logging</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" /> Real-time</span>
            </div>
          </Card>
        </div>

        {/* Tab logs */}
        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="bg-background h-11 p-1 rounded-xl border border-border shadow-sm mb-4">
            <TabsTrigger value="sessions" className="rounded-lg font-bold text-xs px-6 gap-2">
              <User className="h-4 w-4" /> Viewer Sessions
            </TabsTrigger>
            <TabsTrigger value="events" className="rounded-lg font-bold text-xs px-6 gap-2">
              <ListCollapse className="h-4 w-4" /> Event Feed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions">
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-[9px] uppercase tracking-wider font-bold text-muted-foreground">
                      <th className="py-3 px-4">Contact / Visitor</th>
                      <th className="py-3 px-4 text-center">Watch Completion</th>
                      <th className="py-3 px-4 text-center">Duration</th>
                      <th className="py-3 px-4 text-center">CTA Clicked</th>
                      <th className="py-3 px-4 text-center">Downloaded</th>
                      <th className="py-3 px-4 text-right">Last Session Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 px-4 text-center text-xs text-muted-foreground">
                          No active sessions logged for this shared link yet.
                        </td>
                      </tr>
                    ) : (
                      data.sessions.map((session) => (
                        <tr key={session.sessionId} className="border-b border-border hover:bg-muted/10 transition-colors text-xs">
                          <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-2 flex-wrap">
                              {session.contactName ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-foreground text-xs">{session.contactName}</span>
                                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                                    <Sparkles className="h-2.5 w-2.5" /> Identified
                                  </Badge>
                                </div>
                              ) : (
                                <span className="text-muted-foreground font-medium text-xs">Anonymous Visitor</span>
                              )}
                              {session.userAgents && session.userAgents.length > 1 && (
                                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[8px] px-1.5 py-0 rounded font-black uppercase tracking-wider shrink-0">
                                  Shared Link
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="font-bold">{session.maxProgress}%</span>
                              <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                                <div 
                                  className="h-full bg-emerald-500" 
                                  style={{ width: `${session.maxProgress}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center text-muted-foreground font-mono">
                            {formatSessionTime(session.sessionTimeSeconds)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex justify-center">
                              {session.ctaClicked ? (
                                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4.5 w-4.5 text-slate-300 dark:text-slate-800" />
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex justify-center">
                              {session.downloaded ? (
                                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4.5 w-4.5 text-slate-300 dark:text-slate-800" />
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right text-muted-foreground font-mono text-[10px]">
                            {new Date(session.updatedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
              <div className="relative border-l border-border/80 pl-6 ml-2 space-y-6">
                {data.recentEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 pl-2">No event records found.</p>
                ) : (
                  data.recentEvents.map((event) => (
                    <div key={event.id} className="relative group">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background group-hover:scale-125 transition-transform" />
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {getEventDescription(event)}
                          </p>
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            Session UUID: {event.sessionId.substring(0, 8)}...
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0 whitespace-nowrap">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainerFluid>
  );
}
