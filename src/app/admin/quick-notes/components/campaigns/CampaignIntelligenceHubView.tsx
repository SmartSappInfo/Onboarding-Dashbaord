'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Rocket,
  ShieldAlert,
  Search,
  ArrowLeft,
  Plus,
  TrendingUp,
  Sliders,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type CampaignConcept,
  type CampaignChannel,
  type CampaignConceptStatus,
  type ObjectionBattlecard,
  type KnowledgeInsight,
  type Idea,
} from '@/lib/quick-notes-types';
import { filterCampaignConcepts } from '@/lib/quick-notes-domain';
import { CampaignConceptCard } from './CampaignConceptCard';
import { ObjectionMatrixView } from './ObjectionMatrixView';
import { CampaignConceptDrawer } from './CampaignConceptDrawer';
import { CreateConceptDialog } from './CreateConceptDialog';
import {
  getWorkspaceCampaignConceptsAction,
  getWorkspaceBattlecardsAction,
} from '@/lib/quick-notes-campaign-actions';
import { getWorkspaceInsightsAction } from '@/lib/quick-notes-insight-actions';
import { getWorkspaceIdeasAction } from '@/lib/quick-notes-idea-actions';
import { useWorkspace } from '@/context/WorkspaceContext';

export function CampaignIntelligenceHubView() {
  const { activeWorkspaceId } = useWorkspace();

  const [concepts, setConcepts] = React.useState<CampaignConcept[]>([]);
  const [battlecards, setBattlecards] = React.useState<ObjectionBattlecard[]>([]);
  const [insights, setInsights] = React.useState<KnowledgeInsight[]>([]);
  const [ideas, setIdeas] = React.useState<Idea[]>([]);
  const [_isLoading, setIsLoading] = React.useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedChannel, setSelectedChannel] = React.useState<CampaignChannel | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = React.useState<CampaignConceptStatus | 'all'>('all');
  const [activeTab, setActiveTab] = React.useState('concepts');

  // Dialog & Drawer state
  const [selectedConcept, setSelectedConcept] = React.useState<CampaignConcept | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const loadData = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const [conceptsRes, battlecardsRes, insightsRes, ideasRes] = await Promise.all([
        getWorkspaceCampaignConceptsAction(activeWorkspaceId),
        getWorkspaceBattlecardsAction(activeWorkspaceId),
        getWorkspaceInsightsAction(activeWorkspaceId),
        getWorkspaceIdeasAction(activeWorkspaceId),
      ]);

      if (conceptsRes.success && conceptsRes.data) setConcepts(conceptsRes.data);
      if (battlecardsRes.success && battlecardsRes.data) setBattlecards(battlecardsRes.data);
      if (insightsRes.success && insightsRes.data) setInsights(insightsRes.data);
      if (ideasRes.success && ideasRes.data) setIdeas(ideasRes.data);
    } catch (err) {
      console.error('[CampaignIntelligence] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredConcepts = React.useMemo(() => {
    return filterCampaignConcepts(concepts, {
      status: selectedStatus,
      channel: selectedChannel,
      searchQuery,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }, [concepts, selectedStatus, selectedChannel, searchQuery]);

  // Campaign-derived learnings filter
  const campaignLearnings = React.useMemo(() => {
    return insights.filter((ins) =>
      ins.evidenceSources?.some((e) => e.type === 'campaign') || ins.title.includes('[Campaign:')
    );
  }, [insights]);

  // KPI calculations
  const approvedCount = concepts.filter((c) => c.status === 'approved' || c.status === 'deployed_to_campaign').length;
  const avgRelevance = concepts.length > 0
    ? Math.round(concepts.reduce((acc, c) => acc + (c.relevanceScore || 75), 0) / concepts.length)
    : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/quick-notes"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Rocket className="h-4 w-4" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Campaign & Deal Intelligence
              </h1>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pl-10">
            Transform customer notes and validated ideas into high-converting Campaign Concepts and Objection Battlecards.
          </p>
        </div>

        <div className="flex items-center gap-2 pl-10 sm:pl-0">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-xl text-xs h-9 min-h-[44px] sm:min-h-[36px]"
          >
            <Link href="/admin/quick-notes/settings">
              <Sliders className="h-3.5 w-3.5 mr-1.5" />
              Settings
            </Link>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="rounded-xl text-xs font-semibold h-9 min-h-[44px] sm:min-h-[36px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-[0.97] transition-all"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            ✨ Create Concept
          </Button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Campaign Concepts
          </span>
          <p className="text-xl sm:text-2xl font-black text-foreground">{concepts.length}</p>
          <span className="text-[10px] text-muted-foreground">Synthesized from Ideas & Notes</span>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Approved Strategies
          </span>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{approvedCount}</p>
          <span className="text-[10px] text-muted-foreground">Ready for Campaign Studio</span>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Objection Battlecards
          </span>
          <p className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">{battlecards.length}</p>
          <span className="text-[10px] text-muted-foreground">Tactical Rebuttal Scripts</span>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Avg Audience Fit
          </span>
          <p className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">{avgRelevance}%</p>
          <span className="text-[10px] text-muted-foreground">Relevance & Value Score</span>
        </div>
      </div>

      {/* Main Hub Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl w-full sm:w-auto">
            <TabsTrigger value="concepts" className="rounded-lg text-xs font-semibold">
              <Rocket className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Campaign Concepts ({concepts.length})
            </TabsTrigger>
            <TabsTrigger value="battlecards" className="rounded-lg text-xs font-semibold">
              <ShieldAlert className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Objection Matrix ({battlecards.length})
            </TabsTrigger>
            <TabsTrigger value="learnings" className="rounded-lg text-xs font-semibold">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              Campaign Learnings ({campaignLearnings.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: CAMPAIGN CONCEPTS */}
        <TabsContent value="concepts" className="space-y-4 pt-1">
          {/* Search & Channel Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border/80 shadow-sm">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search concepts, personas, hooks..."
                className="pl-9 h-9 text-xs rounded-xl bg-background border-border/70"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedStatus}
                onValueChange={(val) => setSelectedStatus(val as CampaignConceptStatus | 'all')}
              >
                <SelectTrigger className="w-[140px] h-9 text-xs rounded-xl bg-background border-border/70">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="deployed_to_campaign">Deployed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={selectedChannel}
                onValueChange={(val) => setSelectedChannel(val as CampaignChannel | 'all')}
              >
                <SelectTrigger className="w-[140px] h-9 text-xs rounded-xl bg-background border-border/70">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS Blast</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call_center">Call Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Concepts Grid */}
          {filteredConcepts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-muted/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <Rocket className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-foreground">No Campaign Concepts Found</h4>
              <p className="text-xs text-muted-foreground max-w-md mt-1 mb-4">
                Click &quot;Create Concept&quot; to transform validated ideas and customer feedback into grounded marketing campaigns.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="rounded-xl text-xs font-semibold h-9 min-h-[44px] sm:min-h-[36px]"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                ✨ Synthesize First Concept
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredConcepts.map((concept) => (
                <CampaignConceptCard
                  key={concept.id}
                  concept={concept}
                  onOpenDrawer={(c) => {
                    setSelectedConcept(c);
                    setIsDrawerOpen(true);
                  }}
                  onConceptUpdated={loadData}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: OBJECTION MATRIX */}
        <TabsContent value="battlecards" className="pt-1">
          <ObjectionMatrixView
            battlecards={battlecards}
            workspaceId={activeWorkspaceId || ''}
            onRefresh={loadData}
          />
        </TabsContent>

        {/* TAB 3: CAMPAIGN LEARNINGS VAULT */}
        <TabsContent value="learnings" className="pt-1 space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Post-Campaign Qualitative Learnings
            </h3>
            <p className="text-xs text-muted-foreground">
              These insights were automatically synthesized from recipient delivery metrics, conversion funnels, and customer replies.
            </p>
          </div>

          {campaignLearnings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-muted/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-3">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-foreground">No Campaign Learnings Recorded</h4>
              <p className="text-xs text-muted-foreground max-w-md mt-1">
                When campaigns finish executing in Campaign Studio, their qualitative engagement signals and replies will feed back into Company Brain.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaignLearnings.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[11px] capitalize bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                      {item.type.replace('_', ' ')}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {item.evidenceCount} Evidence Sources
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.summary}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Slide-over Brief Drawer */}
      <CampaignConceptDrawer
        concept={selectedConcept}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedConcept(null);
        }}
        onConceptUpdated={loadData}
      />

      {/* Create Concept Dialog */}
      <CreateConceptDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        workspaceId={activeWorkspaceId || ''}
        ideas={ideas}
        onConceptCreated={loadData}
      />
    </div>
  );
}
