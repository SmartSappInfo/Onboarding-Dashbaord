'use client';

import * as React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  Sparkles,
  Search,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type {
  KnowledgeInsight,
  KnowledgeInsightType,
  KnowledgeInsightSeverity,
  KnowledgeInsightStatus,
} from '@/lib/quick-notes-types';
import {
  filterInsights,
  getInsightSeverityDisplayLabel,
  getInsightTypeDisplayLabel,
} from '@/lib/quick-notes-domain';
import {
  getWorkspaceInsightsAction,
  generateWorkspaceInsightsAction,
  convertInsightToIdeaAction,
  convertInsightToTaskAction,
  deleteInsightAction,
} from '@/lib/quick-notes-insight-actions';

interface InsightCenterViewProps {
  workspaceId: string;
  userId: string;
  initialInsights?: KnowledgeInsight[];
}

export function InsightCenterView({
  workspaceId,
  userId,
  initialInsights = [],
}: InsightCenterViewProps) {
  const { toast } = useToast();

  const [insights, setInsights] = React.useState<KnowledgeInsight[]>(initialInsights);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isScanningAi, setIsScanningAi] = React.useState(false);
  const [activeType, setActiveType] = React.useState<KnowledgeInsightType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = React.useState<KnowledgeInsightSeverity | 'all'>('all');
  const [statusFilter, _setStatusFilter] = React.useState<KnowledgeInsightStatus | 'all'>('active');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedEvidenceIds, setExpandedEvidenceIds] = React.useState<Set<string>>(new Set());

  // Refresh insights
  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const res = await getWorkspaceInsightsAction(workspaceId, {
        type: activeType,
        severity: severityFilter,
        status: statusFilter,
      });
      if (res.success && res.data) {
        setInsights(res.data);
      }
    } catch {
      toast({ title: 'Error loading insights', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    handleRefresh();
  }, [workspaceId, activeType, severityFilter, statusFilter]);

  // Run AI Scanner
  const handleRunAiScan = async () => {
    setIsScanningAi(true);
    try {
      const res = await generateWorkspaceInsightsAction(workspaceId, userId);
      if (res.success) {
        toast({
          title: 'AI Intelligence Scan Complete',
          description: `Discovered and synthesized ${res.insightsCount || 0} executive insights.`,
        });
        handleRefresh();
      } else {
        toast({ title: 'AI Scan Notice', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error running AI scan', variant: 'destructive' });
    } finally {
      setIsScanningAi(false);
    }
  };

  // Convert to Idea
  const handleConvertToIdea = async (insight: KnowledgeInsight) => {
    try {
      const res = await convertInsightToIdeaAction(workspaceId, insight.id, userId);
      if (res.success && res.ideaId) {
        toast({
          title: 'Idea Created in Studio',
          description: `Promoted insight to a structured Idea.`,
          actionConfig: {
            path: '/admin/quick-notes/ideas',
            label: 'View Idea Studio',
          },
        });
        handleRefresh();
      } else {
        toast({ title: 'Failed to create idea', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error promoting insight to idea', variant: 'destructive' });
    }
  };

  // Convert to Task
  const handleConvertToTask = async (insight: KnowledgeInsight) => {
    try {
      const res = await convertInsightToTaskAction(workspaceId, insight.id, userId, {
        title: `Action: ${insight.title}`,
        priority: insight.severity === 'critical' ? 'urgent' : insight.severity === 'high' ? 'high' : 'medium',
      });
      if (res.success && res.taskId) {
        toast({
          title: 'Task Created Successfully',
          description: 'Assigned to your task list.',
          actionConfig: {
            path: '/admin/tasks',
            label: 'View Tasks',
          },
        });
        handleRefresh();
      } else {
        toast({ title: 'Failed to create task', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error converting insight to task', variant: 'destructive' });
    }
  };

  // Delete insight
  const handleDeleteInsight = async (insightId: string) => {
    if (!confirm('Are you sure you want to delete this insight?')) return;
    try {
      const res = await deleteInsightAction(workspaceId, insightId);
      if (res.success) {
        setInsights((prev) => prev.filter((i) => i.id !== insightId));
        toast({ title: 'Insight deleted' });
      }
    } catch {
      toast({ title: 'Error deleting insight', variant: 'destructive' });
    }
  };

  const toggleEvidence = (id: string) => {
    setExpandedEvidenceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered insights
  const filteredInsights = React.useMemo(() => {
    return filterInsights(insights, {
      type: activeType,
      severity: severityFilter,
      status: statusFilter,
      searchQuery,
    });
  }, [insights, activeType, severityFilter, statusFilter, searchQuery]);

  // Executive KPI summary counts
  const kpiCounts = React.useMemo(() => {
    const active = insights.filter((i) => i.status === 'active');
    return {
      trends: active.filter((i) => i.type === 'trend' || i.type === 'pattern').length,
      objections: active.filter((i) => i.type === 'recurring_problem').length,
      risks: active.filter((i) => i.type === 'risk').length,
      opportunities: active.filter((i) => i.type === 'opportunity' || i.type === 'emerging_theme').length,
    };
  }, [insights]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Insight Center</h1>
            <Badge variant="outline" className="text-xs font-bold text-primary border-primary/30">
              Executive Intelligence
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Continuous synthesis across customer feedback, call transcripts, and strategy ideas with quote-proof evidence.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-9 text-xs font-semibold gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleRunAiScan}
            disabled={isScanningAi}
            className="h-9 px-3.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm active:scale-[0.98]"
          >
            {isScanningAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            ⚡ Run AI Intelligence Scan
          </Button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Trends */}
        <div
          onClick={() => setActiveType('trend')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeType === 'trend'
              ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
              : 'border-border/80 bg-card hover:border-blue-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Active Trends</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{kpiCounts.trends}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Emerging adoption patterns</p>
        </div>

        {/* Card 2: Recurring Objections */}
        <div
          onClick={() => setActiveType('recurring_problem')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeType === 'recurring_problem'
              ? 'border-destructive bg-destructive/10 ring-1 ring-destructive/30'
              : 'border-border/80 bg-card hover:border-destructive/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-destructive">Recurring Objections</span>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{kpiCounts.objections}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Repeated customer friction</p>
        </div>

        {/* Card 3: Operational Risks */}
        <div
          onClick={() => setActiveType('risk')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeType === 'risk'
              ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
              : 'border-border/80 bg-card hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Operational Risks</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{kpiCounts.risks}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">High-priority vulnerabilities</p>
        </div>

        {/* Card 4: Growth Opportunities */}
        <div
          onClick={() => setActiveType('opportunity')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeType === 'opportunity'
              ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30'
              : 'border-border/80 bg-card hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Growth Opportunities</span>
            <Lightbulb className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{kpiCounts.opportunities}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">New expansion angles</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search insights by keyword, objection, or theme..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Severity Filter */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setSeverityFilter('all')}
              className={`px-2.5 py-1 rounded-lg ${
                severityFilter === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              All Severity
            </button>
            <button
              onClick={() => setSeverityFilter('critical')}
              className={`px-2.5 py-1 rounded-lg ${
                severityFilter === 'critical' ? 'bg-background text-destructive font-bold shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Critical
            </button>
            <button
              onClick={() => setSeverityFilter('high')}
              className={`px-2.5 py-1 rounded-lg ${
                severityFilter === 'high' ? 'bg-background text-orange-600 shadow-xs' : 'text-muted-foreground'
              }`}
            >
              High
            </button>
          </div>

          {/* Reset Filters */}
          {(activeType !== 'all' || severityFilter !== 'all' || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveType('all');
                setSeverityFilter('all');
                setSearchQuery('');
              }}
              className="h-8 text-xs text-muted-foreground"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Insight Cards Grid */}
      <div className="space-y-4">
        {filteredInsights.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-border bg-muted/10 space-y-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto">
              <Sparkles className="h-6 w-6" />
            </span>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">No insights match your criteria</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Click &quot;⚡ Run AI Intelligence Scan&quot; to analyze workspace notes and discover emerging patterns.
              </p>
            </div>
          </div>
        ) : (
          filteredInsights.map((insight) => {
            const { label: sevLabel, badgeClass: sevBadgeClass } = getInsightSeverityDisplayLabel(
              insight.severity
            );
            const { label: typeLabel, badgeClass: typeBadgeClass } = getInsightTypeDisplayLabel(
              insight.type
            );
            const isEvidenceOpen = expandedEvidenceIds.has(insight.id);

            return (
              <div
                key={insight.id}
                className="p-5 rounded-2xl border border-border/80 bg-card hover:border-border hover:shadow-xs transition-all space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] font-bold ${sevBadgeClass}`}>
                      {sevLabel}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] font-bold ${typeBadgeClass}`}>
                      {typeLabel}
                    </Badge>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {insight.evidenceCount} Supporting Citations
                    </span>
                  </div>

                  <span className="text-[11px] text-muted-foreground font-mono">
                    {new Date(insight.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Title & Summary */}
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground leading-snug">{insight.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.summary}</p>
                </div>

                {/* Evidence Vault Collapsible */}
                {insight.evidenceSources && insight.evidenceSources.length > 0 && (
                  <div className="pt-1">
                    <button
                      onClick={() => toggleEvidence(insight.id)}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 focus:outline-hidden"
                    >
                      {isEvidenceOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {isEvidenceOpen
                        ? 'Hide Evidence Vault'
                        : `View Supporting Evidence Vault (${insight.evidenceSources.length} quotes)`}
                    </button>
                    {isEvidenceOpen && (
                      <div className="mt-2.5 space-y-2 pl-3 border-l-2 border-primary/40">
                        {insight.evidenceSources.map((ev, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground">{ev.title}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{ev.date}</span>
                            </div>
                            <p className="text-[11px] italic text-muted-foreground">&quot;{ev.quote}&quot;</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Toolbar */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConvertToIdea(insight)}
                      className="h-8 text-xs font-semibold text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 gap-1.5 active:scale-[0.98]"
                    >
                      <Lightbulb className="h-3.5 w-3.5" />
                      Develop into Idea 💡
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConvertToTask(insight)}
                      className="h-8 text-xs font-semibold gap-1.5 active:scale-[0.98]"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      To Task 📋
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteInsight(insight.id)}
                    className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
