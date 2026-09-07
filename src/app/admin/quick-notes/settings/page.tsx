'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Brain,
  ArrowLeft,
  Save,
  Sliders,
  Sparkles,
  CheckSquare,
  RotateCcw,
  Loader2,
  Search,
  RefreshCw,
  Network,
  Link2,
  Lightbulb,
  Bot,
  Zap,
  Inbox,
  TrendingUp,
  Megaphone,
  Swords,
  HardDrive,
  Wifi,
  Webhook,
  Globe,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { reindexWorkspaceKnowledgeAction } from '@/lib/quick-notes-search-actions';
import { backfillCrmRelationsAction } from '@/lib/quick-notes-graph-actions';
import { generateWorkspaceInsightsAction } from '@/lib/quick-notes-insight-actions';
import { generateWorkspaceBattlecardsAction } from '@/lib/quick-notes-campaign-actions';
import { OfflineStorageService } from '@/lib/offline/offline-storage-service';
import { OfflineSyncEngine } from '@/lib/offline/offline-sync-engine';

export interface CompanyBrainSettings {
  autoEntityResolutionEnabled: boolean;
  minResolutionConfidence: number;
  enableCallsInTimeline: boolean;
  enableMeetingsInTimeline: boolean;
  enableTasksInTimeline: boolean;
  defaultTaskPriority: 'low' | 'medium' | 'high' | 'urgent';
  defaultTaskCategory: 'follow-up' | 'general' | 'admin' | 'call';
  customAiBriefDirectives: string;
  hybridAlpha: number;
  minCitationRelevance: number;
  maxEvidenceSources: number;
  customGroundingDirectives: string;
  // Phase 5: Knowledge Graph Governance
  enableGraphVisualization: boolean;
  minGraphLinkConfidence: number;
  defaultGraphMode: 'explore' | 'focus' | 'path' | 'evidence';
  enableAiLinkSuggestions: boolean;
  maxGraphRenderNodes: number;
  enableGraphPhysics: boolean;
  showUnconnectedNodes: boolean;
  // Phase 6: Idea Intelligence & Studio Governance
  prioritizationFormula?: 'standard_ice' | 'weighted_ice' | 'value_effort';
  strictValidationGate?: boolean;
  minEvidenceForApproval?: number;
  aiIdeaAgentTemperature?: number;
  defaultStudioView?: 'pipeline' | 'matrix' | 'canvas' | 'table';
  autoSyncIdeaNotes?: boolean;
  maxCanvasNodes?: number;
  // Phase 7: Knowledge Insights, Autonomous Copilot & Governance
  enableAutoScanner?: boolean;
  contradictionSensitivity?: 'strict' | 'balanced' | 'permissive';
  duplicateSimilarityThreshold?: number;
  autoDismissLowConfidence?: boolean;
  enablePiiRedaction?: boolean;
  requiredReviewerRole?: 'admin' | 'manager' | 'editor';
  scanFrequencyHours?: number;
  // Phase 8: Campaign & Deal Intelligence Governance
  enableAutoConceptGeneration?: boolean;
  minObjectionConfidence?: number;
  minCorroboratingNotes?: number;
  aiBattlecardTemperature?: number;
  autoSyncCampaignLearnings?: boolean;
  // Phase 9: Knowledge Federation & Ingestion Governance
  enableCrossWorkspaceSharing?: boolean;
  defaultFederationPolicy?: 'isolated' | 'organization_shared' | 'selective_peers';
  maxInboundWebhooksPerMinute?: number;
  allowMarkdownImport?: boolean;
  federationConflictStrategy?: 'last_write_wins' | 'fork_as_variant' | 'manual_inbox_review';
  requireAdminApprovalForSpaces?: boolean;
  // Phase 10: Enterprise Offline Sync & Zero-Data-Loss PWA Governance
  enableOfflinePersistence?: boolean;
  maxOfflineCacheItems?: number;
  autoSyncIntervalSeconds?: number;
  defaultConflictStrategy?: 'prompt_user_diff' | 'last_write_wins' | 'fork_local_variant';
  precacheScope?: 'whole_workspace' | 'recent_100' | 'pinned_and_active';
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_SETTINGS: CompanyBrainSettings = {
  autoEntityResolutionEnabled: true,
  minResolutionConfidence: 0.7,
  enableCallsInTimeline: true,
  enableMeetingsInTimeline: true,
  enableTasksInTimeline: true,
  defaultTaskPriority: 'medium',
  defaultTaskCategory: 'follow-up',
  customAiBriefDirectives: '',
  hybridAlpha: 0.65,
  minCitationRelevance: 0.60,
  maxEvidenceSources: 6,
  customGroundingDirectives: '',
  // Phase 5 defaults
  enableGraphVisualization: true,
  minGraphLinkConfidence: 0.65,
  defaultGraphMode: 'explore',
  enableAiLinkSuggestions: true,
  maxGraphRenderNodes: 250,
  enableGraphPhysics: true,
  showUnconnectedNodes: true,
  // Phase 6 defaults
  prioritizationFormula: 'standard_ice',
  strictValidationGate: true,
  minEvidenceForApproval: 2,
  aiIdeaAgentTemperature: 0.3,
  defaultStudioView: 'pipeline',
  autoSyncIdeaNotes: true,
  maxCanvasNodes: 150,
  // Phase 7 defaults
  enableAutoScanner: true,
  contradictionSensitivity: 'balanced',
  duplicateSimilarityThreshold: 0.80,
  autoDismissLowConfidence: true,
  enablePiiRedaction: true,
  requiredReviewerRole: 'editor',
  scanFrequencyHours: 24,
  // Phase 8 defaults
  enableAutoConceptGeneration: true,
  minObjectionConfidence: 0.75,
  minCorroboratingNotes: 2,
  aiBattlecardTemperature: 0.25,
  autoSyncCampaignLearnings: true,
  // Phase 9 defaults
  enableCrossWorkspaceSharing: true,
  defaultFederationPolicy: 'organization_shared',
  maxInboundWebhooksPerMinute: 60,
  allowMarkdownImport: true,
  federationConflictStrategy: 'manual_inbox_review',
  requireAdminApprovalForSpaces: false,
  // Phase 10 defaults
  enableOfflinePersistence: true,
  maxOfflineCacheItems: 500,
  autoSyncIntervalSeconds: 30,
  defaultConflictStrategy: 'prompt_user_diff',
  precacheScope: 'recent_100',
};

export default function QuickNotesSettingsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return doc(firestore, 'workspaces', activeWorkspaceId, 'settings', 'company_brain');
  }, [firestore, activeWorkspaceId]);

  const { data: remoteSettings, isLoading } = useDoc<CompanyBrainSettings>(settingsDocRef);

  const [settings, setSettings] = React.useState<CompanyBrainSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isReindexing, setIsReindexing] = React.useState(false);
  const [isBackfilling, setIsBackfilling] = React.useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = React.useState(false);
  const [isGeneratingBattlecards, setIsGeneratingBattlecards] = React.useState(false);
  const [isDrainingQueue, setIsDrainingQueue] = React.useState(false);
  const [isPurgingCache, setIsPurgingCache] = React.useState(false);

  React.useEffect(() => {
    if (remoteSettings) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...remoteSettings,
      });
    }
  }, [remoteSettings]);

  const handleSave = async () => {
    if (!firestore || !activeWorkspaceId || !user) return;
    setIsSaving(true);
    try {
      const payload: CompanyBrainSettings = {
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
      };

      await setDoc(
        doc(firestore, 'workspaces', activeWorkspaceId, 'settings', 'company_brain'),
        payload,
        { merge: true }
      );

      toast({ title: 'Company Brain settings saved successfully' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save settings';
      toast({ title: 'Error saving settings', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReindex = async () => {
    if (!activeWorkspaceId || !user) return;
    setIsReindexing(true);
    try {
      const res = await reindexWorkspaceKnowledgeAction(activeWorkspaceId, user.uid);
      if (res.success) {
        toast({
          title: 'Re-indexing Complete',
          description: `Successfully projected ${res.indexedCount ?? 0} notes into the vector search index.`,
        });
      } else {
        toast({
          title: 'Re-indexing Failed',
          description: res.error || 'Failed to complete batch indexing.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred during re-indexing.',
        variant: 'destructive',
      });
    } finally {
      setIsReindexing(false);
    }
  };

  const handleBackfillCrmLinks = async () => {
    if (!activeWorkspaceId || !user) return;
    setIsBackfilling(true);
    try {
      const res = await backfillCrmRelationsAction(
        activeWorkspaceId,
        user.uid,
        user.displayName || 'Admin'
      );
      if (res.success) {
        toast({
          title: 'CRM Relations Backfill Complete',
          description: `Successfully materialized ${res.data.backfilledCount} links into the Knowledge Graph.`,
          actionConfig: {
            path: '/admin/quick-notes/graph',
            label: 'Open Graph',
          },
        });
      } else {
        toast({
          title: 'Backfill Failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Unexpected error during CRM links backfill.',
        variant: 'destructive',
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (!activeWorkspaceId || !user) return;
    setIsGeneratingInsights(true);
    try {
      const res = await generateWorkspaceInsightsAction(
        activeWorkspaceId,
        user.uid
      );
      if (res.success) {
        toast({
          title: 'Autonomous Scan Complete',
          description: `Successfully synthesized ${res.insightsCount ?? 0} strategic insights from workspace notes.`,
          actionConfig: {
            path: '/admin/quick-notes/insights',
            label: 'Open Insight Center',
          },
        });
      } else {
        toast({
          title: 'Scan Failed',
          description: res.error || 'Failed to generate insights.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Unexpected error during autonomous knowledge scan.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handleRefreshBattlecards = async () => {
    if (!activeWorkspaceId) return;
    setIsGeneratingBattlecards(true);
    try {
      const res = await generateWorkspaceBattlecardsAction(
        activeWorkspaceId,
        user?.uid || 'system'
      );
      if (res.success) {
        toast({
          title: 'Battlecards Refreshed',
          description: `Successfully synthesized ${res.battlecardsCount ?? 0} objection battlecards.`,
          actionConfig: {
            path: '/admin/quick-notes/campaigns',
            label: 'Open Campaigns Hub',
          },
        });
      } else {
        toast({
          title: 'Synthesis Failed',
          description: res.error || 'Failed to refresh battlecards.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Unexpected error during objection battlecard synthesis.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingBattlecards(false);
    }
  };

  const handleDrainQueue = async () => {
    if (!activeWorkspaceId) return;
    setIsDrainingQueue(true);
    try {
      const res = await OfflineSyncEngine.drainQueue(activeWorkspaceId);
      toast({
        title: 'Sync Queue Drained',
        description: `Successfully processed mutation queue (${res.synced} mutations synced, ${res.conflicted} conflicts, ${res.failed} failed).`,
      });
    } catch {
      toast({
        title: 'Sync Error',
        description: 'Unexpected error during manual queue flush.',
        variant: 'destructive',
      });
    } finally {
      setIsDrainingQueue(false);
    }
  };

  const handlePurgeCache = async () => {
    if (!activeWorkspaceId) return;
    setIsPurgingCache(true);
    try {
      await OfflineStorageService.clearWorkspaceCache(activeWorkspaceId, false);
      toast({
        title: 'Local Cache Cleared',
        description: 'Successfully purged IndexedDB cached notes, mutation queue, and local drafts.',
      });
    } catch {
      toast({
        title: 'Purge Failed',
        description: 'Failed to clear local browser storage.',
        variant: 'destructive',
      });
    } finally {
      setIsPurgingCache(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    toast({ title: 'Settings reset to defaults (click Save to apply)' });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/quick-notes"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Company Brain Settings
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure CRM Knowledge Timelines, AI Entity Resolution thresholds, and default workflows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
            className="rounded-xl h-9 text-xs font-bold gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="rounded-xl h-9 px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm active:scale-[0.98]"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Section 1: AI Entity Resolution & Suggestions */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm border-b border-border/30 pb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3>AI Entity Resolution & Linking</h3>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">
                Automatic Entity Detection
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Scan notes and interaction logs to identify and suggest links to Contacts, Schools, Leads, and Deals.
              </p>
            </div>
            <Switch
              checked={settings.autoEntityResolutionEnabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, autoEntityResolutionEnabled: checked }))
              }
            />
          </div>

          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">
                Minimum Match Confidence Threshold
              </Label>
              <span className="text-xs font-mono font-bold text-primary">
                {Math.round(settings.minResolutionConfidence * 100)}%
              </span>
            </div>
            <Input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={settings.minResolutionConfidence}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  minResolutionConfidence: parseFloat(e.target.value),
                }))
              }
              className="h-2 w-full cursor-pointer accent-primary"
            />
            <p className="text-[10px] text-muted-foreground">
              Higher values require stronger name similarity before suggesting a CRM link.
            </p>
          </div>
        </div>

        {/* Section 2: CRM Knowledge Timeline Sources */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm border-b border-border/30 pb-3">
            <Sliders className="h-4 w-4 text-primary" />
            <h3>CRM Knowledge Timeline Sources</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">
                  Include Call Summaries
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Display recorded calls and call center notes on entity timelines.
                </p>
              </div>
              <Switch
                checked={settings.enableCallsInTimeline}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableCallsInTimeline: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">
                  Include Meeting Records
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Display calendar and meeting notes on entity timelines.
                </p>
              </div>
              <Switch
                checked={settings.enableMeetingsInTimeline}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableMeetingsInTimeline: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">
                  Include Tasks & Actions
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Display linked tasks and operational action items on entity timelines.
                </p>
              </div>
              <Switch
                checked={settings.enableTasksInTimeline}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableTasksInTimeline: checked }))
                }
              />
            </div>
          </div>
        </div>

        {/* Section 3: Action Item to Task Conversion Defaults */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm border-b border-border/30 pb-3">
            <CheckSquare className="h-4 w-4 text-primary" />
            <h3>1-Click Task Conversion Defaults</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Default Task Priority</Label>
              <Select
                value={settings.defaultTaskPriority}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultTaskPriority: val as CompanyBrainSettings['defaultTaskPriority'],
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Default Category</Label>
              <Select
                value={settings.defaultTaskCategory}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultTaskCategory: val as CompanyBrainSettings['defaultTaskCategory'],
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section 4: AI Brief Prompt Directives */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm border-b border-border/30 pb-3">
            <Brain className="h-4 w-4 text-primary" />
            <h3>Custom AI Brief Directives</h3>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Additional Prompt Instructions (Optional)
            </Label>
            <Textarea
              placeholder="e.g., Focus specifically on parent fee payment objections and upcoming term enrollment targets..."
              value={settings.customAiBriefDirectives}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, customAiBriefDirectives: e.target.value }))
              }
              className="min-h-[90px] text-xs resize-none rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">
              These guidelines are injected into the Executive AI Brief generation prompt for this workspace.
            </p>
          </div>
        </div>

        {/* Section 5: Search & RAG Engine Governance (Phase 4) */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Search className="h-4 w-4 text-violet-600" />
              <h3>Search & RAG Retrieval Engine</h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isReindexing}
              onClick={handleReindex}
              className="text-xs gap-1.5 min-h-[36px] text-violet-600 border-violet-200 dark:border-violet-800"
            >
              {isReindexing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {isReindexing ? 'Re-indexing...' : 'Re-index Knowledge'}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Hybrid Search Weight Balance (Semantic vs Keyword)
              </Label>
              <Select
                value={String(settings.hybridAlpha ?? 0.65)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    hybridAlpha: parseFloat(val),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select balance" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="0.85">Heavy Semantic Vector (0.85 Vector / 0.15 Lexical)</SelectItem>
                  <SelectItem value="0.65">Balanced Hybrid (0.65 Vector / 0.35 Lexical - Recommended)</SelectItem>
                  <SelectItem value="0.50">Equal 50/50 Fusion</SelectItem>
                  <SelectItem value="0.25">Heavy Keyword Lexical (0.25 Vector / 0.75 Lexical)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Controls the balance between cosine semantic similarity and exact keyword token matching.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Minimum Citation Relevance Threshold
              </Label>
              <Select
                value={String(settings.minCitationRelevance ?? 0.60)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    minCitationRelevance: parseFloat(val),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select threshold" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="0.75">Strict (75% Minimum Match)</SelectItem>
                  <SelectItem value="0.60">Standard (60% Minimum Match - Recommended)</SelectItem>
                  <SelectItem value="0.45">Permissive (45% Minimum Match)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Minimum relevance score required for a note chunk to be cited as evidence in RAG answers.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-bold text-foreground">
              Custom AI Grounding Directives (Ask Company Brain)
            </Label>
            <Textarea
              placeholder="e.g., Focus specifically on school management software, admissions processes, and term billing cycles..."
              value={settings.customGroundingDirectives}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, customGroundingDirectives: e.target.value }))
              }
              className="min-h-[80px] text-xs resize-none rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">
              Directives applied globally to all 'Ask SmartSapp Knowledge' queries in this workspace.
            </p>
          </div>
        </div>

        {/* Section 6: Knowledge Graph & Backlinks Governance */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Network className="h-4 w-4 text-blue-600" />
              <h3>Knowledge Graph & Backlinks Governance</h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBackfilling}
              onClick={handleBackfillCrmLinks}
              className="text-xs gap-1.5 min-h-[36px] text-blue-600 border-blue-200 dark:border-blue-800"
            >
              {isBackfilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              {isBackfilling ? 'Backfilling...' : 'Backfill CRM Links'}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Real-Time Physics Simulation</Label>
                <p className="text-[10px] text-muted-foreground">
                  Enables force-directed animation layout. Toggle off on low-power devices.
                </p>
              </div>
              <Switch
                checked={settings.enableGraphPhysics ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableGraphPhysics: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">AI Relationship Discovery</Label>
                <p className="text-[10px] text-muted-foreground">
                  Allows AI Linking Agent to discover semantic connections between notes.
                </p>
              </div>
              <Switch
                checked={settings.enableAiLinkSuggestions ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableAiLinkSuggestions: checked }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                AI Link Detection Minimum Confidence
              </Label>
              <Select
                value={String(settings.minGraphLinkConfidence ?? 0.65)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    minGraphLinkConfidence: parseFloat(val),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select confidence" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="0.80">Strict (80% Minimum Certainty)</SelectItem>
                  <SelectItem value="0.65">Standard (65% Minimum Certainty - Recommended)</SelectItem>
                  <SelectItem value="0.50">Permissive (50% Minimum Certainty)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Filter out speculative relationship predictions below this threshold.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Max Rendered Canvas Nodes Capping
              </Label>
              <Select
                value={String(settings.maxGraphRenderNodes ?? 250)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    maxGraphRenderNodes: parseInt(val, 10),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select cap" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="100">100 Nodes (High Performance / Mobile)</SelectItem>
                  <SelectItem value="250">250 Nodes (Standard - Recommended)</SelectItem>
                  <SelectItem value="500">500 Nodes (High Density)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Limits maximum simultaneous nodes rendered on the visual canvas to prevent frame drops.
              </p>
            </div>
          </div>
        </div>

        {/* Section 7: Idea Intelligence & Studio Governance (Phase 6) */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Lightbulb className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                7. Idea Intelligence & Studio Governance
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure lifecycle state machine gates, prioritization formulas (ICE), and AI Devil's Advocate thresholds.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {/* Prioritization Formula Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Prioritization Scoring Formula
              </Label>
              <Select
                value={settings.prioritizationFormula ?? 'standard_ice'}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    prioritizationFormula: val as 'standard_ice' | 'weighted_ice' | 'value_effort',
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select formula" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="standard_ice">Standard ICE: (Impact × Confidence) / Effort (Recommended)</SelectItem>
                  <SelectItem value="weighted_ice">Weighted ICE: (0.4 × Impact + 0.4 × Confidence - 0.2 × Effort) × 10</SelectItem>
                  <SelectItem value="value_effort">Value vs Effort: (Impact / Effort) × 10</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Governs the mathematical formula used to rank ideas on the Prioritization Matrix leaderboard.
              </p>
            </div>

            {/* Strict Validation Gate Switch */}
            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Strict Validation Gate</Label>
                <p className="text-[10px] text-muted-foreground">
                  Requires ideas to have at least 1 validated hypothesis and attached evidence before moving to "Approved".
                </p>
              </div>
              <Switch
                checked={settings.strictValidationGate ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, strictValidationGate: checked }))
                }
              />
            </div>

            {/* Minimum Evidence Required */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Minimum Empirical Evidence for Approval
              </Label>
              <Select
                value={String(settings.minEvidenceForApproval ?? 2)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    minEvidenceForApproval: parseInt(val, 10),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select count" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="1">1 Evidence Item (Fast Pace)</SelectItem>
                  <SelectItem value="2">2 Evidence Items (Standard - Recommended)</SelectItem>
                  <SelectItem value="3">3 Evidence Items (High Rigor)</SelectItem>
                  <SelectItem value="5">5 Evidence Items (Enterprise Strict)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Number of attached CRM call notes, customer quotes, or telemetry metrics required for formal sign-off.
              </p>
            </div>

            {/* Default Studio View Mode */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Default Studio Initial View
              </Label>
              <Select
                value={settings.defaultStudioView ?? 'pipeline'}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultStudioView: val as 'pipeline' | 'matrix' | 'canvas' | 'table',
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="pipeline">Pipeline (Lifecycle Kanban - Recommended)</SelectItem>
                  <SelectItem value="matrix">Prioritization Matrix (ICE Quadrant Plot)</SelectItem>
                  <SelectItem value="canvas">Visual Idea Canvas (Graph Editor)</SelectItem>
                  <SelectItem value="table">Accessible Table View</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto-Sync Notes Switch */}
            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Auto-Sync Idea Notes</Label>
                <p className="text-[10px] text-muted-foreground">
                  Automatically initializes structured Idea entities whenever a note is tagged with knowledgeType 'idea'.
                </p>
              </div>
              <Switch
                checked={settings.autoSyncIdeaNotes ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, autoSyncIdeaNotes: checked }))
                }
              />
            </div>
          </div>
        </div>

        {/* Section 8: Knowledge Insights, Autonomous Copilot & Governance (Phase 7) */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Bot className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                8. Knowledge Insights, Autonomous Copilot & Governance
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure background contradiction detection, duplicate merging heuristics, PII compliance redactions, and AI insight synthesis.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {/* Auto Scanner Switch */}
            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Autonomous Knowledge Scanner</Label>
                <p className="text-[10px] text-muted-foreground">
                  Periodically analyzes newly captured notes and CRM interactions to detect contradictions, duplicates, and executive trends.
                </p>
              </div>
              <Switch
                checked={settings.enableAutoScanner ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableAutoScanner: checked }))
                }
              />
            </div>

            {/* Contradiction Detection Sensitivity */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Contradiction Sensitivity Threshold
              </Label>
              <Select
                value={settings.contradictionSensitivity ?? 'balanced'}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    contradictionSensitivity: val as 'strict' | 'balanced' | 'permissive',
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select sensitivity" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="strict">Strict (Only Flag Direct & Explicit Factual Clashes)</SelectItem>
                  <SelectItem value="balanced">Balanced (Flag Direct & Implicit Contradictions - Recommended)</SelectItem>
                  <SelectItem value="permissive">Permissive (Include Divergent Opinions & Shifting Timelines)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Governs how strictly the AI Contradiction Engine compares claims and requirements across notes.
              </p>
            </div>

            {/* Duplicate Similarity Threshold */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Duplicate Detection Similarity Threshold
              </Label>
              <Select
                value={String(settings.duplicateSimilarityThreshold ?? 0.80)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    duplicateSimilarityThreshold: parseFloat(val),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select threshold" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="0.90">90% Similarity (Near-Exact Duplicates Only)</SelectItem>
                  <SelectItem value="0.80">80% Similarity (Standard Semantic Overlap - Recommended)</SelectItem>
                  <SelectItem value="0.70">70% Similarity (Broad Semantic Overlap)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Controls the minimum hybrid N-gram and embedding cosine similarity required to trigger an Inbox merge suggestion.
              </p>
            </div>

            {/* Auto-Dismiss Low Confidence Switch */}
            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Auto-Dismiss Low-Confidence Predictions</Label>
                <p className="text-[10px] text-muted-foreground">
                  Automatically discard suggestions with AI confidence &lt; 60% to prevent Inbox notification noise.
                </p>
              </div>
              <Switch
                checked={settings.autoDismissLowConfidence ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, autoDismissLowConfidence: checked }))
                }
              />
            </div>

            {/* PII & Credential Redaction Switch */}
            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Automatic PII & Secret Redaction</Label>
                <p className="text-[10px] text-muted-foreground">
                  Sanitizes sensitive client contact numbers, API keys, passwords, and banking details before sending note excerpts to AI inference.
                </p>
              </div>
              <Switch
                checked={settings.enablePiiRedaction ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enablePiiRedaction: checked }))
                }
              />
            </div>

            {/* Required Reviewer Role */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Required Role for Knowledge Merge Approvals
              </Label>
              <Select
                value={settings.requiredReviewerRole ?? 'editor'}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    requiredReviewerRole: val as 'admin' | 'manager' | 'editor',
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="editor">Editor or Higher (Flexible Team Review)</SelectItem>
                  <SelectItem value="manager">Manager or Higher (Supervised Review)</SelectItem>
                  <SelectItem value="admin">Administrator Only (Strict Governance)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Determines the minimum permission level authorized to accept structural note merges and delete duplicate records.
              </p>
            </div>

            {/* Trigger Live Scan Button & Navigation Links */}
            <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="rounded-xl text-xs h-9 min-h-[44px] sm:min-h-[36px]"
                >
                  <Link href="/admin/quick-notes/inbox">
                    <Inbox className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                    Open Knowledge Inbox
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="rounded-xl text-xs h-9 min-h-[44px] sm:min-h-[36px]"
                >
                  <Link href="/admin/quick-notes/insights">
                    <TrendingUp className="h-3.5 w-3.5 mr-1.5 text-purple-500" />
                    Open Insight Center
                  </Link>
                </Button>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleGenerateInsights}
                disabled={isGeneratingInsights}
                className="rounded-xl text-xs font-semibold h-9 min-h-[44px] sm:min-h-[36px] bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20"
              >
                {isGeneratingInsights ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Synthesizing Insights...
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 mr-1.5 text-purple-600 dark:text-purple-400" />
                    ⚡ Run Autonomous Scan Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Section 9: Campaign & Deal Intelligence Governance */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/10 to-amber-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                <Megaphone className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Section 9: Campaign & Deal Intelligence Governance
                </h3>
                <p className="text-xs text-muted-foreground">
                  Configure automated extraction of marketing campaign concepts and deal battlecard synthesis from customer notes.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <Swords className="h-3 w-3" />
              Campaigns & Deals
            </span>
          </div>

          <div className="space-y-4 pt-1">
            {/* Auto-Generate Campaign Concepts Switch */}
            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">
                  Auto-Extract Campaign Concepts from Notes & Ideas
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Periodically scan customer notes and high-scoring ideas to synthesize structured marketing value propositions and angle drafts.
                </p>
              </div>
              <Switch
                checked={settings.enableAutoConceptGeneration ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableAutoConceptGeneration: checked }))
                }
              />
            </div>

            {/* Auto-Sync Campaign Learnings Switch */}
            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">
                  Auto-Synthesize Learnings from Completed Campaigns
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Extract customer engagement patterns and qualitative replies into permanent Knowledge Insights when marketing campaigns finish.
                </p>
              </div>
              <Switch
                checked={settings.autoSyncCampaignLearnings ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, autoSyncCampaignLearnings: checked }))
                }
              />
            </div>

            {/* Objection Confidence Threshold */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Minimum Objection Detection Confidence Threshold
              </Label>
              <Select
                value={String(settings.minObjectionConfidence ?? 0.75)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    minObjectionConfidence: parseFloat(val),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select confidence" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="0.85">85% Confidence (Strict - Highly Explicit Objections Only)</SelectItem>
                  <SelectItem value="0.75">75% Confidence (Balanced - Recommended for Deal Battlecards)</SelectItem>
                  <SelectItem value="0.65">65% Confidence (Exploratory - Broad Friction Discovery)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Controls the confidence threshold required before customer friction quotes are clustered into Objection Battlecards.
              </p>
            </div>

            {/* Minimum Corroborating Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Minimum Corroborating Notes for Battlecard Cluster
              </Label>
              <Select
                value={String(settings.minCorroboratingNotes ?? 2)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    minCorroboratingNotes: parseInt(val, 10),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="1">1 Note (Include Single Occurrences)</SelectItem>
                  <SelectItem value="2">2 Notes (Recurring Theme - Recommended)</SelectItem>
                  <SelectItem value="3">3 Notes (High-Frequency Friction Point)</SelectItem>
                  <SelectItem value="5">5 Notes (Critical Systematic Objection)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Minimum count of distinct customer interaction notes mentioning an objection before synthesizing a tactical battlecard.
              </p>
            </div>

            {/* AI Battlecard Creativity / Temperature */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                AI Battlecard Rebuttal Temperature
              </Label>
              <Select
                value={String(settings.aiBattlecardTemperature ?? 0.25)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    aiBattlecardTemperature: parseFloat(val),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select temperature" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="0.10">0.10 (Precise, Direct & Fact-Bound Rebuttals)</SelectItem>
                  <SelectItem value="0.25">0.25 (Balanced Strategic Rebuttals - Recommended)</SelectItem>
                  <SelectItem value="0.40">0.40 (Persuasive & Creative Angles)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Governs LLM temperature during objection rebuttal, proof point mapping, and killer qualification question generation.
              </p>
            </div>

            {/* Actions & Links Bar */}
            <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="rounded-xl text-xs h-9 min-h-[44px] sm:min-h-[36px]"
                >
                  <Link href="/admin/quick-notes/campaigns">
                    <Megaphone className="h-3.5 w-3.5 mr-1.5 text-rose-500" />
                    Open Campaign Intelligence Hub
                  </Link>
                </Button>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleRefreshBattlecards}
                disabled={isGeneratingBattlecards}
                className="rounded-xl text-xs font-semibold h-9 min-h-[44px] sm:min-h-[36px] bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
              >
                {isGeneratingBattlecards ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Synthesizing Battlecards...
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 mr-1.5 text-rose-600 dark:text-rose-400" />
                    ⚡ Refresh Objection Battlecards Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Section 10: Knowledge Federation & Ingestion Governance */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <Network className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Section 10: Knowledge Federation & Ingestion Governance
                </h3>
                <p className="text-xs text-muted-foreground">
                  Configure cross-workspace knowledge sharing policies, webhook capture limits, and conflict resolution rules.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Globe className="h-3 w-3" />
              Federation & API
            </span>
          </div>

          <div className="space-y-4 pt-1">
            {/* Cross-Workspace Sharing Switch */}
            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">
                  Enable Cross-Workspace Knowledge Federation
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Allow sibling campus workspaces in this organization to subscribe to published knowledge spaces.
                </p>
              </div>
              <Switch
                checked={settings.enableCrossWorkspaceSharing ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableCrossWorkspaceSharing: checked }))
                }
              />
            </div>

            {/* Default Federation Policy */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Default Space Publishing Policy
              </Label>
              <Select
                value={settings.defaultFederationPolicy ?? 'organization_shared'}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultFederationPolicy: val as 'isolated' | 'organization_shared' | 'selective_peers',
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select policy" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="organization_shared">Organization-Wide (Available to all sibling campuses - Recommended)</SelectItem>
                  <SelectItem value="selective_peers">Selective Peers (Only designated workspace IDs)</SelectItem>
                  <SelectItem value="isolated">Isolated (Strictly internal to owning workspace)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Default access scope applied when users create new shared knowledge spaces.
              </p>
            </div>

            {/* Max Inbound Webhooks Rate Limit */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Inbound Webhook Rate Limit
              </Label>
              <Select
                value={String(settings.maxInboundWebhooksPerMinute ?? 60)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    maxInboundWebhooksPerMinute: parseInt(val, 10),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select rate limit" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="30">30 Requests / Minute (Strict DoS Protection)</SelectItem>
                  <SelectItem value="60">60 Requests / Minute (Balanced Slack/Zapier Ingestion - Recommended)</SelectItem>
                  <SelectItem value="120">120 Requests / Minute (High Volume Institutional Ingestion)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Maximum inbound requests permitted per API key per minute before sliding-window rate throttling is enforced.
              </p>
            </div>

            {/* Allow Markdown Bulk Import Switch */}
            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">
                  Allow Markdown & JSON Bulk Imports
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Permit workspace editors to bulk-import zipped Markdown archives and JSON database backups.
                </p>
              </div>
              <Switch
                checked={settings.allowMarkdownImport ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, allowMarkdownImport: checked }))
                }
              />
            </div>

            {/* Conflict Resolution Strategy */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Federation Conflict Resolution Strategy
              </Label>
              <Select
                value={settings.federationConflictStrategy ?? 'manual_inbox_review'}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    federationConflictStrategy: val as 'last_write_wins' | 'fork_as_variant' | 'manual_inbox_review',
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="manual_inbox_review">Manual Review (Push Clashes to Knowledge Inbox - Recommended)</SelectItem>
                  <SelectItem value="fork_as_variant">Fork as Variant (Preserve both local and upstream copies)</SelectItem>
                  <SelectItem value="last_write_wins">Last Write Wins (Latest timestamp automatically overwrites)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Governs how the system resolves simultaneous edits to a note shared across multiple campus workspaces.
              </p>
            </div>

            {/* Actions & Links Bar */}
            <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="rounded-xl text-xs h-9 min-h-[44px] sm:min-h-[36px]"
                >
                  <Link href="/admin/quick-notes/federation">
                    <Network className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                    Open Federation & Integrations Hub
                  </Link>
                </Button>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                asChild
                className="rounded-xl text-xs font-semibold h-9 min-h-[44px] sm:min-h-[36px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20"
              >
                <Link href="/admin/quick-notes/federation?tab=webhooks">
                  <Webhook className="h-3.5 w-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                  Manage Ingestion Webhooks
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Section 11: Enterprise Offline Sync & Zero-Data-Loss PWA Governance */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <HardDrive className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Section 11: Enterprise Offline Sync & Zero-Data-Loss PWA Governance
                </h3>
                <p className="text-xs text-muted-foreground">
                  Configure client IndexedDB persistence, mutation queue intervals, and visual 3-way conflict resolution.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Wifi className="h-3 w-3" />
              Offline & PWA
            </span>
          </div>

          <div className="space-y-4 pt-1">
            {/* Enable Offline Persistence */}
            <div className="flex items-center justify-between space-x-2 p-3 bg-muted/20 border border-border rounded-xl">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">
                  Enable Client-Side IndexedDB Persistence
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Securely cache workspace notes and queued mutations locally in browser storage for instant sub-10ms reads.
                </p>
              </div>
              <Switch
                checked={settings.enableOfflinePersistence ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableOfflinePersistence: checked }))
                }
              />
            </div>

            {/* Max Cache Items */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Maximum Offline Cache Notes Limit
              </Label>
              <Select
                value={String(settings.maxOfflineCacheItems ?? 500)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    maxOfflineCacheItems: parseInt(val, 10),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select cache limit" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="100">100 Notes (Ultralight / Mobile Data Saver)</SelectItem>
                  <SelectItem value="250">250 Notes (Standard Balanced)</SelectItem>
                  <SelectItem value="500">500 Notes (Recommended High Capacity)</SelectItem>
                  <SelectItem value="1000">1,000 Notes (Power User / Full Offline Brain)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Maximum number of notes retained in local IndexedDB storage before LRU eviction.
              </p>
            </div>

            {/* Auto-Sync Interval */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Background Auto-Sync Interval
              </Label>
              <Select
                value={String(settings.autoSyncIntervalSeconds ?? 30)}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    autoSyncIntervalSeconds: parseInt(val, 10),
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="15">Every 15 seconds (High Frequency / Real-Time)</SelectItem>
                  <SelectItem value="30">Every 30 seconds (Balanced - Recommended)</SelectItem>
                  <SelectItem value="60">Every 60 seconds (Battery & Bandwidth Saver)</SelectItem>
                  <SelectItem value="120">Every 2 minutes (Strict Low-Bandwidth Mode)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Periodic timer interval for draining pending mutation queue when network connection is online.
              </p>
            </div>

            {/* Conflict Strategy */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Offline Conflict Resolution Policy
              </Label>
              <Select
                value={settings.defaultConflictStrategy ?? 'prompt_user_diff'}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultConflictStrategy: val as 'prompt_user_diff' | 'last_write_wins' | 'fork_local_variant',
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select conflict policy" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="prompt_user_diff">Visual 3-Way Diff Dialog (Zero-Data-Loss - Recommended)</SelectItem>
                  <SelectItem value="fork_local_variant">Automatic Fork (Preserve offline edit as new variant note)</SelectItem>
                  <SelectItem value="last_write_wins">Last Write Wins (Latest server timestamp overwrites)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Default behavior when an offline edit conflicts with a newer version modified concurrently on the cloud.
              </p>
            </div>

            {/* Precache Scope */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Workspace Pre-caching Scope
              </Label>
              <Select
                value={settings.precacheScope ?? 'recent_100'}
                onValueChange={(val) =>
                  setSettings((prev) => ({
                    ...prev,
                    precacheScope: val as 'whole_workspace' | 'recent_100' | 'pinned_and_active',
                  }))
                }
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select precache scope" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="recent_100">Recent 100 Notes (Instant Launch - Recommended)</SelectItem>
                  <SelectItem value="pinned_and_active">Pinned Notes & Active Projects Only</SelectItem>
                  <SelectItem value="whole_workspace">Entire Workspace (Complete Offline Replica)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Determines which note records are proactively fetched and stored into IndexedDB upon opening Company Brain.
              </p>
            </div>

            {/* Manual Actions & Diagnostics */}
            <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDrainQueue}
                  disabled={isDrainingQueue}
                  className="rounded-xl text-xs h-9 min-h-[44px] sm:min-h-[36px]"
                >
                  {isDrainingQueue ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin text-emerald-500" />
                      Draining Queue...
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                      Drain Sync Queue Now
                    </>
                  )}
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePurgeCache}
                disabled={isPurgingCache}
                className="rounded-xl text-xs font-semibold h-9 min-h-[44px] sm:min-h-[36px] text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                {isPurgingCache ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Purging...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Purge Local Cache
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
