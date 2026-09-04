/**
 * @fileOverview CompanyBrain 2.0 Phase 6: MCP Platform, Tool Registry & Governance Center
 * Route: `/admin/companybrain/tools`
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Central Governance Console:
 *    - Full management of registered Model Context Protocol (MCP) capabilities.
 *    - 4 tabbed surfaces: Tool Catalog, Human Approval Queue, API Keys, and Telemetry Audit Trail.
 * 2. Mobile Accessibility & Touch Targets:
 *    - Minimum touch targets >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]`.
 * 4. Suspense & Multi-Tenant Scoping:
 *    - Wrapped in Suspense boundary for Next.js 15 navigation compliance.
 *
 * @testability Tested via end-to-end tool runner and server action test suites.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Cpu,
  ShieldAlert,
  Key,
  Activity,
  ArrowLeft,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';

import {
  listMcpToolsAction,
  executeMcpToolAction,
  listPendingApprovalsAction,
  adjudicateApprovalAction,
  listMcpApiKeysAction,
  createMcpApiKeyAction,
  revokeMcpApiKeyAction,
  listMcpAuditLogsAction,
  upsertMcpApprovalPolicyAction,
  type GovernedToolInfo,
} from '@/lib/mcp/actions/mcp-governance-actions';
import type {
  McpPendingApproval,
  McpApiKey,
  McpAuditLog,
  McpCategory,
  McpPayloadValue,
  McpJsonRpcResponse,
} from '@/lib/mcp/types';

import { ToolCatalogTable } from '@/components/mcp/ToolCatalogTable';
import { LiveToolRunnerModal } from '@/components/mcp/LiveToolRunnerModal';
import { PendingApprovalsQueue } from '@/components/mcp/PendingApprovalsQueue';
import { McpApiKeysCard } from '@/components/mcp/McpApiKeysCard';
import { McpAuditLogViewer } from '@/components/mcp/McpAuditLogViewer';

export default function McpGovernanceCenterPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-12 px-6 max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <McpGovernanceContent />
    </React.Suspense>
  );
}

function McpGovernanceContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'catalog';

  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [currentTab, setCurrentTab] = React.useState<string>(initialTab);
  const [tools, setTools] = React.useState<GovernedToolInfo[]>([]);
  const [approvals, setApprovals] = React.useState<McpPendingApproval[]>([]);
  const [apiKeys, setApiKeys] = React.useState<McpApiKey[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<McpAuditLog[]>([]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [runnerTool, setRunnerTool] = React.useState<GovernedToolInfo | null>(null);

  const workspaceId = activeWorkspaceId || '';
  const organizationId = activeOrganizationId || activeWorkspaceId || '';
  const userId = user?.uid || '';

  const loadData = React.useCallback(async () => {
    if (!workspaceId || !userId) return;

    try {
      setIsRefreshing(true);
      const [toolsRes, approvalsRes, keysRes, logsRes] = await Promise.all([
        listMcpToolsAction({ workspaceId, userId }),
        listPendingApprovalsAction({ workspaceId, userId }),
        listMcpApiKeysAction({ workspaceId, userId }),
        listMcpAuditLogsAction({ workspaceId, userId, limit: 100 }),
      ]);

      if (toolsRes.success && toolsRes.data) setTools(toolsRes.data);
      if (approvalsRes.success && approvalsRes.data) setApprovals(approvalsRes.data);
      if (keysRes.success && keysRes.data) setApiKeys(keysRes.data);
      if (logsRes.success && logsRes.data) setAuditLogs(logsRes.data);
    } catch (err) {
      toast({
        title: 'Failed to load MCP telemetry',
        description: err instanceof Error ? err.message : 'Could not refresh data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [workspaceId, userId, toast]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handlers
  const handleExecuteTool = async (
    toolName: string,
    args: Record<string, McpPayloadValue>
  ): Promise<McpJsonRpcResponse> => {
    const res = await executeMcpToolAction({
      workspaceId,
      organizationId,
      userId,
      toolName,
      inputArguments: args,
    });

    if (!res.success) {
      throw new Error(res.error);
    }

    // Refresh telemetry and approvals asynchronously
    void loadData();
    return res.data;
  };

  const handleToggleToolEnabled = async (toolName: string, enabled: boolean) => {
    const currentTool = tools.find((t) => t.name === toolName);
    if (!currentTool) return;

    const res = await upsertMcpApprovalPolicyAction({
      workspaceId,
      organizationId,
      userId,
      toolName,
      requiresApproval: currentTool.requiresApproval,
      enabled,
    });

    if (res.success) {
      setTools((prev) =>
        prev.map((t) => (t.name === toolName ? { ...t, enabled, isCustomPolicy: true } : t))
      );
      toast({
        title: enabled ? 'Tool Enabled' : 'Tool Disabled',
        description: `Tool "${toolName}" policy updated for this workspace.`,
      });
    } else {
      toast({
        title: 'Update Failed',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const handleToggleApprovalRequired = async (toolName: string, requiresApproval: boolean) => {
    const currentTool = tools.find((t) => t.name === toolName);
    if (!currentTool) return;

    const res = await upsertMcpApprovalPolicyAction({
      workspaceId,
      organizationId,
      userId,
      toolName,
      requiresApproval,
      enabled: currentTool.enabled,
    });

    if (res.success) {
      setTools((prev) =>
        prev.map((t) => (t.name === toolName ? { ...t, requiresApproval, isCustomPolicy: true } : t))
      );
      toast({
        title: requiresApproval ? 'Approval Gate Enabled' : 'Automatic Execution Enabled',
        description: `Tool "${toolName}" now ${requiresApproval ? 'requires administrator review' : 'executes automatically'}.`,
      });
    } else {
      toast({
        title: 'Update Failed',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const handleAdjudicate = async (
    approvalId: string,
    decision: 'approved' | 'rejected',
    notes: string
  ) => {
    const res = await adjudicateApprovalAction({
      workspaceId,
      userId,
      approvalId,
      decision,
      notes,
    });

    if (res.success) {
      toast({
        title: decision === 'approved' ? 'Execution Approved' : 'Execution Rejected',
        description: `Approval request ${approvalId} was marked as ${decision}.`,
      });
      await loadData();
    } else {
      toast({
        title: 'Adjudication Failed',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const handleCreateApiKey = async (params: {
    name: string;
    role: 'admin' | 'member' | 'agent';
    allowedCategories?: McpCategory[];
    expiresInDays?: number;
  }) => {
    const res = await createMcpApiKeyAction({
      workspaceId,
      organizationId,
      userId,
      ...params,
    });

    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to generate API key.');
    }

    await loadData();
    return res.data;
  };

  const handleRevokeApiKey = async (keyId: string) => {
    const res = await revokeMcpApiKeyAction({
      workspaceId,
      userId,
      keyId,
    });

    if (res.success) {
      toast({
        title: 'Key Revoked',
        description: 'The MCP API key has been revoked and can no longer be used.',
      });
      await loadData();
    } else {
      toast({
        title: 'Revocation Failed',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <PageContainerFluid className="space-y-6 pb-12">
      {/* Header Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/quick-notes"
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> QuickNotes Brain
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
              MCP Gateway
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Cpu className="w-7 h-7 text-indigo-600" /> MCP Platform & Tool Governance
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Standardized Model Context Protocol (MCP) catalog, risk-gated execution policies, human-in-the-loop approvals, and external agent API keys.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isRefreshing}
            className="min-h-[44px] px-3.5 text-xs font-medium active:scale-[0.97] transition-transform"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Main Governance Tabs */}
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-5">
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-xl overflow-x-auto w-full justify-start sm:w-auto">
          <TabsTrigger value="catalog" className="text-xs gap-2 min-h-[44px]">
            <Cpu className="w-4 h-4" />
            <span>Tool Catalog ({tools.length})</span>
          </TabsTrigger>

          <TabsTrigger value="approvals" className="text-xs gap-2 min-h-[44px] relative">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Pending Approvals</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="keys" className="text-xs gap-2 min-h-[44px]">
            <Key className="w-4 h-4 text-emerald-600" />
            <span>Agent API Keys ({apiKeys.length})</span>
          </TabsTrigger>

          <TabsTrigger value="telemetry" className="text-xs gap-2 min-h-[44px]">
            <Activity className="w-4 h-4 text-indigo-600" />
            <span>Audit Trail & Telemetry</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Tool Catalog */}
        <TabsContent value="catalog" className="space-y-4 pt-1">
          <ToolCatalogTable
            tools={tools}
            onRunTool={(tool) => setRunnerTool(tool)}
            onToggleToolEnabled={handleToggleToolEnabled}
            onToggleApprovalRequired={handleToggleApprovalRequired}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 2: Pending Approvals */}
        <TabsContent value="approvals" className="space-y-4 pt-1">
          <PendingApprovalsQueue
            approvals={approvals}
            onAdjudicate={handleAdjudicate}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 3: API Keys */}
        <TabsContent value="keys" className="space-y-4 pt-1">
          <McpApiKeysCard
            apiKeys={apiKeys}
            onCreateKey={handleCreateApiKey}
            onRevokeKey={handleRevokeApiKey}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 4: Audit Logs */}
        <TabsContent value="telemetry" className="space-y-4 pt-1">
          <McpAuditLogViewer logs={auditLogs} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      {/* Live Tool Runner Modal */}
      <LiveToolRunnerModal
        tool={runnerTool}
        isOpen={Boolean(runnerTool)}
        onClose={() => setRunnerTool(null)}
        onExecute={handleExecuteTool}
      />
    </PageContainerFluid>
  );
}
