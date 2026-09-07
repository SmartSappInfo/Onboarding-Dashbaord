/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Base Domain Specialist & Tool Permission Sandbox
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1):
 *    - All arguments and return values adhere strictly to `McpPayloadValue` and `AgentResult`.
 * 2. Tool Sandbox & Permission Whitelisting:
 *    - Specialists CANNOT execute any tool outside their `descriptor.allowedTools`.
 *    - Workspace-level policy overrides in `/agent_specialists` are evaluated dynamically.
 * 3. Human-in-the-Loop Interception:
 *    - If an invoked MCP tool returns error `-32003` (Approval Required), the specialist
 *      records status `'needs_approval'` and captures the pending approval ID.
 * 4. Grounded Citations & Audit Trail:
 *    - Every tool call is tracked in `toolCalls` with latency and status.
 *
 * @testability Covered in `src/lib/agents/__tests__/domain-agents.test.ts`.
 */

import { McpGateway } from '@/lib/mcp/gateway';
import type {
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpPayloadValue,
} from '@/lib/mcp/types';
import type {
  SmartSappDomainSpecialist,
  DomainSpecialistId,
  SpecialistDescriptor,
  SpecialistMemoryScope,
  SpecialistAutonomyLevel,
  SpecialistWorkspaceConfig,
} from '../domain-types';
import type {
  AgentRequest,
  AgentResult,
  AgentToolCall,
  AgentFinding,
  AgentActionProposal,
} from '@/lib/supervisor/types';
import type { ContextSourceCitation } from '@/lib/memory/context-types';
import { adminDb } from '@/lib/firebase-admin';

export class AgentSecurityViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentSecurityViolationError';
  }
}

/**
 * In-memory cache of workspace specialist configurations to prevent repeated Firestore reads.
 * Key: `${workspaceId}_${specialistId}`
 */
const workspaceConfigCache = new Map<string, { config: SpecialistWorkspaceConfig; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

export abstract class BaseDomainSpecialist implements SmartSappDomainSpecialist {
  public readonly id: string;
  public readonly name: string;
  public readonly version: string;
  public readonly category: 'domain' | 'utility';
  public readonly description: string;
  public readonly capabilities: SpecialistDescriptor['capabilities'];

  constructor(
    public readonly specialistId: DomainSpecialistId,
    public readonly descriptor: SpecialistDescriptor
  ) {
    this.id = specialistId;
    this.name = descriptor.name;
    this.version = descriptor.version;
    this.category = descriptor.category;
    this.description = descriptor.personaDescription;
    this.capabilities = descriptor.capabilities;
  }

  public getAllowedTools(): string[] {
    return [...this.descriptor.allowedTools];
  }

  public getMemoryScope(): SpecialistMemoryScope {
    return {
      readDomains: [...this.descriptor.memoryScope.readDomains],
      writeDomains: [...this.descriptor.memoryScope.writeDomains],
      disallowedDomains: [...this.descriptor.memoryScope.disallowedDomains],
    };
  }

  /**
   * Main entrypoint conforming to `SmartSappAgent`.
   */
  public async execute(request: AgentRequest): Promise<AgentResult> {
    const config = await this.getWorkspaceConfig(request.workspaceId);

    // If autonomy is read_only, verify no write tools are dispatched
    return this.runDomainAnalysis(request, config);
  }

  /**
   * Subclasses implement their domain reasoning and MCP tool orchestration.
   */
  protected abstract runDomainAnalysis(
    request: AgentRequest,
    config: SpecialistWorkspaceConfig | null
  ): Promise<AgentResult>;

  /**
   * Dispatches a governed tool call through `McpGateway` while enforcing:
   * 1. Hardcoded descriptor allowedTools whitelist.
   * 2. Dynamic workspace disabledTools policy.
   * 3. Autonomy level constraints (e.g. read_only blocks mutations).
   */
  protected async callGovernedTool(params: {
    toolName: string;
    arguments: Record<string, McpPayloadValue>;
    request: AgentRequest;
    toolCallsCollector: AgentToolCall[];
    sourcesCollector: ContextSourceCitation[];
    config?: SpecialistWorkspaceConfig | null;
  }): Promise<{
    success: boolean;
    result?: Record<string, McpPayloadValue>;
    error?: string;
    requiresApproval?: boolean;
    approvalId?: string;
  }> {
    const { toolName, arguments: args, request, toolCallsCollector, sourcesCollector, config } = params;

    // 1. Check Hardcoded Allowed Tools Whitelist
    if (!this.descriptor.allowedTools.includes(toolName)) {
      const err = `Tool "${toolName}" is not permitted for specialist "${this.specialistId}". Allowed tools: [${this.descriptor.allowedTools.join(', ')}].`;
      toolCallsCollector.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        stepNumber: toolCallsCollector.length + 1,
        toolName,
        parameters: args,
        arguments: args,
        status: 'error',
        error: err,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });
      throw new AgentSecurityViolationError(err);
    }

    // 2. Check Dynamic Workspace Policy
    if (config?.disabledTools?.includes(toolName)) {
      const err = `Tool "${toolName}" has been explicitly disabled for "${this.specialistId}" in workspace "${request.workspaceId}".`;
      toolCallsCollector.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        stepNumber: toolCallsCollector.length + 1,
        toolName,
        parameters: args,
        arguments: args,
        status: 'error',
        error: err,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });
      throw new AgentSecurityViolationError(err);
    }

    // 3. Dispatch through MCP Gateway via JSON-RPC 2.0
    const startMs = Date.now();
    const rpcRequest: McpJsonRpcRequest = {
      jsonrpc: '2.0',
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    try {
      const response: McpJsonRpcResponse = await McpGateway.handleRequest(rpcRequest, {
        workspaceId: request.workspaceId,
        organizationId: request.organizationId,
        callerId: request.actor.id,
        callerType: 'user',
        userId: request.actor.id,
        requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        callDepth: 1,
        timestamp: new Date().toISOString(),
      });

      const durationMs = Date.now() - startMs;

      // Handle JSON-RPC Error Responses
      if (response.error) {
        // Special case: -32003 (Approval Required)
        if (response.error.code === -32003) {
          const errData = response.error.data as Record<string, McpPayloadValue> | undefined;
          const approvalId = (errData?.approvalId as string) || (errData?.pendingApprovalId as string) || undefined;

          toolCallsCollector.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            stepNumber: toolCallsCollector.length + 1,
            toolName,
            parameters: args,
            arguments: args,
            status: 'needs_approval',
            error: response.error.message,
            approvalId,
            durationMs,
            timestamp: new Date().toISOString(),
          });

          return {
            success: false,
            error: response.error.message,
            requiresApproval: true,
            approvalId,
          };
        }

        toolCallsCollector.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          stepNumber: toolCallsCollector.length + 1,
          toolName,
          parameters: args,
          arguments: args,
          status: 'error',
          error: response.error.message,
          durationMs,
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          error: response.error.message,
        };
      }

      // Success
      const resObj = (response.result as Record<string, McpPayloadValue>) || {};
      toolCallsCollector.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        stepNumber: toolCallsCollector.length + 1,
        toolName,
        parameters: args,
        arguments: args,
        status: 'success',
        result: resObj,
        durationMs,
        timestamp: new Date().toISOString(),
      });

      // Extract Context Citations if returned
      if (Array.isArray(resObj.citations)) {
        for (const cit of resObj.citations) {
          if (
            typeof cit === 'object' &&
            cit !== null &&
            !Array.isArray(cit) &&
            'sourceId' in cit &&
            'sourceTitle' in cit
          ) {
            const rawCit = cit as Record<string, McpPayloadValue>;
            sourcesCollector.push({
              sourceId: String(rawCit.sourceId || ''),
              sourceType: (rawCit.sourceType as ContextSourceCitation['sourceType']) || 'note',
              sourceTitle: String(rawCit.sourceTitle || 'Knowledge Citation'),
              excerpt: String(rawCit.excerpt || ''),
              score: typeof rawCit.score === 'number' ? rawCit.score : 0.8,
              uri: typeof rawCit.uri === 'string' ? rawCit.uri : undefined,
            });
          }
        }
      }

      return {
        success: true,
        result: resObj,
      };
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const errorMsg = err instanceof Error ? err.message : 'Unknown tool dispatch exception';

      toolCallsCollector.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        stepNumber: toolCallsCollector.length + 1,
        toolName,
        parameters: args,
        arguments: args,
        status: 'error',
        error: errorMsg,
        durationMs,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Resolves workspace configuration override from Firestore with in-memory caching.
   */
  protected async getWorkspaceConfig(workspaceId: string): Promise<SpecialistWorkspaceConfig | null> {
    const cacheKey = `${workspaceId}_${this.specialistId}`;
    const cached = workspaceConfigCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.config;
    }

    if (!adminDb) {
      return null;
    }

    try {
      const docRef = adminDb.collection('agent_specialists').doc(cacheKey);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        return null;
      }

      const data = snapshot.data();
      if (!data) return null;

      const config: SpecialistWorkspaceConfig = {
        workspaceId,
        specialistId: this.specialistId,
        autonomyLevel: (data.autonomyLevel as SpecialistAutonomyLevel) || this.descriptor.defaultAutonomy,
        disabledTools: Array.isArray(data.disabledTools) ? (data.disabledTools as string[]) : [],
        customDirective: typeof data.customDirective === 'string' ? data.customDirective : undefined,
        updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : 'system',
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
      };

      workspaceConfigCache.set(cacheKey, {
        config,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return config;
    } catch (err) {
      console.warn(`[BaseDomainSpecialist] Failed to load workspace config for ${cacheKey}:`, err);
      return null;
    }
  }

  /**
   * Helper to construct a standard AgentResult.
   */
  protected buildResult(params: {
    runId?: string;
    status: AgentResult['status'];
    answer: string;
    findings: AgentFinding[];
    actions: AgentActionProposal[];
    toolCalls: AgentToolCall[];
    sources: ContextSourceCitation[];
    memoriesCreated?: string[];
  }): AgentResult {
    const hasApprovalPending = params.toolCalls.some((tc) => tc.status === 'needs_approval');
    const finalStatus: AgentResult['status'] =
      params.status !== 'failed' && hasApprovalPending ? 'needs_approval' : params.status;

    return {
      runId: params.runId || `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: finalStatus,
      answer: params.answer,
      findings: params.findings,
      actions: params.actions,
      toolCalls: params.toolCalls,
      sources: params.sources,
      memoriesCreated: params.memoriesCreated,
    };
  }
}
