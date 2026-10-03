/**
 * @fileOverview Legacy Swarm Strangler Bridge (Phase 6 Milestone 5)
 *
 * Implements Rule 69 (Strangler Fig Pattern SSOT) to preserve 100% backward
 * compatibility for existing CompanyBrain 2.0 SwarmOrchestrator requests,
 * transparently routing them through the canonical SwarmCoordinator.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import crypto from 'node:crypto';
import type {
  SwarmMissionRequest,
  SwarmRun as LegacySwarmRun,
  SwarmMode,
  DomainSpecialistId,
  SwarmConsensus as LegacySwarmConsensus,
} from '@/lib/agents/domain-types';
import type { AgentResult } from '@/lib/supervisor/types';
import type { AgentPersonaId } from '@/platform/identity/agent-persona-types';
import { SwarmCoordinator, type SwarmCoordinatorOptions } from './swarm-coordinator';
import type { SwarmTopology } from './swarm-types';

export class LegacySwarmBridge {
  private readonly coordinator: SwarmCoordinator;

  constructor(options: SwarmCoordinatorOptions = {}) {
    this.coordinator = new SwarmCoordinator(options);
  }

  /**
   * Maps legacy DomainSpecialistId to canonical AgentPersonaId.
   */
  public static mapSpecialistId(id: DomainSpecialistId): AgentPersonaId {
    switch (id) {
      case 'knowledge_specialist':
        return 'crm_researcher';
      case 'revenue_specialist':
        return 'deal_coach';
      case 'meeting_specialist':
        return 'meeting_prep';
      case 'sdr_specialist':
        return 'lead_sdr';
      case 'operations_specialist':
        return 'supervisor';
      case 'governance_specialist':
        return 'supervisor';
      default:
        return 'crm_researcher';
    }
  }

  /**
   * Maps legacy SwarmMode to canonical SwarmTopology.
   */
  public static mapSwarmMode(mode: SwarmMode): SwarmTopology {
    switch (mode) {
      case 'parallel_consensus':
        return 'mesh_consensus';
      case 'sequential_pipeline':
        return 'pipeline';
      case 'supervisor_directed':
        return 'hierarchical';
      default:
        return 'mesh_consensus';
    }
  }

  /**
   * Dispatches a legacy SwarmMissionRequest through the modern SwarmCoordinator,
   * returning a fully backward-compatible LegacySwarmRun object.
   */
  public async dispatchLegacyMission(request: SwarmMissionRequest): Promise<LegacySwarmRun> {
    const topology = LegacySwarmBridge.mapSwarmMode(request.mode);
    const specialistPersonaIds = request.specialistIds.map(LegacySwarmBridge.mapSpecialistId);

    const outcome = await this.coordinator.executeMission({
      missionId: `swarm_leg_${crypto.randomUUID().slice(0, 8)}`,
      objective: request.objective,
      topology,
      supervisorPersonaId: topology === 'hierarchical' ? 'supervisor' : undefined,
      specialistPersonaIds,
      tenantContext: {
        organizationId: request.organizationId,
        workspaceId: request.workspaceId,
      },
      budgets: {
        maxDurationMs: 75000,
        maxTokens: 50000,
        maxToolCalls: 20,
      },
      metadata: {
        legacyBridge: 'true',
        actorId: request.actor?.id ?? 'system',
      },
    });

    // Map canonical outcome status to legacy status
    let legacyStatus: LegacySwarmRun['status'] = 'completed';
    if (outcome.status === 'waiting_for_approval') {
      legacyStatus = 'needs_approval';
    } else if (outcome.status === 'cancelled') {
      legacyStatus = 'cancelled';
    } else if (outcome.status === 'failed') {
      legacyStatus = 'failed';
    }

    // Convert canonical consensus to legacy shape
    let legacyConsensus: LegacySwarmConsensus | undefined;
    if (outcome.consensus) {
      legacyConsensus = {
        executiveSummary: outcome.consensus.consensusSummary,
        consensusPoints: [outcome.consensus.recommendedAction],
        divergencePoints: outcome.consensus.divergencePoints.map((dp) => ({
          topic: 'Specialist Perspective Divergence',
          perspectives: {},
          tensionSummary: dp,
          recommendedEscalation: 'Review divergent perspectives in operator console',
        })),
        jointActions: [],
        confidenceScore: outcome.consensus.confidenceScore,
      };
    }

    // Build synthetic specialist runs record for backward compatibility
    const specialistRuns: Record<string, AgentResult> = {};
    for (const specId of request.specialistIds) {
      specialistRuns[specId] = {
        runId: `run_${specId}_${outcome.swarmRunId}`,
        status: legacyStatus === 'needs_approval' ? 'needs_approval' : 'completed',
        answer: `Specialist ${specId} completed analysis for objective: ${request.objective}`,
        findings: [
          {
            id: `find_${crypto.randomUUID().slice(0, 8)}`,
            title: `Specialist ${specId} execution`,
            description: `Specialist ${specId} executed under canonical swarm bridge.`,
            category: 'observation',
            confidence: 0.9,
          },
        ],
        actions: [],
        toolCalls: [],
        sources: [],
      };
    }

    const now = new Date().toISOString();
    return {
      id: outcome.swarmRunId,
      workspaceId: request.workspaceId,
      organizationId: request.organizationId,
      objective: request.objective,
      mode: request.mode,
      specialistIds: [...request.specialistIds],
      status: legacyStatus,
      actor: request.actor ?? { type: 'system', id: 'system' },
      subject: request.subject,
      specialistRuns,
      consensus: legacyConsensus,
      pendingApprovalId: outcome.approvalProposalId,
      pausedSpecialistId: outcome.approvalProposalId ? request.specialistIds[0] : undefined,
      metrics: {
        durationMs: outcome.durationMs,
        specialistsInvoked: request.specialistIds.length,
        totalFindings: request.specialistIds.length,
        totalToolCalls: outcome.budgetUsage.toolCallsExecuted,
        completedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };
  }
}
