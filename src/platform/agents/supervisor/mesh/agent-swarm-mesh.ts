/**
 * @fileOverview Central Multi-Agent Swarm Mesh Router & Reverse-LIFO Saga Coordinator (Phase 13 Milestone 4)
 *
 * Implements Rules 4, 8, 9, 10, 12, 13, 16, 17, 18, 19, 21, 22, 24, 25, 26, 27, 28, 30, 32, 40, 48, 60, and 69.
 * Single Source of Truth for:
 * - Inter-Agent Swarm Mesh Routing across all 19 canonical personas.
 * - Distributed Reverse-LIFO Saga Compensation & Recovery Journal.
 * - Dead-Letter Queue (DLQ) Recording & Triage.
 * - Multi-Agent Cooperative Cancellation Propagation.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { AGENT_PERSONA_IDS, type AgentPersonaId } from '../../../identity/agent-persona-types';
import {
  type AgentHandoffEnvelope,
  type AgentHandoffEnvelopeRaw,
  type MeshDeliveryReceipt,
  type MeshCompensationRecord,
  type MeshCompensationPlan,
  type MeshDeadLetterRecord,
  type MeshTopology,
  type MeshPeerRegistryEntry,
  AgentHandoffEnvelopeSchema,
  AgentMeshError,
  MESH_MAX_CONCURRENCY,
} from './agent-swarm-mesh-types';
import { AgentMeshChannel, type SendHandoffOptions } from './agent-mesh-channel';
import { defaultEventBus, type EventBus } from '../../../events/event-bus';
import { createDomainEvent } from '../../../capabilities/events/domain-event';
import { checkGovernanceDeadManSwitch } from '../../../policy/governance-dead-man';

export interface AgentSwarmMeshOptions {
  readonly eventBus?: EventBus;
}

export class AgentSwarmMesh {
  private readonly eventBus: EventBus;
  private readonly channels: Map<string, AgentMeshChannel> = new Map();
  private readonly peers: Map<AgentPersonaId, MeshPeerRegistryEntry> = new Map();
  private readonly compensationJournal: MeshCompensationRecord[] = [];
  private readonly deadLetterRecords: MeshDeadLetterRecord[] = [];
  private inFlightHandoffsCount: number = 0;
  private completedHandoffsCount: number = 0;
  private compensationsExecutedCount: number = 0;

  constructor(options: AgentSwarmMeshOptions = {}) {
    this.eventBus = options.eventBus ?? defaultEventBus;
    this.initializePeerRegistry();
  }

  /**
   * Initializes peer registry entries for all 19 canonical agent personas.
   */
  private initializePeerRegistry(): void {
    const now = new Date().toISOString();
    for (const personaId of AGENT_PERSONA_IDS) {
      this.peers.set(personaId, {
        personaId,
        status: 'ACTIVE',
        circuitBreakerState: 'CLOSED',
        concurrencyLimit: MESH_MAX_CONCURRENCY,
        activeHandoffsCount: 0,
        consecutiveFailures: 0,
        lastFailureTimestamp: null,
        lastHeartbeat: now,
      });
    }
  }

  /**
   * Retrieves or creates a point-to-point mesh channel between two agent personas.
   */
  private getChannel(sourcePersona: AgentPersonaId, targetPersona: AgentPersonaId): AgentMeshChannel {
    const channelKey = `${sourcePersona}:${targetPersona}`;
    let channel = this.channels.get(channelKey);
    if (!channel) {
      channel = new AgentMeshChannel({ sourcePersona, targetPersona });
      this.channels.set(channelKey, channel);
    }
    return channel;
  }

  /**
   * Routes an inter-agent handoff envelope through the Swarm Mesh with Anti-IDOR,
   * dead-man pause evaluation, and domain event publishing (Rules 8, 20, 40, 60).
   */
  public async routeHandoff(
    rawEnvelope: AgentHandoffEnvelopeRaw,
    options: SendHandoffOptions = {}
  ): Promise<MeshDeliveryReceipt> {
    // 1. Contract & Zod v4 validation (Rule 10)
    const envelope = AgentHandoffEnvelopeSchema.parse(rawEnvelope);

    // 2. Anti-IDOR Tenant Boundary Validation (Rules 8 & 47)
    if (envelope.organizationId !== envelope.delegationToken.organizationId) {
      throw new AgentMeshError(
        'IDOR_VIOLATION',
        `Tenant mismatch between envelope organizationId '${envelope.organizationId}' and delegation token '${envelope.delegationToken.organizationId}'. Access denied.`
      );
    }

    // 3. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(envelope.organizationId);
    } catch {
      throw new AgentMeshError(
        'DEAD_MAN_PAUSED',
        `Emergency dead-man switch is engaged for organization '${envelope.organizationId}'. Multi-agent handoff blocked.`
      );
    }

    // 4. Update Peer Registry active count
    const targetPeer = this.peers.get(envelope.targetAgentPersona);
    if (targetPeer) {
      targetPeer.activeHandoffsCount += 1;
      targetPeer.lastHeartbeat = new Date().toISOString();
    }
    this.inFlightHandoffsCount += 1;

    try {
      const channel = this.getChannel(envelope.sourceAgentPersona, envelope.targetAgentPersona);
      const receipt = await channel.sendHandoff(envelope, options);

      this.completedHandoffsCount += 1;

      // 5. Publish Domain Event (Rule 40)
      await this.eventBus.publish(
        createDomainEvent({
          type: 'supervisor.mesh.handoff_routed',
          organizationId: envelope.organizationId,
          workspaceId: envelope.workspaceId,
          actor: { type: 'agent', id: envelope.sourceAgentPersona },
          entity: { type: 'mesh.handoff', id: envelope.handoffId },
          correlationId: envelope.missionId,
          source: 'supervisor.swarm_mesh',
          payload: {
            handoffId: envelope.handoffId,
            missionId: envelope.missionId,
            sourcePersona: envelope.sourceAgentPersona,
            targetPersona: envelope.targetAgentPersona,
            deliveryStatus: receipt.deliveryStatus,
            latencyMs: receipt.latencyMs,
          },
        })
      );

      return receipt;
    } catch (err: unknown) {
      if (targetPeer) {
        targetPeer.consecutiveFailures += 1;
        targetPeer.lastFailureTimestamp = new Date().toISOString();
      }
      throw err;
    } finally {
      if (targetPeer && targetPeer.activeHandoffsCount > 0) {
        targetPeer.activeHandoffsCount -= 1;
      }
      if (this.inFlightHandoffsCount > 0) {
        this.inFlightHandoffsCount -= 1;
      }
    }
  }

  /**
   * Registers a mutating step in the append-only Saga Journal for potential rollback (Rule 27).
   */
  public registerCompletedStep(params: {
    readonly missionId: string;
    readonly stepId: string;
    readonly capabilityId: string;
    readonly compensatingCapabilityId: string;
    readonly payloadSnapshot?: Record<string, unknown>;
  }): void {
    const isNoop = params.compensatingCapabilityId === 'noop';
    this.compensationJournal.push({
      compensationId: `cmp_${params.missionId}_${params.stepId}_${Date.now()}`,
      missionId: params.missionId,
      stepId: params.stepId,
      capabilityId: params.capabilityId,
      compensatingCapabilityId: params.compensatingCapabilityId,
      status: isNoop ? 'SKIPPED' : 'PENDING',
      attemptCount: 0,
      executedAt: new Date().toISOString(),
      durationMs: 0,
      payloadSnapshot: params.payloadSnapshot,
      error: isNoop ? 'Read-only capability requires no rollback' : undefined,
    });
  }

  /**
   * Executes distributed reverse-LIFO Saga compensation for a mission (Rule 27).
   */
  public async compensateMission(
    missionId: string,
    options: { readonly dryRun?: boolean; readonly reason?: string } = {}
  ): Promise<MeshCompensationPlan> {
    const plannedAt = new Date().toISOString();
    // 1. Pull all records for mission and reverse order (LIFO: N -> 1)
    const missionRecords = this.compensationJournal
      .filter((r) => r.missionId === missionId)
      .reverse();

    const resultRecords: MeshCompensationRecord[] = [];
    let hadFailure = false;

    for (const record of missionRecords) {
      if (record.compensatingCapabilityId === 'noop' || record.status === 'SKIPPED') {
        resultRecords.push({
          ...record,
          status: 'SKIPPED',
          executedAt: new Date().toISOString(),
        });
        continue;
      }

      if (options.dryRun) {
        resultRecords.push({
          ...record,
          status: 'COMPLETED',
          attemptCount: 0, // 0 live attempts in shadow mode
          executedAt: new Date().toISOString(),
          durationMs: 5,
        });
        this.compensationsExecutedCount += 1;
        continue;
      }

      const stepStart = Date.now();
      try {
        // Execute compensation action / publish compensation step event
        await this.eventBus.publish(
          createDomainEvent({
            type: 'supervisor.step.reverted',
            organizationId: 'org_platform',
            workspaceId: 'ws_platform',
            actor: { type: 'agent', id: 'supervisor' },
            entity: { type: 'supervisor.step', id: record.stepId },
            correlationId: missionId,
            source: 'supervisor.swarm_mesh.saga',
            payload: {
              missionId,
              stepId: record.stepId,
              originalCapabilityId: record.capabilityId,
              compensatingCapabilityId: record.compensatingCapabilityId,
              payloadSnapshot: record.payloadSnapshot,
            },
          })
        );

        resultRecords.push({
          ...record,
          status: 'COMPLETED',
          attemptCount: record.attemptCount + 1,
          executedAt: new Date().toISOString(),
          durationMs: Date.now() - stepStart,
        });
        this.compensationsExecutedCount += 1;
      } catch (err: unknown) {
        hadFailure = true;
        const msg = err instanceof Error ? err.message : String(err);
        resultRecords.push({
          ...record,
          status: 'FAILED',
          attemptCount: record.attemptCount + 1,
          executedAt: new Date().toISOString(),
          durationMs: Date.now() - stepStart,
          error: msg,
        });
      }
    }

    const overallStatus: 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILED' = hadFailure
      ? resultRecords.some((r) => r.status === 'COMPLETED')
        ? 'PARTIAL_FAILURE'
        : 'FAILED'
      : 'SUCCESS';

    const plan: MeshCompensationPlan = {
      missionId,
      plannedAt,
      totalStepsToCompensate: missionRecords.length,
      records: resultRecords,
      overallStatus,
      reason: options.reason,
    };

    // Publish compensation summary event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'supervisor.mesh.compensated',
        organizationId: 'org_platform',
        workspaceId: 'ws_platform',
        actor: { type: 'agent', id: 'supervisor' },
        entity: { type: 'mesh.mission', id: missionId },
        correlationId: missionId,
        source: 'supervisor.swarm_mesh.saga',
        payload: {
          missionId,
          totalStepsToCompensate: plan.totalStepsToCompensate,
          overallStatus: plan.overallStatus,
          reason: options.reason,
        },
      })
    );

    return plan;
  }

  /**
   * Logs a dead-letter queue record for an un-routable or dropped handoff (Rule 25).
   */
  public recordDeadLetter(envelope: AgentHandoffEnvelope, reason: string): void {
    this.deadLetterRecords.push({
      deadLetterId: `dlq_${envelope.handoffId}_${Date.now()}`,
      envelope,
      reason,
      droppedAt: new Date().toISOString(),
      attemptCount: 3,
    });
  }

  /**
   * Retrieves dead-letter records for an organization (Rule 25).
   */
  public getDeadLetterRecords(organizationId: string): MeshDeadLetterRecord[] {
    return this.deadLetterRecords.filter(
      (r) => r.envelope.organizationId === organizationId
    );
  }

  /**
   * Cancels all in-flight handoffs for a mission and publishes a cancellation event (Rules 26 & 40).
   */
  public async cancelMissionHandoffs(missionId: string, reason: string): Promise<void> {
    await this.eventBus.publish(
      createDomainEvent({
        type: 'supervisor.mesh.cancelled',
        organizationId: 'org_platform',
        workspaceId: 'ws_platform',
        actor: { type: 'agent', id: 'supervisor' },
        entity: { type: 'mesh.mission', id: missionId },
        correlationId: missionId,
        source: 'supervisor.swarm_mesh',
        payload: {
          missionId,
          reason,
          cancelledAt: new Date().toISOString(),
        },
      })
    );
  }

  /**
   * Inspects current mesh topology, registered peers, circuit breakers, and metrics (Rule 61).
   */
  public getMeshTopology(organizationId: string, workspaceId: string): MeshTopology {
    const peerEntries: MeshPeerRegistryEntry[] = [];
    let activeNodes = 0;

    for (const [personaId, entry] of this.peers.entries()) {
      const channel = this.channels.get(`supervisor:${personaId}`);
      const circuitBreakerState = channel ? channel.getCircuitBreakerState() : entry.circuitBreakerState;
      const status = circuitBreakerState === 'OPEN' ? 'DRAINING' : entry.status;

      if (status === 'ACTIVE') {
        activeNodes += 1;
      }

      peerEntries.push({
        ...entry,
        circuitBreakerState,
        status,
      });
    }

    return {
      organizationId,
      workspaceId,
      activeNodes,
      peers: peerEntries,
      inFlightHandoffs: this.inFlightHandoffsCount,
      completedHandoffs: this.completedHandoffsCount,
      compensationsExecuted: this.compensationsExecutedCount,
      deadLetterCount: this.deadLetterRecords.length,
    };
  }
}

// Global singleton preservation for HMR and cross-module use (Rule 69)
declare global {
  var __smartsappAgentSwarmMesh: AgentSwarmMesh | undefined;
}

export function getAgentSwarmMesh(): AgentSwarmMesh {
  if (!globalThis.__smartsappAgentSwarmMesh) {
    globalThis.__smartsappAgentSwarmMesh = new AgentSwarmMesh();
  }
  return globalThis.__smartsappAgentSwarmMesh;
}

