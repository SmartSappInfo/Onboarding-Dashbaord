'use server';

/**
 * @fileOverview CompanyBrain 2.0: Backoffice Super-Admin Server Actions
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Super-Admin Control Plane:
 *    - Powers `/backoffice/companybrain` monitoring and configuration.
 * 2. RBAC Security Guard:
 *    - Verifies system_admin permission or authorized backoffice user before execution.
 * 3. Telemetry & Reconciliation:
 *    - Exposes Qdrant cluster ping, vector counts, cache hit rate, and FER re-index triggers.
 *
 * @testability Covered in `src/lib/memory/__tests__/qdrant-client.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { QdrantClient } from '../qdrant/qdrant-client';
import { EmbeddingService } from '../services/embedding-service';
import { QdrantIndexer } from '../qdrant/qdrant-indexer';
import { MEMORY_OBJECTS_COLLECTION } from '../memory-repository';
import type { QdrantClusterHealth } from '../semantic-types';
import type { MemoryObject } from '../types';
import type { MemoryActionResult } from './memory-actions';

async function verifyBackofficeAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) return false;
    const data = userSnap.data();
    return (
      data?.isAuthorized === true ||
      (data?.permissions && data.permissions.includes('system_admin'))
    );
  } catch {
    return false;
  }
}

export interface BackofficeCompanyBrainHealth {
  cluster: QdrantClusterHealth;
  cache: {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  firestore: {
    totalMemories: number;
    indexedCount: number;
    pendingCount: number;
  };
}

/**
 * Retrieves platform-wide health metrics for Qdrant, embeddings, and Firestore memories.
 */
export async function getCompanyBrainHealthAction(
  userId: string
): Promise<MemoryActionResult<BackofficeCompanyBrainHealth>> {
  if (!userId) {
    return { success: false, error: 'Unauthenticated caller.' };
  }

  const isAdmin = await verifyBackofficeAdmin(userId);
  if (!isAdmin) {
    return { success: false, error: 'Unauthorized: Requires Backoffice Administrator access.' };
  }

  try {
    const [clusterHealth, memoriesSnap] = await Promise.all([
      QdrantClient.getClusterHealth(),
      adminDb.collection(MEMORY_OBJECTS_COLLECTION).limit(1000).get(),
    ]);

    const cacheStats = EmbeddingService.getCacheStats();

    let totalMemories = 0;
    let indexedCount = 0;
    let pendingCount = 0;

    for (const doc of memoriesSnap.docs) {
      totalMemories++;
      const data = doc.data() as MemoryObject;
      if (data.lifecycle?.status === 'indexed') {
        indexedCount++;
      } else {
        pendingCount++;
      }
    }

    return {
      success: true,
      data: {
        cluster: clusterHealth,
        cache: cacheStats,
        firestore: {
          totalMemories,
          indexedCount,
          pendingCount,
        },
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve health metrics.';
    console.error('[getCompanyBrainHealthAction] Error:', err);
    return { success: false, error: message };
  }
}

/**
 * Triggers re-indexing across all memories directly from Backoffice.
 */
export async function triggerCompanyBrainReindexAction(
  userId: string,
  workspaceId?: string
): Promise<MemoryActionResult<{ total: number; indexed: number; failed: number }>> {
  if (!userId) {
    return { success: false, error: 'Unauthenticated caller.' };
  }

  const isAdmin = await verifyBackofficeAdmin(userId);
  if (!isAdmin) {
    return { success: false, error: 'Unauthorized: Requires Backoffice Administrator access.' };
  }

  try {
    let query: FirebaseFirestore.Query = adminDb.collection(MEMORY_OBJECTS_COLLECTION);
    if (workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    }

    const snap = await query.limit(500).get();
    const memories = snap.docs.map((d) => d.data() as MemoryObject);

    const stats = await QdrantIndexer.indexMemoriesBatch(memories);

    return {
      success: true,
      data: {
        total: memories.length,
        indexed: stats.indexed,
        failed: stats.failed,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reindexing failed.';
    console.error('[triggerCompanyBrainReindexAction] Error:', err);
    return { success: false, error: message };
  }
}

/**
 * Purges the in-memory embedding cache.
 */
export async function clearEmbeddingCacheAction(
  userId: string
): Promise<MemoryActionResult<{ cleared: boolean }>> {
  if (!userId) {
    return { success: false, error: 'Unauthenticated caller.' };
  }

  const isAdmin = await verifyBackofficeAdmin(userId);
  if (!isAdmin) {
    return { success: false, error: 'Unauthorized: Requires Backoffice Administrator access.' };
  }

  EmbeddingService.clearCache();
  return { success: true, data: { cleared: true } };
}
