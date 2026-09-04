/**
 * @fileOverview CompanyBrain 2.0: Memory -> Qdrant Indexing Pipeline
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Asynchronous Vector Ingestion (PRD Section 77):
 *    - Ingests atomic MemoryObjects into Qdrant vector points with rich payloads.
 * 2. High-Load Guard & Chunking Limits:
 *    - Chunks text into bounded blocks and upserts in batches of <= 100 points.
 * 3. Graceful State Reconciliation (PRD Section 109):
 *    - If vector indexing succeeds, stamps memory status as 'indexed'.
 *    - If vector indexing fails, stamps memory status as 'index_pending' for retry queue.
 *    - The source record in Firestore is NEVER broken or rolled back because vector indexing failed.
 * 4. Tombstone Deletions:
 *    - Deletes outdated vector points by memoryId or sourceId to prevent index drift.
 *
 * @testability Covered in `src/lib/memory/__tests__/qdrant-client.test.ts`.
 */

import { createHash } from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { EmbeddingService } from '../services/embedding-service';
import { QdrantClient } from './qdrant-client';
import { MEMORY_OBJECTS_COLLECTION } from '../memory-repository';
import type { MemoryObject } from '../types';
import type { QdrantPoint, QdrantPayload } from '../semantic-types';

export class QdrantIndexer {
  /**
   * Generates a deterministic RFC 4122 compliant UUID string for a chunk point.
   * Qdrant REST API requires point IDs to be valid unsigned 64-bit integers or UUIDs.
   */
  public static generatePointId(memoryId: string, chunkId: string): string {
    const raw = `${memoryId}_${chunkId}`;
    const hash = createHash('sha256').update(raw).digest('hex');
    return [
      hash.slice(0, 8),
      hash.slice(8, 12),
      '4' + hash.slice(13, 16),
      'a' + hash.slice(17, 20),
      hash.slice(20, 32),
    ].join('-');
  }

  /**
   * Transforms a single MemoryObject into vector points and upserts them to Qdrant.
   */
  public static async indexMemory(memory: MemoryObject): Promise<boolean> {
    if (!memory || !memory.content) return false;

    try {
      // 1. Chunk content into bounded semantic segments
      const chunks = EmbeddingService.chunkText(memory.content, {
        targetChunkSize: 600,
        overlap: 100,
      });

      if (chunks.length === 0) return false;

      // 2. Generate vector embeddings for each chunk
      const embeddedChunks = await EmbeddingService.embedChunks(chunks);

      // 3. Extract connected entity and deal IDs from subjectRefs
      const entityIds = memory.subjectRefs?.entityIds ?? [];
      const dealIds = memory.subjectRefs?.dealIds ?? [];

      // 4. Construct Qdrant points with strongly typed payloads
      const points: QdrantPoint[] = embeddedChunks.map(({ chunk, vector }) => {
        const pointId = this.generatePointId(memory.id, chunk.chunkId);
        const payload: QdrantPayload = {
          organizationId: memory.organizationId,
          workspaceId: memory.workspaceId,
          memoryId: memory.id,
          memoryType: memory.type,
          sourceType: memory.source.type,
          sourceId: memory.source.sourceId,
          chunkId: chunk.chunkId,
          entityIds,
          dealIds,
          topics: memory.topics || [],
          importance: memory.importance ?? 0.8,
          confidence: memory.confidence ?? 0.8,
          visibilityScope: memory.visibility?.scope || 'workspace',
          verification: memory.verification,
          createdAt: memory.createdAt,
          content: chunk.content,
          heading: chunk.heading,
        };

        return {
          id: pointId,
          vector,
          payload,
        };
      });

      // 5. Clean up existing points for this memory before upserting new chunks
      await QdrantClient.deletePointsByFilter('memoryId', memory.id);

      // 6. Upsert points into Qdrant
      const success = await QdrantClient.upsertPoints(points);

      // 7. Update indexing state in Firestore
      try {
        const memoryRef = adminDb.collection(MEMORY_OBJECTS_COLLECTION).doc(memory.id);
        const statusUpdate = success ? 'indexed' : 'index_pending';
        await memoryRef.update({
          'lifecycle.status': statusUpdate,
          updatedAt: new Date().toISOString(),
        });
      } catch (firestoreErr) {
        console.warn('[QdrantIndexer] Failed to update memory indexing status in Firestore:', firestoreErr);
      }

      return success;
    } catch (err) {
      console.error(`[QdrantIndexer] Failed indexing memory ${memory.id}:`, err);
      return false;
    }
  }

  /**
   * Batch indexes multiple memories in safe chunks.
   */
  public static async indexMemoriesBatch(
    memories: MemoryObject[]
  ): Promise<{ indexed: number; failed: number }> {
    let indexed = 0;
    let failed = 0;

    for (const memory of memories) {
      const ok = await this.indexMemory(memory);
      if (ok) indexed++;
      else failed++;
    }

    return { indexed, failed };
  }

  /**
   * Prunes all vector points associated with a deleted or invalidated memory.
   */
  public static async deleteMemoryIndex(memoryId: string): Promise<boolean> {
    if (!memoryId) return true;
    return await QdrantClient.deletePointsByFilter('memoryId', memoryId);
  }

  /**
   * Prunes all vector points associated with a source document (e.g. noteId).
   */
  public static async deleteSourceIndex(sourceId: string): Promise<boolean> {
    if (!sourceId) return true;
    return await QdrantClient.deletePointsByFilter('sourceId', sourceId);
  }
}
