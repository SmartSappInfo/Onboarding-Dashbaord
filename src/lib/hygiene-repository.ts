import { adminDb } from '@/lib/firebase-admin';
import { VerifyEmailResult } from './email-verifier';

/**
 * Handles all database interactions for contact hygiene.
 * Encapsulates caching and bulk entity updates.
 */
export class ContactHygieneRepository {
  
  /**
   * Retrieves the verification result from the global cache collection.
   * Returns null if cache miss or not found.
   */
  static async getCache(email: string): Promise<Partial<VerifyEmailResult> | null> {
    try {
      const hashed = Buffer.from(email.toLowerCase()).toString('base64');
      const doc = await adminDb.collection('verification_cache').doc(hashed).get();
      
      if (!doc.exists) return null;
      return doc.data() as Partial<VerifyEmailResult>;
    } catch (err) {
      console.warn(`[HygieneRepo] Cache read failed for ${email}:`, err);
      return null;
    }
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
      const emailLower = email.toLowerCase();
      const hashed = Buffer.from(emailLower).toString('base64');
      
      // Queue Cache Write
      const cacheRef = adminDb.collection('verification_cache').doc(hashed);
      writes.push({
        ref: cacheRef,
        data: {
          ...result,
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
