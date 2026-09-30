/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Governed MCP Server Actions
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tenant Authorization Gate (agents_mcp PR-1 / N2):
 *    - Every export derives the caller from the SESSION via `authorizeMcpGovernance`
 *      (`requireWorkspace`), and the organization from the workspace document. No export accepts
 *      `userId` or `organizationId`: these used to come from the caller, and the old
 *      `checkWorkspaceAccess(workspaceId, userId)` call had its arguments swapped and tested a
 *      result object as a boolean, so it could never deny. Anyone could mint API keys, change
 *      approval policies, adjudicate approvals and run tools as another user.
 *    - Reads need `management → systemSettings: view`; anything that grants access or changes
 *      data (keys, policies, adjudication, the tool runner) needs `systemSettings: edit`, the same
 *      permission that guards organization integrations (`requireOrgAdmin`).
 *    - Record-level checks: a revoked key and an adjudicated approval must belong to the
 *      workspace, and nobody may approve their own request.
 * 2. Actionable Error Navigation (Rule 1):
 *    - All error responses strictly include relative paths starting with `/`.
 * 3. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - All inputs, return models, and discriminated unions are strictly typed.
 *
 * @testability Authorization: `src/lib/mcp/__tests__/mcp-governance-actions-auth.test.ts`.
 *              Gateway: `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

'use server';

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { requireWorkspace, UnauthorizedError, ForbiddenError } from '@/lib/auth/require-auth';
import { canUser } from '@/lib/workspace-permissions';
import { globalMcpRegistry } from '../registry';
import { registerAllCoreTools } from '../tools';
import { McpGateway } from '../gateway';
import { McpApiKeyService } from '../api-key-service';
import { McpApprovalEngine } from '../approval-engine';
import { McpAuditLogger } from '../audit-logger';
import { toClientErrorMessage } from '@/lib/errors/report-error';
import type {
  McpToolDescriptor,
  McpApiKey,
  McpPendingApproval,
  McpAuditLog,
  McpApprovalPolicy,
  McpCategory,
  McpRiskLevel,
  McpJsonRpcResponse,
  McpJsonRpcRequest,
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

type Failure = Extract<ActionResult<never>, { success: false }>;

export interface GovernedToolInfo extends McpToolDescriptor {
  enabled: boolean;
  isCustomPolicy: boolean;
}

interface McpGovernanceCaller {
  uid: string;
  organizationId: string;
}

/** The backoffice console's pseudo-workspace (see BackofficeCompanyBrainClient). System admins only. */
const PLATFORM_WORKSPACE = { id: 'platform_backoffice', organizationId: 'platform_org' } as const;

const SIGN_IN = { path: '/login', label: 'Sign In' } as const;
const SWITCH_WORKSPACE = { path: '/admin/workspaces', label: 'Switch Workspace' } as const;

/**
 * The verified caller for MCP governance in `workspaceId`, or a ready-to-return failure.
 *
 * - Identity: the session (`requireWorkspace` also proves workspace membership).
 * - Organization: read from the workspace document, never taken from the request.
 * - `view` needs management → systemSettings: view; `manage` needs systemSettings: edit.
 *   System admins pass (canUser's own bypass).
 * CAUTION: every export must call this first and use only the returned uid/organizationId.
 */
async function authorizeMcpGovernance(
  workspaceId: string,
  level: 'view' | 'manage'
): Promise<McpGovernanceCaller | Failure> {
  let uid: string;
  let isSystemAdmin: boolean;
  try {
    ({ uid, isSystemAdmin } = await requireWorkspace(workspaceId));
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return { success: false, error: 'Please sign in again.', code: 'unauthenticated', actionConfig: SIGN_IN };
    }
    if (err instanceof ForbiddenError) {
      return { success: false, error: 'You do not have access to this workspace.', code: 'unauthorized', actionConfig: SWITCH_WORKSPACE };
    }
    throw err;
  }

  // The backoffice CompanyBrain console runs against a platform pseudo-workspace that has no
  // workspace document. Only platform system admins may use it.
  if (workspaceId === PLATFORM_WORKSPACE.id) {
    return isSystemAdmin
      ? { uid, organizationId: PLATFORM_WORKSPACE.organizationId }
      : { success: false, error: 'Only platform administrators can use this console.', code: 'unauthorized' };
  }

  const permission = await canUser(uid, 'management', 'systemSettings', level === 'manage' ? 'edit' : 'view', workspaceId);
  if (!permission.granted) {
    return { success: false, error: 'Only workspace administrators can manage AI tools.', code: 'unauthorized' };
  }

  const workspaceSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
  const organizationId: unknown = workspaceSnap.get('organizationId');
  if (!workspaceSnap.exists || typeof organizationId !== 'string' || !organizationId) {
    return { success: false, error: 'Workspace not found.', code: 'not_found', actionConfig: SWITCH_WORKSPACE };
  }
  return { uid, organizationId };
}

const isFailure = (value: McpGovernanceCaller | Failure): value is Failure => 'success' in value;

const serverError = (err: unknown, fallback: string): Failure => ({
  success: false,
  error: toClientErrorMessage('mcp.actions.mcp-governance-actions', err, undefined, fallback),
  code: 'server_error',
});

/**
 * Lists all registered tools merged with workspace governance policies.
 */
export async function listMcpToolsAction(params: {
  workspaceId: string;
}): Promise<ActionResult<GovernedToolInfo[]>> {
  const caller = await authorizeMcpGovernance(params.workspaceId, 'view');
  if (isFailure(caller)) return caller;

  try {
    const descriptors = globalMcpRegistry.getToolDescriptors();
    const policies = await McpApprovalEngine.listApprovalPolicies(params.workspaceId);
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
    return serverError(err, 'Failed to list MCP tools.');
  }
}

/**
 * Executes an MCP tool from the admin interactive console, as the signed-in administrator.
 * Tools can change CRM data, so this needs `manage`.
 */
export async function executeMcpToolAction(params: {
  workspaceId: string;
  toolName: string;
  inputArguments: Record<string, McpPayloadValue>;
}): Promise<ActionResult<McpJsonRpcResponse>> {
  const caller = await authorizeMcpGovernance(params.workspaceId, 'manage');
  if (isFailure(caller)) return caller;

  try {
    const rpcRequest: McpJsonRpcRequest = {
      jsonrpc: '2.0',
      id: `call_${crypto.randomUUID().slice(0, 8)}`,
      method: 'tools/call',
      params: {
        name: params.toolName,
        arguments: params.inputArguments,
      },
    };

    const response = await McpGateway.handleRequest(rpcRequest, {
      workspaceId: params.workspaceId,
      organizationId: caller.organizationId,
      callerId: caller.uid,
      callerType: 'user',
      requestId: `req_${crypto.randomUUID()}`,
      callDepth: 0,
      timestamp: new Date().toISOString(),
    });

    return { success: true, data: response };
  } catch (err) {
    return serverError(err, 'Failed to execute tool via MCP gateway.');
  }
}

/**
 * Lists pending approvals requiring human review.
 */
export async function listPendingApprovalsAction(params: {
  workspaceId: string;
  status?: 'pending' | 'approved' | 'rejected';
}): Promise<ActionResult<McpPendingApproval[]>> {
  const caller = await authorizeMcpGovernance(params.workspaceId, 'view');
  if (isFailure(caller)) return caller;

  try {
    const approvals = await McpApprovalEngine.listApprovals(params.workspaceId, params.status);
    return { success: true, data: approvals };
  } catch (err) {
    return serverError(err, 'Failed to fetch pending approvals.');
  }
}

/**
 * Adjudicates a pending tool execution approval.
 * The approval must belong to this workspace and still be pending, and the requester can never
 * approve their own request (separation of duties).
 */
export async function adjudicateApprovalAction(params: {
  workspaceId: string;
  approvalId: string;
  decision: 'approved' | 'rejected';
  notes?: string;
}): Promise<ActionResult<McpPendingApproval>> {
  const caller = await authorizeMcpGovernance(params.workspaceId, 'manage');
  if (isFailure(caller)) return caller;

  try {
    const approval = await McpApprovalEngine.getApprovalById(params.approvalId);
    if (!approval || approval.workspaceId !== params.workspaceId) {
      return { success: false, error: 'Approval not found.', code: 'not_found' };
    }
    if (approval.status !== 'pending') {
      return { success: false, error: 'This request has already been decided.', code: 'validation_error' };
    }
    if (approval.callerId === caller.uid) {
      return { success: false, error: 'You cannot approve your own request.', code: 'unauthorized' };
    }

    const result = await McpApprovalEngine.adjudicate({
      approvalId: params.approvalId,
      decision: params.decision,
      adjudicatedBy: caller.uid,
      notes: params.notes,
    });

    return { success: true, data: result };
  } catch (err) {
    return serverError(err, 'Failed to adjudicate approval.');
  }
}

/**
 * Lists workspace-scoped MCP API keys.
 */
export async function listMcpApiKeysAction(params: {
  workspaceId: string;
}): Promise<ActionResult<McpApiKey[]>> {
  const caller = await authorizeMcpGovernance(params.workspaceId, 'view');
  if (isFailure(caller)) return caller;

  try {
    const keys = await McpApiKeyService.listApiKeys(params.workspaceId);
    return { success: true, data: keys };
  } catch (err) {
    return serverError(err, 'Failed to list API keys.');
  }
}

/**
 * Generates a new MCP API key with one-time plaintext key return.
 * The key is bound to this workspace and its organization (from the workspace document).
 */
export async function createMcpApiKeyAction(params: {
  workspaceId: string;
  name: string;
  role: 'admin' | 'member' | 'agent';
  allowedCategories?: McpCategory[];
  expiresInDays?: number;
}): Promise<ActionResult<{ apiKey: McpApiKey; plaintextKey: string }>> {
  const caller = await authorizeMcpGovernance(params.workspaceId, 'manage');
  if (isFailure(caller)) return caller;

  try {
    const result = await McpApiKeyService.createApiKey({
      workspaceId: params.workspaceId,
      organizationId: caller.organizationId,
      name: params.name,
      role: params.role,
      allowedCategories: params.allowedCategories,
      expiresInDays: params.expiresInDays,
      createdBy: caller.uid,
    });

    return { success: true, data: result };
  } catch (err) {
    return serverError(err, 'Failed to generate MCP API key.');
  }
}

/**
 * Revokes an existing API key immediately. The key must belong to this workspace.
 */
export async function revokeMcpApiKeyAction(params: {
  workspaceId: string;
  keyId: string;
}): Promise<ActionResult<{ keyId: string; revoked: boolean }>> {
  const caller = await authorizeMcpGovernance(params.workspaceId, 'manage');
  if (isFailure(caller)) return caller;

  try {
    const key = await McpApiKeyService.getApiKeyById(params.keyId);
    if (!key || key.workspaceId !== params.workspaceId) {
      return { success: false, error: 'API key not found.', code: 'not_found' };
    }
    await McpApiKeyService.revokeApiKey(params.keyId, caller.uid);
    return { success: true, data: { keyId: params.keyId, revoked: true } };
  } catch (err) {
    return serverError(err, 'Failed to revoke API key.');
  }
}

/**
 * Lists audit logs for a workspace.
 */
export async function listMcpAuditLogsAction(params: {
  workspaceId: string;
  limit?: number;
}): Promise<ActionResult<McpAuditLog[]>> {
  const caller = await authorizeMcpGovernance(params.workspaceId, 'view');
  if (isFailure(caller)) return caller;

  try {
    // Bounded read (Rule 9): at most 200 entries per call.
    const logs = await McpAuditLogger.listAuditLogs(params.workspaceId, Math.min(params.limit ?? 50, 200));
    return { success: true, data: logs };
  } catch (err) {
    return serverError(err, 'Failed to fetch MCP audit logs.');
  }
}

/**
 * Updates governance policy override for a tool in the workspace.
 */
export async function upsertMcpApprovalPolicyAction(params: {
  workspaceId: string;
  toolName: string;
  requiresApproval: boolean;
  customRiskLevel?: McpRiskLevel;
  enabled: boolean;
}): Promise<ActionResult<McpApprovalPolicy>> {
  const caller = await authorizeMcpGovernance(params.workspaceId, 'manage');
  if (isFailure(caller)) return caller;

  try {
    const policy = await McpApprovalEngine.upsertApprovalPolicy({
      workspaceId: params.workspaceId,
      organizationId: caller.organizationId,
      toolName: params.toolName,
      requiresApproval: params.requiresApproval,
      customRiskLevel: params.customRiskLevel,
      enabled: params.enabled,
      updatedBy: caller.uid,
    });

    return { success: true, data: policy };
  } catch (err) {
    return serverError(err, 'Failed to update governance policy.');
  }
}
