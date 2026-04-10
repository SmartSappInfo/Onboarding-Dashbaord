'use server';

import { adminDb } from './firebase-admin';

/**
 * Migrates existing global roles, modules, and zones to all current organizations.
 * This ensures every organization starts with the currently defined global settings 
 * and can then edit them independently.
 */
export async function migrateGlobalSettingsToAllOrgsAction(): Promise<{ success: boolean; stats?: any; error?: string }> {
    try {
        const stats = {
            organizationsProcessed: 0,
            rolesCloned: 0,
            modulesCloned: 0,
            zonesCloned: 0
        };

        const timestamp = new Date().toISOString();

        // 1. Get all organizations
        const orgsSnapshot = await adminDb.collection('organizations').get();
        const orgIds = orgsSnapshot.docs.map(doc => doc.id);

        if (orgIds.length === 0) {
            return { success: true, stats, error: 'No organizations found to migrate to.' };
        }

        // 2. Get all global (legacy) items (those without organizationId)
        const globalRoles = (await adminDb.collection('roles').where('organizationId', '==', null).get()).docs;
        const globalModules = (await adminDb.collection('modules').where('organizationId', '==', null).get()).docs;
        const globalZones = (await adminDb.collection('zones').where('organizationId', '==', null).get()).docs;

        // Also fetch those where field is missing entirely
        const globalRolesMissing = (await adminDb.collection('roles').get()).docs.filter(d => !d.data().organizationId);
        const globalModulesMissing = (await adminDb.collection('modules').get()).docs.filter(d => !d.data().organizationId);
        const globalZonesMissing = (await adminDb.collection('zones').get()).docs.filter(d => !d.data().organizationId);

        // Deduplicate and combine
        const uniqueGlobalRoles = Array.from(new Map([...globalRoles, ...globalRolesMissing].map(d => [d.id, d])).values());
        const uniqueGlobalModules = Array.from(new Map([...globalModules, ...globalModulesMissing].map(d => [d.id, d])).values());
        const uniqueGlobalZones = Array.from(new Map([...globalZones, ...globalZonesMissing].map(d => [d.id, d])).values());

        // 3. For each organization, clone these items
        for (const orgId of orgIds) {
            stats.organizationsProcessed++;

            // Clone Roles
            for (const roleDoc of uniqueGlobalRoles) {
                const data = roleDoc.data();
                // Check if already cloned
                const exists = await adminDb.collection('roles')
                    .where('organizationId', '==', orgId)
                    .where('name', '==', data.name)
                    .get();
                
                if (exists.empty) {
                    await adminDb.collection('roles').add({
                        ...data,
                        organizationId: orgId,
                        isDefault: false,
                        updatedAt: timestamp
                    });
                    stats.rolesCloned++;
                }
            }

            // Clone Modules
            for (const modDoc of uniqueGlobalModules) {
                const data = modDoc.data();
                const exists = await adminDb.collection('modules')
                    .where('organizationId', '==', orgId)
                    .where('name', '==', data.name)
                    .get();
                
                if (exists.empty) {
                    await adminDb.collection('modules').add({
                        ...data,
                        organizationId: orgId,
                        isDefault: false
                    });
                    stats.modulesCloned++;
                }
            }

            // Clone Zones
            for (const zoneDoc of uniqueGlobalZones) {
                const data = zoneDoc.data();
                const exists = await adminDb.collection('zones')
                    .where('organizationId', '==', orgId)
                    .where('name', '==', data.name)
                    .get();
                
                if (exists.empty) {
                    await adminDb.collection('zones').add({
                        ...data,
                        organizationId: orgId,
                        isDefault: false
                    });
                    stats.zonesCloned++;
                }
            }
        }

        return { success: true, stats };
    } catch (error: any) {
        console.error('Migration failed:', error);
        return { success: false, error: error.message };
    }
}
