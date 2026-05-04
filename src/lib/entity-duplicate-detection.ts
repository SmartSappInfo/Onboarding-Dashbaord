import { adminDb } from './firebase-admin';

export interface DuplicateMatch {
  entityId: string;
  name: string;
  reason: string;
}

/**
 * Checks for strict duplicates of an entity within a workspace.
 * Matches against exact (case-sensitive) name, email, or phone.
 */
export async function findDuplicateEntities(
  workspaceId: string,
  entityType: string,
  name?: string,
  email?: string,
  phone?: string
): Promise<DuplicateMatch[]> {
  const matches = new Map<string, DuplicateMatch>();
  const queries: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

  const baseQuery = adminDb.collection('workspace_entities')
    .where('workspaceId', '==', workspaceId)
    .where('entityType', '==', entityType);

  if (name?.trim()) {
    queries.push(baseQuery.where('displayName', '==', name.trim()).get());
  }
  
  if (email?.trim()) {
    queries.push(baseQuery.where('primaryEmail', '==', email.trim()).get());
  }
  
  if (phone?.trim()) {
    queries.push(baseQuery.where('primaryPhone', '==', phone.trim()).get());
  }

  if (queries.length === 0) return [];

  try {
    const results = await Promise.all(queries);

    // Combine results and track reasons
    results.forEach((snap, index) => {
      let queryType = 'Unknown';
      if (index === 0 && name?.trim()) queryType = 'Name';
      else if (index === 1 && email?.trim()) queryType = 'Email';
      else if (index === 2 && phone?.trim()) queryType = 'Phone';
      else if (index === 0 && !name?.trim() && email?.trim()) queryType = 'Email';
      else if (index === 0 && !name?.trim() && !email?.trim() && phone?.trim()) queryType = 'Phone';
      else if (index === 1 && !name?.trim() && phone?.trim()) queryType = 'Phone';

      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (matches.has(doc.id)) {
          const existing = matches.get(doc.id)!;
          if (!existing.reason.includes(queryType)) {
            existing.reason += `, ${queryType}`;
          }
        } else {
          matches.set(doc.id, {
            entityId: doc.id,
            name: data.displayName || 'Unknown',
            reason: `${queryType} match`,
          });
        }
      });
    });

    return Array.from(matches.values());
  } catch (error) {
    console.error('Failed to check for duplicate entities:', error);
    return [];
  }
}
