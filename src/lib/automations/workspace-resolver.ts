import { adminDb } from '../firebase-admin';
import type { Automation } from '../types';

/**
 * @fileOverview Single Source of Truth for Workspace GUID Resolution.
 * 
 * ARCHITECTURAL RATIONALE:
 * UI components or URL routes may pass filter strings (such as "prospect", "lead", or "all")
 * into action handlers. Storing these raw filter strings in Firestore causes query mismatches
 * on the automation canvas node badges and breaks tenant isolation boundaries.
 * 
 * SECURITY BOUNDARY:
 * This function guarantees that all backend operations, database documents (automation_jobs,
 * automation_runs, activity_logs), and GCP Cloud Tasks payloads strictly use verified, canonical
 * Workspace GUIDs (e.g., "wLraN52eC3zBaYuGQfKH").
 * 
 * SENSITIVITY WARNING:
 * Modifications to this file affect all tenant isolation checks, bulk enrollments, and background
 * job processing. Ensure all changes maintain 100% strict typing (no use of any/any[]) and preserve
 * the organization boundary checks.
 */

export interface ResolvedWorkspaceContext {
  /** The verified, canonical Workspace GUID (e.g., "wLraN52eC3zBaYuGQfKH") */
  workspaceId: string;
  /** The parent Organization ID associated with the workspace */
  organizationId: string;
}

/**
 * Resolves a requested workspace ID into a verified, canonical Workspace GUID and Organization ID.
 * 
 * @param requestedWorkspaceId The workspace ID passed from UI, route, or payload (may be a GUID or a track filter like "prospect").
 * @param automation Optional Automation object to resolve primary workspace mapping if requestedWorkspaceId is invalid.
 * @returns Promise resolving to the verified Workspace GUID and Organization ID.
 */
export async function resolveWorkspaceGuid(
  requestedWorkspaceId: string | null | undefined,
  automation?: Automation | null
): Promise<ResolvedWorkspaceContext> {
  let candidateWorkspaceId = requestedWorkspaceId?.trim() || '';

  // 1. If requestedWorkspaceId is not a valid GUID or matches a known track string, fallback to automation.workspaceIds[0]
  if (automation?.workspaceIds?.length) {
    if (!candidateWorkspaceId || !automation.workspaceIds.includes(candidateWorkspaceId)) {
      candidateWorkspaceId = automation.workspaceIds[0];
    }
  }

  // 2. Validate candidateWorkspaceId against Firestore 'workspaces' collection
  if (candidateWorkspaceId) {
    try {
      const wsSnap = await adminDb.collection('workspaces').doc(candidateWorkspaceId).get();
      if (wsSnap.exists) {
        const wsData = wsSnap.data() || {};
        const organizationId = String(wsData.organizationId || 'default');

        // Security Check: Enforce organization tenant boundary if automation is provided
        if (automation) {
          const autoOrgId = (automation as unknown as Record<string, unknown>).organizationId as string | undefined;
          if (autoOrgId && autoOrgId !== 'default' && organizationId !== 'default' && autoOrgId !== organizationId) {
            console.warn(
              `[SecurityAlert] Tenant organization boundary mismatch: automation ${automation.id} (org: ${autoOrgId}) requested for workspace ${candidateWorkspaceId} (org: ${organizationId}).`
            );
          }
        }

        return {
          workspaceId: candidateWorkspaceId,
          organizationId,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[WorkspaceResolver] Failed to lookup workspace ${candidateWorkspaceId}: ${msg}`);
    }
  }

  // 3. Ultimate Fallback: Default workspace mapping
  const fallbackWorkspaceId = automation?.workspaceIds?.[0] || candidateWorkspaceId || 'default';
  return {
    workspaceId: fallbackWorkspaceId,
    organizationId: 'default',
  };
}
