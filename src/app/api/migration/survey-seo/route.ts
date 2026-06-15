/**
 * API Route: Backfill Survey SEO (flat → nested)
 *
 * One-off, idempotent migration that copies each survey's legacy flat
 * `seo*` fields into the canonical nested `seo` object (see {@link SeoConfig}).
 * Surveys that already have a `seo` object are skipped. Defaults to a dry run —
 * pass `{ "apply": true }` (or `?apply=1`) to actually write.
 *
 *   POST /api/migration/survey-seo            → dry run (counts only)
 *   POST /api/migration/survey-seo?apply=1    → live backfill
 *
 * Idempotent: re-running after a successful pass is a no-op.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { mapLegacySurveySeo } from '@/lib/seo';
import type { Survey } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Firestore allows up to 500 writes per batch; stay comfortably under.
const BATCH_LIMIT = 400;

export async function POST(request: NextRequest) {
  try {
    let apply = request.nextUrl.searchParams.get('apply') === '1';
    try {
      const body = await request.json();
      if (body?.apply === true) apply = true;
    } catch {
      // No/!JSON body is fine — defaults to dry run.
    }

    const snapshot = await adminDb.collection('surveys').get();

    let scanned = 0;
    let alreadyMigrated = 0;
    let nothingToMap = 0;
    let migrated = 0;
    const migratedIds: string[] = [];

    let batch = adminDb.batch();
    let pending = 0;

    for (const docSnap of snapshot.docs) {
      scanned++;
      const data = docSnap.data() as Survey;

      // Idempotent: never touch a survey that already has the nested object.
      if (data.seo) {
        alreadyMigrated++;
        continue;
      }

      const seo = mapLegacySurveySeo(data);
      if (!seo) {
        nothingToMap++;
        continue;
      }

      migrated++;
      if (migratedIds.length < 50) migratedIds.push(docSnap.id);

      if (apply) {
        batch.update(docSnap.ref, { seo });
        pending++;
        if (pending >= BATCH_LIMIT) {
          await batch.commit();
          batch = adminDb.batch();
          pending = 0;
        }
      }
    }

    if (apply && pending > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      mode: apply ? 'applied' : 'dry-run',
      scanned,
      migrated,
      alreadyMigrated,
      nothingToMap,
      sampleMigratedIds: migratedIds,
      message: apply
        ? `Backfilled seo on ${migrated} survey(s).`
        : `Dry run: ${migrated} survey(s) would be backfilled. Re-run with ?apply=1 to write.`,
    });
  } catch (error: any) {
    console.error('survey-seo migration error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Migration failed' },
      { status: 500 },
    );
  }
}
