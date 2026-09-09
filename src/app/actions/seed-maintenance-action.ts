'use server';

import { seedMaintenanceTemplate } from '@/lib/seed-maintenance';
import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';

/**
 * Server action to trigger the maintenance template seed from the UI.
 */
export async function seedMaintenanceAction() {
  // SECURITY (audit F2): Server Actions are public endpoints. This platform
  // migration was reachable unauthenticated. Identity and permission are resolved
  // server-side from the session; the caller supplies neither.
  await authorizeBackofficeSession('operations', 'execute');

    return await seedMaintenanceTemplate();
}
