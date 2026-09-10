'use client';

/**
 * @fileoverview Platform Control Plane for Knowledge Graph Governance (Phase 5).
 *
 * ARCHITECTURAL POINTER:
 * Super-admin governance console for inspecting, configuring, and maintaining the
 * organizational knowledge graph across tenants:
 * 1. Live Graph Metrics: Nodes, edges, graph density, and orphaned object count.
 * 2. Relation Types Registry: Enable/disable any of the 23 semantic relationship types.
 * 3. AI Linking Agent Hyperparameters: Minimum confidence threshold, candidate pool bounds.
 * 4. FER Migration Runner: Backfills implicit CRM entity links into explicit knowledge_relations.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Touch targets maintain >= 44px height for mobile accessibility.
 * - Conforms to Emil Kowalski micro-interactions (active:scale-[0.97]).
 * - All error notifications provide relative actionConfig navigation paths.
 *
 * TESTABILITY POINTER:
 * Tested via pure deterministic engine functions in quick-notes-domain.ts and server action tests.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import {
  Network,
  Share2,
  Sliders,
  Database,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Zap,
  Activity,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Route,
  Brain,
  ArrowRight,
  Search,
} from 'lucide-react';
import {
  getKnowledgeGraphGovernanceAction,
  updateKnowledgeGraphGovernanceAction,
  getKnowledgeGraphMetricsAction,
  triggerBackfillCrmRelationsAction,
  resetKnowledgeGraphGovernanceAction,
} from '@/app/actions/knowledge-graph-governance-actions';
import {
  getGraphTopologyMetricsAction,
  findGraphPathAction,
  explainGraphConnectionAction,
  syncWorkspaceGraphMeshAction,
} from '@/lib/memory/actions/graph-actions';
import {
  type GraphTopologyMetrics,
  type GraphPath,
  type GraphNodeType,
  NODE_TYPE_DISPLAY_CONFIG,
} from '@/lib/memory/graph-types';
import {
  KNOWLEDGE_RELATION_TYPES,
  type KnowledgeRelationType,
  type KnowledgeGraphGovernanceConfig,
  type GraphMetrics,
} from '@/lib/quick-notes-types';
import { getRelationDisplayLabel } from '@/lib/quick-notes-domain';

interface RelationTypeCategory {
  title: string;
  description: string;
  types: KnowledgeRelationType[];
}

const RELATION_CATEGORIES: RelationTypeCategory[] = [
  {
    title: 'Causal & Structural',
    description: 'Direct hierarchical or logical dependencies between notes and concepts',
    types: ['depends_on', 'derived_from', 'supersedes', 'implements', 'blocks', 'solves', 'causes', 'affects', 'requires'],
  },
  {
    title: 'Evidence & Validation',
    description: 'Empirical citations, customer observations, and hypothesis validation',
    types: ['supports', 'contradicts', 'evidences', 'validates', 'invalidates', 'expands', 'summarizes', 'responds_to'],
  },
  {
    title: 'CRM & Stakeholders',
    description: 'Direct connections to accounts, pipeline opportunities, contacts, and schools',
    types: ['about_contact', 'about_school', 'about_deal', 'about_campaign', 'about_product', 'about_segment', 'mentioned_by_contact', 'targets', 'addresses'],
  },
  {
    title: 'Associative & Semantic',
    description: 'General contextual mentions, citations, and semantic cross-references',
    types: ['related_to', 'inspired_by', 'duplicates', 'references', 'belongs_to'],
  },
];

export default function BackofficeKnowledgeGraphClient() {
  const { user } = useUser();
  const { toast } = useToast();

  const [workspaceId, setWorkspaceId] = React.useState('workspace_default');
  const [governanceConfig, setGovernanceConfig] = React.useState<KnowledgeGraphGovernanceConfig | null>(null);
  const [metrics, setMetrics] = React.useState<GraphMetrics | null>(null);
  const [totalRelations, setTotalRelations] = React.useState<number>(0);
  const [cbTopology, setCbTopology] = React.useState<GraphTopologyMetrics | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isMigrating, setIsMigrating] = React.useState(false);
  const [migrationResult, setMigrationResult] = React.useState<{ backfilledCount: number } | null>(null);
  const [showResetDialog, setShowResetDialog] = React.useState(false);

  // CompanyBrain 2.0 Mesh Sync State
  const [isSyncingMesh, setIsSyncingMesh] = React.useState(false);
  const [meshSyncResult, setMeshSyncResult] = React.useState<{ nodesUpserted: number; edgesUpserted: number } | null>(null);

  // Pathfinding & AI Explainability Sandbox State
  const [simStartNodeId, setSimStartNodeId] = React.useState('');
  const [simEndNodeId, setSimEndNodeId] = React.useState('');
  const [isSimulatingPath, setIsSimulatingPath] = React.useState(false);
  const [simPath, setSimPath] = React.useState<GraphPath | null>(null);
  const [simPathError, setSimPathError] = React.useState<string | null>(null);
  const [isExplainingPath, setIsExplainingPath] = React.useState(false);
  const [simExplanation, setSimExplanation] = React.useState<string | null>(null);

  // Load governance settings and metrics
  const loadData = React.useCallback(async () => {
    if (!user || !workspaceId.trim()) return;
    setIsLoading(true);

    try {
      const [govRes, metricsRes, cbTopologyRes] = await Promise.all([
        getKnowledgeGraphGovernanceAction(workspaceId.trim(), user.uid),
        getKnowledgeGraphMetricsAction(workspaceId.trim(), user.uid),
        getGraphTopologyMetricsAction({ workspaceId: workspaceId.trim(), userId: user.uid }),
      ]);

      if (govRes.success) {
        setGovernanceConfig(govRes.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Governance Fetch Warning',
          description: govRes.error,
        });
      }

      if (metricsRes.success) {
        setMetrics(metricsRes.data.metrics);
        setTotalRelations(metricsRes.data.totalRelations);
      }

      if (cbTopologyRes.success) {
        setCbTopology(cbTopologyRes.data);
      }
    } catch (err) {
      console.error('[BackofficeKnowledgeGraphClient] Load error:', err);
      toast({
        variant: 'destructive',
        title: 'Error loading governance data',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, workspaceId, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle a single relation type
  const handleToggleRelationType = (type: KnowledgeRelationType) => {
    if (!governanceConfig) return;
    const current = new Set(governanceConfig.enabledRelationTypes);
    if (current.has(type)) {
      current.delete(type);
    } else {
      current.add(type);
    }
    setGovernanceConfig({
      ...governanceConfig,
      enabledRelationTypes: Array.from(current) as KnowledgeRelationType[],
    });
  };

  // Enable / Disable all relation types
  const handleBulkToggle = (enable: boolean) => {
    if (!governanceConfig) return;
    setGovernanceConfig({
      ...governanceConfig,
      enabledRelationTypes: enable ? ([...KNOWLEDGE_RELATION_TYPES] as KnowledgeRelationType[]) : ['related_to'],
    });
  };

  // Save governance configuration
  const handleSaveConfig = async () => {
    if (!governanceConfig || !user) return;
    setIsSaving(true);

    try {
      const res = await updateKnowledgeGraphGovernanceAction({
        workspaceId: workspaceId.trim(),
        actorId: user.uid,
        actorName: user.displayName || 'System Admin',
        config: governanceConfig,
      });

      if (res.success) {
        setGovernanceConfig(res.data);
        toast({
          title: 'Configuration Saved',
          description: 'Knowledge Graph governance rules updated across the workspace.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error,
        });
      }
    } catch (err) {
      console.error('[handleSaveConfig] Error:', err);
      toast({
        variant: 'destructive',
        title: 'Network Error',
        description: 'Failed to persist governance updates.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Run FER Migration
  const handleRunMigration = async () => {
    if (!user) return;
    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const res = await triggerBackfillCrmRelationsAction(
        workspaceId.trim(),
        user.uid,
        user.displayName || 'System Admin'
      );

      if (res.success) {
        setMigrationResult(res.data);
        toast({
          title: 'FER Migration Complete ✓',
          description: `Successfully backfilled ${res.data.backfilledCount} implicit relationships into explicit graph edges.`,
        });
        loadData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Migration Notice',
          description: res.error,
        });
      }
    } catch (err) {
      console.error('[handleRunMigration] Error:', err);
      toast({
        variant: 'destructive',
        title: 'Migration Error',
        description: 'Failed to complete FER relationship backfill.',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  // Reset to Defaults
  const handleResetToBaseline = async () => {
    if (!user) return;
    setIsSaving(true);
    setShowResetDialog(false);

    try {
      const res = await resetKnowledgeGraphGovernanceAction(
        workspaceId.trim(),
        user.uid,
        user.displayName || 'System Admin'
      );

      if (res.success) {
        setGovernanceConfig(res.data);
        toast({
          title: 'Governance Reset',
          description: 'Restored system-standard baseline settings.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Reset Failed',
          description: res.error,
        });
      }
    } catch (err) {
      console.error('[handleResetToBaseline] Error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Run CompanyBrain 2.0 Mesh Sync
  const handleRunMeshSync = async () => {
    if (!user) return;
    setIsSyncingMesh(true);
    setMeshSyncResult(null);

    try {
      const res = await syncWorkspaceGraphMeshAction({
        workspaceId: workspaceId.trim(),
        userId: user.uid,
      });

      if (res.success) {
        setMeshSyncResult(res.data);
        toast({
          title: 'CompanyBrain Mesh Synchronized ✓',
          description: `Successfully upserted ${res.data.nodesUpserted} nodes and ${res.data.edgesUpserted} edges.`,
        });
        loadData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Sync Warning',
          description: res.error,
          ...(res.actionConfig && { actionConfig: res.actionConfig }),
        });
      }
    } catch (err) {
      console.error('[handleRunMeshSync] Error:', err);
      toast({
        variant: 'destructive',
        title: 'Sync Error',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setIsSyncingMesh(false);
    }
  };

  // Trace BFS Shortest Path
  const handleSimulatePath = async () => {
    if (!user || !simStartNodeId.trim() || !simEndNodeId.trim()) return;
    setIsSimulatingPath(true);
    setSimPath(null);
    setSimPathError(null);
    setSimExplanation(null);

    try {
      const res = await findGraphPathAction({
        workspaceId: workspaceId.trim(),
        userId: user.uid,
        startNodeId: simStartNodeId.trim(),
        targetNodeId: simEndNodeId.trim(),
        maxHops: 3,
      });

      if (res.success) {
        if (res.data) {
          setSimPath(res.data);
        } else {
          setSimPathError('No path exists between the specified nodes within 3 hops.');
        }
      } else {
        setSimPathError(res.error);
      }
    } catch (err) {
      console.error('[handleSimulatePath] Error:', err);
      setSimPathError(err instanceof Error ? err.message : 'Pathfinding failed.');
    } finally {
      setIsSimulatingPath(false);
    }
  };

  // Grounded AI Explanation for Simulated Path
  const handleExplainPath = async () => {
    if (!user || !simPath) return;
    setIsExplainingPath(true);

    try {
      const res = await explainGraphConnectionAction({
        workspaceId: workspaceId.trim(),
        userId: user.uid,
        startNodeId: simStartNodeId.trim(),
        targetNodeId: simEndNodeId.trim(),
      });

      if (res.success && res.data) {
        setSimExplanation(res.data.narrative || res.data.summary);
      } else {
        toast({
          variant: 'destructive',
          title: 'Explanation Failed',
          description: res.error,
        });
      }
    } catch (err) {
      console.error('[handleExplainPath] Error:', err);
      toast({
        variant: 'destructive',
        title: 'Explanation Error',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setIsExplainingPath(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto font-figtree">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Knowledge Graph Governance
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Multi-tenant relationship registry, AI linking hyperparameters, graph health telemetry, and FER migration runner.
              </p>
            </div>
          </div>
        </div>

        {/* Workspace Selector & Refresh */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-muted/30 border border-border px-3 py-1.5 rounded-xl">
            <Label htmlFor="ws-input" className="text-xs font-medium text-muted-foreground">
              Tenant ID:
            </Label>
            <Input
              id="ws-input"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              placeholder="workspace_default"
              className="h-7 w-36 md:w-44 text-xs font-mono bg-background"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-[36px] px-3 text-xs gap-1.5 active:scale-[0.97] transition-transform"
            title="Reload telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSaveConfig}
            disabled={isSaving || !governanceConfig}
            className="min-h-[44px] sm:min-h-[36px] px-4 text-xs gap-1.5 active:scale-[0.97] transition-transform bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving…' : 'Save Rules'}</span>
          </Button>
        </div>
      </div>

      {/* Real-time Health & Telemetry KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card className="border-border/70 shadow-none bg-card/60">
          <CardHeader className="p-3.5 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Total Nodes</span>
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold text-foreground">
              {metrics ? metrics.totalNodes.toLocaleString() : '—'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Notes & CRM records</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none bg-card/60">
          <CardHeader className="p-3.5 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Explicit Edges</span>
              <Share2 className="w-3.5 h-3.5 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold text-foreground">
              {totalRelations.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Typed relations stored</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none bg-card/60">
          <CardHeader className="p-3.5 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Graph Density</span>
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold text-foreground">
              {metrics ? `${(metrics.density * 100).toFixed(1)}%` : '—'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Connectivity index</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none bg-card/60">
          <CardHeader className="p-3.5 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Hub Object</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-sm font-bold text-foreground truncate" title={metrics?.hubNodeLabel || 'None'}>
              {metrics?.hubNodeLabel || 'None'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Highest centrality node</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none bg-card/60">
          <CardHeader className="p-3.5 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Orphan Nodes</span>
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold text-foreground">
              {metrics ? metrics.isolatedCount.toLocaleString() : '—'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Zero relationship degree</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Governance Tabs */}
      <Tabs defaultValue="registry" className="w-full space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl h-auto p-1 bg-muted/50 rounded-xl gap-1">
          <TabsTrigger
            value="registry"
            className="text-xs font-semibold rounded-lg active:scale-[0.97] transition-all min-h-[36px]"
          >
            Relation Types ({governanceConfig?.enabledRelationTypes.length || 0}/{KNOWLEDGE_RELATION_TYPES.length})
          </TabsTrigger>
          <TabsTrigger
            value="ai-tuning"
            className="text-xs font-semibold rounded-lg active:scale-[0.97] transition-all min-h-[36px]"
          >
            AI Agent Tuning
          </TabsTrigger>
          <TabsTrigger
            value="mesh"
            className="text-xs font-semibold rounded-lg active:scale-[0.97] transition-all min-h-[36px]"
          >
            CompanyBrain Mesh
          </TabsTrigger>
          <TabsTrigger
            value="migration"
            className="text-xs font-semibold rounded-lg active:scale-[0.97] transition-all min-h-[36px]"
          >
            FER CRM Migration
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Relation Types Registry */}
        <TabsContent value="registry" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-foreground">
                Semantic Relationship Dictionary
              </h3>
              <p className="text-xs text-muted-foreground">
                Toggle relationship types on or off for this tenant. Disabled types are suppressed from user dialogs and AI suggestions.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleBulkToggle(true)}
                className="min-h-[44px] sm:min-h-[32px] px-3 text-xs active:scale-[0.97] transition-transform"
              >
                Enable All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleBulkToggle(false)}
                className="min-h-[44px] sm:min-h-[32px] px-3 text-xs text-muted-foreground active:scale-[0.97] transition-transform"
              >
                Disable All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RELATION_CATEGORIES.map((cat) => (
              <Card key={cat.title} className="border-border/70 shadow-none">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
                    <span>{cat.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {cat.types.filter((t) => governanceConfig?.enabledRelationTypes.includes(t)).length}/
                      {cat.types.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {cat.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-2.5">
                  {cat.types.map((type) => {
                    const isEnabled = Boolean(governanceConfig?.enabledRelationTypes.includes(type));
                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground">
                              {getRelationDisplayLabel(type)}
                            </span>
                            <code className="text-[10px] text-muted-foreground font-mono">
                              {type}
                            </code>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => handleToggleRelationType(type)}
                          aria-label={`Toggle ${type}`}
                          className="active:scale-[0.97] transition-transform"
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: AI Agent Tuning */}
        <TabsContent value="ai-tuning" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Confidence Threshold */}
            <Card className="border-border/70 shadow-none">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-500" />
                  <span>Minimum AI Linking Confidence</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Minimum certainty score (0.10 to 1.00) required before the AI Linking Agent proposes a relationship.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-3 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current Threshold:</span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {governanceConfig ? (governanceConfig.minAiConfidence * 100).toFixed(0) : 65}%
                  </span>
                </div>
                <Slider
                  value={[governanceConfig ? governanceConfig.minAiConfidence : 0.65]}
                  min={0.2}
                  max={0.95}
                  step={0.05}
                  onValueChange={([val]) => {
                    if (!governanceConfig || val === undefined) return;
                    setGovernanceConfig({ ...governanceConfig, minAiConfidence: val });
                  }}
                  className="py-2"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>20% (Aggressive Discovery)</span>
                  <span>65% (Recommended)</span>
                  <span>95% (High Precision)</span>
                </div>
              </CardContent>
            </Card>

            {/* Candidate Pool Size */}
            <Card className="border-border/70 shadow-none">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-500" />
                  <span>Candidate Evaluation Pool Bound</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Maximum number of recent documents evaluated per inference call (5 to 30). Protects LLM context windows and latency.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-3 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Maximum Candidates:</span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {governanceConfig?.maxCandidatePool || 15} documents
                  </span>
                </div>
                <Slider
                  value={[governanceConfig ? governanceConfig.maxCandidatePool : 15]}
                  min={5}
                  max={30}
                  step={1}
                  onValueChange={([val]) => {
                    if (!governanceConfig || val === undefined) return;
                    setGovernanceConfig({ ...governanceConfig, maxCandidatePool: val });
                  }}
                  className="py-2"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>5 docs (Fastest)</span>
                  <span>15 docs (Balanced)</span>
                  <span>30 docs (Exhaustive)</span>
                </div>
              </CardContent>
            </Card>

            {/* Autonomy & User Controls */}
            <Card className="border-border/70 shadow-none md:col-span-2">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Operational Permissions & Behavior
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Control frontline user capabilities and automated background processing.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Allow User-Authored Relationships
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      When enabled, frontline sales reps and ops members can draw custom relationships in the graph.
                    </p>
                  </div>
                  <Switch
                    checked={governanceConfig?.allowUserCreatedRelations ?? true}
                    onCheckedChange={(val) => {
                      if (!governanceConfig) return;
                      setGovernanceConfig({ ...governanceConfig, allowUserCreatedRelations: val });
                    }}
                    className="active:scale-[0.97] transition-transform"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Auto-Synchronize CRM Links on Create
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Automatically creates typed graph edges whenever notes are attached to schools, deals, or contacts.
                    </p>
                  </div>
                  <Switch
                    checked={governanceConfig?.autoBackfillCrmLinks ?? true}
                    onCheckedChange={(val) => {
                      if (!governanceConfig) return;
                      setGovernanceConfig({ ...governanceConfig, autoBackfillCrmLinks: val });
                    }}
                    className="active:scale-[0.97] transition-transform"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reset Baseline Action Bar */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-foreground">Reset Workspace Baseline</h4>
              <p className="text-[11px] text-muted-foreground">
                Restore default parameters (65% confidence, 15 candidates, all {KNOWLEDGE_RELATION_TYPES.length} relation types enabled).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              className="min-h-[44px] sm:min-h-[32px] px-3 text-xs text-muted-foreground hover:text-destructive active:scale-[0.97] transition-transform gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </Button>
          </div>
        </TabsContent>

        {/* Tab 3: FER CRM Migration Runner */}
        <TabsContent value="migration" className="space-y-4">
          <Card className="border-border/70 shadow-none">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Fetch, Enrich, Restore (FER) CRM Relationship Backfill</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Converts historical implicit entity links (entityId, contactId, dealId, taskId) stored on notes into first-class explicit knowledge_relations in Firestore.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 text-xs space-y-2">
                <h5 className="font-semibold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                  How the Migration Protocol Operates:
                </h5>
                <ol className="list-decimal pl-4 space-y-1 text-muted-foreground text-[11px]">
                  <li><strong>Fetch:</strong> Scans all active QuickNotes within the selected workspace.</li>
                  <li><strong>Enrich:</strong> Evaluates attached links (entityId $\to$ about_school, contactId $\to$ about_contact, dealId $\to$ about_deal, taskId $\to$ depends_on).</li>
                  <li><strong>Restore:</strong> Safely inserts missing typed relationships into `knowledge_relations` with confidence 1.0 using batched transactions (max 450 items/batch).</li>
                  <li><strong>Idempotency:</strong> Skips any links that already exist to prevent duplicates.</li>
                </ol>
              </div>

              {migrationResult && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    Migration completed successfully: <strong>{migrationResult.backfilledCount}</strong> relationship(s) created.
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="text-[11px] text-muted-foreground">
                  Target Tenant: <code className="font-mono font-bold text-foreground">{workspaceId}</code>
                </div>

                <Button
                  type="button"
                  variant="default"
                  onClick={handleRunMigration}
                  disabled={isMigrating}
                  className="min-h-[44px] px-4 text-xs font-semibold gap-2 active:scale-[0.97] transition-transform bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isMigrating ? 'animate-spin' : ''}`} />
                  <span>{isMigrating ? 'Executing FER Backfill…' : 'Execute FER CRM Migration'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: CompanyBrain 2.0 Mesh & Path Simulator */}
        <TabsContent value="mesh" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                CompanyBrain Multi-Workspace Relationship Mesh
              </h3>
              <p className="text-xs text-muted-foreground">
                High-performance graph persistence (`graph_nodes` & `graph_edges`), bounded traversal engine, and grounded multi-hop reasoning.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleRunMeshSync}
                disabled={isSyncingMesh}
                className="min-h-[44px] sm:min-h-[36px] px-3.5 text-xs font-semibold gap-1.5 active:scale-[0.97] transition-transform bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMesh ? 'animate-spin' : ''}`} />
                <span>{isSyncingMesh ? 'Syncing Mesh…' : 'Sync Graph Mesh'}</span>
              </Button>
            </div>
          </div>

          {meshSyncResult && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                Mesh sync completed: Upserted <strong>{meshSyncResult.nodesUpserted}</strong> nodes and <strong>{meshSyncResult.edgesUpserted}</strong> explicit edges.
              </span>
            </div>
          )}

          {/* Node Distribution Breakdown */}
          {cbTopology && (
            <Card className="border-border/70 shadow-none">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  Node Type Distribution ({cbTopology.totalNodes} total)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  {(Object.keys(cbTopology.nodeCountsByType) as GraphNodeType[]).map((type) => {
                    const count = cbTopology.nodeCountsByType[type] || 0;
                    const config = NODE_TYPE_DISPLAY_CONFIG[type];
                    return (
                      <div
                        key={type}
                        className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground truncate">
                            {config?.label || type}
                          </span>
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: config?.nodeColor || '#64748b' }}
                          />
                        </div>
                        <div className="text-base font-bold text-foreground font-mono">
                          {count.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Interactive Multi-Hop Path Simulator & AI Grounding */}
          <Card className="border-border/70 shadow-none">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Route className="w-4 h-4 text-indigo-500" />
                <span>Multi-Hop Traversal Simulator & AI Grounded Explanation</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Simulate cycle-safe BFS traversal (max 3 hops) between any two entities or memories and inspect intermediate evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sim-start" className="text-xs font-semibold text-foreground">
                    Source Node ID
                  </Label>
                  <Input
                    id="sim-start"
                    value={simStartNodeId}
                    onChange={(e) => setSimStartNodeId(e.target.value)}
                    placeholder="e.g. ent_123 or mem_456"
                    className="text-xs font-mono bg-background min-h-[44px] sm:min-h-[36px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sim-end" className="text-xs font-semibold text-foreground">
                    Target Node ID
                  </Label>
                  <Input
                    id="sim-end"
                    value={simEndNodeId}
                    onChange={(e) => setSimEndNodeId(e.target.value)}
                    placeholder="e.g. deal_789 or mem_101"
                    className="text-xs font-mono bg-background min-h-[44px] sm:min-h-[36px]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSimulatePath}
                  disabled={isSimulatingPath || !simStartNodeId.trim() || !simEndNodeId.trim()}
                  className="min-h-[44px] sm:min-h-[36px] px-4 text-xs font-semibold gap-1.5 active:scale-[0.97] transition-transform"
                >
                  <Search className={`w-3.5 h-3.5 ${isSimulatingPath ? 'animate-spin' : ''}`} />
                  <span>{isSimulatingPath ? 'Tracing Shortest Path…' : 'Trace Shortest Path'}</span>
                </Button>
              </div>

              {simPathError && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{simPathError}</span>
                </div>
              )}

              {/* Path Result */}
              {simPath && (
                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20">
                        {simPath.totalHops ?? simPath.edges.length} Hop{(simPath.totalHops ?? simPath.edges.length) === 1 ? '' : 's'}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        Weight: {(simPath.totalWeight ?? simPath.edges.reduce((acc, e) => acc + (e.weight ?? e.confidence ?? 1.0), 0)).toFixed(2)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleExplainPath}
                      disabled={isExplainingPath}
                      className="h-8 text-xs font-semibold gap-1.5 active:scale-[0.97] bg-primary text-primary-foreground min-h-[44px] sm:min-h-[32px]"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isExplainingPath ? 'animate-spin' : ''}`} />
                      <span>{isExplainingPath ? 'Synthesizing…' : 'Explain Connection with AI'}</span>
                    </Button>
                  </div>

                  {/* Chain of Nodes and Edges */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {simPath.nodes.map((node, idx) => {
                      const edge = simPath.edges[idx];
                      const nodeConfig = NODE_TYPE_DISPLAY_CONFIG[node.nodeType];
                      return (
                        <React.Fragment key={node.id}>
                          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: nodeConfig?.nodeColor || '#64748b' }}
                            />
                            <span className="font-semibold text-foreground truncate max-w-[140px]" title={node.label}>
                              {node.label}
                            </span>
                            <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">
                              {node.nodeType}
                            </Badge>
                          </div>

                          {edge && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                              <Badge variant="secondary" className="text-[9px] font-mono px-1 py-0">
                                {edge.relationshipType}
                              </Badge>
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Grounded AI Explanation output */}
                  {simExplanation && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1.5 animate-in fade-in">
                      <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5" />
                        Grounded Institutional Synthesis
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">
                        {simExplanation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog: Reset to Baseline */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Reset Knowledge Graph Governance?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This action resets the AI confidence threshold to 65%, candidate pool to 15, and re-enables all 23 relation types for workspace &quot;{workspaceId}&quot;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowResetDialog(false)}
              className="min-h-[44px] sm:min-h-[36px] px-3 text-xs active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleResetToBaseline}
              className="min-h-[44px] sm:min-h-[36px] px-3 text-xs active:scale-[0.97]"
            >
              Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
