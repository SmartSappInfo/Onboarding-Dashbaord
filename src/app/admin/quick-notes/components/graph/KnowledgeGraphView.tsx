'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Loader2,
  RefreshCw,
  Route,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import {
  getWorkspaceKnowledgeGraphAction,
  deleteKnowledgeRelationAction,
} from '@/lib/quick-notes-graph-actions';
import {
  findShortestGraphPath,
  extractSubGraph,
  filterKnowledgeGraph,
} from '@/lib/quick-notes-domain';
import type {
  KnowledgeGraphData,
  KnowledgeGraphFilterOptions,
  GraphMode,
  PathFindingResult,
} from '@/lib/quick-notes-types';

import { GraphViewport } from './GraphViewport';
import { GraphModes } from './GraphModes';
import { GraphControls } from './GraphControls';
import { GraphFilters } from './GraphFilters';
import { GraphNodeDrawer } from './GraphNodeDrawer';
import { GraphAccessibilityList } from './GraphAccessibilityList';
import { CreateRelationDialog } from './CreateRelationDialog';
import { AiLinkSuggestionsDialog } from './AiLinkSuggestionsDialog';

interface KnowledgeGraphViewProps {
  initialFocusNodeId?: string;
  className?: string;
}

export function KnowledgeGraphView({
  initialFocusNodeId,
  className = '',
}: KnowledgeGraphViewProps) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();

  const urlFocus = searchParams?.get('focus') || initialFocusNodeId || null;

  // Primary Data State
  const [graphData, setGraphData] = React.useState<KnowledgeGraphData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // View & Mode State
  const [currentMode, setCurrentMode] = React.useState<GraphMode>('explore');
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(urlFocus);
  const [pathStartNodeId, setPathStartNodeId] = React.useState<string | null>(null);
  const [pathResult, setPathResult] = React.useState<PathFindingResult | null>(null);

  // Interactive Viewport State
  const [physicsEnabled, setPhysicsEnabled] = React.useState(true);
  const [clustersVisible, setClustersVisible] = React.useState(true);
  const [isListView, setIsListView] = React.useState(false);

  // Filters State
  const [filters, setFilters] = React.useState<KnowledgeGraphFilterOptions>({});

  // Dialog State
  const [createRelationNodeId, setCreateRelationNodeId] = React.useState<string | null>(null);
  const [aiSuggestionsNodeId, setAiSuggestionsNodeId] = React.useState<string | null>(null);

  // Fetch Graph Data
  const loadGraph = React.useCallback(async () => {
    if (!activeWorkspaceId || !user) return;
    setIsLoading(true);

    try {
      const res = await getWorkspaceKnowledgeGraphAction(activeWorkspaceId, user.uid);
      if (res.success) {
        setGraphData(res.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to load Knowledge Graph',
          description: res.error,
        });
      }
    } catch (err) {
      console.error('[KnowledgeGraphView] Error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch graph data.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, user, toast]);

  React.useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // PRD Section 101 Spec Compliance: Auto-switch to accessible list on mobile viewports (< 768px)
  React.useEffect(() => {
    const checkMobileViewport = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setIsListView(true);
      }
    };
    checkMobileViewport();
    window.addEventListener('resize', checkMobileViewport);
    return () => window.removeEventListener('resize', checkMobileViewport);
  }, []);

  // Nodes Dictionary Map
  const nodesMap = React.useMemo(() => {
    if (!graphData) return new Map();
    return new Map(graphData.nodes.map((n) => [n.id, n]));
  }, [graphData]);

  // Node type counts for filter chips
  const nodeTypeCounts = React.useMemo(() => {
    if (!graphData) return {};
    const counts: Record<string, number> = {};
    for (const n of graphData.nodes) {
      counts[n.type] = (counts[n.type] || 0) + 1;
    }
    return counts;
  }, [graphData]);

  // Derived Mode-Specific Graph Data
  const activeGraph = React.useMemo(() => {
    if (!graphData) return null;

    let processed = graphData;

    // Apply Mode Transformations
    if (currentMode === 'focus' && selectedNodeId) {
      processed = extractSubGraph(processed, selectedNodeId, 2);
    } else if (currentMode === 'evidence') {
      processed = filterKnowledgeGraph(processed, {
        nodeTypes: ['idea', 'insight', 'decision', 'note', 'call', 'meeting'],
        relationTypes: ['supports', 'evidences', 'validates', 'contradicts'],
      });
    }

    // Apply Filter Options
    if (Object.keys(filters).length > 0) {
      processed = filterKnowledgeGraph(processed, filters);
    }

    return processed;
  }, [graphData, currentMode, selectedNodeId, filters]);

  // Handle Path Mode Selection
  const handleSelectNode = (nodeId: string | null) => {
    if (currentMode === 'path' && nodeId && graphData) {
      if (!pathStartNodeId) {
        setPathStartNodeId(nodeId);
        setSelectedNodeId(nodeId);
        setPathResult(null);
        toast({
          title: 'Start node selected',
          description: 'Now click any second knowledge node to calculate shortest path.',
        });
      } else if (pathStartNodeId === nodeId) {
        setPathStartNodeId(null);
        setSelectedNodeId(null);
        setPathResult(null);
      } else {
        const result = findShortestGraphPath(
          graphData.nodes,
          graphData.edges,
          pathStartNodeId,
          nodeId
        );
        setPathResult(result);
        setSelectedNodeId(nodeId);
        if (!result.found) {
          toast({
            variant: 'destructive',
            title: 'No connection found',
            description: result.explanation,
          });
        }
      }
    } else {
      setSelectedNodeId(nodeId);
    }
  };

  const handleResetPath = () => {
    setPathStartNodeId(null);
    setPathResult(null);
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!activeWorkspaceId || !user) return;
    try {
      const res = await deleteKnowledgeRelationAction(activeWorkspaceId, user.uid, relationId);
      if (res.success) {
        toast({
          title: 'Link removed',
          description: 'Relationship successfully deleted.',
        });
        loadGraph();
      } else {
        toast({
          variant: 'destructive',
          title: 'Delete failed',
          description: res.error,
        });
      }
    } catch (err) {
      console.error('[KnowledgeGraphView] Delete error:', err);
    }
  };

  const selectedNode = selectedNodeId && nodesMap ? nodesMap.get(selectedNodeId) || null : null;

  return (
    <div className={`relative flex flex-col w-full h-[calc(100vh-140px)] min-h-[600px] gap-3 ${className}`}>
      {/* Top Header Bar: Modes & Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <GraphModes
            currentMode={currentMode}
            onModeChange={(mode) => {
              setCurrentMode(mode);
              if (mode === 'path') {
                handleResetPath();
              }
            }}
          />

          {currentMode === 'path' && pathStartNodeId && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 animate-in fade-in">
              <Route className="w-3.5 h-3.5" />
              <span>
                From: <strong>{nodesMap.get(pathStartNodeId)?.label}</strong>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetPath}
                className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground ml-1"
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          <GraphControls
            physicsEnabled={physicsEnabled}
            onTogglePhysics={() => setPhysicsEnabled((p) => !p)}
            clustersVisible={clustersVisible}
            onToggleClusters={() => setClustersVisible((c) => !c)}
            isListView={isListView}
            onToggleListView={() => setIsListView((v) => !v)}
            onResetLayout={() => {
              setFilters({});
              setCurrentMode('explore');
              setSelectedNodeId(null);
              handleResetPath();
            }}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadGraph}
            disabled={isLoading}
            className="h-9 px-3 text-xs rounded-xl gap-1.5"
            title="Refresh graph data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter Omnibar & Chips */}
      <GraphFilters
        filterOptions={filters}
        onChangeFilters={setFilters}
        nodeTypeCounts={nodeTypeCounts}
        totalNodes={activeGraph?.nodes.length || 0}
        totalEdges={activeGraph?.edges.length || 0}
        className="shrink-0"
      />

      {/* Pathfinding Explanation Badge */}
      {pathResult?.found && (
        <div className="p-3 bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-2 shrink-0 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-medium">{pathResult.explanation}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetPath}
            className="h-7 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Main Canvas / List View Area */}
      <div className="relative flex-1 w-full h-full min-h-[440px] overflow-hidden rounded-2xl">
        {isLoading && !graphData ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-muted/20 border border-border rounded-2xl text-xs text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span>Building Knowledge Graph & Adjacency Matrix…</span>
          </div>
        ) : isListView ? (
          <div className="w-full h-full overflow-y-auto">
            <GraphAccessibilityList
              nodes={activeGraph?.nodes || []}
              edges={activeGraph?.edges || []}
              onOpenCreateRelation={(id) => setCreateRelationNodeId(id)}
              onDeleteRelation={handleDeleteRelation}
            />
          </div>
        ) : (
          <GraphViewport
            nodes={activeGraph?.nodes || []}
            edges={activeGraph?.edges || []}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            highlightedPath={pathResult?.path || []}
            mode={currentMode}
            physicsEnabled={physicsEnabled}
            searchQuery={filters.searchQuery}
          />
        )}

        {/* Slide-over Inspector Drawer */}
        {!isListView && selectedNode && (
          <GraphNodeDrawer
            node={selectedNode}
            edges={graphData?.edges || []}
            nodesMap={nodesMap}
            onClose={() => setSelectedNodeId(null)}
            onFocusNode={(id) => {
              setSelectedNodeId(id);
              setCurrentMode('focus');
            }}
            onOpenCreateRelation={(id) => setCreateRelationNodeId(id)}
            onOpenAiSuggestions={(id) => setAiSuggestionsNodeId(id)}
            onDeleteRelation={handleDeleteRelation}
          />
        )}
      </div>

      {/* Create Typed Relation Dialog */}
      <CreateRelationDialog
        open={Boolean(createRelationNodeId)}
        onOpenChange={(open) => !open && setCreateRelationNodeId(null)}
        sourceNodeId={createRelationNodeId}
        nodes={graphData?.nodes || []}
        onRelationCreated={loadGraph}
      />

      {/* AI Link Discovery Dialog */}
      <AiLinkSuggestionsDialog
        open={Boolean(aiSuggestionsNodeId)}
        onOpenChange={(open) => !open && setAiSuggestionsNodeId(null)}
        targetNodeId={aiSuggestionsNodeId}
        nodes={graphData?.nodes || []}
        onSuggestionAccepted={loadGraph}
      />
    </div>
  );
}
