'use client';

import * as React from 'react';
import { collection, query, where, orderBy, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MessageAudience, AudienceFilter } from '@/lib/types';

/**
 * Real-time Firestore subscription for saved audiences scoped to a workspace.
 */
export function useAudiences(workspaceId: string | undefined) {
  const firestore = useFirestore();

  const audiencesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'message_audiences'),
      where('workspaceId', '==', workspaceId),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, workspaceId]);

  const { data, isLoading, error } = useCollection<MessageAudience>(audiencesQuery);

  return { audiences: data || [], isLoading, error };
}

// ─── CRUD Actions ─────────────────────────────────────────────────────────────

export async function createAudience(
  firestore: any,
  data: Omit<MessageAudience, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString();
  const sanitized = JSON.parse(JSON.stringify({
    ...data,
    createdAt: now,
    updatedAt: now,
  }));
  const docRef = await addDoc(collection(firestore, 'message_audiences'), sanitized);
  return docRef.id;
}

export async function updateAudience(
  firestore: any,
  audienceId: string,
  data: Partial<MessageAudience>
): Promise<void> {
  const sanitized = JSON.parse(JSON.stringify({
    ...data,
    updatedAt: new Date().toISOString(),
  }));
  await updateDoc(doc(firestore, 'message_audiences', audienceId), sanitized);
}

export async function deleteAudience(
  firestore: any,
  audienceId: string
): Promise<void> {
  await deleteDoc(doc(firestore, 'message_audiences', audienceId));
}

export async function duplicateAudience(
  firestore: any,
  source: MessageAudience,
  userId: string
): Promise<string> {
  return createAudience(firestore, {
    workspaceId: source.workspaceId,
    name: `Copy of ${source.name}`,
    description: source.description,
    filters: source.filters,
    filterLogic: source.filterLogic,
    createdBy: userId,
  });
}

/**
 * Converts Phase 3 simple AudienceDefinition into Phase 4 AudienceFilter[].
 * Backward-compatible migration (R6 fix).
 */
export function legacyAudienceToFilters(def: {
  tagIds?: string[];
  tagLogic?: 'any' | 'all';
  excludeTagIds?: string[];
}): AudienceFilter[] {
  const filters: AudienceFilter[] = [];

  if (def.tagIds && def.tagIds.length > 0) {
    filters.push({
      id: 'legacy_include_tags',
      field: 'tags',
      operator: def.tagLogic === 'all' ? 'all_of' : 'any_of',
      value: def.tagIds,
    });
  }

  if (def.excludeTagIds && def.excludeTagIds.length > 0) {
    filters.push({
      id: 'legacy_exclude_tags',
      field: 'tags',
      operator: 'is_not',
      value: def.excludeTagIds,
    });
  }

  return filters;
}
