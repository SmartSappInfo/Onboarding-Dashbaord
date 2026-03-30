'use client';

import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

interface ResolvedContact {
  id: string;
  name: string;
  entityType?: 'institution' | 'family' | 'person';
  entityId?: string;
  migrationStatus: 'legacy' | 'migrated';
}

/**
 * Client-side contact adapter for resolving contact information in UI components
 * Supports both legacy schools and migrated entities
 * 
 * Requirements: 15.4, 23.1
 */
export async function resolveContactClient(
  identifier: string,
  workspaceId: string,
  firestore?: Firestore
): Promise<ResolvedContact | null> {
  if (!firestore) {
    // Dynamically import to avoid circular dependencies
    const { useFirestore } = await import('@/firebase');
    firestore = useFirestore();
  }

  if (!firestore) {
    console.error('Firestore not available');
    return null;
  }

  try {
    // First, try to resolve as an entity
    const entityDoc = await getDoc(doc(firestore, 'entities', identifier));
    
    if (entityDoc.exists()) {
      const entityData = entityDoc.data();
      
      // Get workspace-specific data
      const weQuery = query(
        collection(firestore, 'workspace_entities'),
        where('entityId', '==', identifier),
        where('workspaceId', '==', workspaceId),
        limit(1)
      );
      
      const weSnapshot = await getDocs(weQuery);
      
      return {
        id: entityDoc.id,
        name: entityData.name || 'Unknown',
        entityType: entityData.entityType,
        entityId: entityDoc.id,
        migrationStatus: 'migrated'
      };
    }

    // Fallback: try to resolve as a legacy school
    const schoolDoc = await getDoc(doc(firestore, 'schools', identifier));
    
    if (schoolDoc.exists()) {
      const schoolData = schoolDoc.data();
      
      return {
        id: schoolDoc.id,
        name: schoolData.name || 'Unknown',
        entityType: 'institution',
        entityId: schoolData.entityId,
        migrationStatus: schoolData.migrationStatus === 'migrated' ? 'migrated' : 'legacy'
      };
    }

    return null;
  } catch (error) {
    console.error('Error resolving contact:', error);
    return null;
  }
}
