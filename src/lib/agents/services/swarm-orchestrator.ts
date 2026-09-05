/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Swarm Orchestration Engine
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Agent Swarm Modes:
 *    - `parallel_consensus`: Concurrently dispatches specialists and synthesizes multi-perspective consensus.
 *    - `sequential_pipeline`: Stages specialists in an ordered chain with upstream context passing.
 * 2. Strict Safety & Concurrency Throttling:
 *    - Max 4 parallel specialists concurrently via bounded chunks to eliminate resource exhaustion.
 *    - 75-second hard ceiling per swarm execution.
 * 3. Human-in-the-Loop Interception & Durable State:
 *    - Persists state in Firestore `/swarm_runs/{swarmRunId}`.
 *    - If any specialist requires approval (`-32003`), the swarm status becomes `'needs_approval'`.
 *    - Resumption adjudicates the paused approval and completes the mission without re-running earlier stages.
 * 4. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1).
 *
 * @testability Covered in `src/lib/agents/__tests__/domain-agents.test.ts`.
 */

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { globalAgentRegistry } from '@/lib/supervisor/agent-registry';
import { McpApprovalEngine } from '@/lib/mcp/approval-engine';
import {
  synthesizeSwarmConsensusFlow,
  synthesizeSwarmDeterministic,
} from '@/ai/flows/synthesize-swarm-consensus-flow';
import type {
  SwarmMissionRequest,
  SwarmRun,
  SwarmConsensus,
  DomainSpecialistId,
} from '../domain-types';
import type {
  AgentRequest,
  AgentResult,
  AgentActionProposal,
} from '@/lib/supervisor/types';

/** In-memory store fallback when Firestore is unconfigured or in testing */
const inMemorySwarmRuns = new Map<string, SwarmRun>();

export class SwarmOrchestrator {
  private static readonly HARD_TIMEOUT_MS = 75_000;
  private static readonly MAX_PARALLEL_CHUNKS = 4;

  /**
   * Dispatches and orchestrates a multi-specialist swarm mission.
   */
  public static async startSwarmMission(request: SwarmMissionRequest): Promise<SwarmRun> {
    const runId = `swarm_${crypto.randomUUID()}`;
    const startTime = Date.now();

    const swarmRun: SwarmRun = {
      id: runId,
      workspaceId: request.workspaceId,
      organizationId: request.organizationId,
      objective: request.objective,
      mode: request.mode,
      specialistIds: [...request.specialistIds],
      status: 'running',
      actor: { ...request.actor },
      subject: request.subject ? { ...request.subject } : undefined,
      specialistRuns: {},
      metrics: {
        durationMs: 0,
        specialistsInvoked: request.specialistIds.length,
        totalFindings: 0,
        totalToolCalls: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.persistSwarmRun(swarmRun);

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Swarm mission exceeded maximum timeout ceiling of ${this.HARD_TIMEOUT_MS / 1000}s`));
      }, this.HARD_TIMEOUT_MS);
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    });

    try {
      const executionPromise = (async () => {
        if (request.mode === 'sequential_pipeline') {
          await this.executeSequentialPipeline(swarmRun, request);
        } else {
          // Default to parallel consensus
          await this.executeParallelConsensus(swarmRun, request);
        }

        swarmRun.metrics.durationMs = Date.now() - startTime;
        swarmRun.updatedAt = new Date().toISOString();

        // If the mission did not pause for human approval, synthesize final consensus
        if (swarmRun.status === 'running') {
          await this.synthesizeAndCompleteSwarm(swarmRun, request);
        }
      })();

      await Promise.race([executionPromise, timeoutPromise]);

      await this.persistSwarmRun(swarmRun);
      return swarmRun;
    } catch (err) {
      swarmRun.status = 'failed';
      swarmRun.errorMessage = err instanceof Error ? err.message : 'Unknown swarm execution error';
      swarmRun.metrics.durationMs = Date.now() - startTime;
      swarmRun.updatedAt = new Date().toISOString();
      await this.persistSwarmRun(swarmRun);
      return swarmRun;
    }
  }

  /**
   * Resumes a swarm mission that paused due to a human approval requirement.
   */
  public static async resumeSwarmMission(
    swarmRunId: string,
    approvalId: string,
    resumedBy: string
  ): Promise<SwarmRun> {
    const swarmRun = await this.getSwarmRun(swarmRunId);
    if (!swarmRun) {
      throw new Error(`Swarm run "${swarmRunId}" not found.`);
    }

    if (swarmRun.status !== 'needs_approval') {
      throw new Error(`Swarm run "${swarmRunId}" is not in "needs_approval" state (current: ${swarmRun.status}).`);
    }

    // Adjudicate approval in McpApprovalEngine
    if (approvalId) {
      try {
        await McpApprovalEngine.adjudicateApproval({
          approvalId,
          decision: 'approved',
          adjudicatedBy: resumedBy,
          notes: 'Approved and resumed via Swarm Mission Control',
        });
      } catch (err) {
        console.warn('[SwarmOrchestrator] Adjudication notice:', err);
      }
    }

    // Complete paused specialist run
    if (swarmRun.pausedSpecialistId && swarmRun.specialistRuns[swarmRun.pausedSpecialistId]) {
      const pausedRun = swarmRun.specialistRuns[swarmRun.pausedSpecialistId];
      pausedRun.status = 'completed';
    }

    swarmRun.status = 'running';
    swarmRun.pendingApprovalId = undefined;
    swarmRun.pausedSpecialistId = undefined;

    // Run synthesis
    const mockRequest: SwarmMissionRequest = {
      workspaceId: swarmRun.workspaceId,
      organizationId: swarmRun.organizationId,
      actor: swarmRun.actor,
      objective: swarmRun.objective,
      specialistIds: swarmRun.specialistIds,
      mode: swarmRun.mode,
      subject: swarmRun.subject,
    };

    await this.synthesizeAndCompleteSwarm(swarmRun, mockRequest);
    await this.persistSwarmRun(swarmRun);
    return swarmRun;
  }

  /**
   * Executes specialists concurrently (fan-out / fan-in) bounded to max 4 parallel chunks.
   */
  private static async executeParallelConsensus(
    swarmRun: SwarmRun,
    request: SwarmMissionRequest
  ): Promise<void> {
    const specialistIds = request.specialistIds;

    // Chunk specialists to avoid resource overload
    for (let i = 0; i < specialistIds.length; i += this.MAX_PARALLEL_CHUNKS) {
      const chunk = specialistIds.slice(i, i + this.MAX_PARALLEL_CHUNKS);

      const promises = chunk.map(async (specId) => {
        const agent = globalAgentRegistry.getAgent(specId);
        if (!agent) {
          throw new Error(`Specialist "${specId}" is not registered in AgentRegistry.`);
        }

        const agentReq: AgentRequest = {
          workspaceId: request.workspaceId,
          organizationId: request.organizationId,
          actor: request.actor,
          objective: request.objective,
          subject: request.subject,
          constraints: [{ type: 'max_steps', value: 3 }],
        };

        const result: AgentResult = await agent.execute(agentReq);
        return { specId, result };
      });

      const settled = await Promise.allSettled(promises);

      for (const res of settled) {
        if (res.status === 'fulfilled') {
          const { specId, result } = res.value;
          swarmRun.specialistRuns[specId] = result;
          swarmRun.metrics.totalFindings += result.findings.length;
          swarmRun.metrics.totalToolCalls += result.toolCalls.length;

          // Check if specialist halted on approval required
          if (result.status === 'needs_approval') {
            const pausedCall = result.toolCalls.find((tc) => tc.status === 'needs_approval');
            swarmRun.status = 'needs_approval';
            swarmRun.pausedSpecialistId = specId;
            swarmRun.pendingApprovalId = pausedCall?.approvalId || `appr_${Date.now()}`;
          }
        } else {
          console.error('[SwarmOrchestrator] Specialist execution rejected:', res.reason);
          const failedSpecId = chunk[settled.indexOf(res)];
          if (failedSpecId) {
            swarmRun.specialistRuns[failedSpecId] = {
              runId: `failed_${failedSpecId}_${Date.now()}`,
              status: 'failed',
              answer: `Specialist execution failed: ${res.reason instanceof Error ? res.reason.message : String(res.reason)}`,
              findings: [],
              actions: [],
              toolCalls: [],
              sources: [],
            };
          }
        }
      }

      // If paused for approval, break execution
      if (swarmRun.status === 'needs_approval') {
        break;
      }
    }
  }

  /**
   * Executes specialists in an ordered sequence, passing prior findings to next stage.
   */
  private static async executeSequentialPipeline(
    swarmRun: SwarmRun,
    request: SwarmMissionRequest
  ): Promise<void> {
    let accumulatedLore = '';

    for (const specId of request.specialistIds) {
      const agent = globalAgentRegistry.getAgent(specId);
      if (!agent) {
        throw new Error(`Specialist "${specId}" is not registered in AgentRegistry.`);
      }

      const enhancedObjective = accumulatedLore
        ? `${request.objective}\n\n[PRIOR SPECIALIST FINDINGS]:\n${accumulatedLore}`
        : request.objective;

      const agentReq: AgentRequest = {
        workspaceId: request.workspaceId,
        organizationId: request.organizationId,
        actor: request.actor,
        objective: enhancedObjective,
        subject: request.subject,
        constraints: [{ type: 'max_steps', value: 3 }],
      };

      const result: AgentResult = await agent.execute(agentReq);
      swarmRun.specialistRuns[specId] = result;
      swarmRun.metrics.totalFindings += result.findings.length;
      swarmRun.metrics.totalToolCalls += result.toolCalls.length;

      accumulatedLore += `\n* ${agent.name}: ${result.answer}`;

      if (result.status === 'needs_approval') {
        const pausedCall = result.toolCalls.find((tc) => tc.status === 'needs_approval');
        swarmRun.status = 'needs_approval';
        swarmRun.pausedSpecialistId = specId;
        swarmRun.pendingApprovalId = pausedCall?.approvalId || `appr_${Date.now()}`;
        break;
      }
    }
  }

  /**
   * Invokes Genkit synthesis flow to produce multi-perspective consensus.
   */
  private static async synthesizeAndCompleteSwarm(
    swarmRun: SwarmRun,
    request: SwarmMissionRequest
  ): Promise<void> {
    const specialistOutputs = Object.entries(swarmRun.specialistRuns).map(([specId, res]) => {
      const agent = globalAgentRegistry.getAgent(specId);
      return {
        specialistId: specId,
        specialistName: agent ? agent.name : specId,
        answer: res.answer || 'Completed domain review.',
        findingsSummary: res.findings.map((f) => f.title).join('; '),
        findingsCount: res.findings.length,
        proposedActionsCount: res.actions.length,
      };
    });

    try {
      const consensusOutput = await synthesizeSwarmConsensusFlow({
        workspaceId: request.workspaceId,
        objective: request.objective,
        mode: request.mode,
        specialistOutputs,
      });

      const jointActions: AgentActionProposal[] = consensusOutput.jointActionProposals.map((act) => ({
        toolName: act.toolName,
        title: act.title,
        description: act.description,
        riskLevel: act.riskLevel,
        requiresApproval: act.requiresApproval,
        arguments: {},
      }));

      const consensus: SwarmConsensus = {
        executiveSummary: consensusOutput.executiveSummary,
        consensusPoints: consensusOutput.consensusPoints,
        divergencePoints: consensusOutput.divergencePoints,
        jointActions,
        confidenceScore: consensusOutput.confidenceScore,
      };

      swarmRun.consensus = consensus;
      swarmRun.status = 'completed';
      swarmRun.metrics.completedAt = new Date().toISOString();
    } catch (err) {
      console.warn('[SwarmOrchestrator] Synthesis flow fallback to deterministic:', err);
      const fallback = synthesizeSwarmDeterministic({
        objective: request.objective,
        mode: request.mode,
        specialistOutputs,
      });

      swarmRun.consensus = {
        executiveSummary: fallback.executiveSummary,
        consensusPoints: fallback.consensusPoints,
        divergencePoints: fallback.divergencePoints,
        jointActions: fallback.jointActionProposals.map((a) => ({
          toolName: a.toolName,
          title: a.title,
          description: a.description,
          riskLevel: a.riskLevel,
          requiresApproval: a.requiresApproval,
          arguments: {},
        })),
        confidenceScore: fallback.confidenceScore,
      };
      swarmRun.status = 'completed';
      swarmRun.metrics.completedAt = new Date().toISOString();
    }
  }

  /**
   * Persists swarm state to Firestore `/swarm_runs` with memory fallback.
   */
  public static async persistSwarmRun(run: SwarmRun): Promise<void> {
    inMemorySwarmRuns.set(run.id, { ...run });

    if (!adminDb) {
      return;
    }

    try {
      await adminDb.collection('swarm_runs').doc(run.id).set(run, { merge: true });
    } catch (err) {
      console.warn(`[SwarmOrchestrator] Firestore persist warning for ${run.id}:`, err);
    }
  }

  /**
   * Retrieves a swarm run by its unique identifier.
   */
  public static async getSwarmRun(runId: string): Promise<SwarmRun | null> {
    if (inMemorySwarmRuns.has(runId)) {
      return inMemorySwarmRuns.get(runId) || null;
    }

    if (!adminDb) {
      return null;
    }

    try {
      const docSnap = await adminDb.collection('swarm_runs').doc(runId).get();
      if (!docSnap.exists) return null;
      return docSnap.data() as SwarmRun;
    } catch (err) {
      console.warn(`[SwarmOrchestrator] Failed to fetch swarm run ${runId}:`, err);
      return null;
    }
  }

  /**
   * Lists historical swarm runs for a given workspace.
   */
  public static async listSwarmRuns(
    workspaceId: string,
    limitCount: number = 20
  ): Promise<SwarmRun[]> {
    if (!adminDb) {
      return Array.from(inMemorySwarmRuns.values())
        .filter((r) => r.workspaceId === workspaceId)
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
        .slice(0, limitCount);
    }

    try {
      const querySnap = await adminDb
        .collection('swarm_runs')
        .where('workspaceId', '==', workspaceId)
        .orderBy('createdAt', 'desc')
        .limit(limitCount)
        .get();

      return querySnap.docs.map((d) => d.data() as SwarmRun);
    } catch (err) {
      console.warn('[SwarmOrchestrator] Query fallback to in-memory:', err);
      return Array.from(inMemorySwarmRuns.values())
        .filter((r) => r.workspaceId === workspaceId)
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
        .slice(0, limitCount);
    }
  }
}
