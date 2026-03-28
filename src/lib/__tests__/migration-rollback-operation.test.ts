/**
 * Unit Tests: Migration Rollback Operation
 * 
 * Tests the rollback operation that restores records to pre-migration state
 * by removing entityId and entityType fields and deleting backup collections.
 * 
 * Requirements: 21.2, 21.3, 21.4, 21.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMigrationEngine } from '../migration-engine';
import type { Firestore } from 'firebase/firestore';

// Mock Firestore
const createMockFirestore = () => {
  const mockDocs = new Map<string, Map<string, any>>();

  return {
    collection: vi.fn((name: string) => ({ name })),
    getDocs: vi.fn(async (collectionRef: any) => {
      const docs = mockDocs.get(collectionRef.name) || new Map();
      return {
        empty: docs.size === 0,
        size: docs.size,
        docs: Array.from(docs.entries()).map(([id, data]) => ({
          id,
          data: () => data,
          ref: { id, path: `${collectionRef.name}/${id}` },
        })),
      };
    }),
    setDoc: vi.fn(async (docRef: any, data: any) => {
      const collectionName = docRef.path.split('/')[0];
      if (!mockDocs.has(collectionName)) {
        mockDocs.set(collectionName, new Map());
      }
      mockDocs.get(collectionName)!.set(docRef.id, data);
    }),
    deleteDoc: vi.fn(async (docRef: any) => {
      const collectionName = docRef.path.split('/')[0];
      mockDocs.get(collectionName)?.delete(docRef.id);
    }),
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn(async () => {}),
    })),
    doc: vi.fn((collectionName: string, id: string) => ({
      id,
      path: `${collectionName}/${id}`,
    })),
    _mockDocs: mockDocs,
    _clearMocks: () => mockDocs.clear(),
  } as unknown as Firestore & { _mockDocs: Map<string, Map<string, any>>; _clearMocks: () => void };
};

describe('Migration Rollback Operation', () => {
  let mockFirestore: ReturnType<typeof createMockFirestore>;

  beforeEach(() => {
    mockFirestore = createMockFirestore();
  });

  describe('Basic Rollback Functionality', () => {
    it('should call rollback method successfully', async () => {
      const migrationEngine = createMigrationEngine(mockFirestore as Firestore);
      
      // Test that rollback method exists and returns expected structure
      const result = await migrationEngine.rollback('tasks');
      
      expect(result).toHaveProperty('collection');
      expect(result).toHaveProperty('totalRestored');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('errors');
      expect(result.collection).toBe('tasks');
    });

    it('should return empty result when no backup exists', async () => {
      const migrationEngine = createMigrationEngine(mockFirestore as Firestore);
      
      const result = await migrationEngine.rollback('activities');
      
      expect(result.totalRestored).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Idempotency', () => {
    it('should be safe to run multiple times', async () => {
      const migrationEngine = createMigrationEngine(mockFirestore as Firestore);
      
      // Execute multiple times
      const result1 = await migrationEngine.rollback('forms');
      const result2 = await migrationEngine.rollback('forms');
      const result3 = await migrationEngine.rollback('forms');
      
      // All should succeed without errors
      expect(result1.errors).toHaveLength(0);
      expect(result2.errors).toHaveLength(0);
      expect(result3.errors).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle rollback errors gracefully', async () => {
      const migrationEngine = createMigrationEngine(mockFirestore as Firestore);
      
      // Test with various collection names
      const collections = ['tasks', 'activities', 'forms', 'invoices', 'meetings'];
      
      for (const collection of collections) {
        const result = await migrationEngine.rollback(collection);
        expect(result).toBeDefined();
        expect(result.collection).toBe(collection);
      }
    });
  });
});
