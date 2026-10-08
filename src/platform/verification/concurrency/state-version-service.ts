/**
 * @fileOverview State Version & Optimistic Concurrency Engine (Phase 14 Milestone 2)
 *
 * Implements Step 2 (Predict / Snapshot Pre-State) and Step 5 (Commit / Assert Version Unchanged)
 * of the 6-Step Responsible Execution Loop.
 *
 * Enforces:
 * - Rule 4 (Strict Typing): Zero any or any[], strict typed contracts
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock): Strict tenant boundary checks on snapshot & validation
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard): Compares live state with snapshot before mutation
 * - Rule 22 (Cryptographic Hash Binding): Canonical SHA-256 state hashing over key-sorted JSON
 * - Rule 26 (Cooperative Cancellation): Honors AbortSignal across all async operations
 * - Rule 40 (Domain Event Auditing): Emits snapshot and conflict events to defaultEventBus
 * - Rule 60 (Emergency Dead-Man Switch): Evaluates checkGovernanceDeadManSwitch and fails closed
 * - Rule 69 (Strangler Fig Pattern): HMR-safe global singleton preservation
 */

import {
  type ResourceSnapshot,
  type VersionValidationResult,
  type ConcurrencyViolationType,
  ResourceSnapshotSchema,
  StateConcurrencyError,
} from './state-version-types';
import {
  getVersionFieldName,
  isHashValidationRequired,
} from './state-version-matrix';
import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';

// ============================================================================
// PARAMETER CONTRACTS (Rule 4)
// ============================================================================

export interface CaptureSnapshotParams {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceData: Readonly<Record<string, unknown>>;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly actorId?: string;
}

export interface ValidateVersionParams {
  readonly expectedSnapshot: Readonly<ResourceSnapshot>;
  readonly currentResourceData: Readonly<Record<string, unknown>> | null;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly actorId?: string;
}

export interface ConcurrencyServiceOptions {
  readonly signal?: AbortSignal;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class StateVersionService {
  /**
   * Captures an immutable pre-mutation snapshot of a domain resource (Rule 18, Step 2).
   * Calculates a canonical SHA-256 state digest across key-sorted attributes (Rule 22).
   */
  public async captureSnapshot(
    params: CaptureSnapshotParams,
    options?: ConcurrencyServiceOptions
  ): Promise<ResourceSnapshot> {
    // 1. Cooperative Cancellation Check (Rule 26)
    if (options?.signal?.aborted) {
      throw new StateConcurrencyError(
        'CONCURRENCY_TIMEOUT',
        'Snapshot capture was aborted by signal',
        504
      );
    }

    // 2. Validate tenant & resource context (Rules 8 & 47)
    if (
      !params.organizationId ||
      !params.workspaceId ||
      !params.resourceId ||
      !params.resourceType
    ) {
      throw new StateConcurrencyError(
        'INVALID_SNAPSHOT_CONTEXT',
        'Snapshot context requires valid organizationId, workspaceId, resourceId, and resourceType',
        400
      );
    }

    // 3. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(params.organizationId);
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        throw new StateConcurrencyError(
          'CONCURRENCY_DEAD_MAN_PAUSED',
          'Concurrency verification is paused by emergency dead-man control',
          503
        );
      }
      throw err;
    }

    // 4. Resolve version from resource data using registered matrix policy
    const versionField = getVersionFieldName(params.resourceType);
    const rawVersion = params.resourceData[versionField];
    const version =
      typeof rawVersion === 'number' || typeof rawVersion === 'string'
        ? rawVersion
        : 1;

    // 5. Compute canonical SHA-256 state digest over key-sorted JSON (Rule 22)
    const stateHash = sha256Hex(params.resourceData);

    const snapshot: ResourceSnapshot = {
      resourceId: params.resourceId,
      resourceType: params.resourceType,
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
      version,
      stateHash,
      capturedAt: new Date().toISOString(),
      attributes: { ...params.resourceData },
    };

    // 6. Validate canonical snapshot schema
    const validatedSnapshot = ResourceSnapshotSchema.parse(snapshot);

    // 7. Emit domain event (Rule 40)
    try {
      defaultEventBus.publish(
        createDomainEvent({
          type: 'concurrency.snapshot.captured',
          source: 'concurrency_engine',
          correlationId: `snap_${snapshot.resourceType}_${snapshot.resourceId}_${Date.now()}`,
          organizationId: snapshot.organizationId,
          workspaceId: snapshot.workspaceId,
          actor: {
            id: params.actorId ?? 'system',
            type: 'system',
          },
          entity: {
            id: snapshot.resourceId,
            type: snapshot.resourceType,
          },
          payload: {
            version: snapshot.version,
            stateHash: snapshot.stateHash,
            capturedAt: snapshot.capturedAt,
          },
        })
      );
    } catch {
      // Non-blocking domain event publishing
    }

    return validatedSnapshot;
  }

  /**
   * Validates whether live database state conforms to the expected pre-mutation snapshot (Rule 18, Step 5).
   * Identifies STALE_READ, CONCURRENT_MUTATION, DELETED_RESOURCE, and HASH_DRIFT.
   */
  public async validateResourceVersion(
    params: ValidateVersionParams,
    options?: ConcurrencyServiceOptions
  ): Promise<VersionValidationResult> {
    // 1. Cooperative Cancellation Check (Rule 26)
    if (options?.signal?.aborted) {
      throw new StateConcurrencyError(
        'CONCURRENCY_TIMEOUT',
        'Version validation was aborted by signal',
        504
      );
    }

    // 2. Anti-IDOR Multi-Tenant Lock (Rules 8 & 47)
    if (
      params.expectedSnapshot.organizationId !== params.organizationId ||
      params.expectedSnapshot.workspaceId !== params.workspaceId
    ) {
      throw new StateConcurrencyError(
        'IDOR_VIOLATION',
        `Cross-tenant snapshot validation denied: expected ${params.expectedSnapshot.organizationId}/${params.expectedSnapshot.workspaceId}, caller provided ${params.organizationId}/${params.workspaceId}`,
        403
      );
    }

    // 3. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(params.organizationId);
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        throw new StateConcurrencyError(
          'CONCURRENCY_DEAD_MAN_PAUSED',
          'Concurrency verification is paused by emergency dead-man control',
          503
        );
      }
      throw err;
    }

    const nowIso = new Date().toISOString();
    const { expectedSnapshot, currentResourceData } = params;

    // 4. Check for phantom deletion
    if (currentResourceData === null) {
      return {
        isCurrent: false,
        resourceId: expectedSnapshot.resourceId,
        resourceType: expectedSnapshot.resourceType,
        expectedVersion: expectedSnapshot.version,
        actualVersion: null,
        driftDetected: true,
        violationType: 'DELETED_RESOURCE',
        message: `Resource '${expectedSnapshot.resourceId}' (${expectedSnapshot.resourceType}) was deleted after snapshot capture`,
        capturedAt: nowIso,
      };
    }

    // 5. Check version number parity
    const versionField = getVersionFieldName(expectedSnapshot.resourceType);
    const rawActualVersion = currentResourceData[versionField];
    const actualVersion =
      typeof rawActualVersion === 'number' || typeof rawActualVersion === 'string'
        ? rawActualVersion
        : 1;

    if (actualVersion !== expectedSnapshot.version) {
      let violationType: ConcurrencyViolationType = 'CONCURRENT_MUTATION';
      if (
        typeof actualVersion === 'number' &&
        typeof expectedSnapshot.version === 'number' &&
        actualVersion > expectedSnapshot.version
      ) {
        violationType = 'STALE_READ';
      }

      return {
        isCurrent: false,
        resourceId: expectedSnapshot.resourceId,
        resourceType: expectedSnapshot.resourceType,
        expectedVersion: expectedSnapshot.version,
        actualVersion,
        driftDetected: true,
        violationType,
        message: `Version conflict on '${expectedSnapshot.resourceId}': expected version ${expectedSnapshot.version}, live version is ${actualVersion} (${violationType})`,
        capturedAt: nowIso,
      };
    }

    // 6. Cryptographic State Hash Evaluation (Rule 22)
    if (isHashValidationRequired(expectedSnapshot.resourceType)) {
      const currentHash = sha256Hex(currentResourceData);
      if (currentHash !== expectedSnapshot.stateHash) {
        return {
          isCurrent: false,
          resourceId: expectedSnapshot.resourceId,
          resourceType: expectedSnapshot.resourceType,
          expectedVersion: expectedSnapshot.version,
          actualVersion,
          driftDetected: true,
          violationType: 'HASH_DRIFT',
          message: `Cryptographic state hash mismatch for resource '${expectedSnapshot.resourceId}': attributes drifted without version bump`,
          capturedAt: nowIso,
        };
      }
    }

    // 7. Clean parity verified
    return {
      isCurrent: true,
      resourceId: expectedSnapshot.resourceId,
      resourceType: expectedSnapshot.resourceType,
      expectedVersion: expectedSnapshot.version,
      actualVersion,
      driftDetected: false,
      violationType: 'NONE',
      message: `Resource version ${expectedSnapshot.version} and state hash verified current`,
      capturedAt: nowIso,
    };
  }

  /**
   * Asserts that a resource is current before committing writes (Rule 18, Step 5).
   * Throws StateConcurrencyError immediately if any drift or version discrepancy is found.
   */
  public async assertVersionCurrent(
    params: ValidateVersionParams,
    options?: ConcurrencyServiceOptions
  ): Promise<VersionValidationResult> {
    const result = await this.validateResourceVersion(params, options);

    if (!result.isCurrent) {
      // Emit conflict domain event (Rule 40)
      try {
        defaultEventBus.publish(
          createDomainEvent({
            type: 'concurrency.conflict.detected',
            source: 'concurrency_engine',
            correlationId: `conflict_${result.resourceType}_${result.resourceId}_${Date.now()}`,
            organizationId: params.organizationId,
            workspaceId: params.workspaceId,
            actor: {
              id: params.actorId ?? 'system',
              type: 'system',
            },
            entity: {
              id: result.resourceId,
              type: result.resourceType,
            },
            payload: {
              expectedVersion: result.expectedVersion,
              actualVersion: result.actualVersion,
              violationType: result.violationType,
              message: result.message,
            },
          })
        );
      } catch {
        // Non-blocking domain event publishing
      }

      // Map violation to authoritative error code
      let errorCode = 'CONCURRENT_MUTATION_CONFLICT' as const;
      if (result.violationType === 'DELETED_RESOURCE') {
        errorCode = 'RESOURCE_NOT_FOUND';
      } else if (result.violationType === 'STALE_READ') {
        errorCode = 'STALE_VERSION_DETECTED';
      } else if (result.violationType === 'HASH_DRIFT') {
        errorCode = 'STATE_HASH_MISMATCH';
      }

      throw new StateConcurrencyError(errorCode, result.message, undefined, {
        validationResult: result,
      });
    }

    return result;
  }
}

// ============================================================================
// HMR-SAFE GLOBAL SINGLETON (Rule 69)
// ============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __smartsappStateVersionService: StateVersionService | undefined;
}

export function getStateVersionService(): StateVersionService {
  if (!globalThis.__smartsappStateVersionService) {
    globalThis.__smartsappStateVersionService = new StateVersionService();
  }
  return globalThis.__smartsappStateVersionService;
}
