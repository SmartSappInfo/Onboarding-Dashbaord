'use server';

import { adminDb } from './firebase-admin';

export interface OrphanedReference {
  contactId: string;
  contactType: 'school' | 'prospect';
  orphanedTagIds: string[];
}

export interface IntegrityReport {
  scannedContacts: number;
  orphanedReferences: OrphanedReference[];
  totalOrphanedRefs: number;
}

/**
 * Validates that all tag IDs in a contact's tags array exist in the tags collection.
 * Returns the list of tag IDs that are orphaned (don't exist).
 * Requirements: NFR4.2
 */
export async function validateTagReferences(
  contactId: string,
  contactType: 'school' | 'prospect'
): Promise<{ valid: boolean; orphanedTagIds: string[] }> {
  const collection = contactType === 'school' ? 'schools' : 'prospects';
  const contactSnap = await adminDb.collection(collection).doc(contactId).get();

  if (!contactSnap.exists) {
    return { valid: false, orphanedTagIds: [] };
  }

  const tagIds: string[] = contactSnap.data()?.tags || [];

  if (tagIds.length === 0) {
    return { valid: true, orphanedTagIds: [] };
  }

  // Fetch all referenced tags in batches of 30 (Firestore 'in' limit)
  const orphanedTagIds: string[] = [];
  const chunkSize = 30;

  for (let i = 0; i < tagIds.length; i += chunkSize) {
    const chunk = tagIds.slice(i, i + chunkSize);
    const tagsSnap = await adminDb
      .collection('tags')
      .where('__name__', 'in', chunk)
      .get();

    const existingIds = new Set(tagsSnap.docs.map(d => d.id));
    chunk.forEach(id => {
      if (!existingIds.has(id)) {
        orphanedTagIds.push(id);
      }
    });
  }

  return { valid: orphanedTagIds.length === 0, orphanedTagIds };
}

/**
 * Background job that scans all schools and prospects for orphaned tag references.
 * Returns a report of all contacts with tag IDs that no longer exist in the tags collection.
 * Requirements: NFR4.2
 */
export async function detectOrphanedTagReferences(): Promise<IntegrityReport> {
  // Fetch all existing tag IDs
  const tagsSnap = await adminDb.collection('tags').get();
  const existingTagIds = new Set(tagsSnap.docs.map(d => d.id));

  const orphanedReferences: OrphanedReference[] = [];
  let scannedContacts = 0;

  const processCollection = async (collectionName: string, contactType: 'school' | 'prospect') => {
    const snap = await adminDb.collection(collectionName).get();
    for (const doc of snap.docs) {
      const tagIds: string[] = doc.data().tags || [];
      if (tagIds.length === 0) {
        scannedContacts++;
        continue;
      }

      const orphanedTagIds = tagIds.filter(id => !existingTagIds.has(id));
      if (orphanedTagIds.length > 0) {
        orphanedReferences.push({ contactId: doc.id, contactType, orphanedTagIds });
      }
      scannedContacts++;
    }
  };

  await processCollection('schools', 'school');
  await processCollection('prospects', 'prospect');

  const totalOrphanedRefs = orphanedReferences.reduce(
    (sum, r) => sum + r.orphanedTagIds.length,
    0
  );

  return { scannedContacts, orphanedReferences, totalOrphanedRefs };
}

/**
 * Removes invalid (orphaned) tag IDs from contacts.
 * Accepts an optional report from detectOrphanedTagReferences; if not provided, runs detection first.
 * Requirements: NFR4.2
 */
export async function cleanupOrphanedTagReferences(
  report?: IntegrityReport
): Promise<{ cleanedContacts: number; removedRefs: number }> {
  const { orphanedReferences } = report ?? (await detectOrphanedTagReferences());

  if (orphanedReferences.length === 0) {
    return { cleanedContacts: 0, removedRefs: 0 };
  }

  const batchSize = 500;
  let cleanedContacts = 0;
  let removedRefs = 0;

  for (let i = 0; i < orphanedReferences.length; i += batchSize) {
    const chunk = orphanedReferences.slice(i, i + batchSize);
    const batch = adminDb.batch();

    for (const { contactId, contactType, orphanedTagIds } of chunk) {
      const collectionName = contactType === 'school' ? 'schools' : 'prospects';
      const ref = adminDb.collection(collectionName).doc(contactId);
      const snap = await ref.get();

      if (!snap.exists) continue;

      const data = snap.data()!;
      const cleanedTags = (data.tags || []).filter(
        (id: string) => !orphanedTagIds.includes(id)
      );
      const taggedAt = { ...data.taggedAt };
      const taggedBy = { ...data.taggedBy };

      orphanedTagIds.forEach(id => {
        delete taggedAt[id];
        delete taggedBy[id];
      });

      batch.update(ref, { tags: cleanedTags, taggedAt, taggedBy });
      cleanedContacts++;
      removedRefs += orphanedTagIds.length;
    }

    await batch.commit();
  }

  return { cleanedContacts, removedRefs };
}
