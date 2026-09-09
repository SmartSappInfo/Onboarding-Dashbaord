'use server';

import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';
import {
  seedAllWorkspacesFields,
  type SeedAllWorkspacesFieldsResult,
} from '@/lib/migrations/seed-all-workspaces-fields';

/**
 * Authenticated entry point for the all-workspaces field seeding migration.
 *
 * SECURITY (audit F2): this used to accept the executing userId as an argument, so any
 * caller could run a cross-tenant write and attribute it to anyone. Identity and
 * permission are now both resolved server-side from the session.
 *
 * The migration itself lives in `@/lib/migrations/seed-all-workspaces-fields` because
 * `pnpm migrate:workspace-fields` runs it from the CLI, where there is no session.
 */
export async function executeSeedAllWorkspacesFieldsFerAction(): Promise<SeedAllWorkspacesFieldsResult> {
  const actor = await authorizeBackofficeSession('operations', 'execute');
  return seedAllWorkspacesFields(actor.userId);
}
