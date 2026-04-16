/**
 * @fileOverview Entity Contact Migration Script (FER-01)
 *
 * Provides a Multi-Stage FER protocol:
 * 1. Backup: Copies legacy records to backup_ collections.
 * 2. Normalize: Converts focalPersons into entityContacts without deleting the old.
 * 3. Purge: Deletes legacy fields natively using FieldValue.delete().
 * 4. Rollback: Restores from backups.
 */

'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { focalPersonToEntityContact, enforceContactConstraints, extractPrimaryContactFields } from './entity-contact-helpers';
import { syncDenormalizedFieldsToWorkspaceEntities } from './denormalization-sync';

// -- 1. BACKUP --
export async function backupContactsAction() {
    return runGenericCollectionAction('Backup', async (doc, collectionName, data) => {
        const legacyContacts = getLegacyContacts(data);
        if (legacyContacts && legacyContacts.length > 0) {
            await adminDb.collection(`backup_${collectionName}_contacts`).doc(doc.id).set({
                ...data,
                backedUpAt: new Date().toISOString()
            });
            return true;
        }
        return false;
    });
}

// -- 2. NORMALIZE --
export async function normalizeContactsAction() {
    const timestamp = new Date().toISOString();
    return runGenericCollectionAction('Normalize', async (doc, collectionName, data) => {
        const legacyContacts = getLegacyContacts(data);
        const hasNoCanonicalContacts = !data.entityContacts || !Array.isArray(data.entityContacts) || data.entityContacts.length === 0;

        if (legacyContacts && legacyContacts.length > 0 && hasNoCanonicalContacts) {
            // 1. Convert to EntityContact[]
            const rawEntityContacts = legacyContacts.map((fp: any, idx: number) => focalPersonToEntityContact(fp, idx));

            // 2. Enforce canonical rules
            const validatedContacts = enforceContactConstraints(rawEntityContacts);

            // 3. Update document (Keeps old legacy fields natively intact for safety verification phase)
            await doc.ref.update({
                entityContacts: validatedContacts,
                updatedAt: timestamp
            });

            // 4. Sync workspace_entities if it's entities collection
            if (collectionName === 'entities') {
                const { primaryEmail, primaryPhone } = extractPrimaryContactFields({ entityContacts: validatedContacts });
                const syncResult = await syncDenormalizedFieldsToWorkspaceEntities(doc.id, {
                    displayName: data.name || '',
                    primaryEmail: primaryEmail || undefined,
                    primaryPhone: primaryPhone || undefined
                });

                if (!syncResult.success) {
                    throw new Error(`Denormalization sync failed: ${syncResult.error}`);
                }
            }
            return true;
        }
        return false;
    });
}

// -- 3. PURGE --
export async function purgeLegacyContactsAction() {
    return runGenericCollectionAction('Purge', async (doc, collectionName, data) => {
        const legacyContacts = getLegacyContacts(data);
        
        // Ensure canonical contacts exist before allowing purge
        const hasCanonicalContacts = data.entityContacts && Array.isArray(data.entityContacts) && data.entityContacts.length > 0;

        if (legacyContacts && legacyContacts.length > 0 && hasCanonicalContacts) {
            const updates: any = {};
            
            // Aggressively flag all known nested locations for deletion
            if (data.institutionData?.focalPersons) updates['institutionData.focalPersons'] = FieldValue.delete();
            if (data.institutionData?.contacts) updates['institutionData.contacts'] = FieldValue.delete();
            if (data.focalPersons) updates['focalPersons'] = FieldValue.delete();
            if (data.contacts) updates['contacts'] = FieldValue.delete();

            // Additional legacy cleanups if any
            
            if (Object.keys(updates).length > 0) {
                updates.updatedAt = new Date().toISOString();
                await doc.ref.update(updates);
                return true;
            }
        }
        return false;
    });
}

// -- 4. ROLLBACK --
export async function rollbackContactsAction() {
    try {
        let restoredCount = 0;
        let errorCount = 0;
        let lastError = '';

        for (const collectionName of ['entities', 'schools']) {
            const backupCollection = `backup_${collectionName}_contacts`;
            const snapshot = await adminDb.collection(backupCollection).get();
            for (const doc of snapshot.docs) {
                try {
                    const { backedUpAt, ...originalData } = doc.data();
                    await adminDb.collection(collectionName).doc(doc.id).set(originalData);
                    await doc.ref.delete(); // Delete from backup after successful rollback
                    restoredCount++;
                } catch(e: any) {
                    errorCount++;
                    lastError = e.message;
                }
            }
        }
        
        return { success: true, count: restoredCount, errors: errorCount, lastError };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

// -- Helpers --

function getLegacyContacts(data: any): any[] | null {
    if (data.institutionData?.focalPersons && Array.isArray(data.institutionData.focalPersons) && data.institutionData.focalPersons.length > 0) {
        return data.institutionData.focalPersons;
    } else if (data.institutionData?.contacts && Array.isArray(data.institutionData.contacts) && data.institutionData.contacts.length > 0) {
        return data.institutionData.contacts;
    } else if (data.focalPersons && Array.isArray(data.focalPersons) && data.focalPersons.length > 0) {
        return data.focalPersons;
    } else if (data.contacts && Array.isArray(data.contacts) && data.contacts.length > 0) {
        return data.contacts;
    }
    return null;
}

async function runGenericCollectionAction(actionName: string, processorFn: (doc: any, collection: string, data: any) => Promise<boolean>) {
    try {
        let entitiesMigrated = 0;
        let schoolsMigrated = 0;
        let errorCount = 0;
        let lastError = '';

        for (const collectionName of ['entities', 'schools']) {
            const snapshot = await adminDb.collection(collectionName).get();
            for (const doc of snapshot.docs) {
                try {
                    const processed = await processorFn(doc, collectionName, doc.data());
                    if (processed) {
                        if (collectionName === 'entities') entitiesMigrated++;
                        else schoolsMigrated++;
                    }
                } catch(e: any) {
                    const msg = e.message || String(e);
                    if (!lastError) lastError = msg;
                    errorCount++;
                }
            }
        }

        return { 
            success: true, 
            entitiesMigrated,
            schoolsMigrated,
            errorCount,
            lastError
        };

    } catch (e: any) {
        console.error(`>>> [FER-01] ${actionName} Failed:`, e.message);
        return { 
            success: false, 
            error: e.message 
        };
    }
}
