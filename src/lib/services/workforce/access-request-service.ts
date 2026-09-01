/**
 * @fileOverview Access Request & Self-Service Approval Service (Workforce 2.0)
 *
 * Manages member role/workspace access requests, approval workflows,
 * and automated privilege assignment cascades.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Approving a request automatically provisions workspace memberships and executes
 *   atomic projection synchronization.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `workforce-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { AccessRequest, AccessRequestStatus } from '@/lib/types';
import { WorkspaceMembershipService } from '@/lib/services/identity/workspace-membership-service';
import { IdentityProjectionService } from '@/lib/services/identity/identity-projection-service';

export interface SubmitAccessRequestPayload {
  workspaceId?: string;
  workspaceName?: string;
  personId: string;
  personName: string;
  personEmail: string;
  requestedRoleIds: string[];
  requestedRoleNames?: string[];
  requestedWorkspaceIds?: string[];
  justification: string;
}

export class AccessRequestService {
  /**
   * Submits a new self-service access request.
   */
  static async submitRequest(
    organizationId: string,
    payload: SubmitAccessRequestPayload
  ): Promise<AccessRequest> {
    if (!organizationId) throw new Error('Missing organizationId');
    if (!payload.personId || !payload.personEmail) throw new Error('Missing requester identity');
    if (!payload.justification?.trim()) throw new Error('Justification is required for access requests');

    const now = new Date().toISOString();
    const reqRef = adminDb.collection('access_requests').doc();

    const request: AccessRequest = {
      id: reqRef.id,
      organizationId,
      workspaceId: payload.workspaceId || undefined,
      workspaceName: payload.workspaceName || undefined,
      personId: payload.personId,
      personName: payload.personName,
      personEmail: payload.personEmail,
      requestedRoleIds: payload.requestedRoleIds,
      requestedRoleNames: payload.requestedRoleNames || [],
      requestedWorkspaceIds: payload.requestedWorkspaceIds || [],
      justification: payload.justification.trim(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await reqRef.set(request);
    return request;
  }

  /**
   * Resolves (approves or rejects) an access request.
   */
  static async resolveRequest(params: {
    organizationId: string;
    requestId: string;
    resolution: 'approved' | 'rejected';
    reviewerId: string;
    reviewerName?: string;
    reviewNote?: string;
  }): Promise<AccessRequest> {
    const { organizationId, requestId, resolution, reviewerId, reviewerName, reviewNote } = params;

    const reqRef = adminDb.collection('access_requests').doc(requestId);
    const snap = await reqRef.get();

    if (!snap.exists) throw new Error('Access request not found');

    const current = { id: snap.id, ...snap.data() } as AccessRequest;
    if (current.organizationId !== organizationId) {
      throw new Error('Forbidden: Access request belongs to a different organization');
    }
    if (current.status !== 'pending') {
      throw new Error(`Request has already been ${current.status}`);
    }

    const now = new Date().toISOString();

    // If approved, provision requested roles into the target workspace membership
    if (resolution === 'approved' && current.workspaceId) {
      await WorkspaceMembershipService.upsertWorkspaceMembership({
        organizationId,
        workspaceId: current.workspaceId,
        workspaceName: current.workspaceName,
        personId: current.personId,
        roleAssignmentIds: current.requestedRoleIds,
        status: 'active',
      });

      // Synchronize legacy projection
      await IdentityProjectionService.syncUserProjection(organizationId, current.personId);
    }

    const updated: AccessRequest = {
      ...current,
      status: resolution,
      reviewedBy: reviewerId,
      reviewerName: reviewerName || undefined,
      reviewedAt: now,
      reviewNote: reviewNote || undefined,
      updatedAt: now,
    };

    await reqRef.set(updated, { merge: true });
    return updated;
  }

  /**
   * Lists pending access requests for an organization.
   */
  static async listPendingRequests(
    organizationId: string,
    workspaceId?: string
  ): Promise<AccessRequest[]> {
    if (!organizationId) return [];

    let query: FirebaseFirestore.Query = adminDb
      .collection('access_requests')
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'pending');

    if (workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    }

    const snap = await query.orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AccessRequest));
  }
}
