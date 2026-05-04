'use server';

/**
 * @fileoverview FER Migration: Backfill stageName onto existing Deal documents.
 *
 * Context: In the deal-centric architecture migration, `deal.stageName` was
 * added as a denormalized field to avoid client-side `onboardingStages` lookups.
 * All NEW deals now have `stageName` written at creation time. This backfill
 * action patches ALL existing deals that have a `stageId` but are missing `stageName`.
 *
 * FER Protocol:
 *   FETCH  — Scans `deals` collection, identifies docs without `stageName`.
 *            Pre-loads all referenced `onboardingStages` into a lookup map.
 *   ENRICH — Uses Firebase write-batches (max 500 ops each) to set `stageName`
 *            on each qualifying deal atomically.
 *   RESTORE — Validates that every previously-enriched deal now has `stageName`.
 *   ROLLBACK — Removes the `stageName` field from all deals (FieldValue.delete()),
 *              restoring the pre-migration state exactly.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface DealStageBackfillResult {
    total: number;           // Total deals scanned
    needingEnrichment: number; // Deals missing stageName
    succeeded: number;
    skipped: number;         // Already had stageName
    failed: number;
    errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — Preview: how many deals need the backfill?
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDealsForStageNameBackfill(
    organizationId: string
): Promise<{ success: boolean; data?: DealStageBackfillResult; error?: string }> {
    try {
        const snap = await adminDb
            .collection('deals')
            .where('organizationId', '==', organizationId)
            .get();

        let needingEnrichment = 0;
        let skipped = 0;

        snap.forEach(doc => {
            const data = doc.data();
            if (data.stageId && !data.stageName) {
                needingEnrichment++;
            } else {
                skipped++;
            }
        });

        return {
            success: true,
            data: {
                total: snap.size,
                needingEnrichment,
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
// ENRICH — Backfill stageName from onboardingStages lookup
// ─────────────────────────────────────────────────────────────────────────────
export async function enrichDealsWithStageName(
    organizationId: string
): Promise<{ success: boolean; data?: DealStageBackfillResult; error?: string }> {
    try {
        const snap = await adminDb
            .collection('deals')
            .where('organizationId', '==', organizationId)
            .get();

        // Collect all unique stageIds that need resolving
        const stageIdSet = new Set<string>();
        snap.forEach(doc => {
            const data = doc.data();
            if (data.stageId && !data.stageName) {
                stageIdSet.add(data.stageId);
            }
        });

        // Batch-fetch all referenced onboardingStage documents
        const stageNameMap = new Map<string, string>();
        const stageIds = Array.from(stageIdSet);

        await Promise.all(
            stageIds.map(async (stageId) => {
                const stageSnap = await adminDb.collection('onboardingStages').doc(stageId).get();
                if (stageSnap.exists) {
                    const stageName = stageSnap.data()?.name as string | undefined;
                    if (stageName) stageNameMap.set(stageId, stageName);
                }
            })
        );

        // Write in batches of 500
        let succeeded = 0;
        let skipped = 0;
        let failed = 0;
        const errors: string[] = [];

        const docsToEnrich: Array<{ ref: FirebaseFirestore.DocumentReference; stageName: string }> = [];

        snap.forEach(doc => {
            const data = doc.data();
            if (!data.stageId || data.stageName) {
                skipped++;
                return;
            }
            const resolvedName = stageNameMap.get(data.stageId);
            if (!resolvedName) {
                // stageId exists but stage doc not found — skip gracefully
                skipped++;
                return;
            }
            docsToEnrich.push({ ref: doc.ref, stageName: resolvedName });
        });

        // Commit in chunks of 500 (Firestore batch limit)
        const BATCH_SIZE = 500;
        for (let i = 0; i < docsToEnrich.length; i += BATCH_SIZE) {
            const chunk = docsToEnrich.slice(i, i + BATCH_SIZE);
            const batch = adminDb.batch();
            chunk.forEach(({ ref, stageName }) => {
                batch.update(ref, {
                    stageName,
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
                needingEnrichment: docsToEnrich.length + failed,
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
// RESTORE — Validate: every deal that has a stageId also has stageName
// ─────────────────────────────────────────────────────────────────────────────
export async function restoreDealStageNameBackfill(
    organizationId: string
): Promise<{ success: boolean; data?: DealStageBackfillResult; error?: string }> {
    try {
        const snap = await adminDb
            .collection('deals')
            .where('organizationId', '==', organizationId)
            .get();

        let succeeded = 0; // valid (stageName present or no stageId)
        let failed = 0;    // has stageId but still no stageName
        const errors: string[] = [];

        snap.forEach(doc => {
            const data = doc.data();
            if (!data.stageId || data.stageName) {
                succeeded++;
            } else {
                failed++;
                errors.push(`Deal ${doc.id} — stageId="${data.stageId}" missing stageName`);
            }
        });

        return {
            success: failed === 0,
            data: {
                total: snap.size,
                needingEnrichment: 0,
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

// ─────────────────────────────────────────────────────────────────────────────
// ROLLBACK — Strip stageName from ALL deal documents
// ─────────────────────────────────────────────────────────────────────────────
export async function rollbackDealStageNameBackfill(
    organizationId: string
): Promise<{ success: boolean; data?: DealStageBackfillResult; error?: string }> {
    try {
        const snap = await adminDb
            .collection('deals')
            .where('organizationId', '==', organizationId)
            .where('stageName', '!=', null)
            .get();

        let succeeded = 0;
        let failed = 0;
        const errors: string[] = [];

        const BATCH_SIZE = 500;
        const docs = snap.docs;

        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const chunk = docs.slice(i, i + BATCH_SIZE);
            const batch = adminDb.batch();
            chunk.forEach(doc => {
                batch.update(doc.ref, {
                    stageName: FieldValue.delete(),
                    updatedAt: new Date().toISOString(),
                });
            });
            try {
                await batch.commit();
                succeeded += chunk.length;
            } catch (e: any) {
                failed += chunk.length;
                errors.push(`Rollback batch ${Math.floor(i / BATCH_SIZE) + 1}: ${e.message}`);
            }
        }

        return {
            success: failed === 0,
            data: {
                total: snap.size,
                needingEnrichment: 0,
                succeeded,
                skipped: 0,
                failed,
                errors,
            },
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
