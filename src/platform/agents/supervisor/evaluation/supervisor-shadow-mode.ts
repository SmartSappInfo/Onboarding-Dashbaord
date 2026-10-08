/**
 * @fileOverview Supervisor Shadow Mode Simulation Engine (Phase 13 Milestone 3)
 *
 * Implements Rules 4, 8, 10, 12, 16, 17, 21, 23, 26, 30, 40, 42, 60, and 69.
 * High-fidelity execution harness that decomposes goals and orchestrates subagents
 * in pure dry-run mode (`dryRun: true`) with guaranteed 0 live database writes.
 *
 * Key Capabilities:
 * - Full Kahn's DAG execution without committing mutating changes.
 * - Deep Multi-Agent Blast Radius reporting (affected accounts, workspaces, exposure, staged proposals).
 * - Anti-IDOR tenant boundaries enforced at runtime.
 * - Fail-closed emergency dead-man switch evaluation (Rule 60).
 * - Cooperative cancellation via native AbortSignal (Rule 26).
 * - Domain event publishing: `supervisor.mission.simulated` (Rule 40).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  type SupervisorGoalInputRaw,
  type MultiAgentBlastRadiusReport,
  type SupervisorSynthesisResult,
  SupervisorGoalInputSchema,
  SupervisorError,
} from '../supervisor-types';
import { SupervisorOrchestrator } from '../supervisor-orchestrator';
import { defaultEventBus, type EventBus } from '../../../events/event-bus';
import { createDomainEvent } from '../../../capabilities/events/domain-event';
import { checkGovernanceDeadManSwitch } from '../../../policy/governance-dead-man';
import { type MeshTopology, AgentSwarmMesh, getAgentSwarmMesh } from '../mesh';

export interface SupervisorShadowRunResult {
  readonly missionId: string;
  readonly goal: string;
  readonly missionType: string;
  readonly blastRadiusReport: MultiAgentBlastRadiusReport;
  readonly synthesis: SupervisorSynthesisResult;
  readonly totalStepsSimulated: number;
  readonly simulationDurationMs: number;
  readonly meshTopology?: MeshTopology;
}

export interface SupervisorShadowRunnerOptions {
  readonly orchestrator?: SupervisorOrchestrator;
  readonly eventBus?: EventBus;
  readonly mesh?: AgentSwarmMesh;
}

export class SupervisorShadowRunner {
  private readonly orchestrator: SupervisorOrchestrator;
  private readonly eventBus: EventBus;
  private readonly mesh: AgentSwarmMesh;

  constructor(options: SupervisorShadowRunnerOptions = {}) {
    this.eventBus = options.eventBus ?? defaultEventBus;
    this.mesh = options.mesh ?? (options.orchestrator ? options.orchestrator.getMesh() : getAgentSwarmMesh());
    this.orchestrator = options.orchestrator ?? new SupervisorOrchestrator({ eventBus: this.eventBus, mesh: this.mesh });
  }

  /**
   * Executes an end-to-end shadow simulation for a supervisor goal.
   * Guarantees dryRun: true and produces a comprehensive MultiAgentBlastRadiusReport.
   */
  public async simulateGoal(
    rawInput: SupervisorGoalInputRaw,
    options: { abortSignal?: AbortSignal; createdBy?: string } = {}
  ): Promise<SupervisorShadowRunResult> {
    const startTime = Date.now();

    // 1. Anti-IDOR validation (Rules 8 & 47)
    if (!rawInput.organizationId || !rawInput.workspaceId) {
      throw new SupervisorError(
        'IDOR_VIOLATION',
        'Both organizationId and workspaceId are required for shadow simulation.'
      );
    }

    const input = SupervisorGoalInputSchema.parse({
      ...rawInput,
      dryRun: true, // Force dryRun: true (Rule 42)
    });

    // 2. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      throw new SupervisorError(
        'DEAD_MAN_PAUSED',
        `Agent governance is emergency-paused for tenant '${input.organizationId}'. Multi-agent simulation blocked.`
      );
    }

    // 3. Check Cooperative Cancellation (Rule 26)
    if (options.abortSignal?.aborted) {
      throw new SupervisorError(
        'EXECUTION_ABORTED',
        'Multi-agent shadow simulation was aborted before execution.'
      );
    }

    // 4. Execute Orchestrator in Dry-Run Mode
    const synthesis = await this.orchestrator.executeMission(input, {
      abortSignal: options.abortSignal,
      createdBy: options.createdBy ?? 'shadow_simulator',
    });

    const mission = this.orchestrator.getMission(synthesis.missionId);
    if (!mission || !mission.blastRadiusReport) {
      throw new SupervisorError(
        'INTERNAL_ERROR',
        'MultiAgentBlastRadiusReport was not generated during shadow simulation.'
      );
    }

    const durationMs = Date.now() - startTime;

    // 5. Publish Simulation Domain Event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'supervisor.mission.simulated',
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        actor: {
          type: 'agent',
          id: 'supervisor',
        },
        entity: { type: 'supervisor.mission', id: synthesis.missionId },
        correlationId: synthesis.missionId,
        source: 'supervisor.shadow_runner',
        payload: {
          missionId: synthesis.missionId,
          goal: input.goal,
          missionType: mission.missionType,
          totalStepsSimulated: mission.executedSteps.length,
          stagedProposalsCount: mission.blastRadiusReport.stagedProposals.length,
          highestRisk: mission.blastRadiusReport.highestSimulatedRisk,
          requiresHumanApproval: mission.blastRadiusReport.requiresHumanApproval,
          simulationDurationMs: durationMs,
        },
      })
    );

    const meshTopology = this.mesh.getMeshTopology(input.organizationId, input.workspaceId);

    return {
      missionId: synthesis.missionId,
      goal: input.goal,
      missionType: mission.missionType,
      blastRadiusReport: mission.blastRadiusReport,
      synthesis,
      totalStepsSimulated: mission.executedSteps.length,
      simulationDurationMs: durationMs,
      meshTopology,
    };
  }
}

// Global singleton preservation for HMR and cross-module use (Rule 69)
declare global {
  var __smartsappSupervisorShadowRunner: SupervisorShadowRunner | undefined;
}

export function getSupervisorShadowRunner(): SupervisorShadowRunner {
  if (!globalThis.__smartsappSupervisorShadowRunner) {
    globalThis.__smartsappSupervisorShadowRunner = new SupervisorShadowRunner();
  }
  return globalThis.__smartsappSupervisorShadowRunner;
}

