/**
 * ARCHITECTURE:
 * Creative Approval Center Page (Phase 7)
 * 
 * Server Component fetching projects pending review or approval.
 */

import { listProjectsPendingApprovalAction } from '@/app/actions/creative-collab-actions';
import { ApprovalsClient } from './ApprovalsClient';

export default async function ApprovalsPage() {
  const workspaceId = 'default-workspace';
  const res = await listProjectsPendingApprovalAction(workspaceId);
  const projects = res.success && res.data ? res.data : [];

  return <ApprovalsClient initialProjects={projects} />;
}
