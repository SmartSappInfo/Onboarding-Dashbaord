import { adminDb } from '@/lib/firebase-admin';
import { VerifyEmailResult } from './email-verifier';

const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Handles all database interactions for contact hygiene.
 * Encapsulates caching, locking, and bulk entity updates.
 */
export class ContactHygieneRepository {

  /** Convert email to its cache document ID */
  static hashEmail(email: string): string {
    return Buffer.from(email.toLowerCase()).toString('base64');
  }
  
  /**
   * Retrieves the verification result from the global cache collection.
   * Returns null if cache miss or not found.
   */
  static async getCache(email: string): Promise<Partial<VerifyEmailResult> & { lockedAt?: string; _status?: string } | null> {
    try {
      const doc = await adminDb.collection('verification_cache').doc(this.hashEmail(email)).get();
      if (!doc.exists) return null;
      return doc.data() as any;
    } catch (err) {
      console.warn(`[HygieneRepo] Cache read failed for ${email}:`, err);
      return null;
    }
  }

  /**
   * Atomically sets a "verifying" lock on an email to prevent duplicate
   * concurrent verification requests (idempotency guard).
   */
  static async setVerifyingLock(email: string): Promise<void> {
    const ref = adminDb.collection('verification_cache').doc(this.hashEmail(email));
    await ref.set({
      _status: 'verifying',
      lockedAt: new Date().toISOString(),
    }, { merge: true });
  }

  /**
   * Checks if an email is currently being verified by another worker.
   * Returns true if a lock exists and is less than LOCK_TTL_MS old.
   */
  static async isLocked(email: string): Promise<boolean> {
    const cached = await this.getCache(email);
    if (!cached || cached._status !== 'verifying') return false;
    if (!cached.lockedAt) return false;
    const elapsed = Date.now() - new Date(cached.lockedAt).getTime();
    return elapsed < LOCK_TTL_MS;
  }

  /**
   * Discovers emails from workspace_entities that have never been verified.
   * Queries workspace_entities in paginated batches, extracts contact emails,
   * and cross-references them against the verification_cache to find unchecked ones.
   * Memory-safe and highly scalable for 10,000+ uploads.
   */
  static async getUncheckedEmails(limit: number = 50): Promise<string[]> {
    const unchecked: string[] = [];
    const processedEmails = new Set<string>();
    
    let lastDoc: any = null;
    let keepQuerying = true;
    const BATCH_SIZE = 100;
    
    while (keepQuerying && unchecked.length < limit) {
      let query = adminDb.collection('workspace_entities')
        .orderBy('email')
        .limit(BATCH_SIZE);
        
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      if (snapshot.empty) {
        break;
      }
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      const emailsInBatch = new Set<string>();
      for (const doc of snapshot.docs) {
        const email = doc.data().email;
        if (email && typeof email === 'string' && email.includes('@')) {
          const lowerEmail = email.toLowerCase().trim();
          if (!processedEmails.has(lowerEmail)) {
            emailsInBatch.add(lowerEmail);
            processedEmails.add(lowerEmail);
          }
        }
      }
      
      if (emailsInBatch.size > 0) {
        const emailArray = Array.from(emailsInBatch);
        // Chunk Firestore IN query (max 30 items)
        for (let i = 0; i < emailArray.length; i += 30) {
          const chunk = emailArray.slice(i, i + 30);
          const hashes = chunk.map(e => this.hashEmail(e));
          
          const cacheSnap = await adminDb.collection('verification_cache')
            .where('__name__', 'in', hashes)
            .get();
            
          const verifiedHashes = new Set(cacheSnap.docs.map(d => d.id));
          
          for (const email of chunk) {
            if (unchecked.length >= limit) {
              keepQuerying = false;
              break;
            }
            if (!verifiedHashes.has(this.hashEmail(email))) {
              unchecked.push(email);
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
   * Commits a batch of verification updates to Firestore safely.
   * This updates the global cache AND the actual contact documents in `workspace_entities`.
   * Automatically handles splitting into chunks of 500 to respect Firestore batch limits.
   */
  static async commitBatch(updates: [string, VerifyEmailResult][]) {
    // 1. Gather all document refs & payloads
    const writes: { ref: FirebaseFirestore.DocumentReference, data: any, isMerge?: boolean }[] = [];
    
    // We run queries in parallel to find all contact documents mapped to these emails
    const entityQueries = updates.map(async ([email, result]) => {
      const hashed = this.hashEmail(email);
      
      // Queue Cache Write — clear the lock and persist the result
      const cacheRef = adminDb.collection('verification_cache').doc(hashed);
      writes.push({
        ref: cacheRef,
        data: {
          ...result,
          _status: 'complete',
          lockedAt: null,
          lastVerifiedAt: new Date().toISOString()
        },
        isMerge: true
      });
      
      // Queue Contact Entity Updates
      // Find all contacts matching this email address across all workspaces
      const entitiesSnap = await adminDb.collection('workspace_entities')
        .where('email', '==', email)
        .get();
        
      entitiesSnap.docs.forEach(doc => {
         writes.push({
           ref: doc.ref,
           data: {
             verificationStatus: result.status,
             verificationScore: result.score,
             lastVerifiedAt: new Date().toISOString(),
             verificationDetails: result.checks
           }
         });
      });
    });

    await Promise.all(entityQueries);

    // 2. Commit in chunks of 500 (Firestore hard limit per batch)
    for (let i = 0; i < writes.length; i += 500) {
      const chunk = writes.slice(i, i + 500);
      const batch = adminDb.batch();
      
      for (const w of chunk) {
        if (w.isMerge) {
          batch.set(w.ref, w.data, { merge: true });
        } else {
          batch.update(w.ref, w.data);
        }
      }
      
      await batch.commit();
    }
  }
}
