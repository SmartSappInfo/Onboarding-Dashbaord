/**
 * @fileOverview Cryptographic Tool Definition Drift & Rug-Pull Monitor (Phase 15 Milestone 3)
 *
 * Implements Rules 1, 4, 8, 14, 16, 17, 19, 22, 40, 48, 60, 67, 68, 69, 1974.
 * Tracks 8-dimension SHA-256 tool fingerprints, detects definition drift / rug-pulls,
 * immediately locks execution on drift, and requires strictly non-delegable human approval.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';
import {
  ToolFingerprintRecord,
  ToolFingerprintStatus,
  SecurityDomainError,
} from '@/platform/security/contracts/security-types';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';

export interface ToolDefinitionInput {
  toolId: string;
  serverId: string;
  serverVersion: string;
  toolVersion: string;
  inputSchema: unknown;
  description: string;
  permissions: readonly string[];
  risk: unknown;
}

export interface RegisterBaselineInput extends ToolDefinitionInput {
  approvedBy: string;
  organizationId: string;
  workspaceId?: string;
}

export interface ToolFingerprintHashes {
  compositeFingerprint: string;
  schemaHash: string;
  descriptionHash: string;
  permissionHash: string;
  riskHash: string;
}

export interface ToolVerificationResult {
  toolId: string;
  status: ToolFingerprintStatus;
  hasDrift: boolean;
  isExecutionPermitted: boolean;
  record: ToolFingerprintRecord;
  driftDetails?: {
    schemaChanged: boolean;
    descriptionChanged: boolean;
    permissionChanged: boolean;
    riskChanged: boolean;
    versionChanged: boolean;
  };
}

export interface ApproveFingerprintInput {
  toolId: string;
  definition: ToolDefinitionInput;
  actor: { type: string; id: string };
  organizationId: string;
  workspaceId?: string;
}

export class ToolDriftMonitor {
  private readonly baselines: Map<string, ToolFingerprintRecord> = new Map();

  private getBaselineKey(organizationId: string, toolId: string): string {
    return `${organizationId}:${toolId}`;
  }

  /**
   * Computes deterministic SHA-256 hashes across all 8 dimensions of a tool definition (Rule 22 & 1974).
   */
  public computeFingerprint(params: ToolDefinitionInput): ToolFingerprintHashes {
    const schemaHash = sha256Hex(params.inputSchema);
    const descriptionHash = sha256Hex(params.description.trim().replace(/\s+/g, ' '));
    const permissionHash = sha256Hex([...params.permissions].sort());
    const riskHash = sha256Hex(params.risk);

    const compositePayload = {
      toolId: params.toolId,
      serverId: params.serverId,
      serverVersion: params.serverVersion,
      toolVersion: params.toolVersion,
      schemaHash,
      descriptionHash,
      permissionHash,
      riskHash,
    };

    const compositeFingerprint = sha256Hex(compositePayload);

    return {
      compositeFingerprint,
      schemaHash,
      descriptionHash,
      permissionHash,
      riskHash,
    };
  }

  /**
   * Registers or updates an approved baseline fingerprint for a tool.
   */
  public registerApprovedBaseline(params: RegisterBaselineInput): ToolFingerprintRecord {
    const hashes = this.computeFingerprint(params);

    const record: ToolFingerprintRecord = {
      toolId: params.toolId,
      serverId: params.serverId,
      serverVersion: params.serverVersion,
      toolVersion: params.toolVersion,
      schemaHash: hashes.schemaHash,
      descriptionHash: hashes.descriptionHash,
      permissionHash: hashes.permissionHash,
      riskHash: hashes.riskHash,
      compositeFingerprint: hashes.compositeFingerprint,
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedBy: params.approvedBy,
      approvedByUserId: params.approvedBy,
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
    };

    const key = this.getBaselineKey(params.organizationId, params.toolId);
    this.baselines.set(key, record);
    return record;
  }

  /**
   * Verifies live tool definition against approved baseline snapshot.
   */
  public async verifyToolFingerprint(
    toolId: string,
    liveParams: ToolDefinitionInput,
    tenant: { organizationId: string; workspaceId?: string }
  ): Promise<ToolVerificationResult> {
    const key = this.getBaselineKey(tenant.organizationId, toolId);
    const baseline = this.baselines.get(key);

    if (!baseline) {
      throw new SecurityDomainError(
        'SECURITY_TOOL_DRIFT_DETECTED',
        `No approved baseline found for tool '${toolId}' in organization '${tenant.organizationId}'`,
        404
      );
    }

    if (baseline.status === 'REVOKED') {
      return {
        toolId,
        status: 'REVOKED',
        hasDrift: true,
        isExecutionPermitted: false,
        record: baseline,
      };
    }

    const liveHashes = this.computeFingerprint(liveParams);
    const hasDrift = liveHashes.compositeFingerprint !== baseline.compositeFingerprint;

    if (!hasDrift) {
      return {
        toolId,
        status: baseline.status,
        hasDrift: false,
        isExecutionPermitted: baseline.status === 'APPROVED',
        record: baseline,
      };
    }

    // Drift detected! Determine severity and lock if material change
    const schemaChanged = liveHashes.schemaHash !== baseline.schemaHash;
    const descriptionChanged = liveHashes.descriptionHash !== baseline.descriptionHash;
    const permissionChanged = liveHashes.permissionHash !== baseline.permissionHash;
    const riskChanged = liveHashes.riskHash !== baseline.riskHash;
    const versionChanged =
      liveParams.toolVersion !== baseline.toolVersion ||
      liveParams.serverVersion !== baseline.serverVersion;

    const isMaterialDrift = schemaChanged || permissionChanged || riskChanged;
    const updatedStatus: ToolFingerprintStatus = isMaterialDrift ? 'LOCKED' : 'DRIFTED';

    const updatedRecord: ToolFingerprintRecord = {
      ...baseline,
      status: updatedStatus,
    };
    this.baselines.set(key, updatedRecord);

    // Emit security drift domain event (Rule 40)
    await defaultEventBus.publish(
      createDomainEvent({
        type: 'security.drift.detected',
        source: 'ToolDriftMonitor',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        actor: { type: 'system', id: 'tool_drift_monitor' },
        entity: { type: 'tool', id: toolId },
        correlationId: crypto.randomUUID(),
        payload: {
          toolId,
          status: updatedStatus,
          isMaterialDrift,
          schemaChanged,
          descriptionChanged,
          permissionChanged,
          riskChanged,
          versionChanged,
          approvedComposite: baseline.compositeFingerprint,
          liveComposite: liveHashes.compositeFingerprint,
        },
      })
    );

    return {
      toolId,
      status: updatedStatus,
      hasDrift: true,
      isExecutionPermitted: false,
      record: updatedRecord,
      driftDetails: {
        schemaChanged,
        descriptionChanged,
        permissionChanged,
        riskChanged,
        versionChanged,
      },
    };
  }

  /**
   * Asserts that live tool execution is permitted, throwing if drifted or locked.
   */
  public async assertExecutionPermitted(
    toolId: string,
    liveParams: ToolDefinitionInput,
    tenant: { organizationId: string; workspaceId?: string }
  ): Promise<void> {
    const result = await this.verifyToolFingerprint(toolId, liveParams, tenant);
    if (!result.isExecutionPermitted) {
      throw new SecurityDomainError(
        'SECURITY_TOOL_DRIFT_DETECTED',
        `Tool '${toolId}' execution blocked: definition has drifted or is locked (Status: ${result.status})`,
        409
      );
    }
  }

  /**
   * Approves a new tool baseline. Strictly non-delegable: only human users allowed (Rule 17).
   */
  public async approveToolFingerprint(
    params: ApproveFingerprintInput
  ): Promise<ToolFingerprintRecord> {
    // Rule 17 Non-Delegable Guard
    if (params.actor.type !== 'user') {
      throw new SecurityDomainError(
        'SECURITY_UNAUTHORIZED_APPROVAL',
        `Agent or automated actor '${params.actor.id}' cannot approve tool fingerprint. Only authenticated human administrators can re-approve tool baselines.`,
        403
      );
    }

    const hashes = this.computeFingerprint(params.definition);
    const key = this.getBaselineKey(params.organizationId, params.toolId);

    const record: ToolFingerprintRecord = {
      toolId: params.toolId,
      serverId: params.definition.serverId,
      serverVersion: params.definition.serverVersion,
      toolVersion: params.definition.toolVersion,
      schemaHash: hashes.schemaHash,
      descriptionHash: hashes.descriptionHash,
      permissionHash: hashes.permissionHash,
      riskHash: hashes.riskHash,
      compositeFingerprint: hashes.compositeFingerprint,
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedBy: params.actor.id,
      approvedByUserId: params.actor.id,
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
    };

    this.baselines.set(key, record);

    await defaultEventBus.publish(
      createDomainEvent({
        type: 'security.tool.approved',
        source: 'ToolDriftMonitor',
        organizationId: params.organizationId,
        workspaceId: params.workspaceId,
        actor: { type: 'user', id: params.actor.id },
        entity: { type: 'tool', id: params.toolId },
        correlationId: crypto.randomUUID(),
        payload: {
          toolId: params.toolId,
          approvedFingerprint: hashes.compositeFingerprint,
          approvedBy: params.actor.id,
        },
      })
    );

    return record;
  }

  /**
   * Revokes an existing tool baseline, blocking execution (Rule 27 Rollback).
   */
  public async revokeToolFingerprint(
    toolId: string,
    actor: { type: string; id: string },
    organizationId: string,
    workspaceId?: string
  ): Promise<ToolFingerprintRecord> {
    const key = this.getBaselineKey(organizationId, toolId);
    const existing = this.baselines.get(key);

    if (!existing) {
      throw new SecurityDomainError(
        'SECURITY_TOOL_DRIFT_DETECTED',
        `Cannot revoke non-existent tool baseline for '${toolId}'`,
        404
      );
    }

    const revokedRecord: ToolFingerprintRecord = {
      ...existing,
      status: 'REVOKED',
    };
    this.baselines.set(key, revokedRecord);

    await defaultEventBus.publish(
      createDomainEvent({
        type: 'security.tool.revoked',
        source: 'ToolDriftMonitor',
        organizationId,
        workspaceId,
        actor: { type: actor.type as 'user' | 'system', id: actor.id },
        entity: { type: 'tool', id: toolId },
        correlationId: crypto.randomUUID(),
        payload: {
          toolId,
          revokedBy: actor.id,
        },
      })
    );

    return revokedRecord;
  }
}

// Global singleton preservation (Rule 69)
declare global {
  var __smartsappToolDriftMonitor: ToolDriftMonitor | undefined;
}

export function getToolDriftMonitor(): ToolDriftMonitor {
  if (!globalThis.__smartsappToolDriftMonitor) {
    globalThis.__smartsappToolDriftMonitor = new ToolDriftMonitor();
  }
  return globalThis.__smartsappToolDriftMonitor;
}
