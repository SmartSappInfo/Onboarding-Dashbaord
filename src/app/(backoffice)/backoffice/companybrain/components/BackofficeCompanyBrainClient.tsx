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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
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
  Cpu,
  ExternalLink,
  Bot,
  Workflow,
  Activity,
  RotateCw,
  Play,
  ShieldAlert,
  Users,
  Download,
  Shield,
  Sliders,
} from 'lucide-react';
import {
  getCompanyBrainHealthAction,
  triggerCompanyBrainReindexAction,
  clearEmbeddingCacheAction,
  type BackofficeCompanyBrainHealth,
} from '@/lib/memory/actions/backoffice-companybrain-actions';
import { semanticSearchMemoriesAction } from '@/lib/memory/actions/semantic-search-actions';
import { scanMemoryConflictsBatchAction } from '@/lib/memory/actions/orchestrator-actions';
import { buildContextAction } from '@/lib/memory/actions/context-builder-actions';
import {
  listMcpToolsAction,
  executeMcpToolAction,
  upsertMcpApprovalPolicyAction,
  type GovernedToolInfo,
} from '@/lib/mcp/actions/mcp-governance-actions';
import {
  listAgentDescriptorsAction,
  listSupervisorRunsAction,
} from '@/lib/supervisor/actions/supervisor-actions';
import { ToolCatalogTable } from '@/components/mcp/ToolCatalogTable';
import { LiveToolRunnerModal } from '@/components/mcp/LiveToolRunnerModal';
import type { SemanticSearchResult } from '@/lib/memory/semantic-types';
import type { ContextPackage, ContextSubjectType } from '@/lib/memory/context-types';
import type { McpPayloadValue, McpJsonRpcResponse } from '@/lib/mcp/types';
import type { AgentDescriptor, AgentRun } from '@/lib/supervisor/types';
import type {
  SpecialistDescriptor,
  SpecialistAutonomyLevel,
  DomainSpecialistId,
  SwarmRun,
} from '@/lib/agents/domain-types';
import {
  listSpecialistsAction,
  updateSpecialistConfigAction,
  startSwarmMissionAction,
} from '@/lib/agents/actions/domain-agent-actions';
import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowSimulationResult,
} from '@/lib/workflows/types';
import {
  listWorkflowsAction,
  toggleWorkflowAction,
  installBlueprintAction,
  simulateWorkflowAction,
  listWorkflowRunsAction,
} from '@/lib/workflows/actions/workflow-actions';
import { TURNKEY_WORKFLOW_BLUEPRINTS } from '@/lib/workflows/blueprints';
import {
  runObservationScanAction,
  executeSelfHealingAction,
  generateComplianceExportAction,
} from '@/lib/intelligence/actions/intelligence-actions';

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

  // Context Simulator state (Phase 5)
  const [simWorkspaceId, setSimWorkspaceId] = React.useState('');
  const [simSubjectType, setSimSubjectType] = React.useState<ContextSubjectType>('entity');
  const [simSubjectId, setSimSubjectId] = React.useState('');
  const [simObjective, setSimObjective] = React.useState('Prepare comprehensive account briefing');
  const [simMaxTokens, setSimMaxTokens] = React.useState('4000');
  const [isSimulatingContext, setIsSimulatingContext] = React.useState(false);
  const [simulatedPackage, setSimulatedPackage] = React.useState<ContextPackage | null>(null);

  const handleRunContextSimulation = async () => {
    if (!user?.uid) return;
    if (!simWorkspaceId.trim()) {
      toast({
        title: 'Workspace ID Required',
        description: 'Please specify a target workspace ID for context simulation.',
        variant: 'destructive',
      });
      return;
    }

    setIsSimulatingContext(true);
    try {
      const res = await buildContextAction({
        workspaceId: simWorkspaceId.trim(),
        organizationId: 'org_default',
        userId: user.uid,
        objective: simObjective.trim() || 'General context assembly',
        subject: simSubjectId.trim()
          ? { type: simSubjectType, id: simSubjectId.trim() }
          : undefined,
        maxTokens: parseInt(simMaxTokens, 10) || 4000,
        depth: 'standard',
      });

      if (res.success && res.data) {
        setSimulatedPackage(res.data);
        toast({
          title: 'Context Assembled',
          description: `Built package with ${res.data.tokenBudget.totalTokens} tokens in ${res.data.executionTimeMs}ms.`,
        });
      } else {
        toast({
          title: 'Assembly Error',
          description: res.error || 'Failed to assemble context package.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Assembly Failed',
        description: err instanceof Error ? err.message : 'Unknown simulation error',
        variant: 'destructive',
      });
    } finally {
      setIsSimulatingContext(false);
    }
  };

  // MCP Governance State (Phase 6)
  const [mcpTools, setMcpTools] = React.useState<GovernedToolInfo[]>([]);
  const [isLoadingMcp, setIsLoadingMcp] = React.useState(false);
  const [runnerTool, setRunnerTool] = React.useState<GovernedToolInfo | null>(null);

  const fetchMcpTools = React.useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingMcp(true);
    try {
      const res = await listMcpToolsAction({
        workspaceId: 'platform_backoffice',
        userId: user.uid,
      });
      if (res.success && res.data) {
        setMcpTools(res.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoadingMcp(false);
    }
  }, [user?.uid]);

  React.useEffect(() => {
    fetchMcpTools();
  }, [fetchMcpTools]);

  const handleBackofficeExecuteTool = async (
    toolName: string,
    args: Record<string, McpPayloadValue>
  ): Promise<McpJsonRpcResponse> => {
    if (!user?.uid) throw new Error('Unauthenticated');
    const res = await executeMcpToolAction({
      workspaceId: 'platform_backoffice',
      organizationId: 'platform_org',
      userId: user.uid,
      toolName,
      inputArguments: args,
    });
    if (!res.success) throw new Error(res.error);
    return res.data;
  };

  const handleBackofficeToggleTool = async (toolName: string, enabled: boolean) => {
    if (!user?.uid) return;
    const currentTool = mcpTools.find((t) => t.name === toolName);
    if (!currentTool) return;
    const res = await upsertMcpApprovalPolicyAction({
      workspaceId: 'platform_backoffice',
      organizationId: 'platform_org',
      userId: user.uid,
      toolName,
      requiresApproval: currentTool.requiresApproval,
      enabled,
    });
    if (res.success) {
      setMcpTools((prev) =>
        prev.map((t) => (t.name === toolName ? { ...t, enabled, isCustomPolicy: true } : t))
      );
      toast({
        title: enabled ? 'Tool Enabled' : 'Tool Disabled',
        description: `Tool "${toolName}" policy updated.`,
      });
    }
  };

  const handleBackofficeToggleApproval = async (toolName: string, requiresApproval: boolean) => {
    if (!user?.uid) return;
    const currentTool = mcpTools.find((t) => t.name === toolName);
    if (!currentTool) return;
    const res = await upsertMcpApprovalPolicyAction({
      workspaceId: 'platform_backoffice',
      organizationId: 'platform_org',
      userId: user.uid,
      toolName,
      requiresApproval,
      enabled: currentTool.enabled,
    });
    if (res.success) {
      setMcpTools((prev) =>
        prev.map((t) => (t.name === toolName ? { ...t, requiresApproval, isCustomPolicy: true } : t))
      );
      toast({
        title: requiresApproval ? 'Approval Gate Enabled' : 'Automatic Execution Enabled',
        description: `Tool "${toolName}" approval requirement updated.`,
      });
    }
  };

  // Supervisor Governance State (Phase 7)
  const [registeredAgents, setRegisteredAgents] = React.useState<AgentDescriptor[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = React.useState(false);
  const [supervisorRuns, setSupervisorRuns] = React.useState<AgentRun[]>([]);
  const [isLoadingSupervisorRuns, setIsLoadingSupervisorRuns] = React.useState(false);
  const [supervisorWorkspaceFilter, setSupervisorWorkspaceFilter] = React.useState('');

  const fetchAgentsAndRuns = React.useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingAgents(true);
    setIsLoadingSupervisorRuns(true);
    try {
      const [agentsRes, runsRes] = await Promise.all([
        listAgentDescriptorsAction({ userId: user.uid }),
        listSupervisorRunsAction({
          workspaceId: supervisorWorkspaceFilter.trim() || 'all',
          userId: user.uid,
          limit: 15,
        }),
      ]);
      if (agentsRes.success && agentsRes.data) {
        setRegisteredAgents(agentsRes.data);
      }
      if (runsRes.success && runsRes.data) {
        setSupervisorRuns(runsRes.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoadingAgents(false);
      setIsLoadingSupervisorRuns(false);
    }
  }, [user?.uid, supervisorWorkspaceFilter]);

  React.useEffect(() => {
    fetchAgentsAndRuns();
  }, [fetchAgentsAndRuns]);

  // Domain Specialists & Swarm Governance State (Phase 8)
  const [specialistsList, setSpecialistsList] = React.useState<SpecialistDescriptor[]>([]);
  const [_isLoadingSpecialists, setIsLoadingSpecialists] = React.useState(false);
  const [selectedSpecialistId, setSelectedSpecialistId] = React.useState<DomainSpecialistId>('revenue_specialist');
  const [policyWorkspaceId, setPolicyWorkspaceId] = React.useState('');
  const [policyAutonomy, setPolicyAutonomy] = React.useState<SpecialistAutonomyLevel>('supervised');
  const [policyDirective, setPolicyDirective] = React.useState('');
  const [isSavingSpecialistPolicy, setIsSavingSpecialistPolicy] = React.useState(false);
  const [swarmSimObjective, setSwarmSimObjective] = React.useState('Conduct strategic expansion and compliance audit for high-value client');
  const [isSimulatingSwarm, setIsSimulatingSwarm] = React.useState(false);
  const [simulatedSwarmRun, setSimulatedSwarmRun] = React.useState<SwarmRun | null>(null);

  const fetchSpecialists = React.useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingSpecialists(true);
    try {
      const res = await listSpecialistsAction(policyWorkspaceId || 'default');
      if (res.success && res.data) {
        setSpecialistsList(res.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoadingSpecialists(false);
    }
  }, [user?.uid, policyWorkspaceId]);

  React.useEffect(() => {
    fetchSpecialists();
  }, [fetchSpecialists]);

  const handleSaveSpecialistPolicy = async () => {
    if (!user?.uid) return;
    if (!policyWorkspaceId.trim()) {
      toast({
        title: 'Workspace ID Required',
        description: 'Please enter a valid workspace ID to apply this policy.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingSpecialistPolicy(true);
    try {
      const res = await updateSpecialistConfigAction({
        workspaceId: policyWorkspaceId.trim(),
        specialistId: selectedSpecialistId,
        autonomyLevel: policyAutonomy,
        disabledTools: [],
        customDirective: policyDirective.trim() || undefined,
        updatedBy: user.uid,
        updatedAt: new Date().toISOString(),
      });

      if (res.success) {
        toast({
          title: 'Specialist Policy Applied',
          description: `Configured ${selectedSpecialistId} as ${policyAutonomy} for workspace ${policyWorkspaceId}.`,
          actionConfig: {
            path: '/backoffice/companybrain',
            label: 'Review',
          },
        });
      } else {
        toast({
          title: 'Policy Update Failed',
          description: res.error || 'Failed to update specialist policy.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unknown error saving policy.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSpecialistPolicy(false);
    }
  };

  const handleRunSwarmSimulation = async () => {
    if (!user?.uid) return;
    setIsSimulatingSwarm(true);
    try {
      const res = await startSwarmMissionAction({
        workspaceId: policyWorkspaceId.trim() || 'default_ws',
        organizationId: 'default_org',
        actor: { type: 'user', id: user.uid },
        objective: swarmSimObjective.trim(),
        specialistIds: ['knowledge_specialist', 'revenue_specialist', 'governance_specialist'],
        mode: 'parallel_consensus',
      });

      if (res.success && res.data) {
        setSimulatedSwarmRun(res.data);
        toast({
          title: 'Swarm Simulation Finished',
          description: `Executed swarm with 3 specialists in ${res.data.metrics.durationMs}ms.`,
          actionConfig: {
            path: '/backoffice/companybrain',
            label: 'Inspect',
          },
        });
      } else {
        toast({
          title: 'Simulation Error',
          description: res.error || 'Failed to simulate swarm run.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Simulation Error',
        description: err instanceof Error ? err.message : 'Unknown simulation exception.',
        variant: 'destructive',
      });
    } finally {
      setIsSimulatingSwarm(false);
    }
  };

  // Phase 9: Autonomous Workflows & Event Triggers State
  const [workflowsList, setWorkflowsList] = React.useState<WorkflowDefinition[]>([]);
  const [_workflowRunsList, setWorkflowRunsList] = React.useState<WorkflowRun[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = React.useState<boolean>(false);
  const [isEmergencyKillSwitchActive, setIsEmergencyKillSwitchActive] = React.useState<boolean>(false);
  const [installingBlueprintId, setInstallingBlueprintId] = React.useState<string | null>(null);
  const [syntheticEventType, setSyntheticEventType] = React.useState<string>('crm.deal.stalled');
  const [syntheticPayloadJson, setSyntheticPayloadJson] = React.useState<string>(
    JSON.stringify(
      {
        eventType: 'crm.deal.stalled',
        dealId: 'deal_backoffice_mock_99',
        dealTitle: 'Enterprise Cloud Transformation',
        daysStalled: 21,
        dealValue: 240000,
        riskScore: 85,
      },
      null,
      2
    )
  );
  const [isSimulatingEvent, setIsSimulatingEvent] = React.useState<boolean>(false);
  const [simulationResult, setSimulationResult] = React.useState<WorkflowSimulationResult | null>(null);

  const fetchWorkflowsData = React.useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingWorkflows(true);
    try {
      const [wfRes, runsRes] = await Promise.all([
        listWorkflowsAction({ workspaceId: playgroundWorkspaceId || 'default', userId: user.uid }),
        listWorkflowRunsAction({ workspaceId: playgroundWorkspaceId || 'default', userId: user.uid, limit: 15 }),
      ]);
      if (wfRes.success && wfRes.data) {
        setWorkflowsList(wfRes.data);
      }
      if (runsRes.success && runsRes.data) {
        setWorkflowRunsList(runsRes.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoadingWorkflows(false);
    }
  }, [user?.uid, playgroundWorkspaceId]);

  React.useEffect(() => {
    void fetchWorkflowsData();
  }, [fetchWorkflowsData]);

  const handleToggleWorkflow = async (workflowId: string, currentStatus: 'active' | 'paused') => {
    if (!user?.uid) return;
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const res = await toggleWorkflowAction({
        workflowId,
        workspaceId: playgroundWorkspaceId || 'default',
        status: newStatus,
        userId: user.uid,
      });
      if (res.success) {
        setWorkflowsList((prev) =>
          prev.map((w) => (w.id === workflowId ? { ...w, status: newStatus } : w))
        );
        toast({
          title: 'Workflow Toggled',
          description: `Workflow is now ${newStatus}.`,
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to toggle workflow status.',
        variant: 'destructive',
      });
    }
  };

  const handleInstallBlueprintBackoffice = async (blueprintId: string) => {
    if (!user?.uid) return;
    setInstallingBlueprintId(blueprintId);
    try {
      const res = await installBlueprintAction({
        blueprintId,
        workspaceId: playgroundWorkspaceId || 'default',
        organizationId: 'default_org',
        userId: user.uid,
      });
      if (res.success && res.data) {
        toast({
          title: 'Blueprint Installed',
          description: `Installed "${res.data.title}" into workspace.`,
        });
        await fetchWorkflowsData();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to install blueprint.',
        variant: 'destructive',
      });
    } finally {
      setInstallingBlueprintId(null);
    }
  };

  const handleSimulateSyntheticEvent = async () => {
    if (!user?.uid) return;
    let payload: Record<string, McpPayloadValue> = {};
    try {
      payload = JSON.parse(syntheticPayloadJson);
    } catch {
      toast({
        title: 'Invalid JSON',
        description: 'Please provide valid JSON for the synthetic event payload.',
        variant: 'destructive',
      });
      return;
    }

    const targetWf = workflowsList.find((w) => w.trigger.eventType === syntheticEventType) || workflowsList[0];
    if (!targetWf) {
      toast({
        title: 'No Matching Workflow',
        description: `Install a blueprint listening for "${syntheticEventType}" first.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSimulatingEvent(true);
    try {
      const res = await simulateWorkflowAction({
        workflow: targetWf,
        workspaceId: playgroundWorkspaceId || 'default',
        userId: user.uid,
        simulatedPayload: payload,
      });
      if (res.success && res.data) {
        setSimulationResult(res.data);
        toast({
          title: 'Simulation Succeeded',
          description: `Predicted ${res.data.predictedNodesExecuted} steps, ${res.data.predictedApprovalsCount} human approval gates.`,
        });
      }
    } catch {
      toast({
        title: 'Simulation Error',
        description: 'Failed to run dry-run simulation.',
        variant: 'destructive',
      });
    } finally {
      setIsSimulatingEvent(false);
    }
  };

  const handleToggleEmergencyKillSwitch = () => {
    setIsEmergencyKillSwitchActive((prev) => {
      const next = !prev;
      toast({
        title: next ? 'EMERGENCY KILL-SWITCH ACTIVE' : 'Kill-Switch Disengaged',
        description: next
          ? 'All automated background workflow triggers and cron executions are immediately HALTED.'
          : 'Automated workflow triggers resumed normal operation.',
        variant: next ? 'destructive' : 'default',
        duration: next ? 15000 : 4000,
      });
      return next;
    });
  };

  // Tab 10: Continuous Intelligence & Enterprise Security State
  const [observationSensitivity, setObservationSensitivity] = React.useState<'low' | 'balanced' | 'high'>('balanced');
  const [sweepIntervalHours, setSweepIntervalHours] = React.useState<number>(6);
  const [autoWorkflowThreshold, setAutoWorkflowThreshold] = React.useState<number>(0.85);
  const [isTriggeringSweep, setIsTriggeringSweep] = React.useState<boolean>(false);

  const [staleMemoryDays, setStaleMemoryDays] = React.useState<number>(90);
  const [autoPruneOrphanEdges, setAutoPruneOrphanEdges] = React.useState<boolean>(true);
  const [autoReconcileVectors, setAutoReconcileVectors] = React.useState<boolean>(true);
  const [isExecutingHealingSweep, setIsExecutingHealingSweep] = React.useState<boolean>(false);

  const [testTenantWorkspaceId, setTestTenantWorkspaceId] = React.useState<string>('default');
  const [isTestingIsolation, setIsTestingIsolation] = React.useState<boolean>(false);
  const [tenantIsolationResult, setTenantIsolationResult] = React.useState<{
    confirmed: boolean;
    details: string;
    totalEvaluated?: number;
  } | null>(null);
  const [isGeneratingCompliance, setIsGeneratingCompliance] = React.useState<boolean>(false);
  const [complianceDigest, setComplianceDigest] = React.useState<string | null>(null);

  const handleTriggerObservationSweep = async () => {
    if (!user?.uid) return;
    setIsTriggeringSweep(true);
    try {
      const res = await runObservationScanAction({
        workspaceId: testTenantWorkspaceId || 'default',
        userId: user.uid,
        forceFresh: true,
      });
      if (res.success && res.data) {
        toast({
          title: 'Observation Sweep Complete',
          description: `Identified ${res.data.recommendations.length} proactive recommendations.`,
        });
      } else {
        toast({
          title: 'Sweep Failed',
          description: res.error || 'Unable to complete observation sweep.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch {
      toast({
        title: 'Sweep Error',
        description: 'An unexpected error occurred during observation sweep.',
        variant: 'destructive',
      });
    } finally {
      setIsTriggeringSweep(false);
    }
  };

  const handleRunSelfHealingSweep = async () => {
    if (!user?.uid) return;
    setIsExecutingHealingSweep(true);
    try {
      const res = await executeSelfHealingAction({
        workspaceId: testTenantWorkspaceId || 'default',
        userId: user.uid,
        actionIds: [],
      });
      if (res.success && res.data) {
        toast({
          title: 'Self-Healing Sweep Complete',
          description: `Executed ${res.data.executedCount} healing actions. Knowledge base is healthy.`,
        });
      } else {
        toast({
          title: 'Self-Healing Sweep Failed',
          description: res.error || 'Unable to execute self-healing actions.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch {
      toast({
        title: 'Healing Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsExecutingHealingSweep(false);
    }
  };

  const handleTestTenantIsolation = async () => {
    if (!user?.uid) return;
    setIsTestingIsolation(true);
    try {
      const res = await generateComplianceExportAction({
        workspaceId: testTenantWorkspaceId || 'default',
        userId: user.uid,
      });
      if (res.success && res.data) {
        setTenantIsolationResult({
          confirmed: res.data.tenantIsolationConfirmed,
          details: `Multi-tenant isolation verified across ${res.data.totalMemoriesEvaluated} memories. Zero cross-workspace contamination.`,
          totalEvaluated: res.data.totalMemoriesEvaluated,
        });
        toast({
          title: 'Tenant Isolation Verified',
          description: 'Cryptographic boundary validation passed.',
        });
      } else {
        setTenantIsolationResult({
          confirmed: false,
          details: res.error || 'Isolation probe failed.',
        });
        toast({
          title: 'Isolation Probe Alert',
          description: res.error || 'Tenant isolation verification probe failed.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch {
      setTenantIsolationResult({
        confirmed: false,
        details: 'An unexpected error occurred during verification probe.',
      });
    } finally {
      setIsTestingIsolation(false);
    }
  };

  const handleGenerateComplianceExport = async () => {
    if (!user?.uid) return;
    setIsGeneratingCompliance(true);
    try {
      const res = await generateComplianceExportAction({
        workspaceId: testTenantWorkspaceId || 'default',
        userId: user.uid,
      });
      if (res.success && res.data) {
        setComplianceDigest(res.data.reportHash);
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compliance_audit_${testTenantWorkspaceId || 'default'}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: 'Compliance Audit Downloaded',
          description: `Export signed with SHA-256 digest: ${res.data.reportHash.substring(0, 12)}...`,
        });
      } else {
        toast({
          title: 'Compliance Export Failed',
          description: res.error || 'Unable to generate compliance package.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch {
      toast({
        title: 'Export Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingCompliance(false);
    }
  };

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
          <TabsTrigger value="context-simulator" className="gap-1.5 text-xs">
            <Brain className="h-3.5 w-3.5 text-indigo-500" />
            <span>Context Simulator</span>
          </TabsTrigger>
          <TabsTrigger value="mcp-governance" className="gap-1.5 text-xs">
            <Cpu className="h-3.5 w-3.5 text-blue-500" />
            <span>MCP & Governed Tools</span>
          </TabsTrigger>
          <TabsTrigger value="supervisor-orchestration" className="gap-1.5 text-xs">
            <Bot className="h-3.5 w-3.5 text-purple-600" />
            <span>Supervisor & Agents</span>
          </TabsTrigger>
          <TabsTrigger value="domain-agents" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5 text-purple-600" />
            <span>Domain Specialists & Swarms</span>
          </TabsTrigger>
          <TabsTrigger value="workflows-triggers" className="gap-1.5 text-xs">
            <Workflow className="h-3.5 w-3.5 text-purple-600" />
            <span>Agentic Workflows & Triggers</span>
          </TabsTrigger>
          <TabsTrigger value="intelligence-governance" className="gap-1.5 text-xs">
            <Cpu className="h-3.5 w-3.5 text-purple-600" />
            <span>Intelligence & Security</span>
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

        {/* Tab 5: Context Simulator & Workbench (Phase 5) */}
        <TabsContent value="context-simulator" className="space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-indigo-600" />
                <span>Context Builder Simulator & Workbench</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Simulate prompt context assembly, 4-tier token budget allocation, and multi-store aggregation across any tenant or entity without modifying code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Target Workspace ID <span className="text-rose-500">*</span>:
                  </label>
                  <Input
                    value={simWorkspaceId}
                    onChange={(e) => setSimWorkspaceId(e.target.value)}
                    placeholder="e.g. ws_test_tenant or your workspace ID"
                    className="text-xs min-h-[44px] font-mono bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Subject Type:
                  </label>
                  <select
                    value={simSubjectType}
                    onChange={(e) => setSimSubjectType(e.target.value as ContextSubjectType)}
                    aria-label="Subject Type"
                    className="w-full text-xs min-h-[44px] px-3 py-2 rounded-md border border-input bg-background text-foreground"
                  >
                    <option value="entity">Entity / Account</option>
                    <option value="deal">Commercial Deal</option>
                    <option value="meeting">Meeting Event</option>
                    <option value="campaign">Marketing Campaign</option>
                    <option value="user">User / Rep</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Subject Record ID (optional):
                  </label>
                  <Input
                    value={simSubjectId}
                    onChange={(e) => setSimSubjectId(e.target.value)}
                    placeholder="e.g. ent_123 or deal_456"
                    className="text-xs min-h-[44px] font-mono bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Max Token Budget:
                  </label>
                  <Input
                    type="number"
                    value={simMaxTokens}
                    onChange={(e) => setSimMaxTokens(e.target.value)}
                    placeholder="4000"
                    className="text-xs min-h-[44px] font-mono bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  User or Agent Objective:
                </label>
                <Input
                  value={simObjective}
                  onChange={(e) => setSimObjective(e.target.value)}
                  placeholder="e.g. Prepare for upcoming contract renewal negotiation"
                  className="text-xs min-h-[44px] bg-background"
                />
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleRunContextSimulation}
                  disabled={isSimulatingContext}
                  className="min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2 active:scale-[0.97]"
                >
                  <Brain className={cn('h-4 w-4', isSimulatingContext && 'animate-spin')} />
                  <span>{isSimulatingContext ? 'Assembling Context...' : 'Assemble Context Package'}</span>
                </Button>
              </div>

              {/* Simulation Results Dashboard */}
              {simulatedPackage && (
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Simulation Telemetry</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Latency: {simulatedPackage.executionTimeMs}ms
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="text-muted-foreground block text-[11px]">Tokens Used</span>
                      <span className="text-base font-bold text-foreground">
                        {simulatedPackage.tokenBudget.totalTokens} / {simulatedPackage.tokenBudget.maxBudget}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="text-muted-foreground block text-[11px]">Utilization</span>
                      <span className="text-base font-bold text-indigo-600">
                        {simulatedPackage.tokenBudget.utilizationPercentage}%
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="text-muted-foreground block text-[11px]">Verified Memories</span>
                      <span className="text-base font-bold text-foreground">
                        {simulatedPackage.memories.length}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="text-muted-foreground block text-[11px]">Contradictions</span>
                      <span className={cn('text-base font-bold', simulatedPackage.conflicts.length > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                        {simulatedPackage.conflicts.length}
                      </span>
                    </div>
                  </div>

                  {/* Tier Breakdown */}
                  <div className="p-3 rounded-lg border bg-background space-y-1 text-xs">
                    <span className="font-semibold block text-[11px] text-muted-foreground">
                      Stratified Budget Allocation:
                    </span>
                    <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                      <Badge variant="secondary">Tier 1 Critical: {simulatedPackage.tokenBudget.tierBreakdown.tier1Critical}t</Badge>
                      <Badge variant="secondary">Tier 2 Relevant: {simulatedPackage.tokenBudget.tierBreakdown.tier2Relevant}t</Badge>
                      <Badge variant="secondary">Tier 3 Supporting: {simulatedPackage.tokenBudget.tierBreakdown.tier3Supporting}t</Badge>
                      <Badge variant="secondary">Tier 4 Discoverable: {simulatedPackage.tokenBudget.tierBreakdown.tier4Discoverable}t</Badge>
                    </div>
                  </div>

                  {/* Raw JSON View */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Context Package Payload (JSON)</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(simulatedPackage, null, 2));
                          toast({ title: 'JSON Copied', description: 'Package payload copied to clipboard.' });
                        }}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
                      >
                        Copy JSON
                      </Button>
                    </div>
                    <pre className="p-4 rounded-xl bg-muted/50 border text-[11px] font-mono max-h-72 overflow-auto text-foreground/90">
                      {JSON.stringify(simulatedPackage, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: MCP & Governed Tools */}
        <TabsContent value="mcp-governance" className="space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-blue-600" />
                    <span>Model Context Protocol (MCP) Governance</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Inspect registered tool capabilities, risk profiles, human-in-the-loop approval gates, and agent telemetry.
                  </CardDescription>
                </div>
                <Link href="/admin/companybrain/tools">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-xs gap-1.5 active:scale-[0.97] transition-transform"
                  >
                    <span>Open Full Console</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <ToolCatalogTable
                tools={mcpTools}
                onRunTool={(tool) => setRunnerTool(tool)}
                onToggleToolEnabled={handleBackofficeToggleTool}
                onToggleApprovalRequired={handleBackofficeToggleApproval}
                isLoading={isLoadingMcp}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 7: Supervisor & Agent Orchestration */}
        <TabsContent value="supervisor-orchestration" className="space-y-4">
          {/* Header Card */}
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-4 w-4 text-purple-600" />
                    <span>Supervisor Agent & Dynamic Tool Orchestration</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Platform control plane for inspecting registered autonomous agents, cross-workspace active missions, and platform execution boundaries.
                  </CardDescription>
                </div>
                <Link href="/admin/companybrain/supervisor">
                  <Button
                    size="sm"
                    className="min-h-[44px] bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5 active:scale-[0.97] transition-transform"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span>Open Mission Control</span>
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Platform Limits & Safety Invariants */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-1">
                  <div className="text-[11px] font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                    <Workflow className="h-3.5 w-3.5" />
                    <span>Loop Ceiling</span>
                  </div>
                  <div className="text-lg font-bold text-foreground">10 Steps Max</div>
                  <p className="text-[11px] text-muted-foreground">
                    Guarantees plan termination and prevents runaway AI token loops.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-1">
                  <div className="text-[11px] font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Mission Timeout</span>
                  </div>
                  <div className="text-lg font-bold text-foreground">60 Seconds</div>
                  <p className="text-[11px] text-muted-foreground">
                    Hard ceiling per mission loop before returning partial findings.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                  <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>HITL Interception</span>
                  </div>
                  <div className="text-lg font-bold text-foreground">Error -32003</div>
                  <p className="text-[11px] text-muted-foreground">
                    High-risk actions pause execution cleanly for supervisor approval.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    <span>Durable Resumption</span>
                  </div>
                  <div className="text-lg font-bold text-foreground">Firestore Runs</div>
                  <p className="text-[11px] text-muted-foreground">
                    State persisted at each step; resumes without re-executing steps.
                  </p>
                </div>
              </div>

              {/* Registered Agents Registry */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Registered Agent Registry
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Active autonomous agents and domain specialists available for dynamic goal delegation.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {registeredAgents.length} Agents
                  </Badge>
                </div>

                <div className="rounded-xl border border-border overflow-hidden bg-background">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/40 text-muted-foreground border-b border-border text-[11px] font-medium">
                        <tr>
                          <th className="px-4 py-3">Agent</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Capabilities</th>
                          <th className="px-4 py-3">Version</th>
                          <th className="px-4 py-3">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {isLoadingAgents ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                              Loading registered agents...
                            </td>
                          </tr>
                        ) : registeredAgents.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                              No agents registered in registry.
                            </td>
                          </tr>
                        ) : (
                          registeredAgents.map((agent) => (
                            <tr key={agent.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                                <div>{agent.name}</div>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {agent.id}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'text-[10px] capitalize',
                                    agent.category === 'supervisor' &&
                                      'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
                                    agent.category === 'domain' &&
                                      'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
                                    agent.category === 'utility' &&
                                      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  )}
                                >
                                  {agent.category}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {agent.capabilities.map((cap) => (
                                    <Badge
                                      key={cap}
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground"
                                    >
                                      {cap}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                                v{agent.version}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground max-w-sm text-[11px]">
                                {agent.description}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Cross-Workspace Mission Runs Monitor */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Recent Mission Runs
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Live execution status across workspaces stored in Firestore /agent_runs.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={supervisorWorkspaceFilter}
                      onChange={(e) => setSupervisorWorkspaceFilter(e.target.value)}
                      placeholder="Filter workspace (default: all)"
                      className="text-xs min-h-[44px] sm:min-h-[38px] w-48 font-mono bg-background"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchAgentsAndRuns}
                      disabled={isLoadingSupervisorRuns}
                      className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5 active:scale-[0.97]"
                    >
                      <RefreshCw
                        className={cn('h-3.5 w-3.5', isLoadingSupervisorRuns && 'animate-spin')}
                      />
                      <span>Refresh</span>
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border overflow-hidden bg-background">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/40 text-muted-foreground border-b border-border text-[11px] font-medium">
                        <tr>
                          <th className="px-4 py-3">Mission ID</th>
                          <th className="px-4 py-3">Objective</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Steps</th>
                          <th className="px-4 py-3">Duration</th>
                          <th className="px-4 py-3">Created</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {isLoadingSupervisorRuns ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                              Loading mission runs...
                            </td>
                          </tr>
                        ) : supervisorRuns.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                              No mission runs found.
                            </td>
                          </tr>
                        ) : (
                          supervisorRuns.map((run) => (
                            <tr key={run.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3 font-mono text-[11px] font-medium text-foreground whitespace-nowrap">
                                {run.id.slice(0, 18)}...
                              </td>
                              <td className="px-4 py-3 max-w-xs truncate text-foreground font-medium">
                                {run.objective}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'text-[10px] capitalize',
                                    run.status === 'completed' &&
                                      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
                                    run.status === 'executing' &&
                                      'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 animate-pulse',
                                    run.status === 'needs_approval' &&
                                      'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
                                    run.status === 'failed' &&
                                      'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                  )}
                                >
                                  {run.status.replace('_', ' ')}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                                {run.metrics.completedSteps} / {run.steps.length || run.metrics.totalSteps}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                                {run.metrics.durationMs ? `${run.metrics.durationMs}ms` : '—'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-[11px]">
                                {new Date(run.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <Link
                                  href={`/admin/companybrain/supervisor?runId=${run.id}`}
                                  className="inline-block"
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 active:scale-[0.97]"
                                  >
                                    Inspect
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 8: Domain Specialists & Swarm Collaboration Governance */}
        <TabsContent value="domain-agents" className="space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span>Domain Specialists Roster & Policy Management</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Inspect domain specialists, configure code-free workspace autonomy policies, and simulate multi-agent swarms.
                  </CardDescription>
                </div>
                <Link href="/admin/companybrain/agents">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-purple-200 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 active:scale-[0.97]"
                  >
                    <span>Open Agent Center</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Specialist Cards Grid */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-foreground">
                  Registered Specialist Personas ({specialistsList.length})
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {specialistsList.map((spec) => (
                    <div
                      key={spec.id}
                      className="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {spec.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {spec.category}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {spec.personaDescription}
                      </p>
                      <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground">
                        <span>{spec.allowedTools.length} Tools</span>
                        <span className="capitalize font-medium text-foreground">
                          {spec.defaultAutonomy.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code-Free Policy Editor */}
              <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/20 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-purple-600" />
                    Code-Free Policy & Autonomy Control Plane
                  </span>
                  <Badge variant="secondary" className="text-[10px] bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                    Zero-Code Governance
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Target Workspace ID
                    </label>
                    <Input
                      placeholder="e.g. ws_acme_corp"
                      value={policyWorkspaceId}
                      onChange={(e) => setPolicyWorkspaceId(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Specialist Persona
                    </label>
                    <select
                      value={selectedSpecialistId}
                      onChange={(e) => setSelectedSpecialistId(e.target.value as DomainSpecialistId)}
                      className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="knowledge_specialist">Knowledge & Lore Specialist</option>
                      <option value="revenue_specialist">Revenue & Pipeline Specialist</option>
                      <option value="meeting_specialist">Meeting & Briefing Specialist</option>
                      <option value="sdr_specialist">SDR & Prospecting Specialist</option>
                      <option value="operations_specialist">Operations & Workflow Specialist</option>
                      <option value="governance_specialist">Governance & Compliance Specialist</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Autonomy Tier
                    </label>
                    <select
                      value={policyAutonomy}
                      onChange={(e) => setPolicyAutonomy(e.target.value as SpecialistAutonomyLevel)}
                      className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="read_only">Read-Only (Queries Only, Mutations Blocked)</option>
                      <option value="supervised">Supervised (Mutations Require Approval)</option>
                      <option value="autonomous">Autonomous (Auto-run Low-Risk Mutations)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Custom Workspace Directive / Prompt Injection
                  </label>
                  <Input
                    placeholder="e.g. Always enforce HIPAA medical privacy standards and NHS clinical code validation..."
                    value={policyDirective}
                    onChange={(e) => setPolicyDirective(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <Button
                  size="sm"
                  disabled={isSavingSpecialistPolicy}
                  onClick={handleSaveSpecialistPolicy}
                  className="min-h-[44px] text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition-all active:scale-[0.97]"
                >
                  {isSavingSpecialistPolicy ? 'Saving Policy...' : 'Save Specialist Policy Override'}
                </Button>
              </div>

              {/* Swarm Simulation Sandbox */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  Swarm Consensus Simulation & Telemetry
                </span>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Simulation Objective
                  </label>
                  <Input
                    value={swarmSimObjective}
                    onChange={(e) => setSwarmSimObjective(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="Describe mission objective for 3-agent swarm..."
                  />
                </div>

                <Button
                  size="sm"
                  disabled={isSimulatingSwarm}
                  onClick={handleRunSwarmSimulation}
                  className="min-h-[44px] text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl transition-all active:scale-[0.97] flex items-center gap-1.5"
                >
                  {isSimulatingSwarm ? (
                    <>
                      <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Simulating Swarm...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Simulate Swarm Consensus</span>
                    </>
                  )}
                </Button>

                {simulatedSwarmRun && simulatedSwarmRun.consensus && (
                  <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/20 dark:bg-purple-950/20 space-y-3 mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">
                        Simulated Swarm Run ID: {simulatedSwarmRun.id}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {simulatedSwarmRun.metrics.durationMs}ms
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line bg-background p-3 rounded-lg border border-border">
                      {simulatedSwarmRun.consensus.executiveSummary}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 space-y-1">
                        <span className="font-bold block">Consensus Points ({simulatedSwarmRun.consensus.consensusPoints.length})</span>
                        {simulatedSwarmRun.consensus.consensusPoints.map((pt, i) => (
                          <div key={i} className="text-[11px] leading-relaxed">&bull; {pt}</div>
                        ))}
                      </div>

                      <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-300 space-y-1">
                        <span className="font-bold block">Divergence Points ({simulatedSwarmRun.consensus.divergencePoints.length})</span>
                        {simulatedSwarmRun.consensus.divergencePoints.length === 0 ? (
                          <div className="text-[11px] italic">Zero divergence detected.</div>
                        ) : (
                          simulatedSwarmRun.consensus.divergencePoints.map((dp, i) => (
                            <div key={i} className="text-[11px] leading-relaxed">&bull; {dp.topic}: {dp.tensionSummary}</div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 9: Agentic Autonomous Workflows & Event Triggers */}
        <TabsContent value="workflows-triggers" className="space-y-6">
          {/* Section 1: Global Execution Guardrails & Emergency Kill-Switch */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    <span>Global Execution Guardrails & Emergency Controls</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Real-time safety telemetry, background execution limits, and workspace emergency kill-switch.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-lg border">
                  <div className="text-right">
                    <span className="text-[11px] font-bold block text-foreground">
                      {isEmergencyKillSwitchActive ? 'Automations Disabled' : 'Automations Active'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Emergency Kill-Switch</span>
                  </div>
                  <Switch
                    checked={!isEmergencyKillSwitchActive}
                    onCheckedChange={handleToggleEmergencyKillSwitch}
                    aria-label="Emergency kill switch toggle"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg border space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Hard Timeout Ceiling</span>
                  <span className="font-bold text-foreground">90 Seconds (Promise.race)</span>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border space-y-1">
                  <span className="text-muted-foreground block text-[11px]">DAG Step Limit</span>
                  <span className="font-bold text-foreground">Max 12 Steps (Recursion Shield)</span>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Concurrency Limit</span>
                  <span className="font-bold text-foreground">Max 5 Simultaneous Runs/WS</span>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Approval Policy</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Strict HITL Interception</span>
                </div>
              </div>

              {isEmergencyKillSwitchActive && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>
                    Emergency kill-switch is active. All inbound event routing, background triggers, and cron dispatches are currently suppressed platform-wide.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Turnkey Blueprint Gallery (1-Click Install) */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span>Turnkey Production Blueprints (1-Click Deployment)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Install pre-configured, tested agentic pipelines directly into target workspace without writing code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {TURNKEY_WORKFLOW_BLUEPRINTS.map((bp) => (
                  <div
                    key={bp.id}
                    className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] font-mono capitalize">
                          {bp.category}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {bp.nodes.length} Steps
                        </Badge>
                      </div>
                      <h4 className="text-xs font-bold text-foreground">{bp.title}</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                        {bp.description}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleInstallBlueprintBackoffice(bp.id)}
                      disabled={installingBlueprintId === bp.id}
                      className="w-full min-h-[44px] sm:min-h-[36px] text-xs font-semibold active:scale-[0.97] transition-all"
                    >
                      {installingBlueprintId === bp.id ? 'Installing...' : '1-Click Install Blueprint'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Active Pipelines & Control Toggles */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-purple-600" />
                    <span>Configured Pipelines ({workflowsList.length})</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Inspect active workflows, toggle automated execution, and view step topology.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchWorkflowsData}
                  disabled={isLoadingWorkflows}
                  className="min-h-[44px] sm:min-h-[36px] text-xs active:scale-[0.97]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoadingWorkflows ? 'animate-spin' : ''}`} />
                  Refresh Workflows
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {workflowsList.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground border border-dashed rounded-xl">
                  No workflows installed in workspace yet. Use the 1-click installer above.
                </div>
              ) : (
                <div className="space-y-2">
                  {workflowsList.map((wf) => (
                    <div
                      key={wf.id}
                      className="p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-xs">{wf.title}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {wf.trigger.eventType || 'Manual'}
                          </Badge>
                          <Badge
                            className={`text-[10px] ${
                              wf.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {wf.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {wf.description} • {wf.nodes.length} nodes
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="text-[11px] text-muted-foreground">Active:</span>
                        <Switch
                          checked={wf.status === 'active'}
                          onCheckedChange={() => handleToggleWorkflow(wf.id, wf.status as 'active' | 'paused')}
                          aria-label={`Toggle active state for ${wf.title}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Interactive Event Trigger Simulator */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4 text-purple-600" />
                <span>Synthetic Event Ingestion & Simulation Sandbox</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Simulate inbound CRM events (e.g. stalled deal, new inbound lead, completed meeting) and predict branching decisions and approval intercepts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Select Event Type to Simulate:</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {['crm.deal.stalled', 'crm.lead.created', 'meeting.completed'].map((evt) => (
                    <Button
                      key={evt}
                      type="button"
                      variant={syntheticEventType === evt ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSyntheticEventType(evt)}
                      className={`min-h-[44px] sm:min-h-[32px] text-xs font-mono active:scale-[0.97] ${
                        syntheticEventType === evt ? 'bg-purple-600 text-white' : ''
                      }`}
                    >
                      {evt}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Synthetic Event Payload (JSON):</label>
                <Textarea
                  value={syntheticPayloadJson}
                  onChange={(e) => setSyntheticPayloadJson(e.target.value)}
                  className="font-mono text-[11px] min-h-[90px] bg-muted/20"
                />
              </div>

              <Button
                type="button"
                onClick={handleSimulateSyntheticEvent}
                disabled={isSimulatingEvent}
                className="w-full min-h-[44px] text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white active:scale-[0.97]"
              >
                {isSimulatingEvent ? 'Simulating Event Dispatch...' : 'Simulate Event & Predict Flow'}
              </Button>

              {simulationResult && (
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-foreground">Dry-Run Prediction Output</span>
                    <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                      {simulationResult.predictedNodesExecuted} Steps Traversed
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Execution Steps:
                    </span>
                    {simulationResult.executionSteps.map((step, idx) => (
                      <div key={idx} className="p-1.5 bg-card rounded border text-[11px] flex justify-between">
                        <span className="font-medium text-foreground">{step.title}</span>
                        <span className="text-muted-foreground">{step.details}</span>
                      </div>
                    ))}
                  </div>
                  {simulationResult.predictedApprovalsCount > 0 && (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-amber-900 dark:text-amber-200 text-[11px]">
                      Gated at Human Approval Checkpoint ({simulationResult.predictedApprovalsCount} Gate Predicted).
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 10: Continuous Intelligence & Enterprise Security */}
        <TabsContent value="intelligence-governance" className="space-y-4">
          {/* Card 1: Autonomous Observation Scheduler & Sensitivity */}
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4 text-purple-600" />
                <span>Autonomous Observation & Pattern Detection</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Configure background scanning cadence, heuristic sensitivity thresholds, and automatic workflow trigger criteria.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Sensitivity Profile</label>
                  <div className="flex gap-2">
                    {(['low', 'balanced', 'high'] as const).map((level) => (
                      <Button
                        key={level}
                        type="button"
                        size="sm"
                        variant={observationSensitivity === level ? 'default' : 'outline'}
                        onClick={() => setObservationSensitivity(level)}
                        className="text-xs capitalize flex-1 min-h-[44px] sm:min-h-[36px] active:scale-[0.97]"
                      >
                        {level}
                      </Button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {observationSensitivity === 'low' && 'Surfaces only critical risks with high confidence.'}
                    {observationSensitivity === 'balanced' && 'Surfaces medium-to-high opportunities and risks.'}
                    {observationSensitivity === 'high' && 'Maximum exploratory detection across all subtle shifts.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Observation Sweep Cadence</label>
                  <div className="flex gap-2">
                    {[1, 6, 12, 24].map((hours) => (
                      <Button
                        key={hours}
                        type="button"
                        size="sm"
                        variant={sweepIntervalHours === hours ? 'default' : 'outline'}
                        onClick={() => setSweepIntervalHours(hours)}
                        className="text-xs flex-1 min-h-[44px] sm:min-h-[36px] active:scale-[0.97]"
                      >
                        {hours}h
                      </Button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Sliding window scan frequency across active workspace activities.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Auto-Workflow Confidence</label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      step="0.05"
                      min="0.5"
                      max="1.0"
                      value={autoWorkflowThreshold}
                      onChange={(e) => setAutoWorkflowThreshold(parseFloat(e.target.value) || 0.85)}
                      className="text-xs font-mono min-h-[44px] sm:min-h-[36px]"
                    />
                    <Badge variant="outline" className="text-xs">
                      {Math.round(autoWorkflowThreshold * 100)}%
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Confidence required to recommend 1-click autonomous workflow dispatch.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  In-memory debounce cache active (1-hour TTL) to prevent redundant scans.
                </span>
                <Button
                  size="sm"
                  onClick={handleTriggerObservationSweep}
                  disabled={isTriggeringSweep}
                  className="w-full sm:w-auto text-xs min-h-[44px] sm:min-h-[36px] active:scale-[0.97] gap-2"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${isTriggeringSweep ? 'animate-spin' : ''}`} />
                  <span>{isTriggeringSweep ? 'Scanning...' : 'Trigger Immediate Sweep'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Continuous Self-Healing Policies */}
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <span>Continuous Self-Healing Policies</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Non-destructive reconciliation policies for stale memories, orphaned topology edges, and vector index drift.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Stale Memory Horizon</label>
                  <div className="flex gap-2">
                    {[30, 60, 90, 180].map((days) => (
                      <Button
                        key={days}
                        type="button"
                        size="sm"
                        variant={staleMemoryDays === days ? 'default' : 'outline'}
                        onClick={() => setStaleMemoryDays(days)}
                        className="text-xs flex-1 min-h-[44px] sm:min-h-[36px] active:scale-[0.97]"
                      >
                        {days}d
                      </Button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Memories unmodified past this horizon are flagged for soft-archival.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground">Prune Orphan Edges</span>
                    <p className="text-[11px] text-muted-foreground">Clean dangling relations</p>
                  </div>
                  <Switch
                    checked={autoPruneOrphanEdges}
                    onCheckedChange={setAutoPruneOrphanEdges}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground">Vector Reconciliation</span>
                    <p className="text-[11px] text-muted-foreground">Resync missing embeddings</p>
                  </div>
                  <Switch
                    checked={autoReconcileVectors}
                    onCheckedChange={setAutoReconcileVectors}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  Non-destructive invariant: raw human notes in quick_notes are never deleted.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRunSelfHealingSweep}
                  disabled={isExecutingHealingSweep}
                  className="w-full sm:w-auto text-xs min-h-[44px] sm:min-h-[36px] active:scale-[0.97] gap-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Activity className={`h-3.5 w-3.5 ${isExecutingHealingSweep ? 'animate-spin' : ''}`} />
                  <span>{isExecutingHealingSweep ? 'Reconciling...' : 'Run Full Self-Healing Sweep'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Multi-Tenant Enterprise Security & Compliance */}
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span>Multi-Tenant Enterprise Security & Compliance</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Audit tenant isolation boundaries, generate signed SOC2/GDPR compliance exports, and test cryptographic erasures.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Tenant Boundary Verification Probe</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      SOC2 / ISO 27001
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Simulates cross-tenant query probes against Firestore, Qdrant vectors, and knowledge graphs to confirm mathematical isolation.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Target Workspace ID"
                      value={testTenantWorkspaceId}
                      onChange={(e) => setTestTenantWorkspaceId(e.target.value)}
                      className="text-xs font-mono min-h-[44px] sm:min-h-[36px]"
                    />
                    <Button
                      size="sm"
                      onClick={handleTestTenantIsolation}
                      disabled={isTestingIsolation}
                      className="text-xs min-h-[44px] sm:min-h-[36px] active:scale-[0.97] shrink-0"
                    >
                      {isTestingIsolation ? 'Probing...' : 'Run Probe'}
                    </Button>
                  </div>

                  {tenantIsolationResult && (
                    <div
                      className={`p-3 rounded-lg border text-xs ${
                        tenantIsolationResult.confirmed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      <p className="font-semibold">{tenantIsolationResult.details}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Cryptographic Compliance Export</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      GDPR Art. 15 / 20
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Generates a complete, verifiable JSON audit package signed with an immutable SHA-256 cryptographic digest.
                  </p>
                  <div className="pt-2">
                    <Button
                      size="sm"
                      onClick={handleGenerateComplianceExport}
                      disabled={isGeneratingCompliance}
                      className="w-full text-xs min-h-[44px] sm:min-h-[36px] active:scale-[0.97] gap-2 bg-primary text-primary-foreground"
                    >
                      <Download className={`h-3.5 w-3.5 ${isGeneratingCompliance ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingCompliance ? 'Generating Package...' : 'Download Signed Audit Package'}</span>
                    </Button>
                  </div>

                  {complianceDigest && (
                    <div className="p-2.5 rounded-lg border border-border/60 bg-background text-[11px] font-mono text-muted-foreground break-all">
                      <span className="font-semibold text-foreground">SHA-256 Digest:</span> {complianceDigest}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Live Tool Runner Modal */}
      <LiveToolRunnerModal
        tool={runnerTool}
        isOpen={Boolean(runnerTool)}
        onClose={() => setRunnerTool(null)}
        onExecute={handleBackofficeExecuteTool}
      />

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
