/**
 * @fileOverview Unit & Integration Tests for Server Allowlist & Supply-Chain Controls (Phase 5 Milestone 3 Task 3 & 4)
 *
 * Implements Rule 15 (Server Allowlisting & Supply-Chain Controls), Rule 4 (Zero any/any[]),
 * Rule 8 & 50 (Tenant Isolation), Rule 10 (Inline Architectural Docs), Rule 34 (SSRF Defense),
 * Rule 40 (Append-Only Audit Logging), and Rule 60 (Emergency Dead-Man Controls).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  McpServerRegistrationSchema,
  isValidLifecycleTransition,
  isServerExecutionPermitted,
  ALLOWLIST_ERROR_CODES,
} from '../../mcp/security/server-allowlist-types';
import {
  ServerAllowlistService,
  createMemoryAllowlistStore,
} from '../../mcp/security/server-allowlist-service';
import { createEventBus, type EventBus } from '../../events/event-bus';
import type { DomainEvent } from '../../capabilities/events/domain-event';
import { setGovernanceDeadManStateForTests } from '../../policy/governance-dead-man';

import { validateExternalUrl } from '../../security/safe-url-fetch';

describe('Server Allowlist Lifecycle Models & Validation (Phase 5 Milestone 3 Task 3)', () => {
  it('validates canonical 8-stage lifecycle transitions', () => {
    // Valid forward transitions
    expect(isValidLifecycleTransition('discovered', 'reviewed')).toBe(true);
    expect(isValidLifecycleTransition('reviewed', 'tested')).toBe(true);
    expect(isValidLifecycleTransition('tested', 'approved')).toBe(true);
    expect(isValidLifecycleTransition('approved', 'connected')).toBe(true);
    expect(isValidLifecycleTransition('connected', 'monitored')).toBe(true);
    expect(isValidLifecycleTransition('monitored', 'suspended')).toBe(true);
    expect(isValidLifecycleTransition('suspended', 'connected')).toBe(true);
    expect(isValidLifecycleTransition('suspended', 'revoked')).toBe(true);

    // Invalid jumps
    expect(isValidLifecycleTransition('discovered', 'connected')).toBe(false);
    expect(isValidLifecycleTransition('discovered', 'approved')).toBe(false);
    expect(isValidLifecycleTransition('revoked', 'connected')).toBe(false);
  });

  it('permits tool execution only for approved, connected, or monitored servers', () => {
    expect(isServerExecutionPermitted('discovered')).toBe(false);
    expect(isServerExecutionPermitted('reviewed')).toBe(false);
    expect(isServerExecutionPermitted('tested')).toBe(false);
    expect(isServerExecutionPermitted('suspended')).toBe(false);
    expect(isServerExecutionPermitted('revoked')).toBe(false);

    expect(isServerExecutionPermitted('approved')).toBe(true);
    expect(isServerExecutionPermitted('connected')).toBe(true);
    expect(isServerExecutionPermitted('monitored')).toBe(true);
  });

  it('validates McpServerRegistration entity with Zod v4', () => {
    const valid = {
      serverId: 'srv_weather_api',
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      serverUrl: 'https://mcp.weather-vendor.com/v1',
      transportType: 'http',
      status: 'approved',
      allowedDomains: ['sales'],
      allowedTools: ['sales.weather.forecast'],
      provenance: {
        vendor: 'WeatherCorp LLC',
        repository: 'https://github.com/weathercorp/mcp-server',
        integrityHash: 'a'.repeat(64),
      },
      healthStatus: 'healthy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = McpServerRegistrationSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});

describe('ServerAllowlistService & SSRF Egress Defense (Phase 5 Milestone 3 Task 4)', () => {
  const tenant = {
    organizationId: 'org_enterprise_1',
    workspaceId: 'ws_prod_1',
  };
  const otherTenant = {
    organizationId: 'org_enterprise_2',
    workspaceId: 'ws_prod_2',
  };

  let eventBus: EventBus;
  let service: ServerAllowlistService;
  const emittedEvents: DomainEvent[] = [];

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
    emittedEvents.length = 0;
    eventBus = createEventBus();
    eventBus.subscribe('*', (e) => {
      emittedEvents.push(e);
    });

    const testUrlValidator = async (url: string): Promise<string> => {
      const res = validateExternalUrl(url);
      if (!res.isValid || !res.sanitizedUrl) {
        throw new Error(res.error || 'Invalid or forbidden egress URL');
      }
      return res.sanitizedUrl;
    };

    service = new ServerAllowlistService({
      store: createMemoryAllowlistStore(),
      eventBus,
      urlValidator: testUrlValidator,
    });
  });

  it('registers an external server with valid public HTTPS URL', async () => {
    const server = await service.registerServer(
      {
        serverId: 'srv_external_crm',
        serverUrl: 'https://api.crm-partner.com/mcp',
        transportType: 'http',
        allowedDomains: ['crm'],
        allowedTools: ['crm.partner.sync'],
      },
      tenant,
      'admin_user_1'
    );

    expect(server.serverId).toBe('srv_external_crm');
    expect(server.status).toBe('discovered');
    expect(server.organizationId).toBe(tenant.organizationId);

    const stored = await service.getServer('srv_external_crm', tenant);
    expect(stored).not.toBeNull();
    expect(stored?.serverUrl).toBe('https://api.crm-partner.com/mcp');
  });

  it('strictly blocks SSRF attempts to GCP metadata server and private IPs (Rule 34)', async () => {
    // 1. GCP Metadata Server
    await expect(
      service.registerServer(
        {
          serverId: 'srv_malicious_metadata',
          serverUrl: 'http://169.254.169.254/computeMetadata/v1/',
          transportType: 'http',
          allowedDomains: ['system'],
          allowedTools: ['*'],
        },
        tenant,
        'attacker'
      )
    ).rejects.toThrow(ALLOWLIST_ERROR_CODES.SSRF_EGRESS_BLOCKED);

    // 2. Localhost
    await expect(
      service.registerServer(
        {
          serverId: 'srv_malicious_localhost',
          serverUrl: 'http://localhost:8080/mcp',
          transportType: 'http',
          allowedDomains: ['system'],
          allowedTools: ['*'],
        },
        tenant,
        'attacker'
      )
    ).rejects.toThrow(ALLOWLIST_ERROR_CODES.SSRF_EGRESS_BLOCKED);

    // 3. RFC-1918 Private IP
    await expect(
      service.registerServer(
        {
          serverId: 'srv_malicious_private_ip',
          serverUrl: 'http://10.0.0.1:8080/mcp',
          transportType: 'http',
          allowedDomains: ['system'],
          allowedTools: ['*'],
        },
        tenant,
        'attacker'
      )
    ).rejects.toThrow(ALLOWLIST_ERROR_CODES.SSRF_EGRESS_BLOCKED);
  });

  it('enforces lifecycle state transitions with audit events (Rule 15 & Rule 40)', async () => {
    await service.registerServer(
      {
        serverId: 'srv_analytics_hub',
        serverUrl: 'https://hub.analytics-vendor.com/mcp',
        transportType: 'http',
        allowedDomains: ['sales'],
        allowedTools: ['sales.analytics.report'],
      },
      tenant,
      'admin_user_1'
    );

    // Transition: discovered -> reviewed
    const reviewed = await service.transitionStatus(
      'srv_analytics_hub',
      'reviewed',
      tenant,
      'security_officer_1',
      'Security review completed: no suspicious capabilities.'
    );
    expect(reviewed.status).toBe('reviewed');
    expect(reviewed.reviewedBy).toBe('security_officer_1');

    // Transition: reviewed -> tested
    await service.transitionStatus('srv_analytics_hub', 'tested', tenant, 'qa_engineer_1');

    // Transition: tested -> approved
    const approved = await service.transitionStatus('srv_analytics_hub', 'approved', tenant, 'ciso_1');
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('ciso_1');

    // Verify status changed event was emitted to EventBus
    const statusEvents = emittedEvents.filter((e) => e.type === 'mcp.security.server_status_changed');
    expect(statusEvents.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects invalid lifecycle transition jumps', async () => {
    await service.registerServer(
      {
        serverId: 'srv_untested',
        serverUrl: 'https://mcp.untested.com/v1',
        transportType: 'http',
        allowedDomains: ['sales'],
        allowedTools: ['sales.tool'],
      },
      tenant,
      'admin_user_1'
    );

    // Attempt direct transition from discovered to connected without review/test/approval
    await expect(
      service.transitionStatus('srv_untested', 'connected', tenant, 'admin_user_1')
    ).rejects.toThrow(ALLOWLIST_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION);
  });

  it('assertServerAllowed permits execution only when server is approved/connected/monitored', async () => {
    const server = await service.registerServer(
      {
        serverId: 'srv_payment_gateway',
        serverUrl: 'https://api.gateway.com/mcp',
        transportType: 'http',
        allowedDomains: ['sales'],
        allowedTools: ['sales.charge'],
      },
      tenant,
      'admin_user_1'
    );

    // Initially discovered -> should be blocked
    await expect(service.assertServerAllowed(server.serverId, tenant)).rejects.toThrow(
      ALLOWLIST_ERROR_CODES.MCP_SERVER_NOT_ALLOWED
    );

    // Advance to connected
    await service.transitionStatus(server.serverId, 'reviewed', tenant, 'admin');
    await service.transitionStatus(server.serverId, 'tested', tenant, 'admin');
    await service.transitionStatus(server.serverId, 'approved', tenant, 'admin');
    await service.transitionStatus(server.serverId, 'connected', tenant, 'admin');

    // Connected -> allowed
    const allowed = await service.assertServerAllowed(server.serverId, tenant);
    expect(allowed.status).toBe('connected');

    // Suspend server
    await service.transitionStatus(server.serverId, 'suspended', tenant, 'admin');
    await expect(service.assertServerAllowed(server.serverId, tenant)).rejects.toThrow(
      ALLOWLIST_ERROR_CODES.MCP_SERVER_NOT_ALLOWED
    );
  });

  it('fails closed when Rule 60 emergency dead-man switch is tripped', async () => {
    const server = await service.registerServer(
      {
        serverId: 'srv_partner_api',
        serverUrl: 'https://partner.api.com/mcp',
        transportType: 'http',
        allowedDomains: ['portals'],
        allowedTools: ['portals.sync'],
      },
      tenant,
      'admin_user_1'
    );

    await service.transitionStatus(server.serverId, 'reviewed', tenant, 'admin');
    await service.transitionStatus(server.serverId, 'tested', tenant, 'admin');
    await service.transitionStatus(server.serverId, 'approved', tenant, 'admin');
    await service.transitionStatus(server.serverId, 'connected', tenant, 'admin');

    // Trip emergency dead man switch
    setGovernanceDeadManStateForTests(true);

    await expect(service.assertServerAllowed(server.serverId, tenant)).rejects.toThrow(
      'MCP_EXECUTION_PAUSED'
    );
  });

  it('enforces multi-tenant isolation: Tenant B cannot execute Tenant A server (Rule 8, 50)', async () => {
    const server = await service.registerServer(
      {
        serverId: 'srv_tenant_a_tool',
        serverUrl: 'https://api.vendor.com/mcp',
        transportType: 'http',
        allowedDomains: ['sales'],
        allowedTools: ['sales.tool'],
      },
      tenant,
      'admin_user_1'
    );

    await service.transitionStatus(server.serverId, 'reviewed', tenant, 'admin');
    await service.transitionStatus(server.serverId, 'tested', tenant, 'admin');
    await service.transitionStatus(server.serverId, 'approved', tenant, 'admin');
    await service.transitionStatus(server.serverId, 'connected', tenant, 'admin');

    // Tenant B attempts to access Tenant A's server
    await expect(service.assertServerAllowed(server.serverId, otherTenant)).rejects.toThrow(
      ALLOWLIST_ERROR_CODES.MCP_SERVER_NOT_FOUND
    );
  });
});
