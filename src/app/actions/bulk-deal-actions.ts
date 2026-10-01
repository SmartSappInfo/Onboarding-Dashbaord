'use server';

import { requireWorkspace } from '@/lib/auth/require-auth';
import { bulkCreateDealsCore, type BulkDealCreationData } from '@/lib/crm/bulk-deal-core';

/**
 * Server Action entry point — a public HTTP endpoint. Identity comes from the session and the
 * core checks operations/pipeline:create in the target workspace (audit F2, agents_mcp N1).
 * Trusted server code (the automation engine) calls `bulkCreateDealsCore` with a service actor.
 */
export async function bulkCreateDealsAction(data: BulkDealCreationData) {
  const { uid } = await requireWorkspace(data.workspaceId);
  return bulkCreateDealsCore({ kind: 'user', uid }, data);
}
