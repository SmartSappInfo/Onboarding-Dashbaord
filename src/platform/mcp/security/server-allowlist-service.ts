/**
 * @fileOverview Server Allowlist & Supply-Chain Security Service (Phase 5 Milestone 3 Task 4)
 *
 * Implements Rule 15 (Server Allowlisting & Supply-Chain Controls), Rule 4 (Zero any/any[]),
 * Rule 8 & 50 (Tenant Isolation), Rule 10 (Inline Architectural Docs), Rule 18 (Concurrency),
 * Rule 19 (Mutating Idempotency), Rule 24 (Circuit Breaker & Fallback), Rule 34 (SSRF Defense),
 * Rule 40 (Append-Only Audit Logging via EventBus), and Rule 60 (Emergency Dead-Man Controls).
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. SSRF Defense on Ingress & Registration:
 *    Every registered or invoked server URL passes `validateSafeEgressUrl`, blocking loopback,
 *    GCP metadata server (169.254.169.254), and private RFC-1918 networks.
 * 2. Execution Authorization:
 *    `assertServerAllowed` permits invocation ONLY when status is `approved`, `connected`, or `monitored`.
 * 3. Dead-Man Integration (Rule 60):
 *    If the emergency dead-man pause switch is active, all external server execution immediately
 *    fails closed with `MCP_EXECUTION_PAUSED`.
 * 4. Multi-Tenant Scope:
 *    All server registrations are isolated by `organizationId` and `workspaceId`.
 */

import { validateSafeEgressUrl } from '../../security/safe-url-fetch';
import {
  safeFetchWithDnsPinning,
  type SafeFetchPinnedOptions,
} from './safe-dns-pinning';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '../../policy/governance-dead-man';
import { defaultEventBus, type EventBus } from '../../events/event-bus';
import { createDomainEvent } from '../../capabilities/events/domain-event';
import {
  ALLOWLIST_ERROR_CODES,
  isServerExecutionPermitted,
  isValidLifecycleTransition,
  McpServerRegistrationSchema,
  type CreateServerRegistrationInput,
  type McpServerRegistration,
  type McpServerStatus,
} from './server-allowlist-types';
import type { TenantContext } from './tool-fingerprint-types';

export interface ServerAllowlistStore {
  get(organizationId: string, workspaceId: string, serverId: string): Promise<McpServerRegistration | null>;
  set(server: McpServerRegistration): Promise<void>;
  list(organizationId: string, workspaceId: string): Promise<McpServerRegistration[]>;
  delete(organizationId: string, workspaceId: string, serverId: string): Promise<void>;
}

export function buildServerAllowlistStoreKey(
  organizationId: string,
  workspaceId: string,
  serverId: string
): string {
  return `${organizationId}:${workspaceId}:${serverId}`;
}

export function createMemoryAllowlistStore(): ServerAllowlistStore {
  const store = new Map<string, McpServerRegistration>();

  return {
    async get(organizationId, workspaceId, serverId) {
      const key = buildServerAllowlistStoreKey(organizationId, workspaceId, serverId);
      const item = store.get(key);
      return item ? { ...item } : null;
    },
    async set(server) {
      const key = buildServerAllowlistStoreKey(
        server.organizationId,
        server.workspaceId,
        server.serverId
      );
      store.set(key, { ...server });
    },
    async list(organizationId, workspaceId) {
      const prefix = `${organizationId}:${workspaceId}:`;
      const results: McpServerRegistration[] = [];
      for (const [key, value] of store.entries()) {
        if (key.startsWith(prefix)) {
          results.push({ ...value });
        }
      }
      return results;
    },
    async delete(organizationId, workspaceId, serverId) {
      const key = buildServerAllowlistStoreKey(organizationId, workspaceId, serverId);
      store.delete(key);
    },
  };
}

export interface ServerAllowlistServiceOptions {
  store?: ServerAllowlistStore;
  eventBus?: EventBus;
  urlValidator?: (url: string) => Promise<string> | string;
}

export class ServerAllowlistService {
  private readonly store: ServerAllowlistStore;
  private readonly eventBus: EventBus;
  private readonly urlValidator: (url: string) => Promise<string> | string;

  constructor(options: ServerAllowlistServiceOptions = {}) {
    this.store = options.store || getGlobalServerAllowlistStore();
    this.eventBus = options.eventBus || defaultEventBus;
    this.urlValidator = options.urlValidator || validateSafeEgressUrl;
  }

  /**
   * Registers an external MCP server into the allowlist in the initial `discovered` state.
   * Strictly validates URL safety against SSRF attacks (Rule 34).
   */
  public async registerServer(
    input: CreateServerRegistrationInput,
    tenant: TenantContext,
    creatorId: string
  ): Promise<McpServerRegistration> {
    // 1. Enforce universal SSRF guard (Rule 34)
    let sanitizedUrl: string;
    try {
      sanitizedUrl = await this.urlValidator(input.serverUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const error = new Error(
        `[ServerAllowlistService] ${ALLOWLIST_ERROR_CODES.SSRF_EGRESS_BLOCKED}: ${msg}`
      );
      error.name = ALLOWLIST_ERROR_CODES.SSRF_EGRESS_BLOCKED;
      throw error;
    }

    const existing = await this.store.get(
      tenant.organizationId,
      tenant.workspaceId,
      input.serverId
    );
    if (existing) {
      const error = new Error(
        `[ServerAllowlistService] ${ALLOWLIST_ERROR_CODES.MCP_SERVER_ALREADY_EXISTS}: Server ${input.serverId} already registered for workspace ${tenant.workspaceId}`
      );
      error.name = ALLOWLIST_ERROR_CODES.MCP_SERVER_ALREADY_EXISTS;
      throw error;
    }

    const now = new Date().toISOString();
    const server: McpServerRegistration = McpServerRegistrationSchema.parse({
      serverId: input.serverId,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      serverUrl: sanitizedUrl,
      transportType: input.transportType || 'http',
      status: 'discovered',
      pinnedVersion: input.pinnedVersion,
      allowedDomains: input.allowedDomains || [],
      allowedTools: input.allowedTools || [],
      provenance: input.provenance,
      healthStatus: 'healthy',
      createdAt: now,
      updatedAt: now,
    });

    await this.store.set(server);

    // Audit event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'mcp.security.server_registered',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        actor: { type: 'user', id: creatorId },
        entity: { type: 'mcp_server', id: server.serverId },
        correlationId: crypto.randomUUID(),
        source: 'mcp.server_allowlist_service',
        payload: {
          serverId: server.serverId,
          serverUrl: server.serverUrl,
          status: server.status,
        },
      })
    );

    return server;
  }

  /**
   * Advances or transitions the lifecycle state of an external MCP server (Rule 15).
   */
  public async transitionStatus(
    serverId: string,
    nextStatus: McpServerStatus,
    tenant: TenantContext,
    actorId: string,
    notes?: string
  ): Promise<McpServerRegistration> {
    const server = await this.store.get(
      tenant.organizationId,
      tenant.workspaceId,
      serverId
    );

    if (!server) {
      const error = new Error(
        `[ServerAllowlistService] ${ALLOWLIST_ERROR_CODES.MCP_SERVER_NOT_FOUND}: Server ${serverId} not found for workspace ${tenant.workspaceId}`
      );
      error.name = ALLOWLIST_ERROR_CODES.MCP_SERVER_NOT_FOUND;
      throw error;
    }

    if (!isValidLifecycleTransition(server.status, nextStatus)) {
      const error = new Error(
        `[ServerAllowlistService] ${ALLOWLIST_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION}: Cannot transition server from '${server.status}' to '${nextStatus}'`
      );
      error.name = ALLOWLIST_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION;
      throw error;
    }

    const now = new Date().toISOString();
    const updated: McpServerRegistration = {
      ...server,
      status: nextStatus,
      updatedAt: now,
      reviewNotes: notes || server.reviewNotes,
    };

    if (nextStatus === 'reviewed') {
      updated.reviewedBy = actorId;
      updated.reviewedAt = now;
    } else if (nextStatus === 'approved') {
      updated.approvedBy = actorId;
      updated.approvedAt = now;
    }

    await this.store.set(updated);

    // Audit event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'mcp.security.server_status_changed',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        actor: { type: 'user', id: actorId },
        entity: { type: 'mcp_server', id: server.serverId },
        correlationId: crypto.randomUUID(),
        source: 'mcp.server_allowlist_service',
        payload: {
          serverId: server.serverId,
          previousStatus: server.status,
          newStatus: nextStatus,
          notes,
        },
      })
    );

    return updated;
  }

  /**
   * Execution Gate: Verifies that the server is known, allowed, and not paused under Rule 60.
   */
  public async assertServerAllowed(
    serverId: string,
    tenant: TenantContext
  ): Promise<McpServerRegistration> {
    // 1. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(tenant.organizationId);
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        const error = new Error(
          `[ServerAllowlistService] MCP_EXECUTION_PAUSED: Emergency dead-man switch is active for workspace ${tenant.workspaceId}`
        );
        error.name = 'MCP_EXECUTION_PAUSED';
        throw error;
      }
      throw err;
    }

    const server = await this.store.get(
      tenant.organizationId,
      tenant.workspaceId,
      serverId
    );

    if (!server) {
      const error = new Error(
        `[ServerAllowlistService] ${ALLOWLIST_ERROR_CODES.MCP_SERVER_NOT_FOUND}: Server ${serverId} not found for workspace ${tenant.workspaceId}`
      );
      error.name = ALLOWLIST_ERROR_CODES.MCP_SERVER_NOT_FOUND;
      throw error;
    }

    if (!isServerExecutionPermitted(server.status)) {
      const error = new Error(
        `[ServerAllowlistService] ${ALLOWLIST_ERROR_CODES.MCP_SERVER_NOT_ALLOWED}: Server ${serverId} has status '${server.status}' and cannot execute tools`
      );
      error.name = ALLOWLIST_ERROR_CODES.MCP_SERVER_NOT_ALLOWED;
      throw error;
    }

    return server;
  }

  public async getServer(
    serverId: string,
    tenant: TenantContext
  ): Promise<McpServerRegistration | null> {
    return this.store.get(tenant.organizationId, tenant.workspaceId, serverId);
  }

  public async listServers(tenant: TenantContext): Promise<McpServerRegistration[]> {
    return this.store.list(tenant.organizationId, tenant.workspaceId);
  }

  /**
   * Dispatches a safe outbound HTTP/SSE request to an approved external MCP server using
   * socket-level DNS pinning to permanently eliminate TOCTOU DNS rebinding (Milestone 3 Rec #2).
   */
  public async fetchServer(
    serverId: string,
    tenant: TenantContext,
    path = '',
    options?: SafeFetchPinnedOptions
  ): Promise<Response> {
    const server = await this.assertServerAllowed(serverId, tenant);
    const baseUrl = server.serverUrl.replace(/\/$/, '');
    const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
    const fullUrl = `${baseUrl}${cleanPath}`;
    return safeFetchWithDnsPinning(fullUrl, options);
  }
}

// Global singletons with HMR safety
declare global {
  var __smartsappAllowlistService: ServerAllowlistService | undefined;
  var __smartsappAllowlistStore: ServerAllowlistStore | undefined;
}

export function getGlobalServerAllowlistStore(): ServerAllowlistStore {
  if (!globalThis.__smartsappAllowlistStore) {
    globalThis.__smartsappAllowlistStore = createMemoryAllowlistStore();
  }
  return globalThis.__smartsappAllowlistStore;
}

export function getServerAllowlistService(options?: ServerAllowlistServiceOptions): ServerAllowlistService {
  if (options) {
    return new ServerAllowlistService(options);
  }

  if (!globalThis.__smartsappAllowlistService) {
    globalThis.__smartsappAllowlistService = new ServerAllowlistService();
  }

  return globalThis.__smartsappAllowlistService;
}

export const createServerAllowlistService = (options?: ServerAllowlistServiceOptions): ServerAllowlistService =>
  new ServerAllowlistService(options);

export const createMemoryServerAllowlistStore = createMemoryAllowlistStore;

export const globalServerAllowlistService = getServerAllowlistService();
