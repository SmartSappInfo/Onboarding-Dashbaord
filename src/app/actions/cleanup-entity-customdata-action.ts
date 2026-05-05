'use server';

/**
 * @fileoverview FER Migration: Strip redundant `customData` from entity documents.
 *
 * Context: The legacy bulk-upload system in `bulk-upload-actions.ts` routed
 * `contact_0_name`, `contact_0_email`, `contact_0_phone`, `contact_0_role` etc.
 * into `entity.customData` via the `resolveFieldStorageBucket` fallback, even
 * though the same data was already correctly stored in `entity.entityContacts`.
 * This created a redundant `customData` map on affected entities.
 *
 * The root cause has been fixed (contact slot fields now skip the routing loop),
 * but existing entities still carry the stale `customData`. This FER migration
 * cleans them up.
 *
 * FER Protocol:
 *   FETCH   — Scans `entities` collection, counts docs that have a non-empty
 *             `customData` map.
 *   ENRICH  — Uses Firebase write-batches (max 500 ops each) to atomically
 *             delete the `customData` field from every affected entity.
 *   RESTORE — Validates that no entities still carry a `customData` field.
 *   ROLLBACK — N/A (destructive cleanup — customData is fully redundant and
 *              cannot be restored once removed).
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface CustomDataCleanupResult {
    total: number;             // Total entities scanned
    withCustomData: number;    // Entities that have customData
    succeeded: number;
    skipped: number;           // Entities without customData (clean)
    failed: number;
    errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — Preview: how many entities still have customData?
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchEntitiesWithCustomData(
    organizationId: string
): Promise<{ success: boolean; data?: CustomDataCleanupResult; error?: string }> {
    try {
        const snap = await adminDb
            .collection('entities')
            .where('organizationId', '==', organizationId)
            .get();

        let withCustomData = 0;
        let skipped = 0;

        snap.forEach(doc => {
            const data = doc.data();
            if (data.customData && typeof data.customData === 'object' && Object.keys(data.customData).length > 0) {
                withCustomData++;
            } else {
                skipped++;
            }
        });

        return {
            success: true,
            data: {
                total: snap.size,
                withCustomData,
                succeeded: 0,
                skipped,
                failed: 0,
                errors: [],
            },
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENRICH — Remove customData field from all affected entities
// ─────────────────────────────────────────────────────────────────────────────
export async function cleanupEntityCustomData(
    organizationId: string
): Promise<{ success: boolean; data?: CustomDataCleanupResult; error?: string }> {
    try {
        const snap = await adminDb
            .collection('entities')
            .where('organizationId', '==', organizationId)
            .get();

        let succeeded = 0;
        let skipped = 0;
        let failed = 0;
        const errors: string[] = [];

        // Collect refs that need cleanup
        const docsToClean: FirebaseFirestore.DocumentReference[] = [];

        snap.forEach(doc => {
            const data = doc.data();
            if (data.customData && typeof data.customData === 'object' && Object.keys(data.customData).length > 0) {
                docsToClean.push(doc.ref);
            } else {
                skipped++;
            }
        });

        // Commit in chunks of 500 (Firestore batch limit)
        const BATCH_SIZE = 500;
        for (let i = 0; i < docsToClean.length; i += BATCH_SIZE) {
            const chunk = docsToClean.slice(i, i + BATCH_SIZE);
            const batch = adminDb.batch();
            chunk.forEach(ref => {
                batch.update(ref, {
                    customData: FieldValue.delete(),
                    updatedAt: new Date().toISOString(),
                });
            });
            try {
                await batch.commit();
                succeeded += chunk.length;
            } catch (e: any) {
                failed += chunk.length;
                errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${e.message}`);
            }
        }

        return {
            success: failed === 0,
            data: {
                total: snap.size,
                withCustomData: docsToClean.length,
                succeeded,
                skipped,
                failed,
                errors,
            },
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTORE — Validate: no entities should have customData anymore
// ─────────────────────────────────────────────────────────────────────────────
export async function validateCustomDataCleanup(
    organizationId: string
): Promise<{ success: boolean; data?: CustomDataCleanupResult; error?: string }> {
    try {
        const snap = await adminDb
            .collection('entities')
            .where('organizationId', '==', organizationId)
            .get();

        let succeeded = 0; // clean (no customData)
        let failed = 0;    // still has customData
        const errors: string[] = [];

        snap.forEach(doc => {
            const data = doc.data();
            if (data.customData && typeof data.customData === 'object' && Object.keys(data.customData).length > 0) {
                failed++;
                errors.push(`Entity ${doc.id} — still has ${Object.keys(data.customData).length} customData fields`);
            } else {
                succeeded++;
            }
        });

        return {
            success: failed === 0,
            data: {
                total: snap.size,
                withCustomData: failed,
                succeeded,
                skipped: 0,
                failed,
                errors: errors.slice(0, 20),
            },
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
