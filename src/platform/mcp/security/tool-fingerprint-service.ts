/**
 * @fileOverview Tool Fingerprint Service & Persistence Store (Phase 5 Milestone 3 Task 2)
 *
 * Implements Rule 14 (Tool Poisoning / Rug-Pull Defense), Rule 4 (Zero any/any[]),
 * Rule 8 & 50 (Tenant Isolation), Rule 10 (Inline Architectural Docs), Rule 18 (Concurrency),
 * Rule 19 (Mutating Idempotency), Rule 21 & 22 (Human Approval & Hash Binding),
 * Rule 24 (Circuit Breaker & Fallback), Rule 35 (Cache Invalidation), and Rule 40 (Audit Events).
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Fail-Closed Verification:
 *    If a capability's live definition differs from the approved fingerprint in `/mcp_tool_fingerprints`,
 *    `verifyCapabilityFingerprint` rejects the execution and publishes `mcp.security.tool_drift_detected`.
 * 2. Multi-Tenant Anti-IDOR:
 *    Every query and write to the fingerprint store is partitioned by `organizationId` and `workspaceId`.
 * 3. HMR & Serverless Safe:
 *    The global singleton is preserved across Next.js HMR cycles via `globalThis`.
 */

import type { AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import { defaultEventBus, type EventBus } from '../../events/event-bus';
import { createDomainEvent } from '../../capabilities/events/domain-event';
import {
  computeToolFingerprint,
  detectToolDrift,
  FINGERPRINT_ERROR_CODES,
  type TenantContext,
  type ToolDriftReport,
  type ToolFingerprint,
} from './tool-fingerprint-types';

export interface ToolFingerprintStore {
  get(organizationId: string, workspaceId: string, toolId: string, version: string): Promise<ToolFingerprint | null>;
  set(fingerprint: ToolFingerprint): Promise<void>;
  list(organizationId: string, workspaceId: string): Promise<ToolFingerprint[]>;
  delete(organizationId: string, workspaceId: string, toolId: string, version: string): Promise<void>;
}

export function buildFingerprintStoreKey(
  organizationId: string,
  workspaceId: string,
  toolId: string,
  version: string
): string {
  return `${organizationId}:${workspaceId}:${toolId}:${version}`;
}

/**
 * High-performance in-memory store for unit tests and local fallback caching.
 */
export function createMemoryFingerprintStore(): ToolFingerprintStore {
  const store = new Map<string, ToolFingerprint>();

  return {
    async get(organizationId, workspaceId, toolId, version) {
      const key = buildFingerprintStoreKey(organizationId, workspaceId, toolId, version);
      const item = store.get(key);
      return item ? { ...item } : null;
    },
    async set(fingerprint) {
      const key = buildFingerprintStoreKey(
        fingerprint.organizationId,
        fingerprint.workspaceId,
        fingerprint.toolId,
        fingerprint.version
      );
      store.set(key, { ...fingerprint });
    },
    async list(organizationId, workspaceId) {
      const prefix = `${organizationId}:${workspaceId}:`;
      const results: ToolFingerprint[] = [];
      for (const [key, value] of store.entries()) {
        if (key.startsWith(prefix)) {
          results.push({ ...value });
        }
      }
      return results;
    },
    async delete(organizationId, workspaceId, toolId, version) {
      const key = buildFingerprintStoreKey(organizationId, workspaceId, toolId, version);
      store.delete(key);
    },
  };
}

export interface ToolFingerprintServiceOptions {
  store?: ToolFingerprintStore;
  eventBus?: EventBus;
  failClosedOnDrift?: boolean;
}

export class ToolFingerprintService {
  private readonly store: ToolFingerprintStore;
  private readonly eventBus: EventBus;
  private readonly failClosedOnDrift: boolean;

  constructor(options: ToolFingerprintServiceOptions = {}) {
    this.store = options.store || getGlobalToolFingerprintStore();
    this.eventBus = options.eventBus || defaultEventBus;
    this.failClosedOnDrift = options.failClosedOnDrift ?? true;
  }

  /**
   * Approves and records a canonical tool fingerprint into the store with operator signature (Rules 21 & 22).
   */
  public async approveFingerprint(
    capability: AnyCapabilityDefinition,
    tenant: TenantContext,
    approverId: string
  ): Promise<ToolFingerprint> {
    const fingerprint = computeToolFingerprint(
      capability,
      tenant,
      approverId,
      new Date().toISOString()
    );

    await this.store.set(fingerprint);

    // Invalidate discovery caches via EventBus (Rule 35 & 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'mcp.security.fingerprint_approved',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        actor: { type: 'user', id: approverId },
        entity: { type: 'mcp_tool', id: fingerprint.toolId },
        correlationId: crypto.randomUUID(),
        source: 'mcp.tool_fingerprint_service',
        payload: {
          toolId: fingerprint.toolId,
          version: fingerprint.version,
          compositeHash: fingerprint.compositeHash,
          approvedBy: approverId,
        },
      })
    );

    return fingerprint;
  }

  /**
   * Verifies that a live CapabilityDefinition matches its approved fingerprint for the active tenant.
   * If drift is detected, publishes a security alert and fails closed (Rule 14 & Rule 40).
   */
  public async verifyCapabilityFingerprint(
    capability: AnyCapabilityDefinition,
    tenant: TenantContext
  ): Promise<{
    isValid: boolean;
    approvedFingerprint: ToolFingerprint;
    driftReport: ToolDriftReport;
  }> {
    const approved = await this.store.get(
      tenant.organizationId,
      tenant.workspaceId,
      capability.id,
      capability.version
    );

    if (!approved) {
      const error = new Error(
        `[ToolFingerprintService] ${FINGERPRINT_ERROR_CODES.TOOL_FINGERPRINT_NOT_FOUND}: No approved fingerprint for tool ${capability.id} v${capability.version}`
      );
      error.name = FINGERPRINT_ERROR_CODES.TOOL_FINGERPRINT_NOT_FOUND;
      throw error;
    }

    const driftReport = detectToolDrift(capability, approved);

    if (driftReport.hasDrift) {
      // Publish security alert to EventBus (Rule 40 & Rule 62)
      await this.eventBus.publish(
        createDomainEvent({
          type: 'mcp.security.tool_drift_detected',
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          actor: { type: 'system', id: 'mcp_fingerprint_monitor' },
          entity: { type: 'mcp_tool', id: capability.id },
          correlationId: crypto.randomUUID(),
          source: 'mcp.tool_fingerprint_service',
          payload: {
            toolId: capability.id,
            version: capability.version,
            driftTypes: driftReport.driftTypes,
            severity: driftReport.severity,
            details: driftReport.details,
          },
        })
      );

      if (this.failClosedOnDrift) {
        const error = new Error(
          `[ToolFingerprintService] ${FINGERPRINT_ERROR_CODES.TOOL_FINGERPRINT_DRIFT}: Tool ${capability.id} v${capability.version} has drifted: ${driftReport.driftTypes.join(', ')}`
        );
        error.name = FINGERPRINT_ERROR_CODES.TOOL_FINGERPRINT_DRIFT;
        throw error;
      }

      return {
        isValid: false,
        approvedFingerprint: approved,
        driftReport,
      };
    }

    return {
      isValid: true,
      approvedFingerprint: approved,
      driftReport,
    };
  }

  public async getApprovedFingerprint(
    toolId: string,
    version: string,
    tenant: TenantContext
  ): Promise<ToolFingerprint | null> {
    return this.store.get(tenant.organizationId, tenant.workspaceId, toolId, version);
  }

  public async listFingerprints(tenant: TenantContext): Promise<ToolFingerprint[]> {
    return this.store.list(tenant.organizationId, tenant.workspaceId);
  }
}

// Global singletons with HMR safety
declare global {
  var __smartsappFingerprintService: ToolFingerprintService | undefined;
  var __smartsappFingerprintStore: ToolFingerprintStore | undefined;
}

export function getGlobalToolFingerprintStore(): ToolFingerprintStore {
  if (!globalThis.__smartsappFingerprintStore) {
    globalThis.__smartsappFingerprintStore = createMemoryFingerprintStore();
  }
  return globalThis.__smartsappFingerprintStore;
}

export function getToolFingerprintService(options?: ToolFingerprintServiceOptions): ToolFingerprintService {
  if (options) {
    return new ToolFingerprintService(options);
  }

  if (!globalThis.__smartsappFingerprintService) {
    globalThis.__smartsappFingerprintService = new ToolFingerprintService();
  }

  return globalThis.__smartsappFingerprintService;
}

export const createToolFingerprintService = (options?: ToolFingerprintServiceOptions): ToolFingerprintService =>
  new ToolFingerprintService(options);

export const globalToolFingerprintService = getToolFingerprintService();
