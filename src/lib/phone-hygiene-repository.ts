import { adminDb } from '@/lib/firebase-admin';
import { VerifyPhoneResult } from './phone-verifier';
import { calculateNewPhoneVerifyScores } from './scoring-rules-engine';
import { getPhoneFormats } from './phone-utils';
import type { EntityContact, PhoneVerificationRule } from './types';

const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Statuses that represent stronger confidence than offline verification can
 * provide (OTP ownership, confirmed delivery, explicit opt-out). Offline
 * re-verification must never downgrade them — only scores/details refresh.
 */
const PROTECTED_PHONE_STATUSES = new Set(['otp_sent', 'verified', 'active', 'opted_out']);

/**
 * Zero-impact fallback: phone verification contributes nothing to lead scores
 * until rules are explicitly configured in the workspace lead-scoring settings.
 * (Prevents a cron sweep from silently shifting every entity's leadScore.)
 */
const DEFAULT_PHONE_RULES: PhoneVerificationRule[] = [{ minScore: 0, scoreValue: 0 }];

export interface UncheckedPhone {
  phone: string;
  organizationId?: string;
}

/**
 * Handles all database interactions for phone hygiene.
 * Mirrors ContactHygieneRepository (email) with two deliberate differences:
 *  - entity/workspace_entity writebacks run inside Firestore transactions
 *    (the email + phone verifiers both rewrite entityContacts[]; blind batch
 *    merges would race and lose data), and
 *  - verification-only writes never bump `updatedAt`.
 */
export class PhoneHygieneRepository {

  /** Convert a stored phone string to its cache document ID. */
  static hashPhone(phone: string): string {
    return Buffer.from(phone.trim()).toString('base64');
  }

  /**
   * Retrieves the verification result from the phone cache collection.
   * Returns null on cache miss or read failure.
   */
  static async getCache(phone: string): Promise<Partial<VerifyPhoneResult> & { lockedAt?: string; _status?: string } | null> {
    try {
      const doc = await adminDb.collection('phone_verification_cache').doc(this.hashPhone(phone)).get();
      if (!doc.exists) return null;
      return doc.data() as any;
    } catch (err) {
      console.warn(`[PhoneHygieneRepo] Cache read failed for ${phone}:`, err);
      return null;
    }
  }

  /**
   * Atomically sets a "verifying" lock on a phone to prevent duplicate
   * concurrent verification requests (idempotency guard).
   */
  static async setVerifyingLock(phone: string): Promise<void> {
    const ref = adminDb.collection('phone_verification_cache').doc(this.hashPhone(phone));
    await ref.set({
      _status: 'verifying',
      lockedAt: new Date().toISOString(),
    }, { merge: true });
  }

  /**
   * Checks if a phone is currently being verified by another worker.
   * Returns true if a lock exists and is less than LOCK_TTL_MS old.
   */
  static async isLocked(phone: string): Promise<boolean> {
    const cached = await this.getCache(phone);
    if (!cached || cached._status !== 'verifying') return false;
    if (!cached.lockedAt) return false;
    const elapsed = Date.now() - new Date(cached.lockedAt).getTime();
    return elapsed < LOCK_TTL_MS;
  }

  /**
   * Discovers phones from workspace_entities that have never been verified.
   * Returns the stored phone string verbatim (any format — legacy local
   * formats included) plus the owning organizationId so callers can resolve
   * the org's default country for parsing.
   */
  static async getUncheckedPhones(limit: number = 50): Promise<UncheckedPhone[]> {
    const unchecked: UncheckedPhone[] = [];
    const processedPhones = new Set<string>();

    let lastDoc: any = null;
    let keepQuerying = true;
    const BATCH_SIZE = 100;

    while (keepQuerying && unchecked.length < limit) {
      let query = adminDb.collection('workspace_entities')
        .orderBy('primaryPhone')
        .limit(BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        break;
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      const phonesInBatch = new Map<string, UncheckedPhone>();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const phone = typeof data.primaryPhone === 'string' ? data.primaryPhone.trim() : '';
        if (phone && !processedPhones.has(phone)) {
          phonesInBatch.set(phone, { phone, organizationId: data.organizationId });
          processedPhones.add(phone);
        }
      }

      if (phonesInBatch.size > 0) {
        const phoneArray = Array.from(phonesInBatch.values());
        // Chunk Firestore IN query (max 30 items)
        for (let i = 0; i < phoneArray.length; i += 30) {
          const chunk = phoneArray.slice(i, i + 30);
          const hashes = chunk.map(p => this.hashPhone(p.phone));

          const cacheSnap = await adminDb.collection('phone_verification_cache')
            .where('__name__', 'in', hashes)
            .get();

          const verifiedHashes = new Set(cacheSnap.docs.map(d => d.id));

          for (const entry of chunk) {
            if (unchecked.length >= limit) {
              keepQuerying = false;
              break;
            }
            if (!verifiedHashes.has(this.hashPhone(entry.phone))) {
              unchecked.push(entry);
            }
          }
        }
      }

      if (snapshot.docs.length < BATCH_SIZE) {
        break;
      }
    }

    return unchecked;
  }

  /**
   * Commits a batch of verification updates.
   * Cache writes go out in plain batches; entity/workspace_entity writebacks
   * each run inside a transaction (fresh read of entityContacts) so concurrent
   * email verification or user edits are never clobbered.
   */
  static async commitBatch(updates: [string, VerifyPhoneResult][]) {
    if (updates.length === 0) return;

    const now = new Date().toISOString();

    // 1. Cache writes — clear the lock and persist the result
    const cacheWrites = updates.map(([phone, result]) => ({
      ref: adminDb.collection('phone_verification_cache').doc(this.hashPhone(phone)),
      data: {
        ...result,
        _status: 'complete',
        lockedAt: null,
        lastVerifiedAt: now,
      },
    }));

    for (let i = 0; i < cacheWrites.length; i += 500) {
      const batch = adminDb.batch();
      for (const w of cacheWrites.slice(i, i + 500)) {
        batch.set(w.ref, w.data, { merge: true });
      }
      await batch.commit();
    }

    // 2. Locate affected workspace_entities and group by entity
    interface EntityGroup {
      phone: string;
      result: VerifyPhoneResult;
      entityId: string;
      wsDocs: { ref: FirebaseFirestore.DocumentReference; workspaceId: string }[];
    }
    const groups = new Map<string, EntityGroup>();
    const workspaceIds = new Set<string>();

    await Promise.all(updates.map(async ([phone, result]) => {
      const snap = await adminDb.collection('workspace_entities')
        .where('primaryPhone', '==', phone.trim())
        .get();

      for (const doc of snap.docs) {
        const data = doc.data();
        if (!data.entityId || !data.workspaceId) continue;
        workspaceIds.add(data.workspaceId);
        const key = `${data.entityId}::${phone.trim()}`;
        if (!groups.has(key)) {
          groups.set(key, { phone: phone.trim(), result, entityId: data.entityId, wsDocs: [] });
        }
        groups.get(key)!.wsDocs.push({ ref: doc.ref, workspaceId: data.workspaceId });
      }
    }));

    if (groups.size === 0) return;

    // 3. Prefetch scoring rules per workspace (kept outside transactions —
    //    rules are config, not transactional data, and txns can retry)
    const rulesByWorkspace = new Map<string, PhoneVerificationRule[]>();
    await Promise.all(Array.from(workspaceIds).map(async (workspaceId) => {
      try {
        const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
        const rules = snap.data()?.leadScoringSettings?.phoneVerificationRules;
        rulesByWorkspace.set(workspaceId, Array.isArray(rules) && rules.length > 0 ? rules : DEFAULT_PHONE_RULES);
      } catch {
        rulesByWorkspace.set(workspaceId, DEFAULT_PHONE_RULES);
      }
    }));

    // 4. Transactional writebacks per entity group
    for (const group of groups.values()) {
      try {
        await adminDb.runTransaction(async (txn) => {
          const entityRef = adminDb.collection('entities').doc(group.entityId);
          const entitySnap = await txn.get(entityRef);
          if (!entitySnap.exists) return;

          const wsSnaps = await Promise.all(group.wsDocs.map(ws => txn.get(ws.ref)));

          const baseContacts: EntityContact[] = entitySnap.data()?.entityContacts || [];
          let finalContacts = baseContacts;
          let finalLeadScore = 0;

          for (let i = 0; i < group.wsDocs.length; i++) {
            const ws = group.wsDocs[i];
            const wsSnap = wsSnaps[i];
            if (!wsSnap.exists) continue;

            const rules = rulesByWorkspace.get(ws.workspaceId) || DEFAULT_PHONE_RULES;
            const { entityContacts: scoredContacts, leadScore } = calculateNewPhoneVerifyScores(
              finalContacts,
              group.phone,
              group.result.score,
              rules,
              group.result.e164
            );

            finalContacts = this.applyPhoneHygieneFields(scoredContacts, group.phone, group.result);
            finalLeadScore = leadScore;

            const existingWsStatus = wsSnap.data()?.phoneVerificationStatus;
            const wsStatus = PROTECTED_PHONE_STATUSES.has(existingWsStatus)
              ? existingWsStatus
              : group.result.status;

            txn.set(ws.ref, {
              phoneVerificationStatus: wsStatus,
              phoneVerificationScore: group.result.score,
              lastPhoneVerifiedAt: now,
              phoneVerificationDetails: group.result.checks,
              entityContacts: finalContacts,
              leadScore: finalLeadScore,
            }, { merge: true });
          }

          // Intentionally no `updatedAt` bump: verification-only writes must
          // not reorder "recently updated" views or wake update automations.
          txn.set(entityRef, {
            entityContacts: finalContacts,
            leadScore: finalLeadScore,
          }, { merge: true });
        });
      } catch (err) {
        console.error(`[PhoneHygieneRepo] Transactional writeback failed for entity ${group.entityId}:`, err);
      }
    }
  }

  /**
   * Maps an offline verification result onto matching contacts, honouring the
   * status precedence guard. Never introduces `undefined` field values.
   */
  private static applyPhoneHygieneFields(
    contacts: EntityContact[],
    phone: string,
    result: VerifyPhoneResult
  ): EntityContact[] {
    const target = phone.trim();
    return contacts.map((c) => {
      const p = c.phone?.trim();
      if (!p || (p !== target && (!result.e164 || p !== result.e164))) return c;

      const next: EntityContact = { ...c };
      if (result.lineType) next.phoneType = result.lineType;
      if (!c.phoneStatus || !PROTECTED_PHONE_STATUSES.has(c.phoneStatus)) {
        next.phoneStatus = result.status;
        next.phoneVerificationMethod = 'offline';
      }
      return next;
    });
  }

  /**
   * Best-effort reachability signal from SMS sends (Level 3).
   * Provider-accept → lastSmsDeliveredAt (+ verified → active upgrade);
   * send failure → lastSmsFailedAt (+ format_valid → failed downgrade).
   * Never throws — a hygiene write error must never fail a message send.
   */
  static async recordSmsOutcome(recipient: string, ok: boolean): Promise<void> {
    try {
      const formats = getPhoneFormats(recipient);
      if (formats.length === 0) return;

      const snap = await adminDb.collection('workspace_entities')
        .where('primaryPhone', 'in', formats.slice(0, 30))
        .get();
      if (snap.empty) return;

      const now = new Date().toISOString();
      const matchSet = new Set(formats);
      const writes: { ref: FirebaseFirestore.DocumentReference; data: any }[] = [];
      const entityIds = new Set<string>();

      for (const doc of snap.docs) {
        const data = doc.data();
        const contacts: EntityContact[] = data.entityContacts || [];
        writes.push({
          ref: doc.ref,
          data: { entityContacts: contacts.map(c => this.applySmsOutcome(c, matchSet, ok, now)) },
        });
        if (data.entityId) entityIds.add(data.entityId);
      }

      await Promise.all(Array.from(entityIds).map(async (entityId) => {
        const ref = adminDb.collection('entities').doc(entityId);
        const entitySnap = await ref.get();
        if (!entitySnap.exists) return;
        const contacts: EntityContact[] = entitySnap.data()?.entityContacts || [];
        writes.push({
          ref,
          data: { entityContacts: contacts.map(c => this.applySmsOutcome(c, matchSet, ok, now)) },
        });
      }));

      for (let i = 0; i < writes.length; i += 500) {
        const batch = adminDb.batch();
        for (const w of writes.slice(i, i + 500)) {
          batch.set(w.ref, w.data, { merge: true });
        }
        await batch.commit();
      }
    } catch (err) {
      console.warn('[PhoneHygieneRepo] recordSmsOutcome failed (non-fatal):', err);
    }
  }

  private static applySmsOutcome(
    c: EntityContact,
    matchSet: Set<string>,
    ok: boolean,
    now: string
  ): EntityContact {
    const p = c.phone?.trim();
    if (!p || !matchSet.has(p)) return c;

    const next: EntityContact = { ...c };
    if (ok) {
      next.lastSmsDeliveredAt = now;
      if (c.phoneStatus === 'verified') next.phoneStatus = 'active';
    } else {
      next.lastSmsFailedAt = now;
      if (c.phoneStatus === 'format_valid') next.phoneStatus = 'failed';
    }
    return next;
  }
}
