'use client';

/**
 * @fileoverview Platform Control Plane for CompanyBrain Governance (Phase 2).
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Super-admin governance console for inspecting, configuring, and maintaining the
 *    vector search engine and institutional memory index across tenants:
 *    - Live Vector Cluster Health (Qdrant REST status, collection points, vectors count).
 *    - Memory Index Alignment (Firestore records vs Vector Points sync state).
 *    - In-Memory Embedding Cache Telemetry (LRU size, hit rate, memory flush).
 *    - FER Re-Index Trigger (One-click batch synchronization with safe chunks).
 *    - Interactive Semantic Search Playground (Live query testing with score explainability).
 * 2. Strict Zero-`any` typing enforced across all props, state, and server action responses.
 * 3. Mobile touch targets maintain >= 44px height (`min-h-[44px]`).
 * 4. Emil Kowalski micro-interactions (`active:scale-[0.97]`).
 * 5. Actionable error and toast navigation with relative paths.
 *
 * @testability Tested via pure domain functions and backoffice action unit tests.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { cn } from '@/lib/utils';
import {
  Brain,
  Database,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Search,
  Zap,
  AlertTriangle,
  Server,
  Trash2,
  Clock,
} from 'lucide-react';
import {
  getCompanyBrainHealthAction,
  triggerCompanyBrainReindexAction,
  clearEmbeddingCacheAction,
  type BackofficeCompanyBrainHealth,
} from '@/lib/memory/actions/backoffice-companybrain-actions';
import { semanticSearchMemoriesAction } from '@/lib/memory/actions/semantic-search-actions';
import { scanMemoryConflictsBatchAction } from '@/lib/memory/actions/orchestrator-actions';
import type { SemanticSearchResult } from '@/lib/memory/semantic-types';

export default function BackofficeCompanyBrainClient() {
  const { user } = useUser();
  const { toast } = useToast();

  const [healthData, setHealthData] = React.useState<BackofficeCompanyBrainHealth | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = React.useState(true);
  const [isReindexing, setIsReindexing] = React.useState(false);
  const [isClearingCache, setIsClearingCache] = React.useState(false);
  const [reindexTargetWorkspace, setReindexTargetWorkspace] = React.useState('');
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = React.useState(false);

  // Playground state
  const [playgroundQuery, setPlaygroundQuery] = React.useState('');
  const [playgroundWorkspaceId, setPlaygroundWorkspaceId] = React.useState('');
  const [isSearchingPlayground, setIsSearchingPlayground] = React.useState(false);
  const [playgroundResults, setPlaygroundResults] = React.useState<SemanticSearchResult[]>([]);
  const [searchLatencyMs, setSearchLatencyMs] = React.useState<number | null>(null);

  // Orchestrator audit state
  const [auditWorkspaceId, setAuditWorkspaceId] = React.useState('');
  const [isAuditingConflicts, setIsAuditingConflicts] = React.useState(false);
  const [auditResult, setAuditResult] = React.useState<{
    scannedPairs: number;
    conflictsDetected: number;
  } | null>(null);

  // Fetch health telemetry
  const fetchHealth = React.useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingHealth(true);
    try {
      const res = await getCompanyBrainHealthAction(user.uid);
      if (res.success && res.data) {
        setHealthData(res.data);
      } else {
        toast({
          title: 'Health Metric Error',
          description: res.error || 'Failed to fetch cluster health.',
          variant: 'destructive',
          actionConfig: {
            path: '/backoffice/companybrain',
            label: 'Retry',
          },
        });
      }
    } catch {
      toast({
        title: 'Connection Error',
        description: 'Could not contact backoffice health service.',
        variant: 'destructive',
        actionConfig: {
          path: '/backoffice/companybrain',
          label: 'Retry',
        },
      });
    } finally {
      setIsLoadingHealth(false);
    }
  }, [user?.uid, toast]);

  React.useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Handle re-index trigger
  const handleTriggerReindex = async () => {
    if (!user?.uid) return;
    setIsReindexing(true);
    try {
      const res = await triggerCompanyBrainReindexAction(
        user.uid,
        reindexTargetWorkspace.trim() || undefined
      );

      if (res.success && res.data) {
        toast({
          title: 'Re-indexing Completed',
          description: `Processed ${res.data.total} memories. Indexed: ${res.data.indexed}, Failed: ${res.data.failed}.`,
          duration: 8000,
          actionConfig: {
            path: '/backoffice/companybrain',
            label: 'Refresh Health',
          },
        });
        await fetchHealth();
      } else {
        toast({
          title: 'Re-indexing Failed',
          description: res.error || 'Vector re-indexing operation encountered an error.',
          variant: 'destructive',
          actionConfig: {
            path: '/backoffice/companybrain',
            label: 'Review Status',
          },
        });
      }
    } catch (err) {
      toast({
        title: 'Re-indexing Exception',
        description: err instanceof Error ? err.message : 'Unknown server error.',
        variant: 'destructive',
        actionConfig: {
          path: '/backoffice/companybrain',
          label: 'Retry',
        },
      });
    } finally {
      setIsReindexing(false);
    }
  };

  // Handle clear embedding cache
  const handleClearCache = async () => {
    if (!user?.uid) return;
    setIsClearingCache(true);
    try {
      const res = await clearEmbeddingCacheAction(user.uid);
      if (res.success) {
        toast({
          title: 'Cache Cleared',
          description: 'Embedding LRU memory cache was successfully purged.',
          actionConfig: {
            path: '/backoffice/companybrain',
            label: 'View Cache',
          },
        });
        setClearCacheDialogOpen(false);
        await fetchHealth();
      } else {
        toast({
          title: 'Purge Failed',
          description: res.error || 'Failed to clear embedding cache.',
          variant: 'destructive',
          actionConfig: {
            path: '/backoffice/companybrain',
            label: 'Retry',
          },
        });
      }
    } finally {
      setIsClearingCache(false);
    }
  };

  // Trigger batch contradiction audit
  const handleTriggerAuditConflicts = async () => {
    if (!user?.uid) return;
    setIsAuditingConflicts(true);
    try {
      const res = await scanMemoryConflictsBatchAction({
        workspaceId: auditWorkspaceId.trim() || 'all',
        organizationId: 'all',
        userId: user.uid,
      });

      if (res.success && res.data) {
        setAuditResult(res.data);
        toast({
          title: 'Contradiction Audit Finished',
          description: `Evaluated ${res.data.scannedPairs} pairs. Identified ${res.data.conflictsDetected} new contradictory claims.`,
          actionConfig: {
            path: '/admin/quick-notes/conflicts',
            label: 'Open Conflict Center',
          },
        });
      } else {
        toast({
          title: 'Audit Failed',
          description: res.error || 'Contradiction scan failed.',
          variant: 'destructive',
          actionConfig: {
            path: '/backoffice/companybrain',
            label: 'Retry',
          },
        });
      }
    } finally {
      setIsAuditingConflicts(false);
    }
  };

  // Handle interactive search playground
  const handlePlaygroundSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = playgroundQuery.trim();
    if (!query) return;

    setIsSearchingPlayground(true);
    const start = performance.now();
    try {
      const res = await semanticSearchMemoriesAction({
        query,
        workspaceId: playgroundWorkspaceId.trim() || 'all',
        organizationId: 'all',
        userId: user?.uid || '',
        limit: 8,
        filters: {
          minScore: 0.25,
        },
      });

      const duration = Math.round(performance.now() - start);
      setSearchLatencyMs(duration);

      if (res.success && res.data) {
        setPlaygroundResults(res.data);
      } else {
        toast({
          title: 'Search Playground Error',
          description: res.error || 'Semantic vector search query failed.',
          variant: 'destructive',
          actionConfig: {
            path: '/backoffice/companybrain',
            label: 'Check Cluster',
          },
        });
      }
    } catch (err) {
      toast({
        title: 'Playground Exception',
        description: err instanceof Error ? err.message : 'Query failed.',
        variant: 'destructive',
        actionConfig: {
          path: '/backoffice/companybrain',
          label: 'Retry',
        },
      });
    } finally {
      setIsSearchingPlayground(false);
    }
  };

  const clusterStatus = healthData?.cluster.status || 'unknown';
  const isClusterOnline = clusterStatus === 'healthy';
  const isFallback = clusterStatus === 'fallback_active';

  const firestoreTotal = healthData?.firestore.totalMemories ?? 0;
  const firestoreIndexed = healthData?.firestore.indexedCount ?? 0;
  const syncPercentage = firestoreTotal > 0 ? Math.round((firestoreIndexed / firestoreTotal) * 100) : 100;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              CompanyBrain Governance
              <Badge
                variant={isClusterOnline ? 'default' : isFallback ? 'secondary' : 'destructive'}
                className="text-[11px] font-medium"
              >
                {isClusterOnline ? 'Qdrant Connected' : isFallback ? 'Local Fallback' : 'Cluster Offline'}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Qdrant vector cluster telemetry, memory index synchronization, embedding cache monitoring, and data reconciliation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealth}
            disabled={isLoadingHealth}
            className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5 active:scale-[0.97] transition-transform"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoadingHealth && 'animate-spin')} />
            <span>Refresh Telemetry</span>
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Vector Cluster Status */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Vector Cluster</span>
              <Server className="h-4 w-4 text-violet-600" />
            </CardDescription>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              {isLoadingHealth ? (
                <Skeleton className="h-6 w-28" />
              ) : (
                <span className="capitalize">{healthData?.cluster.status.replace('_', ' ')}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Points:</span>
              <span className="font-semibold text-foreground">
                {healthData?.cluster.pointsCount.toLocaleString() ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Dimension:</span>
              <span className="font-mono text-foreground">
                {healthData?.cluster.vectorDimension ?? 768}d (Cosine)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Firestore Alignment */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Memory Sync State</span>
              <Database className="h-4 w-4 text-blue-600" />
            </CardDescription>
            <CardTitle className="text-lg font-bold">
              {isLoadingHealth ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                `${syncPercentage}% Synced`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Indexed:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {healthData?.firestore.indexedCount ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Pending Queue:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {healthData?.firestore.pendingCount ?? '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Embedding Cache */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>LRU Embedding Cache</span>
              <Zap className="h-4 w-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-lg font-bold">
              {isLoadingHealth ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                `${healthData?.cache.hitRate ?? 0}% Hit Rate`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Entries:</span>
              <span className="font-semibold text-foreground">
                {healthData?.cache.size ?? 0} / {healthData?.cache.maxSize ?? 1000}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Hits / Misses:</span>
              <span className="text-foreground">
                {healthData?.cache.hits ?? 0} / {healthData?.cache.misses ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Architecture Guarantee */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Tenant Security</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span>Pre-Filtered</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div>
              <span>Isolation:</span>{' '}
              <span className="font-semibold text-foreground">workspaceId + orgId</span>
            </div>
            <div>
              <span>Collection:</span>{' '}
              <span className="font-mono text-[11px] text-foreground">smartsapp_memory</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabbed Interface */}
      <Tabs defaultValue="sync" className="w-full space-y-4">
        <TabsList className="bg-muted/50 p-1 border border-border">
          <TabsTrigger value="sync" className="gap-1.5 text-xs">
            <Database className="h-3.5 w-3.5" />
            <span>Index Synchronization</span>
          </TabsTrigger>
          <TabsTrigger value="playground" className="gap-1.5 text-xs">
            <Search className="h-3.5 w-3.5" />
            <span>Search Playground</span>
          </TabsTrigger>
          <TabsTrigger value="cache" className="gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" />
            <span>Embedding Cache</span>
          </TabsTrigger>
          <TabsTrigger value="orchestrator" className="gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Orchestrator & Conflicts</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Index Synchronization & FER Reconciliation */}
        <TabsContent value="sync" className="space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-violet-600" />
                <span>Re-index Institutional Memories</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Triggers vector embedding generation and Qdrant upsert across Firestore memories. Safe batching guarantees execution limits (&le; 100 points per batch).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-lg">
                <label className="text-xs font-medium text-foreground">
                  Target Workspace ID (optional, leave empty for platform-wide batch):
                </label>
                <Input
                  value={reindexTargetWorkspace}
                  onChange={(e) => setReindexTargetWorkspace(e.target.value)}
                  placeholder="e.g. ws_acme_prod or leave empty"
                  className="text-xs min-h-[44px] font-mono bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  If left blank, re-indexes the next batch of up to 500 memories across all organizations.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button
                  onClick={handleTriggerReindex}
                  disabled={isReindexing}
                  className="min-h-[44px] bg-violet-600 hover:bg-violet-700 text-white text-xs gap-2 active:scale-[0.97]"
                >
                  <RefreshCw className={cn('h-4 w-4', isReindexing && 'animate-spin')} />
                  <span>{isReindexing ? 'Re-indexing Memories...' : 'Start Vector Re-index'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Interactive Search Playground */}
        <TabsContent value="playground" className="space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4 text-violet-600" />
                <span>Qdrant Vector Retrieval Playground</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Test raw vector similarity retrieval, inspect cosine distances, and verify payload extraction in real-time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handlePlaygroundSearch} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-medium text-foreground">Search Query</label>
                    <Input
                      value={playgroundQuery}
                      onChange={(e) => setPlaygroundQuery(e.target.value)}
                      placeholder="e.g. fee structure objections or onboarding blockers"
                      className="text-xs min-h-[44px] bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Workspace Filter (optional)</label>
                    <Input
                      value={playgroundWorkspaceId}
                      onChange={(e) => setPlaygroundWorkspaceId(e.target.value)}
                      placeholder="Workspace ID or 'all'"
                      className="text-xs min-h-[44px] font-mono bg-background"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSearchingPlayground || !playgroundQuery.trim()}
                  className="min-h-[44px] bg-violet-600 hover:bg-violet-700 text-white text-xs gap-2 active:scale-[0.97]"
                >
                  <Sparkles className={cn('h-4 w-4', isSearchingPlayground && 'animate-spin')} />
                  <span>{isSearchingPlayground ? 'Searching Vectors...' : 'Execute Vector Search'}</span>
                </Button>
              </form>

              {/* Latency & Results Count */}
              {searchLatencyMs !== null && (
                <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground border-t border-border/50">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-violet-500" />
                    Latency: <strong className="text-foreground">{searchLatencyMs}ms</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Matches Found: <strong className="text-foreground">{playgroundResults.length}</strong>
                  </span>
                </div>
              )}

              {/* Results List */}
              {playgroundResults.length > 0 && (
                <div className="space-y-3 pt-2">
                  {playgroundResults.map((res, idx) => (
                    <div
                      key={`${res.memoryId}_${idx}`}
                      className="p-3 rounded-lg border border-border/70 bg-card/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            #{idx + 1}
                          </Badge>
                          <span className="font-semibold text-foreground">{res.memory.title}</span>
                          <Badge variant="secondary" className="capitalize text-[10px]">
                            {res.memory.type}
                          </Badge>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 font-mono text-[11px]"
                        >
                          Score: {(res.score * 100).toFixed(1)}%
                        </Badge>
                      </div>

                      <p className="text-muted-foreground line-clamp-2 italic">
                        &ldquo;{res.matchedChunk?.content || res.memory.content}&rdquo;
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                        <span>Workspace: <code className="text-foreground">{res.memory.workspaceId}</code></span>
                        <span>Source: <code className="text-foreground">{res.memory.source.type}</code></span>
                        {res.whyMatched && (
                          <span className="text-violet-600 dark:text-violet-400">
                            Reason: {res.whyMatched.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Embedding Cache Controls */}
        <TabsContent value="cache" className="space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>LRU Embedding Cache Management</span>
              </CardTitle>
              <CardDescription className="text-xs">
                The embedding service caches sha256 text hashes and their 768-dimensional vectors in memory to eliminate redundant Genkit LLM API calls and optimize latency.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <div className="text-xs text-muted-foreground">Current Cache Size</div>
                  <div className="text-lg font-bold text-foreground mt-1">
                    {healthData?.cache.size ?? 0} entries
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <div className="text-xs text-muted-foreground">Cache Hits</div>
                  <div className="text-lg font-bold text-emerald-600 mt-1">
                    {healthData?.cache.hits ?? 0}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <div className="text-xs text-muted-foreground">Cache Misses</div>
                  <div className="text-lg font-bold text-muted-foreground mt-1">
                    {healthData?.cache.misses ?? 0}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setClearCacheDialogOpen(true)}
                  className="min-h-[44px] text-xs gap-1.5 active:scale-[0.97]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Purge LRU Embedding Cache</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Orchestrator & Contradiction Governance */}
        <TabsContent value="orchestrator" className="space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Memory Orchestration & Contradiction Audit</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Audits institutional intelligence across transactional storage (Firestore), dense vector search (Qdrant), and relational topology (Knowledge Graph). Triggers pairwise semantic contradiction scans and monitors staleness decay.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-lg">
                <label className="text-xs font-medium text-foreground">
                  Target Workspace ID for Contradiction Scan:
                </label>
                <Input
                  value={auditWorkspaceId}
                  onChange={(e) => setAuditWorkspaceId(e.target.value)}
                  placeholder="e.g. ws_test or leave empty for all"
                  className="text-xs min-h-[44px] font-mono bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  Scans active memories using SHA-256 pair caching and Genkit Gemini evaluation.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleTriggerAuditConflicts}
                  disabled={isAuditingConflicts}
                  className="min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white text-xs gap-2 active:scale-[0.97]"
                >
                  <RefreshCw className={cn('h-4 w-4', isAuditingConflicts && 'animate-spin')} />
                  <span>{isAuditingConflicts ? 'Auditing Contradictions...' : 'Run Contradiction Audit'}</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => window.open('/admin/quick-notes/conflicts', '_blank')}
                  className="min-h-[44px] text-xs gap-1.5 active:scale-[0.97]"
                >
                  <span>Open Knowledge Conflict Center &rarr;</span>
                </Button>
              </div>

              {auditResult && (
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2 mt-4">
                  <span className="text-xs font-bold text-foreground">Latest Audit Results:</span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg border border-border bg-background">
                      <span className="text-muted-foreground">Evaluated Pairs</span>
                      <p className="text-lg font-bold text-foreground mt-0.5">{auditResult.scannedPairs}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-background">
                      <span className="text-muted-foreground">Contradictions Flagged</span>
                      <p className="text-lg font-bold text-rose-600 mt-0.5">{auditResult.conflictsDetected}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Clear Cache Confirmation Dialog */}
      <Dialog open={clearCacheDialogOpen} onOpenChange={setClearCacheDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Purge Embedding Cache?</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will evict all currently cached vector embeddings from memory. Subsequent searches will query the embedding model directly until warmed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearCacheDialogOpen(false)}
              className="min-h-[44px] text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isClearingCache}
              onClick={handleClearCache}
              className="min-h-[44px] text-xs gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isClearingCache ? 'Purging...' : 'Confirm Purge'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
