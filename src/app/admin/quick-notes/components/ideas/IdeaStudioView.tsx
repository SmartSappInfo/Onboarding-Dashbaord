'use client';

import * as React from 'react';
import {
  type Idea,
  type IdeaLifecycleStage,
  type CreateIdeaPayload,
} from '@/lib/quick-notes-types';
import {
  Lightbulb,
  Sparkles,
  TrendingUp,
  Target,
  CheckCircle2,
  Layers,
  Plus,
  Search,
  Table,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  getWorkspaceIdeasAction,
  createIdeaAction,
  transitionIdeaStageAction,
} from '@/lib/quick-notes-idea-actions';
import { IdeaPipelineView } from './IdeaPipelineView';
import { IdeaPrioritizationMatrix } from './IdeaPrioritizationMatrix';
import { IdeaVisualCanvas } from './IdeaVisualCanvas';
import { IdeaAccessibilityView } from './IdeaAccessibilityView';
import { IdeaEditorDrawer } from './IdeaEditorDrawer';
import { CreateIdeaDialog } from './CreateIdeaDialog';
import { AiIdeaAssistantDialog } from './AiIdeaAssistantDialog';

export type StudioViewMode = 'pipeline' | 'matrix' | 'canvas' | 'accessible';

interface IdeaStudioViewProps {
  workspaceId: string;
  userId: string;
  userName?: string;
  initialIdeas?: Idea[];
}

export function IdeaStudioView({
  workspaceId,
  userId,
  userName = 'User',
  initialIdeas = [],
}: IdeaStudioViewProps) {
  const { toast } = useToast();

  const [ideas, setIdeas] = React.useState<Idea[]>(initialIdeas);
  const [viewMode, setViewMode] = React.useState<StudioViewMode>('pipeline');
  const [_isLoading, setIsLoading] = React.useState(false);

  const [selectedIdea, setSelectedIdea] = React.useState<Idea | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = React.useState(false);

  const [searchQuery, setSearchQuery] = React.useState('');

  // Fetch ideas on mount or workspace change
  const fetchIdeas = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getWorkspaceIdeasAction(workspaceId);
      if (res.success && res.data) {
        setIdeas(res.data);
      }
    } catch {
      toast({ title: 'Failed to fetch ideas', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, toast]);

  React.useEffect(() => {
    if (!initialIdeas || initialIdeas.length === 0) {
      fetchIdeas();
    }
  }, [workspaceId, initialIdeas, fetchIdeas]);

  // Studio KPI Summary Calculations
  const kpiData = React.useMemo(() => {
    const total = ideas.length;
    const validating = ideas.filter((i) => i.lifecycleStage === 'validating' || i.validationStatus === 'testing').length;
    const validated = ideas.filter((i) => i.lifecycleStage === 'validated' || i.lifecycleStage === 'approved' || i.validationStatus === 'validated').length;
    const avgIce = total > 0
      ? Math.round((ideas.reduce((acc, i) => acc + (i.iceScore || 0), 0) / total) * 10) / 10
      : 0;

    return { total, validating, validated, avgIce };
  }, [ideas]);

  // Filtered Ideas
  const filteredIdeas = React.useMemo(() => {
    if (!searchQuery.trim()) return ideas;
    const q = searchQuery.toLowerCase().trim();
    return ideas.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.problem && i.problem.toLowerCase().includes(q)) ||
        (i.proposedSolution && i.proposedSolution.toLowerCase().includes(q)) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [ideas, searchQuery]);

  // Open Idea Inspector
  const handleSelectIdea = (idea: Idea) => {
    setSelectedIdea(idea);
    setIsDrawerOpen(true);
  };

  // Advance Stage
  const handleAdvanceStage = async (idea: Idea, nextStage: IdeaLifecycleStage) => {
    try {
      const res = await transitionIdeaStageAction(workspaceId, idea.id, nextStage, userId);
      if (res.success && res.data) {
        setIdeas((prev) => prev.map((i) => (i.id === idea.id ? res.data! : i)));
        toast({ title: `Moved to ${nextStage}` });
      } else {
        toast({ title: 'Cannot advance stage', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error transitioning stage', variant: 'destructive' });
    }
  };

  // Create Idea
  const handleCreateIdea = async (payload: CreateIdeaPayload) => {
    try {
      const res = await createIdeaAction(workspaceId, payload, userId, userName);
      if (res.success && res.data) {
        setIdeas((prev) => [res.data!, ...prev]);
        toast({ title: 'Idea created successfully' });
      } else {
        toast({ title: 'Failed to create idea', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error creating idea', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Studio Header & KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Ideas */}
        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Ideas</p>
            <h3 className="text-2xl font-black text-foreground mt-0.5">{kpiData.total}</h3>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Lightbulb className="h-5 w-5" />
          </span>
        </div>

        {/* KPI 2: Active Validation */}
        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">In Validation</p>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{kpiData.validating}</h3>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Target className="h-5 w-5" />
          </span>
        </div>

        {/* KPI 3: Validated & Ready */}
        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Validated & Ready</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{kpiData.validated}</h3>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </span>
        </div>

        {/* KPI 4: Avg ICE Score */}
        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Avg ICE Score</p>
            <h3 className="text-2xl font-black text-primary mt-0.5">{kpiData.avgIce}</h3>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp className="h-5 w-5" />
          </span>
        </div>
      </div>

      {/* Control Bar: View Switcher, Search & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-2xl border border-border/60 bg-muted/20 backdrop-blur-sm">
        {/* Mode Switcher Buttons */}
        <div className="flex items-center gap-1 bg-background/80 p-1 rounded-xl border border-border/60">
          <Button
            variant={viewMode === 'pipeline' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('pipeline')}
            className={`h-8 text-xs font-semibold rounded-lg gap-1.5 ${
              viewMode === 'pipeline' ? 'shadow-xs' : 'text-muted-foreground'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Pipeline (Kanban)
          </Button>

          <Button
            variant={viewMode === 'matrix' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('matrix')}
            className={`h-8 text-xs font-semibold rounded-lg gap-1.5 ${
              viewMode === 'matrix' ? 'shadow-xs' : 'text-muted-foreground'
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            ICE Matrix
          </Button>

          <Button
            variant={viewMode === 'canvas' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('canvas')}
            className={`h-8 text-xs font-semibold rounded-lg gap-1.5 ${
              viewMode === 'canvas' ? 'shadow-xs' : 'text-muted-foreground'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Visual Canvas
          </Button>

          <Button
            variant={viewMode === 'accessible' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('accessible')}
            className={`h-8 text-xs font-semibold rounded-lg gap-1.5 ${
              viewMode === 'accessible' ? 'shadow-xs' : 'text-muted-foreground'
            }`}
            title="Section 84 Spec Accessible Table View"
          >
            <Table className="h-3.5 w-3.5" />
            Table View
          </Button>
        </div>

        {/* Search & Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="relative w-44 sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ideas..."
              className="pl-8 h-8 text-xs bg-background rounded-xl"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAiAssistantOpen(true)}
            className="h-8 text-xs font-semibold rounded-xl text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Strategy
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-8 px-3 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1 shadow-sm active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Idea
          </Button>
        </div>
      </div>

      {/* Main Viewport Content */}
      {viewMode === 'pipeline' && (
        <IdeaPipelineView
          ideas={filteredIdeas}
          onSelectIdea={handleSelectIdea}
          onAdvanceStage={handleAdvanceStage}
          onNewIdeaClick={() => setIsCreateOpen(true)}
        />
      )}

      {viewMode === 'matrix' && (
        <IdeaPrioritizationMatrix
          ideas={filteredIdeas}
          onSelectIdea={handleSelectIdea}
        />
      )}

      {viewMode === 'canvas' && (
        <div className="space-y-3">
          {ideas.length > 0 ? (
            <IdeaVisualCanvas
              idea={selectedIdea || ideas[0]}
              workspaceId={workspaceId}
              userId={userId}
              onUpdateIdea={(updated) => {
                setIdeas((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
                setSelectedIdea(updated);
              }}
              onSelectNode={(_node) => {
                // Node selected
              }}
            />
          ) : (
            <div className="h-96 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-center">
              <Lightbulb className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-bold text-foreground">No ideas on canvas yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Capture an idea to start mapping it visually.</p>
              <Button size="sm" onClick={() => setIsCreateOpen(true)} className="text-xs font-bold">
                + Capture First Idea
              </Button>
            </div>
          )}
        </div>
      )}

      {viewMode === 'accessible' && (
        <IdeaAccessibilityView
          ideas={filteredIdeas}
          onSelectIdea={handleSelectIdea}
        />
      )}

      {/* Slide-over Workbench Drawer */}
      <IdeaEditorDrawer
        idea={selectedIdea}
        workspaceId={workspaceId}
        userId={userId}
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedIdea(null);
        }}
        onIdeaUpdated={(updated) => {
          setIdeas((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          setSelectedIdea(updated);
        }}
        onIdeaDeleted={(deletedId) => {
          setIdeas((prev) => prev.filter((i) => i.id !== deletedId));
          setSelectedIdea(null);
        }}
      />

      {/* Create Idea Dialog */}
      <CreateIdeaDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        workspaceId={workspaceId}
        userId={userId}
        onSubmit={handleCreateIdea}
      />

      {/* AI Strategy Assistant Dialog */}
      <AiIdeaAssistantDialog
        open={isAiAssistantOpen}
        onOpenChange={setIsAiAssistantOpen}
        workspaceId={workspaceId}
        userId={userId}
        selectedIdea={selectedIdea}
      />
    </div>
  );
}
