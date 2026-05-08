'use server';

import { seedMaintenanceTemplate } from '@/lib/seed-maintenance';

/**
 * Server action to trigger the maintenance template seed from the UI.
 */
export async function seedMaintenanceAction() {
    return await seedMaintenanceTemplate();
}
