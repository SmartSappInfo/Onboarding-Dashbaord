/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Governed MCP Server Actions
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tenant Authorization Gate:
 *    - Gated by `checkWorkspaceAccess` before executing any MCP tool or querying registry/telemetry.
 * 2. Actionable Error Navigation (Rule 1):
 *    - All error responses strictly include relative paths starting with `/`.
 * 3. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - All inputs, return models, and discriminated unions are strictly typed.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

'use server';

import crypto from 'crypto';
import { checkWorkspaceAccess } from '@/lib/workspace-permissions';
import { globalMcpRegistry } from '../registry';
import { registerAllCoreTools } from '../tools';
import { McpGateway } from '../gateway';
import { McpApiKeyService } from '../api-key-service';
import { McpApprovalEngine } from '../approval-engine';
import { McpAuditLogger } from '../audit-logger';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import type {
  McpToolDescriptor,
  McpApiKey,
  McpPendingApproval,
  McpAuditLog,
  McpApprovalPolicy,
  McpCategory,
  McpRiskLevel,
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpPayloadValue,
} from '../types';

// Ensure all core tools are initialized in the registry
registerAllCoreTools(globalMcpRegistry);

export type ActionResult<T> =
  | { success: true; data: T; error?: never; code?: never; actionConfig?: never }
  | {
      success: false;
      data?: never;
      error: string;
      code?: 'unauthenticated' | 'unauthorized' | 'validation_error' | 'not_found' | 'server_error';
      actionConfig?: { path: string; label: string };
    };

export interface GovernedToolInfo extends McpToolDescriptor {
  enabled: boolean;
  isCustomPolicy: boolean;
}

/**
 * Lists all registered tools merged with workspace governance policies.
 */
export async function listMcpToolsAction(params: {
  workspaceId: string;
  userId: string;
}): Promise<ActionResult<GovernedToolInfo[]>> {
  const { workspaceId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const descriptors = globalMcpRegistry.getToolDescriptors();
    const policies = await McpApprovalEngine.listApprovalPolicies(workspaceId);
    const policyMap = new Map(policies.map((p) => [p.toolName, p]));

    const governedTools: GovernedToolInfo[] = descriptors.map((d) => {
      const customPolicy = policyMap.get(d.name);
      return {
        ...d,
        requiresApproval: customPolicy ? customPolicy.requiresApproval : d.requiresApproval,
        riskLevel: customPolicy?.customRiskLevel || d.riskLevel,
        enabled: customPolicy ? customPolicy.enabled : true,
        isCustomPolicy: Boolean(customPolicy),
      };
    });

    return { success: true, data: governedTools };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('mcp.actions.mcp-governance-actions', err, undefined, 'Failed to list MCP tools.'),
      code: 'server_error',
    };
  }
}

/**
 * Executes an MCP tool from the admin backoffice interactive console.
 */
export async function executeMcpToolAction(params: {
  workspaceId: string;
  organizationId: string;
  userId: string;
  toolName: string;
  inputArguments: Record<string, McpPayloadValue>;
}): Promise<ActionResult<McpJsonRpcResponse>> {
  const { workspaceId, organizationId, userId, toolName, inputArguments } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'You do not have access to this workspace.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const rpcRequest: McpJsonRpcRequest = {
      jsonrpc: '2.0',
      id: `call_${crypto.randomUUID().slice(0, 8)}`,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: inputArguments,
      },
    };

    const response = await McpGateway.handleRequest(rpcRequest, {
      workspaceId,
      organizationId,
      callerId: userId,
      callerType: 'user',
      requestId: `req_${crypto.randomUUID()}`,
      callDepth: 0,
      timestamp: new Date().toISOString(),
    });

    return { success: true, data: response };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('mcp.actions.mcp-governance-actions', err, undefined, 'Failed to execute tool via MCP gateway.'),
      code: 'server_error',
    };
  }
}

/**
 * Lists pending approvals requiring human review.
 */
export async function listPendingApprovalsAction(params: {
  workspaceId: string;
  userId: string;
  status?: 'pending' | 'approved' | 'rejected';
}): Promise<ActionResult<McpPendingApproval[]>> {
  const { workspaceId, userId, status } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const approvals = await McpApprovalEngine.listApprovals(workspaceId, status);
    return { success: true, data: approvals };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('mcp.actions.mcp-governance-actions', err, undefined, 'Failed to fetch pending approvals.'),
      code: 'server_error',
    };
  }
}

/**
 * Adjudicates a pending tool execution approval.
 */
export async function adjudicateApprovalAction(params: {
  workspaceId: string;
  userId: string;
  approvalId: string;
  decision: 'approved' | 'rejected';
  notes?: string;
}): Promise<ActionResult<McpPendingApproval>> {
  const { workspaceId, userId, approvalId, decision, notes } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const result = await McpApprovalEngine.adjudicate({
      approvalId,
      decision,
      adjudicatedBy: userId,
      notes,
    });

    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('mcp.actions.mcp-governance-actions', err, undefined, 'Failed to adjudicate approval.'),
      code: 'server_error',
    };
  }
}

/**
 * Lists workspace-scoped MCP API keys.
 */
export async function listMcpApiKeysAction(params: {
  workspaceId: string;
  userId: string;
}): Promise<ActionResult<McpApiKey[]>> {
  const { workspaceId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const keys = await McpApiKeyService.listApiKeys(workspaceId);
    return { success: true, data: keys };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('mcp.actions.mcp-governance-actions', err, undefined, 'Failed to list API keys.'),
      code: 'server_error',
    };
  }
}

/**
 * Generates a new MCP API key with one-time plaintext key return.
 */
export async function createMcpApiKeyAction(params: {
  workspaceId: string;
  organizationId: string;
  userId: string;
  name: string;
  role: 'admin' | 'member' | 'agent';
  allowedCategories?: McpCategory[];
  expiresInDays?: number;
}): Promise<ActionResult<{ apiKey: McpApiKey; plaintextKey: string }>> {
  const { workspaceId, organizationId, userId, name, role, allowedCategories, expiresInDays } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const result = await McpApiKeyService.createApiKey({
      workspaceId,
      organizationId,
      name,
      role,
      allowedCategories,
      expiresInDays,
      createdBy: userId,
    });

    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('mcp.actions.mcp-governance-actions', err, undefined, 'Failed to generate MCP API key.'),
      code: 'server_error',
    };
  }
}

/**
 * Revokes an existing API key immediately.
 */
export async function revokeMcpApiKeyAction(params: {
  workspaceId: string;
  userId: string;
  keyId: string;
}): Promise<ActionResult<{ keyId: string; revoked: boolean }>> {
  const { workspaceId, userId, keyId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    await McpApiKeyService.revokeApiKey(keyId, userId);
    return { success: true, data: { keyId, revoked: true } };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('mcp.actions.mcp-governance-actions', err, undefined, 'Failed to revoke API key.'),
      code: 'server_error',
    };
  }
}

/**
 * Lists audit logs for a workspace.
 */
export async function listMcpAuditLogsAction(params: {
  workspaceId: string;
  userId: string;
  limit?: number;
}): Promise<ActionResult<McpAuditLog[]>> {
  const { workspaceId, userId, limit } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const logs = await McpAuditLogger.listAuditLogs(workspaceId, limit ?? 50);
    return { success: true, data: logs };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('mcp.actions.mcp-governance-actions', err, undefined, 'Failed to fetch MCP audit logs.'),
      code: 'server_error',
    };
  }
}

/**
 * Updates governance policy override for a tool in the workspace.
 */
export async function upsertMcpApprovalPolicyAction(params: {
  workspaceId: string;
  organizationId: string;
  userId: string;
  toolName: string;
  requiresApproval: boolean;
  customRiskLevel?: McpRiskLevel;
  enabled: boolean;
}): Promise<ActionResult<McpApprovalPolicy>> {
  const { workspaceId, organizationId, userId, toolName, requiresApproval, customRiskLevel, enabled } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }

  const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
  if (!hasAccess) {
    return {
      success: false,
      error: 'Access denied.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/workspaces', label: 'Switch Workspace' },
    };
  }

  try {
    const policy = await McpApprovalEngine.upsertApprovalPolicy({
      workspaceId,
      organizationId,
      toolName,
      requiresApproval,
      customRiskLevel,
      enabled,
      updatedBy: userId,
    });

    return { success: true, data: policy };
  } catch (err) {
    return {
      success: false,
      error: toClientErrorMessage('mcp.actions.mcp-governance-actions', err, undefined, 'Failed to update governance policy.'),
      code: 'server_error',
    };
  }
}
