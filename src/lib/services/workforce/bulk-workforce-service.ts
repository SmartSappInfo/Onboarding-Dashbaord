/**
 * @fileOverview Chunked Bulk Workforce Lifecycle Engine (Workforce 2.0)
 *
 * Executes bulk workforce mutations (roles, workspaces, departments, suspensions)
 * chunked into safe batches of <= 250 write operations to guarantee resilience against
 * rate limits and resource exhaustion.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Chunk size strictly capped at 250 operations per batch.
 * - Every bulk change triggers `IdentityProjectionService.syncUserProjection()`.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `workforce-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { BulkWorkforceActionType, BulkOperationResult } from '@/lib/types';
import { PersonService } from '@/lib/services/identity/person-service';
import { OrganizationMembershipService } from '@/lib/services/identity/organization-membership-service';
import { WorkspaceMembershipService } from '@/lib/services/identity/workspace-membership-service';
import { IdentityProjectionService } from '@/lib/services/identity/identity-projection-service';

export interface BulkActionPayload {
  roleIds?: string[];
  workspaceId?: string;
  workspaceName?: string;
  departmentId?: string;
  departmentName?: string;
  teamId?: string;
}

const CHUNK_SIZE = 250;

export class BulkWorkforceService {
  /**
   * Splits an array of items into chunks of specified maximum size.
   */
  private static chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Executes a bulk operation over an array of person IDs with safe batch chunking.
   */
  static async executeBulkAction(params: {
    organizationId: string;
    personIds: string[];
    action: BulkWorkforceActionType;
    payload?: BulkActionPayload;
  }): Promise<BulkOperationResult> {
    const { organizationId, personIds, action, payload } = params;

    if (!organizationId) throw new Error('Missing organizationId');
    if (!personIds || personIds.length === 0) {
      return { totalProcessed: 0, succeeded: 0, failed: 0, errors: [] };
    }

    const chunks = this.chunkArray(personIds, CHUNK_SIZE);
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const chunk of chunks) {
      const batch = adminDb.batch();
      const chunkPersonsToSync: string[] = [];

      for (const personId of chunk) {
        try {
          switch (action) {
            case 'assign_roles':
              if (payload?.workspaceId && payload.roleIds) {
                await WorkspaceMembershipService.upsertWorkspaceMembership(
                  {
                    organizationId,
                    workspaceId: payload.workspaceId,
                    workspaceName: payload.workspaceName,
                    personId,
                    roleAssignmentIds: payload.roleIds,
                    status: 'active',
                  },
                  batch
                );
                chunkPersonsToSync.push(personId);
              }
              break;

            case 'assign_workspaces':
              if (payload?.workspaceId) {
                await WorkspaceMembershipService.upsertWorkspaceMembership(
                  {
                    organizationId,
                    workspaceId: payload.workspaceId,
                    workspaceName: payload.workspaceName,
                    personId,
                    roleAssignmentIds: payload.roleIds || [],
                    status: 'active',
                  },
                  batch
                );
                chunkPersonsToSync.push(personId);
              }
              break;

            case 'assign_department':
              if (payload?.departmentId !== undefined) {
                await PersonService.upsertPerson(
                  {
                    id: personId,
                    organizationId,
                    displayName: 'User', // Preserved on merge
                    email: '', // Preserved on merge
                    departmentId: payload.departmentId,
                  },
                  batch
                );
                chunkPersonsToSync.push(personId);
              }
              break;

            case 'suspend':
              await OrganizationMembershipService.updateMembershipStatus(
                organizationId,
                personId,
                'suspended',
                batch
              );
              chunkPersonsToSync.push(personId);
              break;

            case 'reactivate':
              await OrganizationMembershipService.updateMembershipStatus(
                organizationId,
                personId,
                'active',
                batch
              );
              chunkPersonsToSync.push(personId);
              break;

            default:
              break;
          }
          succeeded++;
        } catch (itemErr: unknown) {
          failed++;
          const msg = itemErr instanceof Error ? itemErr.message : 'Unknown item error';
          errors.push({ id: personId, error: msg });
        }
      }

      // Commit the chunk write operations
      try {
        await batch.commit();

        // Synchronize projections for all affected members in this chunk
        for (const pid of chunkPersonsToSync) {
          await IdentityProjectionService.syncUserProjection(organizationId, pid);
        }
      } catch (batchCommitErr: unknown) {
        const msg = batchCommitErr instanceof Error ? batchCommitErr.message : 'Batch commit error';
        console.error('[BulkWorkforceService] Batch commit failed:', msg);
      }
    }

    return {
      totalProcessed: personIds.length,
      succeeded,
      failed,
      errors,
    };
  }
}
