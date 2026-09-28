import { adminDb } from '../src/lib/firebase-admin';
import { PhoneVerificationEngine, type VerifyPhoneResult } from '../src/lib/phone-verifier';
import { PhoneHygieneRepository } from '../src/lib/phone-hygiene-repository';
import { resolveOrganizationCountryCode } from '../src/lib/organization-country';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 *
 * This reconciliation script performs a retroactive scan across all
 * phone_verification_cache entries where score === 0.
 *
 * It re-evaluates each number using:
 * 1. The universal international calling-code pre-pass (unambiguous E.164).
 * 2. The tenant organization's regional country setting if linked to an entity.
 *
 * All verified numbers are committed in safe chunks to Firestore via PhoneHygieneRepository.
 * Strict typing: Zero `any` or `any[]`.
 */

async function reconcilePhoneHygiene(): Promise<void> {
  console.log('>>> [RECONCILER] Starting Phone Hygiene Reconciliation...');

  const engine = new PhoneVerificationEngine();
  const cacheSnap = await adminDb.collection('phone_verification_cache')
    .where('score', '==', 0)
    .limit(500)
    .get();

  if (cacheSnap.empty) {
    console.log('>>> [RECONCILER] No score 0 records found in phone_verification_cache.');
    return;
  }

  console.log(`>>> [RECONCILER] Found ${cacheSnap.docs.length} records with score === 0 to re-evaluate.`);

  const updates: [string, VerifyPhoneResult][] = [];
  let unblockedCount = 0;
  let stillInvalidCount = 0;

  for (const doc of cacheSnap.docs) {
    const data = doc.data();
    let rawPhone = typeof data.e164 === 'string' ? data.e164.trim() : '';
    if (!rawPhone) {
      try {
        rawPhone = Buffer.from(doc.id, 'base64').toString('utf-8').trim();
      } catch {
        continue;
      }
    }

    if (!rawPhone) continue;

    let organizationId: string | undefined;
    const entitySnap = await adminDb.collection('workspace_entities')
      .where('primaryPhone', '==', rawPhone)
      .limit(1)
      .get();

    if (!entitySnap.empty) {
      organizationId = entitySnap.docs[0].data()?.organizationId;
    }

    const orgCountry = await resolveOrganizationCountryCode(organizationId);
    const result = await engine.verify(rawPhone, orgCountry, { forceRefresh: true });

    if (result.valid && result.status === 'format_valid') {
      console.log(`[RECONCILER] UNBLOCKED: ${rawPhone} (Old: 0 -> New: ${result.score}, Country: ${result.country || orgCountry || 'Universal'})`);
      updates.push([rawPhone, result]);
      unblockedCount++;
    } else {
      console.log(`[RECONCILER] STILL INVALID: ${rawPhone} (${result.details?.structure?.error || 'unparseable'})`);
      stillInvalidCount++;
    }
  }

  if (updates.length > 0) {
    console.log(`>>> [RECONCILER] Committing ${updates.length} unblocked numbers to Firestore...`);
    await PhoneHygieneRepository.commitBatch(updates);
    console.log(`>>> [RECONCILER] Successfully healed and unblocked ${unblockedCount} contacts!`);
  }

  console.log(`>>> [RECONCILER] Summary: ${unblockedCount} unblocked, ${stillInvalidCount} confirmed invalid.`);
}

reconcilePhoneHygiene().catch(err => {
  console.error('>>> [RECONCILER] Fatal error:', err);
  process.exit(1);
});
