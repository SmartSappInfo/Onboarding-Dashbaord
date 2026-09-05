/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Supervisor Orchestration Engine
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Coordinated Agent Execution:
 *    - Implements goal decomposition, step-by-step MCP tool routing,
 *      human approval pause/resumption, and executive result synthesis.
 * 2. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1):
 *    - Strongly typed with domain contracts in `src/lib/supervisor/types.ts`.
 * 3. Execution Safety Invariants:
 *    - Loop ceiling: hard max 10 steps per mission to eliminate runaway AI loops.
 *    - Timeout ceiling: 60,000ms max duration per mission execution.
 * 4. Durable State Persistence:
 *    - Run state is persisted at each step in Firestore collection `/agent_runs/{runId}`.
 *    - When an MCP tool returns `-32003`, the run is saved with `status: 'needs_approval'`
 *      and can be resumed without re-running earlier steps.
 * 5. Multi-Tenant Scoping:
 *    - Every execution context and query is strictly scoped by `workspaceId` and `organizationId`.
 *
 * @testability Covered in `src/lib/supervisor/__tests__/supervisor-engine.test.ts`.
 */

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { globalMcpRegistry } from '@/lib/mcp/registry';
import { McpGateway } from '@/lib/mcp/gateway';
import { McpApprovalEngine } from '@/lib/mcp/approval-engine';
import { globalAgentRegistry } from '../agent-registry';
import { ContextBuilderService } from '@/lib/memory/services/context-builder-service';
import { decomposeSupervisorGoalFlow } from '@/ai/flows/decompose-supervisor-goal-flow';
import { synthesizeSupervisorResultFlow } from '@/ai/flows/synthesize-supervisor-result-flow';
import {
  AgentRequest,
  AgentRun,
  AgentResult,
  AgentToolCall,
  SupervisorPlan,
  SupervisorPlanStep,
  AgentActionProposal,
} from '../types';
import type {
  McpExecutionContext,
  McpJsonRpcRequest,
  McpPayloadValue,
} from '@/lib/mcp/types';
import { MCP_ERROR_CODES } from '@/lib/mcp/types';
import type { ContextSubjectType, ContextSourceCitation } from '@/lib/memory/context-types';

export class SupervisorEngine {
  private static readonly RUNS_COLLECTION = 'agent_runs';
  private static readonly MAX_STEPS_LIMIT = 10;
  private static readonly TIMEOUT_MS = 60000;

  /**
   * Initiates a new supervisor mission, decomposes the objective, and executes steps.
   */
  public static async startMission(request: AgentRequest): Promise<AgentRun> {
    const runId = `run_${crypto.randomUUID()}`;
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    const boundedMaxSteps = Math.min(
      request.maxSteps || 5,
      this.MAX_STEPS_LIMIT
    );

    // 1. Gather initial context snapshot via ContextBuilderService (Phase 5)
    let contextSummary = '';
    let citations: ContextSourceCitation[] = [];
    try {
      const contextPackage = await ContextBuilderService.buildContext({
        objective: request.objective,
        workspaceId: request.workspaceId,
        organizationId: request.organizationId,
        subject: request.subject
          ? {
              id: request.subject.id,
              type: request.subject.type as ContextSubjectType,
            }
          : undefined,
        maxTokens: 2000,
      });
      const factsText = (contextPackage?.structuredFacts || []).map((f) => `${f.label}: ${f.value}`).join('\n');
      const memoriesText = (contextPackage?.memories || []).map((m) => m.memory?.content || '').join('\n');
      contextSummary = [factsText, memoriesText].filter(Boolean).join('\n\n').slice(0, 1500);
      citations = contextPackage?.sources || [];
    } catch (ctxErr) {
      console.warn('[SupervisorEngine] Context compilation warning:', ctxErr);
    }

    // 2. Fetch available MCP tools from registry (Phase 6)
    const availableToolDescriptors = globalMcpRegistry.getToolDescriptors();

    // 3. Decompose goal into an executable plan
    const decomposition = await decomposeSupervisorGoalFlow({
      workspaceId: request.workspaceId,
      objective: request.objective,
      subjectId: request.subject?.id,
      subjectType: request.subject?.type,
      contextSummary,
      availableTools: availableToolDescriptors.map((t) => ({
        name: t.name,
        description: t.description,
        category: t.category,
        riskLevel: t.riskLevel,
        requiresApproval: t.requiresApproval,
      })),
      maxSteps: boundedMaxSteps,
    });

    const planSteps: SupervisorPlanStep[] = decomposition.steps.map((s, idx) => ({
      stepNumber: idx + 1,
      title: s.title,
      intent: s.intent,
      assignedAgentOrTool: s.assignedAgentOrTool,
      arguments: s.arguments as Record<string, McpPayloadValue>,
      status: 'pending',
      whyThisStep: s.whyThisStep,
    }));

    const plan: SupervisorPlan = {
      goal: request.objective,
      summary: decomposition.summary,
      totalSteps: planSteps.length,
      steps: planSteps,
    };

    let run: AgentRun = {
      id: runId,
      workspaceId: request.workspaceId,
      organizationId: request.organizationId,
      actor: request.actor,
      objective: request.objective,
      subject: request.subject,
      status: 'executing',
      plan,
      steps: planSteps,
      currentStepIndex: 0,
      toolCalls: [],
      metrics: {
        totalSteps: planSteps.length,
        completedSteps: 0,
        durationMs: 0,
        totalToolCalls: 0,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Save initial run document in Firestore
    await adminDb.collection(this.RUNS_COLLECTION).doc(runId).set(run);

    // 4. If executionMode is 'step_by_step', stop at planning and wait for operator
    if (request.executionMode === 'step_by_step') {
      return run;
    }

    // 5. Execute plan steps sequentially
    run = await this.executeRemainingSteps(run, startTime);

    return run;
  }

  /**
   * Resumes an execution paused for human approval.
   */
  public static async resumeMission(
    runId: string,
    approvalId: string,
    resumedBy: string
  ): Promise<AgentRun> {
    const runRef = adminDb.collection(this.RUNS_COLLECTION).doc(runId);
    const snap = await runRef.get();
    if (!snap.exists) {
      throw new Error(`Agent run "${runId}" not found.`);
    }

    let run = snap.data() as AgentRun;
    if (run.status !== 'needs_approval') {
      throw new Error(`Agent run "${runId}" is not currently awaiting approval (status: ${run.status}).`);
    }

    const currentStep = run.steps[run.currentStepIndex];
    if (currentStep && currentStep.status === 'needs_approval') {
      if (approvalId) {
        try {
          const adjudication = await McpApprovalEngine.adjudicate({
            approvalId,
            decision: 'approved',
            adjudicatedBy: resumedBy,
            notes: 'Approved and resumed via Supervisor Mission Control',
          });
          currentStep.result = adjudication.executionResult;
        } catch (adjErr) {
          // Log notice if approval was already adjudicated externally
          console.warn('[SupervisorEngine] Approval adjudication notice:', adjErr);
        }
      }
      currentStep.status = 'completed';
      currentStep.completedAt = new Date().toISOString();
      run.metrics.completedSteps += 1;
    }

    run.currentStepIndex += 1;
    run.status = 'executing';
    run.pendingApprovalId = undefined;
    run.updatedAt = new Date().toISOString();

    await runRef.set(run);

    // Continue executing subsequent steps
    run = await this.executeRemainingSteps(run, Date.now());

    return run;
  }

  /**
   * Cancels an ongoing or paused mission.
   */
  public static async cancelMission(
    runId: string,
    cancelledBy: string,
    reason?: string
  ): Promise<AgentRun> {
    const runRef = adminDb.collection(this.RUNS_COLLECTION).doc(runId);
    const snap = await runRef.get();
    if (!snap.exists) {
      throw new Error(`Agent run "${runId}" not found.`);
    }

    const run = snap.data() as AgentRun;
    run.status = 'cancelled';
    run.errorMessage = reason || `Mission cancelled by user "${cancelledBy}".`;
    run.updatedAt = new Date().toISOString();

    await runRef.set(run);
    return run;
  }

  /**
   * Internal execution loop running through remaining plan steps.
   */
  private static async executeRemainingSteps(
    run: AgentRun,
    loopStartTime: number
  ): Promise<AgentRun> {
    const runRef = adminDb.collection(this.RUNS_COLLECTION).doc(run.id);

    while (run.currentStepIndex < run.steps.length) {
      // Check execution timeout guard
      if (Date.now() - loopStartTime > this.TIMEOUT_MS) {
        run.status = 'failed';
        run.errorMessage = 'Execution timed out after 60 seconds.';
        run.updatedAt = new Date().toISOString();
        await runRef.set(run);
        return run;
      }

      const step = run.steps[run.currentStepIndex];
      step.status = 'running';
      run.updatedAt = new Date().toISOString();
      await runRef.set(run);

      const stepStart = Date.now();

      // Construct MCP execution context
      const mcpContext: McpExecutionContext = {
        workspaceId: run.workspaceId,
        organizationId: run.organizationId,
        callerId: run.actor.id,
        callerType: 'agent',
        requestId: `step_${run.id}_${step.stepNumber}`,
        callDepth: 1,
        timestamp: new Date().toISOString(),
      };

      // Interpolate any dynamic step output references from previously completed steps
      const resolvedArguments = this.interpolateArguments(
        step.arguments,
        run.steps.slice(0, run.currentStepIndex)
      );
      step.arguments = resolvedArguments;

      // Check if assigned target is a registered domain specialist agent (Phase 8)
      const targetAgentId = step.assignedAgentOrTool.startsWith('agent:')
        ? step.assignedAgentOrTool.slice(6)
        : step.assignedAgentOrTool;

      const registeredAgent = globalAgentRegistry.hasAgent(targetAgentId)
        ? globalAgentRegistry.getAgent(targetAgentId)
        : undefined;

      if (registeredAgent && targetAgentId !== 'supervisor-prime') {
        try {
          const specialistResult = await registeredAgent.execute({
            workspaceId: run.workspaceId,
            organizationId: run.organizationId,
            actor: run.actor,
            objective: step.intent || step.title,
            subject: run.subject,
          });

          const stepDuration = Date.now() - stepStart;
          step.durationMs = stepDuration;

          if (specialistResult.status === 'needs_approval') {
            step.status = 'needs_approval';
            run.status = 'needs_approval';
            run.updatedAt = new Date().toISOString();
            await runRef.set(run);
            return run;
          }

          step.status = 'completed';
          step.result = {
            answer: specialistResult.answer || 'Domain analysis complete',
            findingsCount: specialistResult.findings.length,
            actionsCount: specialistResult.actions.length,
          };
          step.completedAt = new Date().toISOString();
          run.metrics.completedSteps += 1;

          run.toolCalls.push(
            ...specialistResult.toolCalls.map((tc) => ({
              id: `call_${step.stepNumber}_${Date.now().toString(36)}`,
              stepNumber: step.stepNumber,
              toolName: tc.toolName,
              parameters: tc.arguments,
              durationMs: tc.durationMs,
              status: (tc.status === 'success' ? 'success' : 'error') as 'success' | 'error',
              result: tc.result,
              error: tc.error,
              timestamp: tc.timestamp,
            }))
          );

          if (run.result) {
            run.result.findings.push(...specialistResult.findings);
            run.result.actions.push(...specialistResult.actions);
          }

          run.currentStepIndex += 1;
          run.updatedAt = new Date().toISOString();
          await runRef.set(run);
          continue;
        } catch (specErr) {
          const stepDuration = Date.now() - stepStart;
          step.durationMs = stepDuration;
          step.status = 'failed';
          step.error = specErr instanceof Error ? specErr.message : 'Specialist execution failed';
          run.status = 'failed';
          run.errorMessage = step.error;
          run.updatedAt = new Date().toISOString();
          await runRef.set(run);
          return run;
        }
      }

      // Construct JSON-RPC 2.0 tool call request
      const rpcRequest: McpJsonRpcRequest = {
        jsonrpc: '2.0',
        id: step.stepNumber,
        method: 'tools/call',
        params: {
          name: step.assignedAgentOrTool,
          arguments: resolvedArguments,
        },
      };

      try {
        const response = await McpGateway.handleRequest(rpcRequest, mcpContext);

        const stepDuration = Date.now() - stepStart;
        step.durationMs = stepDuration;

        // Check if tool execution was blocked by human approval gate (-32003)
        if (response.error && response.error.code === MCP_ERROR_CODES.APPROVAL_REQUIRED) {
          step.status = 'needs_approval';
          step.error = response.error.message;

          const errorData = response.error.data as Record<string, McpPayloadValue> | undefined;
          const pendingApprovalId =
            (errorData?.pendingApprovalId as string) ||
            (errorData?.approvalId as string) ||
            undefined;
          run.status = 'needs_approval';
          run.pendingApprovalId = pendingApprovalId;
          run.updatedAt = new Date().toISOString();

          // Record tool call telemetry
          run.toolCalls.push({
            id: `call_${step.stepNumber}_${Date.now().toString(36)}`,
            stepNumber: step.stepNumber,
            toolName: step.assignedAgentOrTool,
            parameters: step.arguments,
            durationMs: stepDuration,
            status: 'pending_approval',
            timestamp: new Date().toISOString(),
          });

          await runRef.set(run);
          return run; // Pause execution and wait for human adjudication
        }

        if (response.error) {
          step.status = 'failed';
          step.error = response.error.message;

          run.toolCalls.push({
            id: `call_${step.stepNumber}_${Date.now().toString(36)}`,
            stepNumber: step.stepNumber,
            toolName: step.assignedAgentOrTool,
            parameters: step.arguments,
            error: response.error.message,
            durationMs: stepDuration,
            status: 'error',
            timestamp: new Date().toISOString(),
          });
        } else {
          step.status = 'completed';
          step.result = response.result?.structured as Record<string, McpPayloadValue> | undefined;
          step.completedAt = new Date().toISOString();
          run.metrics.completedSteps += 1;

          run.toolCalls.push({
            id: `call_${step.stepNumber}_${Date.now().toString(36)}`,
            stepNumber: step.stepNumber,
            toolName: step.assignedAgentOrTool,
            parameters: step.arguments,
            result: response.result?.structured as Record<string, McpPayloadValue> | undefined,
            durationMs: stepDuration,
            status: 'success',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (execErr) {
        step.status = 'failed';
        step.error = execErr instanceof Error ? execErr.message : 'Tool execution crashed.';
      }

      run.metrics.totalToolCalls = run.toolCalls.length;
      run.currentStepIndex += 1;
      run.updatedAt = new Date().toISOString();
      await runRef.set(run);
    }

    // 6. Synthesize final results via Genkit flow
    run = await this.synthesizeAndCompleteRun(run, loopStartTime);
    return run;
  }

  /**
   * Compiles executive brief, findings, and actionable proposals upon mission completion.
   */
  private static async synthesizeAndCompleteRun(
    run: AgentRun,
    loopStartTime: number
  ): Promise<AgentRun> {
    const runRef = adminDb.collection(this.RUNS_COLLECTION).doc(run.id);

    const completedStepsPayload = run.steps
      .filter((s) => s.status === 'completed')
      .map((s) => ({
        stepNumber: s.stepNumber,
        title: s.title,
        toolName: s.assignedAgentOrTool,
        outputSummary: s.result ? JSON.stringify(s.result).slice(0, 500) : 'Completed successfully.',
        rawOutput: s.result ? JSON.stringify(s.result) : undefined,
      }));

    const synthesis = await synthesizeSupervisorResultFlow({
      workspaceId: run.workspaceId,
      objective: run.objective,
      subjectId: run.subject?.id,
      subjectType: run.subject?.type,
      completedSteps: completedStepsPayload,
      citations: [],
    });

    const rawActions = synthesis.proposedActions || [];
    const actionProposals: AgentActionProposal[] = rawActions.map((a) => ({
      id: a.id,
      toolName: a.toolName,
      title: a.title,
      description: a.description,
      parameters: (a.parameters || {}) as Record<string, McpPayloadValue>,
      riskLevel: a.riskLevel || 'low_risk',
      requiresApproval: Boolean(a.requiresApproval),
      status: 'suggested',
    }));

    const result: AgentResult = {
      runId: run.id,
      status: 'completed',
      answer: synthesis.executiveSummary || 'Mission completed successfully.',
      findings: synthesis.findings || [],
      actions: actionProposals,
      toolCalls: run.toolCalls,
      sources: [],
    };

    run.status = 'completed';
    run.result = result;
    run.metrics.durationMs = Date.now() - loopStartTime;
    run.updatedAt = new Date().toISOString();

    await runRef.set(run);
    return run;
  }

  /**
   * Retrieves a single run by ID.
   */
  public static async getRun(runId: string): Promise<AgentRun | null> {
    const snap = await adminDb.collection(this.RUNS_COLLECTION).doc(runId).get();
    if (!snap.exists) {
      return null;
    }
    return snap.data() as AgentRun;
  }

  /**
   * Lists runs for a specific workspace with in-memory sort fallback.
   */
  public static async listRuns(
    workspaceId: string,
    limitCount: number = 20
  ): Promise<AgentRun[]> {
    try {
      const snapshot = await adminDb
        .collection(this.RUNS_COLLECTION)
        .where('workspaceId', '==', workspaceId)
        .orderBy('createdAt', 'desc')
        .limit(limitCount)
        .get();

      return snapshot.docs.map((doc) => doc.data() as AgentRun);
    } catch {
      // In-memory fallback while composite index builds
      const snapshot = await adminDb
        .collection(this.RUNS_COLLECTION)
        .where('workspaceId', '==', workspaceId)
        .limit(50)
        .get();

      const items = snapshot.docs.map((doc) => doc.data() as AgentRun);
      return items
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
        .slice(0, limitCount);
    }
  }

  /**
   * Resolves dynamic template variables referencing results from previous steps.
   * e.g. {{step.1.id}} or {{step.1.entityId}}
   */
  private static interpolateArguments(
    args: Record<string, McpPayloadValue>,
    previousSteps: SupervisorPlanStep[]
  ): Record<string, McpPayloadValue> {
    const resolved: Record<string, McpPayloadValue> = {};
    for (const [key, val] of Object.entries(args)) {
      if (typeof val === 'string' && val.includes('{{step.')) {
        const match = val.match(/\{\{step\.(\d+)\.(.*?)\}\}/);
        if (match) {
          const stepNum = parseInt(match[1], 10);
          const field = match[2];
          const prevStep = previousSteps.find((s) => s.stepNumber === stepNum);
          if (prevStep?.result && field in prevStep.result) {
            resolved[key] = prevStep.result[field];
            continue;
          }
        }
      }
      resolved[key] = val;
    }
    return resolved;
  }
}
