/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Risk & Approval Engine
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Execution Governance:
 *    - Intercepts all tool execution requests before dispatch.
 *    - Gating criteria: base tool `requiresApproval`, `riskLevel` ('high_risk' | 'critical'),
 *      or workspace custom policy override in `/mcp_approval_policies`.
 * 2. Immutable Auditability:
 *    - Queued requests are durably persisted in `/mcp_pending_approvals`.
 *    - Adjudication retains who approved/rejected, timestamp, and notes.
 * 3. Strict Zero-`any` & Zero-`unknown` Invariant:
 *    - Fully typed with `McpPendingApproval`, `McpApprovalPolicy`, and `McpPayloadValue`.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import type {
  McpPendingApproval,
  McpApprovalPolicy,
  McpExecutionContext,
  McpPayloadValue,
  McpRiskLevel,
} from './types';
import type { RegisteredMcpTool } from './registry';

export interface EvaluationResult {
  allowedToExecute: boolean;
  requiresApproval: boolean;
  pendingApproval?: McpPendingApproval;
  rejectionReason?: string;
}

export class McpApprovalEngine {
  private static readonly APPROVALS_COLLECTION = 'mcp_pending_approvals';
  private static readonly POLICIES_COLLECTION = 'mcp_approval_policies';

  /**
   * Evaluates if a tool invocation can proceed automatically or requires human approval.
   */
  public static async evaluateToolExecution(
    tool: RegisteredMcpTool,
    params: Record<string, McpPayloadValue>,
    context: McpExecutionContext
  ): Promise<EvaluationResult> {
    // 1. Fetch any workspace-level policy override
    const policy = await this.getApprovalPolicy(context.workspaceId, tool.name);

    if (policy && !policy.enabled) {
      return {
        allowedToExecute: false,
        requiresApproval: false,
        rejectionReason: `Tool "${tool.name}" is disabled by workspace security policy.`,
      };
    }

    // Determine effective risk and approval requirements
    const effectiveRequiresApproval =
      policy?.requiresApproval ??
      (tool.requiresApproval || tool.riskLevel === 'high_risk' || tool.riskLevel === 'critical');

    if (!effectiveRequiresApproval) {
      return { allowedToExecute: true, requiresApproval: false };
    }

    // High-risk or policy-flagged execution: queue for human approval
    const id = `mcpappr_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    const pendingApproval: McpPendingApproval = {
      id,
      toolName: tool.name,
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
      callerId: context.callerId,
      callerType: context.callerType,
      inputPayload: params,
      reason: `Action carries ${tool.riskLevel.toUpperCase()} risk and requires administrator review before executing.`,
      status: 'pending',
      createdAt: timestamp,
    };

    await adminDb.collection(this.APPROVALS_COLLECTION).doc(id).set(pendingApproval);

    return {
      allowedToExecute: false,
      requiresApproval: true,
      pendingApproval,
    };
  }

  /**
   * Adjudicates a pending tool execution approval.
   */
  public static async adjudicate(params: {
    approvalId: string;
    decision: 'approved' | 'rejected';
    adjudicatedBy: string;
    notes?: string;
  }): Promise<McpPendingApproval> {
    const ref = adminDb.collection(this.APPROVALS_COLLECTION).doc(params.approvalId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error(`Pending approval "${params.approvalId}" not found.`);
    }

    const current = snap.data() as McpPendingApproval;
    if (current.status !== 'pending') {
      throw new Error(`Approval "${params.approvalId}" has already been adjudicated (${current.status}).`);
    }

    const updates: Partial<McpPendingApproval> = {
      status: params.decision,
      adjudicatedAt: new Date().toISOString(),
      adjudicatedBy: params.adjudicatedBy,
      adjudicationNotes: params.notes || '',
    };

    await ref.update(updates);

    return {
      ...current,
      ...updates,
    };
  }

  /**
   * Retrieves pending approvals for a workspace.
   */
  public static async listApprovals(
    workspaceId: string,
    status?: 'pending' | 'approved' | 'rejected'
  ): Promise<McpPendingApproval[]> {
    try {
      let query: FirebaseFirestore.Query = adminDb
        .collection(this.APPROVALS_COLLECTION)
        .where('workspaceId', '==', workspaceId);

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').limit(100).get();
      return snapshot.docs.map((doc) => doc.data() as McpPendingApproval);
    } catch {
      // In-memory fallback while composite index builds
      let query: FirebaseFirestore.Query = adminDb
        .collection(this.APPROVALS_COLLECTION)
        .where('workspaceId', '==', workspaceId);

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.limit(100).get();
      const items = snapshot.docs.map((doc) => doc.data() as McpPendingApproval);
      return items.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    }
  }

  /**
   * Retrieves an approval by ID.
   */
  public static async getApprovalById(approvalId: string): Promise<McpPendingApproval | null> {
    const snap = await adminDb.collection(this.APPROVALS_COLLECTION).doc(approvalId).get();
    if (!snap.exists) {
      return null;
    }
    return snap.data() as McpPendingApproval;
  }

  /**
   * Fetches policy override for a specific tool in a workspace.
   */
  public static async getApprovalPolicy(
    workspaceId: string,
    toolName: string
  ): Promise<McpApprovalPolicy | null> {
    const docId = `${workspaceId}_${toolName.replace(/\./g, '_')}`;
    const snap = await adminDb.collection(this.POLICIES_COLLECTION).doc(docId).get();
    if (!snap.exists) {
      return null;
    }
    return snap.data() as McpApprovalPolicy;
  }

  /**
   * Sets or updates workspace policy for a specific tool.
   */
  public static async upsertApprovalPolicy(params: {
    workspaceId: string;
    organizationId: string;
    toolName: string;
    requiresApproval: boolean;
    customRiskLevel?: McpRiskLevel;
    enabled: boolean;
    updatedBy: string;
  }): Promise<McpApprovalPolicy> {
    const docId = `${params.workspaceId}_${params.toolName.replace(/\./g, '_')}`;
    const policy: McpApprovalPolicy = {
      id: docId,
      toolName: params.toolName,
      workspaceId: params.workspaceId,
      organizationId: params.organizationId,
      requiresApproval: params.requiresApproval,
      customRiskLevel: params.customRiskLevel,
      enabled: params.enabled,
      updatedAt: new Date().toISOString(),
      updatedBy: params.updatedBy,
    };

    await adminDb.collection(this.POLICIES_COLLECTION).doc(docId).set(policy, { merge: true });
    return policy;
  }

  /**
   * Lists all customized policies for a workspace.
   */
  public static async listApprovalPolicies(workspaceId: string): Promise<McpApprovalPolicy[]> {
    const snapshot = await adminDb
      .collection(this.POLICIES_COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .get();

    return snapshot.docs.map((doc) => doc.data() as McpApprovalPolicy);
  }
}
