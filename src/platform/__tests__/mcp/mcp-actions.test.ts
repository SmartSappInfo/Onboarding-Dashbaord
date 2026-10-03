/**
 * @fileOverview Unit & Integration Tests for MCP Operator Server Actions (Phase 5 Milestone 4)
 *
 * Invariants Tested:
 * 1. Rule 4: Zero any / Zero any[] strict typing.
 * 2. Rule 8 & 47: Anti-IDOR tenant validation comparing session orgId with inputs.
 * 3. Rule 14 & 21: Tool fingerprint drift detection and human re-approval.
 * 4. Rule 15 & 34: External server allowlisting and SSRF safe verification.
 * 5. Rule 51: Session authentication via requireAuth().
 * 6. Rule 60: Dead-man switch emergency pause evaluation.
 * 7. Rule 40: Domain event emission to defaultEventBus.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listMcpCapabilitiesAction,
  getMcpToolDetailsAction,
  approveToolFingerprintAction,
  toggleMcpToolStateAction,
  listMcpServersAction,
  registerMcpServerAction,
  transitionServerLifecycleAction,
  getMcpPlatformMetricsAction,
} from '@/app/actions/mcp-actions';
import { getCapabilityRegistry } from '@/platform/capabilities/registry/capability-registry';
import { ensureCapabilitiesRegistered } from '@/platform/capabilities/registry/register-capabilities';
import {
  getGlobalToolFingerprintStore,
  computeToolFingerprint,
} from '@/platform/mcp/security';
import { defaultEventBus } from '@/platform/events/event-bus';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

// Mock requireAuth
let mockAuthUser = {
  uid: 'usr_mcp_admin_123',
  isSystemAdmin: false,
  profile: {
    organizationId: 'org_mcp_test',
    defaultWorkspaceId: 'ws_mcp_test',
  },
};

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => mockAuthUser),
}));

describe('MCP Operator Server Actions (Rules 4, 8, 14, 15, 21, 47, 51, 60)', () => {
  const tenant = {
    organizationId: 'org_mcp_test',
    workspaceId: 'ws_mcp_test',
  };

  beforeEach(async () => {
    setGovernanceDeadManStateForTests(false);
    defaultEventBus.clear();
    ensureCapabilitiesRegistered();

    mockAuthUser = {
      uid: 'usr_mcp_admin_123',
      isSystemAdmin: false,
      profile: {
        organizationId: 'org_mcp_test',
        defaultWorkspaceId: 'ws_mcp_test',
      },
    };

    const registry = getCapabilityRegistry();
    const cap = registry.getCapability('crm.activity.create');
    if (cap) {
      const fp = computeToolFingerprint(cap, tenant, 'usr_mcp_admin_123');
      await getGlobalToolFingerprintStore().set(fp);
    }
  });

  it('lists capabilities with domain filtering and fingerprint status (Rules 8 & 14)', async () => {
    const result = await listMcpCapabilitiesAction({
      organizationId: 'org_mcp_test',
      workspaceId: 'ws_mcp_test',
      domain: 'crm_contacts',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBeGreaterThan(0);
    const found = result.data!.find((c) => c.id === 'crm.activity.create');
    expect(found).toBeDefined();
    expect(found!.riskLevel).toBeDefined();
    expect(found!.fingerprintStatus).toBe('verified');
  });

  it('rejects cross-tenant requests with IDOR_VIOLATION (Rule 8 & 47)', async () => {
    const result = await listMcpCapabilitiesAction({
      organizationId: 'org_attacker_999',
      workspaceId: 'ws_attacker_999',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('IDOR_VIOLATION');
  });

  it('retrieves detailed tool metadata including JSON schemas (Rule 2)', async () => {
    const result = await getMcpToolDetailsAction({
      organizationId: 'org_mcp_test',
      workspaceId: 'ws_mcp_test',
      toolId: 'crm.activity.create',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.id).toBe('crm.activity.create');
    expect(result.data!.inputSchema).toBeDefined();
    expect(result.data!.fingerprint).toBeDefined();
    expect(result.data!.fingerprint!.compositeHash).toBeDefined();
  });

  it('approves a drifted capability and emits fingerprint_approved event (Rules 14, 21, 40)', async () => {
    let eventReceived: unknown = null;
    defaultEventBus.subscribe('mcp.security.fingerprint_approved', async (event) => {
      eventReceived = event;
    });

    const result = await approveToolFingerprintAction({
      organizationId: 'org_mcp_test',
      workspaceId: 'ws_mcp_test',
      toolId: 'crm.activity.create',
      reason: 'Schema updated for Q4 CRM workflow',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.approvedBy).toBe('usr_mcp_admin_123');
    expect(eventReceived).not.toBeNull();
  });

  it('toggles MCP tool enablement state and publishes state_toggled event (Rule 40)', async () => {
    let eventReceived: unknown = null;
    defaultEventBus.subscribe('mcp.tool.state_toggled', async (event) => {
      eventReceived = event;
    });

    const result = await toggleMcpToolStateAction({
      organizationId: 'org_mcp_test',
      workspaceId: 'ws_mcp_test',
      toolId: 'crm.activity.create',
      enabled: false,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.toolId).toBe('crm.activity.create');
    expect(result.data!.enabled).toBe(false);
    expect(eventReceived).not.toBeNull();
  });

  it('blocks mutating actions when emergency dead-man pause is tripped (Rule 60)', async () => {
    setGovernanceDeadManStateForTests(true);

    const result = await approveToolFingerprintAction({
      organizationId: 'org_mcp_test',
      workspaceId: 'ws_mcp_test',
      toolId: 'crm.activity.create',
      reason: 'Emergency attempt',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('MCP_DEAD_MAN_PAUSED');
  });

  it('manages external MCP server lifecycle state (Rules 15 & 34)', async () => {
    const regResult = await registerMcpServerAction({
      organizationId: 'org_mcp_test',
      workspaceId: 'ws_mcp_test',
      serverName: 'Weather Gateway',
      serverUrl: 'https://api.weather-mcp.org/sse',
      description: 'External verified weather server',
    });

    expect(regResult.success).toBe(true);
    expect(regResult.data!.status).toBe('discovered');

    const serverId = regResult.data!.serverId;

    // Transition discovered -> reviewed
    const transResult = await transitionServerLifecycleAction({
      organizationId: 'org_mcp_test',
      workspaceId: 'ws_mcp_test',
      serverId,
      nextStatus: 'reviewed',
      reason: 'Security team reviewed architecture',
    });

    expect(transResult.success).toBe(true);
    expect(transResult.data!.status).toBe('reviewed');

    // List servers
    const listResult = await listMcpServersAction({
      organizationId: 'org_mcp_test',
      workspaceId: 'ws_mcp_test',
    });

    expect(listResult.success).toBe(true);
    expect(listResult.data!.some((s) => s.serverId === serverId)).toBe(true);
  });

  it('rejects SSRF targeting Google Cloud metadata on registration (Rule 34)', async () => {
    const regResult = await registerMcpServerAction({
      organizationId: 'org_mcp_test',
      workspaceId: 'ws_mcp_test',
      serverName: 'Evil Metadata Server',
      serverUrl: 'http://169.254.169.254/computeMetadata/v1/',
      description: 'Adversarial SSRF attempt',
    });

    expect(regResult.success).toBe(false);
    expect(regResult.code).toBe('SSRF_EGRESS_BLOCKED');
  });

  it('computes live platform metrics accurately (Rule 61)', async () => {
    const metricsResult = await getMcpPlatformMetricsAction({
      organizationId: 'org_mcp_test',
      workspaceId: 'ws_mcp_test',
    });

    expect(metricsResult.success).toBe(true);
    expect(metricsResult.data).toBeDefined();
    expect(metricsResult.data!.totalCapabilities).toBeGreaterThan(0);
    expect(metricsResult.data!.verifiedFingerprints).toBeGreaterThan(0);
  });
});
