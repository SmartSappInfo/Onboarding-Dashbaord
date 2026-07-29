'use client';

/**
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS:
 * 
 * 1. Interactive KPI Filter State:
 *    - `metricFilter` filters the session table based on card clicks (e.g. 'DOWNLOADS' shows only downloaded sessions).
 *    - Clicking an active KPI card toggles it back to 'ALL'.
 * 2. Identity Filter & Protection:
 *    - `identityFilter` segments sessions into 'ALL', 'IDENTIFIED' (CRM profiles), or 'ANONYMOUS'.
 *    - Anonymous rows CANNOT be bulk-selected or modified via CRM entity actions (checkboxes disabled with tooltips).
 * 3. Tag Selection Single Source of Truth:
 *    - Tag assignment on identified contacts MUST exclusively use `<TagSelector>` (`src/components/tags/TagSelector.tsx`).
 * 4. Mobile & Accessibility Optimizations:
 *    - Touch-friendly `min-h-[44px]` touch targets, active state feedback, and responsive horizontal table scrolling.
 * 5. Testability Pointers:
 *    - Test KPI card click filter toggles, identity filter pills, row selection, bulk tagging, and row-level dropdown actions.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { 
  getMediaShareDrilldownAction, 
  MediaAnalyticsResult, 
  MediaPageEventWithContact,
  MediaSessionRecordWithContact
} from '@/lib/media-analytics-actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { 
  ArrowLeft, User, Loader2, CheckCircle2, XCircle, BarChart3, ListCollapse, Sparkles,
  Filter, Search, X, MoreVertical, Tag as TagIcon,
  GitPullRequest, ExternalLink
} from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { TagSelector } from '@/components/tags/TagSelector';
import MediaAnalyticsBulkActionsBar from '../components/MediaAnalyticsBulkActionsBar';
import { bulkApplyTagsToMediaContactsAction } from '@/lib/media-analytics-entity-actions';
import { useToast } from '@/hooks/use-toast';

export type MetricFilterType = 'ALL' | 'VIEWS' | 'PLAYS' | 'COMPLETED' | 'CTA_CLICKS' | 'DOWNLOADS' | 'LEADS_CAPTURED';
export type IdentityFilterType = 'ALL' | 'IDENTIFIED' | 'ANONYMOUS';

interface DrilldownProps {
  shareId: string;
}

export default function ShareAnalyticsDrilldown({ shareId }: DrilldownProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();

  const [data, setData] = React.useState<MediaAnalyticsResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filter & Search States
  const [metricFilter, setMetricFilter] = React.useState<MetricFilterType>('ALL');
  const [identityFilter, setIdentityFilter] = React.useState<IdentityFilterType>('ALL');
  const [searchTerm, setSearchTerm] = React.useState('');

  // Bulk Selection States
  const [selectedSessionIds, setSelectedSessionIds] = React.useState<string[]>([]);

  // Single Row Tag Dialog State
  const [rowTagModalSession, setRowTagModalSession] = React.useState<MediaSessionRecordWithContact | null>(null);
  const [rowTagIds, setRowTagIds] = React.useState<string[]>([]);
  const [isSavingRowTags, setIsSavingRowTags] = React.useState(false);

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

  // KPI Funnel Chart Data
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

  // Filtered Sessions Array
  const filteredSessions = React.useMemo(() => {
    if (!data || !data.sessions) return [];

    return data.sessions.filter((session) => {
      // 1. Metric Filter
      if (metricFilter === 'PLAYS' && session.maxProgress === 0 && session.sessionTimeSeconds === 0) {
        return false;
      }
      if (metricFilter === 'COMPLETED' && session.maxProgress < 100) {
        return false;
      }
      if (metricFilter === 'CTA_CLICKS' && !session.ctaClicked) {
        return false;
      }
      if (metricFilter === 'DOWNLOADS' && !session.downloaded) {
        return false;
      }
      if (metricFilter === 'LEADS_CAPTURED' && !session.contactName && !session.contactId && !session.entityId) {
        return false;
      }

      // 2. Identity Filter
      if (identityFilter === 'IDENTIFIED' && !session.contactName && !session.contactId && !session.entityId) {
        return false;
      }
      if (identityFilter === 'ANONYMOUS' && (session.contactName || session.contactId || session.entityId)) {
        return false;
      }

      // 3. Search Filter
      if (searchTerm.trim()) {
        const queryStr = searchTerm.toLowerCase().trim();
        const matchesName = session.contactName ? session.contactName.toLowerCase().includes(queryStr) : false;
        const matchesId = session.sessionId.toLowerCase().includes(queryStr);
        const matchesContactId = session.contactId ? session.contactId.toLowerCase().includes(queryStr) : false;
        if (!matchesName && !matchesId && !matchesContactId) {
          return false;
        }
      }

      return true;
    });
  }, [data, metricFilter, identityFilter, searchTerm]);

  // Identified Sessions Subset (eligible for CRM actions)
  const identifiedSessions = React.useMemo(() => {
    return filteredSessions.filter((s) => s.contactName || s.contactId || s.entityId);
  }, [filteredSessions]);

  // Selected Identified Contacts metadata for bulk bar
  const { selectedContactIds, selectedContactNames } = React.useMemo(() => {
    if (!data || selectedSessionIds.length === 0) {
      return { selectedContactIds: [], selectedContactNames: [] };
    }

    const ids: string[] = [];
    const names: string[] = [];

    data.sessions.forEach((s) => {
      if (selectedSessionIds.includes(s.sessionId)) {
        const targetId = s.contactId || s.entityId;
        if (targetId) {
          ids.push(targetId);
          names.push(s.contactName || targetId);
        }
      }
    });

    return { selectedContactIds: ids, selectedContactNames: names };
  }, [data, selectedSessionIds]);

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIdentifiedSessionIds = identifiedSessions.map((s) => s.sessionId);
      setSelectedSessionIds(allIdentifiedSessionIds);
    } else {
      setSelectedSessionIds([]);
    }
  };

  const handleToggleRowSelect = (sessionId: string, checked: boolean) => {
    if (checked) {
      setSelectedSessionIds((prev) => [...prev, sessionId]);
    } else {
      setSelectedSessionIds((prev) => prev.filter((id) => id !== sessionId));
    }
  };

  const handleSaveRowTags = async () => {
    if (!activeWorkspaceId || !rowTagModalSession) return;
    const contactTargetId = rowTagModalSession.contactId || rowTagModalSession.entityId;
    if (!contactTargetId) return;

    setIsSavingRowTags(true);
    try {
      const result = await bulkApplyTagsToMediaContactsAction({
        workspaceId: activeWorkspaceId,
        contactIds: [contactTargetId],
        tagIds: rowTagIds,
      });

      if (result.success) {
        toast({
          title: 'Tags Updated',
          description: `Assigned ${rowTagIds.length} tag(s) to ${rowTagModalSession.contactName || 'contact'}.`,
        });
        setRowTagModalSession(null);
        setRowTagIds([]);
        loadDrilldown();
      } else {
        toast({
          variant: 'destructive',
          title: 'Tagging Failed',
          description: result.error || 'Could not update contact tags.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsSavingRowTags(false);
    }
  };

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

  const isAllSelected = identifiedSessions.length > 0 && identifiedSessions.every((s) => selectedSessionIds.includes(s.sessionId));

  return (
    <PageContainerFluid>
      <TooltipProvider>
        <div className="space-y-6 pb-28 w-full text-left">
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
                  className="h-9 w-9 p-0 rounded-xl active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Return to media analytics list"
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

          {/* Interactive KPI Mini Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. VIEWS CARD */}
            <Card 
              onClick={() => setMetricFilter(metricFilter === 'VIEWS' ? 'ALL' : 'VIEWS')}
              className={`rounded-2xl border transition-all duration-200 p-4 text-left cursor-pointer min-h-[44px] select-none active:scale-[0.98] ${
                metricFilter === 'VIEWS' 
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/5 shadow-md' 
                  : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Views</span>
                {metricFilter === 'VIEWS' && (
                  <Badge className="bg-primary text-white text-[8px] px-1.5 py-0 rounded font-black uppercase">Active</Badge>
                )}
              </div>
              <span className="text-xl font-black text-foreground mt-1 block">{data.stats.views}</span>
              <span className="text-[8px] text-muted-foreground font-medium">{data.stats.uniqueViews} Unique visits</span>
            </Card>

            {/* 2. PLAYS CARD */}
            <Card 
              onClick={() => setMetricFilter(metricFilter === 'PLAYS' ? 'ALL' : 'PLAYS')}
              className={`rounded-2xl border transition-all duration-200 p-4 text-left cursor-pointer min-h-[44px] select-none active:scale-[0.98] ${
                metricFilter === 'PLAYS' 
                  ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/5 shadow-md' 
                  : 'border-border bg-card hover:border-emerald-500/40 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Plays</span>
                {metricFilter === 'PLAYS' && (
                  <Badge className="bg-emerald-500 text-white text-[8px] px-1.5 py-0 rounded font-black uppercase">Active</Badge>
                )}
              </div>
              <span className="text-xl font-black text-foreground mt-1 block">{data.stats.mediaPlays}</span>
              <span className="text-[8px] text-muted-foreground font-medium">Started playback</span>
            </Card>

            {/* 3. COMPLETED CARD */}
            <Card 
              onClick={() => setMetricFilter(metricFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
              className={`rounded-2xl border transition-all duration-200 p-4 text-left cursor-pointer min-h-[44px] select-none active:scale-[0.98] ${
                metricFilter === 'COMPLETED' 
                  ? 'border-violet-500 ring-2 ring-violet-500/30 bg-violet-500/5 shadow-md' 
                  : 'border-border bg-card hover:border-violet-500/40 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Completed</span>
                {metricFilter === 'COMPLETED' && (
                  <Badge className="bg-violet-500 text-white text-[8px] px-1.5 py-0 rounded font-black uppercase">Active</Badge>
                )}
              </div>
              <span className="text-xl font-black text-foreground mt-1 block">{data.stats.mediaCompletions}</span>
              <span className="text-[8px] text-emerald-500 font-bold">{completionRate}% Completion</span>
            </Card>

            {/* 4. CTA CLICKS CARD */}
            <Card 
              onClick={() => setMetricFilter(metricFilter === 'CTA_CLICKS' ? 'ALL' : 'CTA_CLICKS')}
              className={`rounded-2xl border transition-all duration-200 p-4 text-left cursor-pointer min-h-[44px] select-none active:scale-[0.98] ${
                metricFilter === 'CTA_CLICKS' 
                  ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/5 shadow-md' 
                  : 'border-border bg-card hover:border-blue-500/40 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">CTA Clicks</span>
                {metricFilter === 'CTA_CLICKS' && (
                  <Badge className="bg-blue-500 text-white text-[8px] px-1.5 py-0 rounded font-black uppercase">Active</Badge>
                )}
              </div>
              <span className="text-xl font-black text-foreground mt-1 block">{data.stats.ctaClicks}</span>
              <span className="text-[8px] text-blue-500 font-bold">{clickRate}% CTR</span>
            </Card>

            {/* 5. DOWNLOADS CARD */}
            <Card 
              onClick={() => setMetricFilter(metricFilter === 'DOWNLOADS' ? 'ALL' : 'DOWNLOADS')}
              className={`rounded-2xl border transition-all duration-200 p-4 text-left cursor-pointer min-h-[44px] select-none active:scale-[0.98] ${
                metricFilter === 'DOWNLOADS' 
                  ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/5 shadow-md' 
                  : 'border-border bg-card hover:border-amber-500/40 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Downloads</span>
                {metricFilter === 'DOWNLOADS' && (
                  <Badge className="bg-amber-500 text-white text-[8px] px-1.5 py-0 rounded font-black uppercase">Active</Badge>
                )}
              </div>
              <span className="text-xl font-black text-foreground mt-1 block">{data.stats.downloads}</span>
              <span className="text-[8px] text-muted-foreground font-medium">Saves triggered</span>
            </Card>

            {/* 6. LEADS CAPTURED CARD */}
            <Card 
              onClick={() => setMetricFilter(metricFilter === 'LEADS_CAPTURED' ? 'ALL' : 'LEADS_CAPTURED')}
              className={`rounded-2xl border transition-all duration-200 p-4 text-left cursor-pointer min-h-[44px] select-none active:scale-[0.98] ${
                metricFilter === 'LEADS_CAPTURED' 
                  ? 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-500/5 shadow-md' 
                  : 'border-border bg-card hover:border-purple-500/40 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Leads Captured</span>
                {metricFilter === 'LEADS_CAPTURED' && (
                  <Badge className="bg-purple-500 text-white text-[8px] px-1.5 py-0 rounded font-black uppercase">Active</Badge>
                )}
              </div>
              <span className="text-xl font-black text-foreground mt-1 block">{data.totalKnownContacts}</span>
              <span className="text-[8px] text-muted-foreground font-medium">{data.anonymousCount} Anonymous sessions</span>
            </Card>
          </div>

          {/* Active Metric Filter Indicator Banner */}
          {metricFilter !== 'ALL' && (
            <div className="p-3 px-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs font-bold text-primary animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>
                  Filtering list by KPI metric: <strong>{metricFilter.replace('_', ' ')}</strong> ({filteredSessions.length} record(s) found)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMetricFilter('ALL')}
                className="h-7 px-3 text-[10px] font-bold rounded-lg hover:bg-primary/20 text-primary gap-1"
              >
                <X className="h-3 w-3" /> Clear Metric Filter
              </Button>
            </div>
          )}

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
                    <RechartsTooltip 
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

          {/* Tab logs & Audience Identity Filters */}
          <Tabs defaultValue="sessions" className="w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <TabsList className="bg-background h-11 p-1 rounded-xl border border-border shadow-sm w-fit">
                <TabsTrigger value="sessions" className="rounded-lg font-bold text-xs px-6 gap-2 min-h-[38px]">
                  <User className="h-4 w-4" /> Viewer Sessions
                </TabsTrigger>
                <TabsTrigger value="events" className="rounded-lg font-bold text-xs px-6 gap-2 min-h-[38px]">
                  <ListCollapse className="h-4 w-4" /> Event Feed
                </TabsTrigger>
              </TabsList>

              {/* Identity Segmented Pills & Search Filter */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center bg-muted/40 p-1 rounded-xl border border-border shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIdentityFilter('ALL')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all min-h-[36px] ${
                      identityFilter === 'ALL'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All Traffic
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdentityFilter('IDENTIFIED')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all min-h-[36px] flex items-center gap-1 ${
                      identityFilter === 'IDENTIFIED'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Sparkles className="h-2.5 w-2.5" /> Identified Contacts
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdentityFilter('ANONYMOUS')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all min-h-[36px] ${
                      identityFilter === 'ANONYMOUS'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Anonymous
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search name, ID, or session..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 pl-9 rounded-xl text-xs font-semibold bg-background border-border min-h-[44px]"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <TabsContent value="sessions">
              <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/20 text-[9px] uppercase tracking-wider font-bold text-muted-foreground">
                        <th className="py-3 px-4 w-10 text-center">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleToggleSelectAll}
                            disabled={identifiedSessions.length === 0}
                            aria-label="Select all identified sessions on current page"
                          />
                        </th>
                        <th className="py-3 px-4">Contact / Visitor</th>
                        <th className="py-3 px-4 text-center">Watch Completion</th>
                        <th className="py-3 px-4 text-center">Duration</th>
                        <th className="py-3 px-4 text-center">CTA Clicked</th>
                        <th className="py-3 px-4 text-center">Downloaded</th>
                        <th className="py-3 px-4 text-right">Last Session Activity</th>
                        <th className="py-3 px-4 w-10 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 px-4 text-center text-xs text-muted-foreground">
                            No sessions match your selected metric and audience filters.
                          </td>
                        </tr>
                      ) : (
                        filteredSessions.map((session) => {
                          const isIdentified = !!(session.contactName || session.contactId || session.entityId);
                          const isSelected = selectedSessionIds.includes(session.sessionId);

                          return (
                            <tr 
                              key={session.sessionId} 
                              className={`border-b border-border transition-colors text-xs ${
                                isSelected ? 'bg-primary/5' : 'hover:bg-muted/10'
                              }`}
                            >
                              <td className="py-3.5 px-4 text-center">
                                {isIdentified ? (
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(c) => handleToggleRowSelect(session.sessionId, Boolean(c))}
                                    aria-label={`Select session for ${session.contactName || session.sessionId}`}
                                  />
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <Checkbox disabled className="opacity-30 cursor-not-allowed" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="text-[10px] font-bold">
                                      Actions available for identified CRM contacts
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </td>
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
                              <td className="py-3.5 px-4 text-center">
                                {isIdentified ? (
                                  <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 min-h-[36px] min-w-[36px] p-0 rounded-lg hover:bg-muted"
                                      >
                                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl w-48 p-1.5 shadow-xl border-border">
                                      <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1">
                                        Entity Actions
                                      </DropdownMenuLabel>
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          setRowTagModalSession(session);
                                          setRowTagIds([]);
                                        }}
                                        className="text-xs font-bold gap-2 p-2 rounded-lg cursor-pointer"
                                      >
                                        <TagIcon className="h-3.5 w-3.5 text-emerald-500" />
                                        Apply Tags
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          setSelectedSessionIds([session.sessionId]);
                                        }}
                                        className="text-xs font-bold gap-2 p-2 rounded-lg cursor-pointer"
                                      >
                                        <GitPullRequest className="h-3.5 w-3.5 text-primary" />
                                        Move Pipeline Stage
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => router.push('/admin/entities')}
                                        className="text-xs font-bold gap-2 p-2 rounded-lg cursor-pointer"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                        View Profile
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground opacity-30">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
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

          {/* Bulk Actions Sticky Toolbar */}
          <MediaAnalyticsBulkActionsBar
            selectedContactIds={selectedContactIds}
            selectedContactNames={selectedContactNames}
            onClearSelection={() => setSelectedSessionIds([])}
            onActionComplete={loadDrilldown}
          />

          {/* Single Row Tag Selector Dialog */}
          <Dialog open={!!rowTagModalSession} onOpenChange={(open) => !open && setRowTagModalSession(null)}>
            <DialogContent 
              className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-card"
              onClick={(e) => e.stopPropagation()}
            >
              <DialogHeader className="p-6 bg-emerald-500/10 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500 text-white rounded-2xl shadow-lg">
                    <TagIcon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <DialogTitle className="text-lg font-extrabold text-foreground">Apply Tags</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground font-medium">
                      Assign tags to {rowTagModalSession?.contactName || 'identified contact'}.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-4 text-left">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Select Tags
                </Label>
                <TagSelector
                  currentTagIds={rowTagIds}
                  onTagsChange={setRowTagIds}
                  className="w-full"
                />
              </div>

              <DialogFooter className="p-4 bg-muted/20 border-t border-border flex justify-between items-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRowTagModalSession(null)}
                  disabled={isSavingRowTags}
                  className="rounded-xl font-bold min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveRowTags}
                  disabled={isSavingRowTags || rowTagIds.length === 0}
                  className="rounded-xl font-bold min-h-[44px] px-6 bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-lg"
                >
                  {isSavingRowTags ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Apply Tags
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </PageContainerFluid>
  );
}
