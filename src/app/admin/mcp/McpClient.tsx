'use client';

/**
 * @fileOverview MCP Mission Control & Operator Capability Console Client (Phase 5 Milestone 4 Task 6)
 *
 * Implements UI #12 & UI #38:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 14 & 21: Tool fingerprint drift visualization and operator re-approval workflow.
 * - Rule 15 & 34: External server allowlisting and SSRF protection.
 * - Rule 47: Anti-IDOR multi-tenant isolation via workspace context.
 * - Rule 60: Emergency dead-man switch banner and fail-closed indicators.
 * - Rule 61: Backoffice operator control plane surfaces.
 * - Rule 62: Live SSE reactivity via useEventStream.
 */

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useEventStream } from '@/hooks/useEventStream';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Wrench,
  Server,
  Activity,
  RefreshCw,
  Plus,
  Layers,
} from 'lucide-react';
import {
  listMcpCapabilitiesAction,
  getMcpToolDetailsAction,
  approveToolFingerprintAction,
  toggleMcpToolStateAction,
  listMcpServersAction,
  registerMcpServerAction,
  transitionServerLifecycleAction,
  getMcpPlatformMetricsAction,
  type McpCapabilitySummary,
  type McpToolDetails,
  type McpPlatformMetrics,
} from '@/app/actions/mcp-actions';
import type { McpServerRegistration, McpServerStatus } from '@/platform/mcp/security';
import { McpMetricsCards } from '@/components/mcp/McpMetricsCards';
import { McpDeadManBanner } from '@/components/mcp/McpDeadManBanner';
import { CapabilityCatalogTable } from '@/components/mcp/CapabilityCatalogTable';
import { ServerAllowlistTable } from '@/components/mcp/ServerAllowlistTable';
import { ToolInspectorDrawer } from '@/components/mcp/ToolInspectorDrawer';
import { RegisterServerModal } from '@/components/mcp/RegisterServerModal';
import { McpActivityStream } from '@/components/mcp/McpActivityStream';

export function McpClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();

  const orgId = activeOrganizationId || 'org_default';
  const wsId = activeWorkspaceId || 'ws_default';

  const initialTab = searchParams.get('tab') || 'catalog';
  const [activeTab, setActiveTab] = React.useState<'catalog' | 'servers' | 'activity'>(
    initialTab === 'servers' || initialTab === 'activity' ? initialTab : 'catalog'
  );

  const [metrics, setMetrics] = React.useState<McpPlatformMetrics | null>(null);
  const [capabilities, setCapabilities] = React.useState<McpCapabilitySummary[]>([]);
  const [servers, setServers] = React.useState<McpServerRegistration[]>([]);
  const [selectedTool, setSelectedTool] = React.useState<McpToolDetails | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Sync tab with URL
  const handleTabChange = (val: string) => {
    const tab = val as typeof activeTab;
    setActiveTab(tab);
    router.replace(`/admin/mcp?tab=${tab}`, { scroll: false });
  };

  const fetchAllData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [metricsRes, capsRes, serversRes] = await Promise.all([
        getMcpPlatformMetricsAction({ organizationId: orgId, workspaceId: wsId }),
        listMcpCapabilitiesAction({ organizationId: orgId, workspaceId: wsId }),
        listMcpServersAction({ organizationId: orgId, workspaceId: wsId }),
      ]);

      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }
      if (capsRes.success && capsRes.data) {
        setCapabilities(capsRes.data);
      }
      if (serversRes.success && serversRes.data) {
        setServers(serversRes.data);
      }
    } catch (err: unknown) {
      toast({
        title: 'Failed to load MCP console',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [orgId, wsId, toast]);

  React.useEffect(() => {
    void fetchAllData();
  }, [fetchAllData]);

  const sseRefreshTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Live SSE stream subscription for automated refresh with 500ms debounce (Rule 62)
  useEventStream({
    workspaceId: wsId,
    enabled: Boolean(wsId),
    onActivity: (activity) => {
      if (
        activity.eventType.startsWith('mcp.') ||
        activity.eventType.startsWith('governance.') ||
        activity.eventType.startsWith('policy.')
      ) {
        if (sseRefreshTimerRef.current) {
          clearTimeout(sseRefreshTimerRef.current);
        }
        sseRefreshTimerRef.current = setTimeout(() => {
          void fetchAllData();
        }, 500);
      }
    },
  });

  React.useEffect(() => {
    return () => {
      if (sseRefreshTimerRef.current) {
        clearTimeout(sseRefreshTimerRef.current);
      }
    };
  }, []);

  const handleInspectTool = async (toolId: string) => {
    setIsProcessing(true);
    try {
      const res = await getMcpToolDetailsAction({
        organizationId: orgId,
        workspaceId: wsId,
        toolId,
      });

      if (res.success && res.data) {
        setSelectedTool(res.data);
        setIsInspectorOpen(true);
      } else {
        toast({
          title: 'Failed to load tool details',
          description: res.error || 'Capability metadata could not be retrieved.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Error inspecting tool',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveFingerprint = async (toolId: string, reason: string) => {
    setIsProcessing(true);
    try {
      const res = await approveToolFingerprintAction({
        organizationId: orgId,
        workspaceId: wsId,
        toolId,
        reason,
      });

      if (res.success && res.data) {
        toast({
          title: 'Fingerprint Approved',
          description: `Cryptographic hash ${res.data.compositeHash.slice(0, 16)}... recorded and active.`,
        });
        // Refresh live data and drawer
        await fetchAllData();
        if (selectedTool && selectedTool.id === toolId) {
          await handleInspectTool(toolId);
        }
      } else {
        toast({
          title: 'Approval Failed',
          description: res.error || 'Failed to approve fingerprint.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Error approving fingerprint',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleToolState = async (toolId: string, enabled: boolean) => {
    // Optimistic update
    setCapabilities((prev) =>
      prev.map((c) => (c.id === toolId ? { ...c, enabled } : c))
    );

    try {
      const res = await toggleMcpToolStateAction({
        organizationId: orgId,
        workspaceId: wsId,
        toolId,
        enabled,
      });

      if (!res.success) {
        // Revert
        setCapabilities((prev) =>
          prev.map((c) => (c.id === toolId ? { ...c, enabled: !enabled } : c))
        );
        toast({
          title: 'Failed to toggle state',
          description: res.error || 'Could not update capability state.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: enabled ? 'Tool Enabled' : 'Tool Disabled',
          description: `Capability ${toolId} is now ${enabled ? 'active' : 'inactive'}.`,
        });
      }
    } catch {
      setCapabilities((prev) =>
        prev.map((c) => (c.id === toolId ? { ...c, enabled: !enabled } : c))
      );
    }
  };

  const handleRegisterServer = async (data: {
    serverName: string;
    serverUrl: string;
    description: string;
  }) => {
    setIsProcessing(true);
    try {
      const res = await registerMcpServerAction({
        organizationId: orgId,
        workspaceId: wsId,
        serverName: data.serverName,
        serverUrl: data.serverUrl,
        description: data.description,
      });

      if (res.success && res.data) {
        toast({
          title: 'Server Registered',
          description: `External MCP server '${res.data.serverId}' registered in discovered status with Rule 34 SSRF verification.`,
        });
        await fetchAllData();
      } else {
        throw new Error(res.error || 'Failed to register server');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransitionServerStatus = async (
    serverId: string,
    nextStatus: McpServerStatus,
    reason: string
  ) => {
    setIsProcessing(true);
    try {
      const res = await transitionServerLifecycleAction({
        organizationId: orgId,
        workspaceId: wsId,
        serverId,
        nextStatus,
        reason,
      });

      if (res.success && res.data) {
        toast({
          title: 'Status Updated',
          description: `Server '${serverId}' transitioned to '${nextStatus}'.`,
        });
        await fetchAllData();
      } else {
        toast({
          title: 'Transition Failed',
          description: res.error || 'Could not transition server lifecycle.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Error updating status',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Console Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              <span>Operator Capability Console</span>
            </h1>
            <CardInfoTooltip
              text="Central mission control for platform capability registration, cryptographic tool fingerprinting, schema drift detection, and external MCP server allowlisting."
            />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage Model Context Protocol (MCP) streamable endpoints, verify supply-chain security, and monitor autonomous tool dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void fetchAllData()}
            disabled={isLoading}
            className="gap-1.5 rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            className="gap-1.5 rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[36px]"
          >
            <Plus className="h-4 w-4" />
            Register Server
          </Button>
        </div>
      </div>

      {/* Emergency Dead-Man Kill Switch Alert Banner (Rule 60) */}
      <McpDeadManBanner
        active={metrics?.deadManPaused ?? false}
        onRefresh={() => void fetchAllData()}
      />

      {/* KPI Metrics Cards */}
      <McpMetricsCards metrics={metrics} isLoading={isLoading} />

      {/* Main Surface Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6"
      >
        <TabsList className="bg-muted/40 p-1 rounded-2xl border border-border/60">
          <TabsTrigger
            value="catalog"
            className="gap-2 text-xs py-2 px-4 rounded-xl active:scale-[0.97]"
          >
            <Wrench className="h-3.5 w-3.5" />
            Capability Catalog
            <span className="text-[11px] font-mono text-muted-foreground ml-1">
              ({capabilities.length})
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="servers"
            className="gap-2 text-xs py-2 px-4 rounded-xl active:scale-[0.97]"
          >
            <Server className="h-3.5 w-3.5" />
            Allowlisted Servers
            <span className="text-[11px] font-mono text-muted-foreground ml-1">
              ({servers.length})
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="gap-2 text-xs py-2 px-4 rounded-xl active:scale-[0.97]"
          >
            <Activity className="h-3.5 w-3.5" />
            Live Activity Stream
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Capability Catalog */}
        <TabsContent value="catalog" className="m-0 focus-visible:outline-hidden">
          <CapabilityCatalogTable
            capabilities={capabilities}
            onInspect={(id) => void handleInspectTool(id)}
            onToggleState={handleToggleToolState}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 2: External Server Allowlist */}
        <TabsContent value="servers" className="m-0 focus-visible:outline-hidden">
          <ServerAllowlistTable
            servers={servers}
            onTransitionStatus={handleTransitionServerStatus}
            onRegisterNew={() => setIsRegisterModalOpen(true)}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 3: Live Activity Stream */}
        <TabsContent value="activity" className="m-0 focus-visible:outline-hidden">
          <McpActivityStream workspaceId={wsId} />
        </TabsContent>
      </Tabs>

      {/* Standardized Tool Inspector Drawer (theme.md §8) */}
      <ToolInspectorDrawer
        tool={selectedTool}
        open={isInspectorOpen}
        onOpenChange={setIsInspectorOpen}
        onApproveFingerprint={handleApproveFingerprint}
        onToggleToolState={handleToggleToolState}
        isProcessing={isProcessing}
      />

      {/* Standardized Register Server Modal (theme.md §8) */}
      <RegisterServerModal
        open={isRegisterModalOpen}
        onOpenChange={setIsRegisterModalOpen}
        onRegister={handleRegisterServer}
        isProcessing={isProcessing}
      />
    </div>
  );
}
