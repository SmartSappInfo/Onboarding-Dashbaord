/**
 * @fileoverview Type-Safe Client-Side IndexedDB Storage Service for Company Brain 2.0 (Phase 10).
 *
 * ARCHITECTURAL NOTES & FUTURE MAINTAINER GUIDES:
 * - Provides high-speed, zero-latency local caching of workspace notes, local drafts, and offline mutation jobs.
 * - Gracefully falls back to an in-memory storage driver if IndexedDB is blocked, private browsing is active, or running during SSR.
 * - Strictly typed without `any` or `any[]`.
 */

import type {
  QuickNote,
  OfflineMutationJob,
  OfflineLocalDraft,
  OfflineStorageStats,
  OfflineMutationStatus,
} from '../quick-notes-types';
import { calculateCacheStorageEstimate } from '../quick-notes-domain';

const DB_NAME = 'SmartSapp_Knowledge_DB_v1';
const DB_VERSION = 1;

// Object Store names
const STORE_NOTES = 'cached_notes';
const STORE_QUEUE = 'mutation_queue';
const STORE_DRAFTS = 'local_drafts';
const STORE_META = 'sync_meta';

// In-memory fallback stores when IndexedDB is unavailable
const memoryNotes = new Map<string, QuickNote>();
const memoryQueue = new Map<string, OfflineMutationJob>();
const memoryDrafts = new Map<string, OfflineLocalDraft>();
const _memoryMeta = new Map<string, unknown>();

/**
 * Checks if browser IndexedDB API is supported and accessible.
 */
export function isIndexedDbAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Opens and initializes the IndexedDB database instance with typed schema migrations.
 */
function openDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Cached Notes store
        if (!db.objectStoreNames.contains(STORE_NOTES)) {
          const notesStore = db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
          notesStore.createIndex('workspaceId', 'workspaceId', { unique: false });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          notesStore.createIndex('categoryId', 'categoryId', { unique: false });
        }

        // 2. Offline Mutation Queue store
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
          queueStore.createIndex('workspaceId', 'workspaceId', { unique: false });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('clientTimestamp', 'clientTimestamp', { unique: false });
        }

        // 3. Local Scratchpad Drafts store
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
          const draftsStore = db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
          draftsStore.createIndex('workspaceId', 'workspaceId', { unique: false });
          draftsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 4. Sync Metadata store
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('[OfflineStorage] IndexedDB open error; falling back to memory driver.');
        resolve(null);
      };
    } catch (err) {
      console.warn('[OfflineStorage] Failed to initialize IndexedDB:', err);
      resolve(null);
    }
  });
}

/**
 * Helper to run a transactional operation on an IndexedDB store.
 */
async function executeTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = operation(store);

      if (request) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn(`[OfflineStorage] Request failed on store ${storeName}:`, request.error);
          resolve(null);
        };
      } else {
        tx.oncomplete = () => resolve(null);
        tx.onerror = () => {
          console.warn(`[OfflineStorage] Transaction failed on store ${storeName}:`, tx.error);
          resolve(null);
        };
      }
    } catch (err) {
      console.warn(`[OfflineStorage] Transaction exception on store ${storeName}:`, err);
      resolve(null);
    }
  });
}

export const OfflineStorageService = {
  // --------------------------------------------------------------------------
  // CACHED NOTES
  // --------------------------------------------------------------------------

  async getCachedNotes(workspaceId: string): Promise<QuickNote[]> {
    if (!isIndexedDbAvailable()) {
      return Array.from(memoryNotes.values()).filter((n) => n.workspaceId === workspaceId);
    }

    const db = await openDatabase();
    if (!db) {
      return Array.from(memoryNotes.values()).filter((n) => n.workspaceId === workspaceId);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NOTES, 'readonly');
        const store = tx.objectStore(STORE_NOTES);
        const index = store.index('workspaceId');
        const request = index.getAll(workspaceId);

        request.onsuccess = () => {
          resolve(request.result || []);
        };
        request.onerror = () => {
          resolve(Array.from(memoryNotes.values()).filter((n) => n.workspaceId === workspaceId));
        };
      } catch {
        resolve(Array.from(memoryNotes.values()).filter((n) => n.workspaceId === workspaceId));
      }
    });
  },

  async putCachedNotes(workspaceId: string, notes: QuickNote[]): Promise<void> {
    // Keep in-memory cache synchronized
    for (const note of notes) {
      memoryNotes.set(note.id, note);
    }

    if (!isIndexedDbAvailable()) return;

    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NOTES, 'readwrite');
        const store = tx.objectStore(STORE_NOTES);

        for (const note of notes) {
          store.put(note);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  async putCachedNote(note: QuickNote): Promise<void> {
    memoryNotes.set(note.id, note);

    if (!isIndexedDbAvailable()) return;

    await executeTransaction(STORE_NOTES, 'readwrite', (store) => {
      store.put(note);
    });
  },

  async deleteCachedNote(id: string): Promise<void> {
    memoryNotes.delete(id);

    if (!isIndexedDbAvailable()) return;

    await executeTransaction(STORE_NOTES, 'readwrite', (store) => {
      store.delete(id);
    });
  },

  // --------------------------------------------------------------------------
  // OFFLINE MUTATION QUEUE
  // --------------------------------------------------------------------------

  async enqueueMutation(job: OfflineMutationJob): Promise<void> {
    memoryQueue.set(job.id, job);

    if (!isIndexedDbAvailable()) return;

    await executeTransaction(STORE_QUEUE, 'readwrite', (store) => {
      store.put(job);
    });
  },

  async getPendingMutations(workspaceId: string): Promise<OfflineMutationJob[]> {
    if (!isIndexedDbAvailable()) {
      return Array.from(memoryQueue.values())
        .filter((j) => j.workspaceId === workspaceId && (j.status === 'pending' || j.status === 'syncing'))
        .sort((a, b) => new Date(a.clientTimestamp).getTime() - new Date(b.clientTimestamp).getTime());
    }

    const db = await openDatabase();
    if (!db) {
      return Array.from(memoryQueue.values()).filter((j) => j.workspaceId === workspaceId && j.status === 'pending');
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_QUEUE, 'readonly');
        const store = tx.objectStore(STORE_QUEUE);
        const request = store.getAll();

        request.onsuccess = () => {
          const allJobs: OfflineMutationJob[] = request.result || [];
          const pending = allJobs
            .filter((j) => j.workspaceId === workspaceId && (j.status === 'pending' || j.status === 'syncing'))
            .sort((a, b) => new Date(a.clientTimestamp).getTime() - new Date(b.clientTimestamp).getTime());
          resolve(pending);
        };
        request.onerror = () => {
          resolve(Array.from(memoryQueue.values()).filter((j) => j.workspaceId === workspaceId && j.status === 'pending'));
        };
      } catch {
        resolve(Array.from(memoryQueue.values()).filter((j) => j.workspaceId === workspaceId && j.status === 'pending'));
      }
    });
  },

  async getAllMutations(workspaceId: string): Promise<OfflineMutationJob[]> {
    if (!isIndexedDbAvailable()) {
      return Array.from(memoryQueue.values())
        .filter((j) => j.workspaceId === workspaceId)
        .sort((a, b) => new Date(a.clientTimestamp).getTime() - new Date(b.clientTimestamp).getTime());
    }

    const db = await openDatabase();
    if (!db) {
      return Array.from(memoryQueue.values()).filter((j) => j.workspaceId === workspaceId);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_QUEUE, 'readonly');
        const store = tx.objectStore(STORE_QUEUE);
        const request = store.getAll();

        request.onsuccess = () => {
          const allJobs: OfflineMutationJob[] = request.result || [];
          const workspaceJobs = allJobs
            .filter((j) => j.workspaceId === workspaceId)
            .sort((a, b) => new Date(a.clientTimestamp).getTime() - new Date(b.clientTimestamp).getTime());
          resolve(workspaceJobs);
        };
        request.onerror = () => {
          resolve(Array.from(memoryQueue.values()).filter((j) => j.workspaceId === workspaceId));
        };
      } catch {
        resolve(Array.from(memoryQueue.values()).filter((j) => j.workspaceId === workspaceId));
      }
    });
  },

  async updateMutationStatus(
    id: string,
    status: OfflineMutationStatus,
    lastError?: string
  ): Promise<void> {
    const memJob = memoryQueue.get(id);
    if (memJob) {
      memJob.status = status;
      if (lastError !== undefined) memJob.lastError = lastError;
      if (status === 'failed') memJob.retryCount += 1;
    }

    if (!isIndexedDbAvailable()) return;

    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
          const job: OfflineMutationJob = getReq.result;
          if (job) {
            job.status = status;
            if (lastError !== undefined) job.lastError = lastError;
            if (status === 'failed') job.retryCount += 1;
            store.put(job);
          }
          resolve();
        };
        getReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  async removeMutation(id: string): Promise<void> {
    memoryQueue.delete(id);

    if (!isIndexedDbAvailable()) return;

    await executeTransaction(STORE_QUEUE, 'readwrite', (store) => {
      store.delete(id);
    });
  },

  async clearMutationQueue(workspaceId: string): Promise<void> {
    for (const [key, val] of memoryQueue.entries()) {
      if (val.workspaceId === workspaceId) memoryQueue.delete(key);
    }

    if (!isIndexedDbAvailable()) return;

    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        const req = store.getAll();

        req.onsuccess = () => {
          const jobs: OfflineMutationJob[] = req.result || [];
          for (const job of jobs) {
            if (job.workspaceId === workspaceId) {
              store.delete(job.id);
            }
          }
          resolve();
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  // --------------------------------------------------------------------------
  // LOCAL DRAFTS
  // --------------------------------------------------------------------------

  async saveLocalDraft(draft: OfflineLocalDraft): Promise<void> {
    memoryDrafts.set(draft.id, draft);

    if (!isIndexedDbAvailable()) return;

    await executeTransaction(STORE_DRAFTS, 'readwrite', (store) => {
      store.put(draft);
    });
  },

  async getLocalDraft(id: string): Promise<OfflineLocalDraft | null> {
    if (!isIndexedDbAvailable()) {
      return memoryDrafts.get(id) || null;
    }

    const result = await executeTransaction<OfflineLocalDraft>(STORE_DRAFTS, 'readonly', (store) => {
      return store.get(id);
    });

    return result || memoryDrafts.get(id) || null;
  },

  async listLocalDrafts(workspaceId: string): Promise<OfflineLocalDraft[]> {
    if (!isIndexedDbAvailable()) {
      return Array.from(memoryDrafts.values()).filter((d) => d.workspaceId === workspaceId);
    }

    const db = await openDatabase();
    if (!db) {
      return Array.from(memoryDrafts.values()).filter((d) => d.workspaceId === workspaceId);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_DRAFTS, 'readonly');
        const store = tx.objectStore(STORE_DRAFTS);
        const index = store.index('workspaceId');
        const request = index.getAll(workspaceId);

        request.onsuccess = () => {
          resolve(request.result || []);
        };
        request.onerror = () => {
          resolve(Array.from(memoryDrafts.values()).filter((d) => d.workspaceId === workspaceId));
        };
      } catch {
        resolve(Array.from(memoryDrafts.values()).filter((d) => d.workspaceId === workspaceId));
      }
    });
  },

  async deleteLocalDraft(id: string): Promise<void> {
    memoryDrafts.delete(id);

    if (!isIndexedDbAvailable()) return;

    await executeTransaction(STORE_DRAFTS, 'readwrite', (store) => {
      store.delete(id);
    });
  },

  // --------------------------------------------------------------------------
  // STORAGE DIAGNOSTICS & MAINTENANCE
  // --------------------------------------------------------------------------

  async getStorageStats(workspaceId: string): Promise<OfflineStorageStats> {
    const cached = await this.getCachedNotes(workspaceId);
    const queue = await this.getAllMutations(workspaceId);
    const drafts = await this.listLocalDrafts(workspaceId);

    const pendingCount = queue.filter((j) => j.status === 'pending' || j.status === 'syncing').length;
    const bytes = calculateCacheStorageEstimate(cached.length, drafts.length, queue.length);

    let lastSync: string | undefined;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`smartsapp_last_sync_${workspaceId}`);
        if (stored) lastSync = stored;
      } catch {
        // ignore
      }
    }

    return {
      cachedNotesCount: cached.length,
      pendingMutationsCount: pendingCount,
      localDraftsCount: drafts.length,
      storageBytesEstimated: bytes,
      lastSyncTimestamp: lastSync,
      isIndexedDbSupported: isIndexedDbAvailable(),
    };
  },

  async clearWorkspaceCache(workspaceId: string, preserveQueue = true): Promise<void> {
    // Clear in-memory
    for (const [key, val] of memoryNotes.entries()) {
      if (val.workspaceId === workspaceId) memoryNotes.delete(key);
    }
    for (const [key, val] of memoryDrafts.entries()) {
      if (val.workspaceId === workspaceId) memoryDrafts.delete(key);
    }
    if (!preserveQueue) {
      for (const [key, val] of memoryQueue.entries()) {
        if (val.workspaceId === workspaceId) memoryQueue.delete(key);
      }
    }

    if (!isIndexedDbAvailable()) return;

    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const stores = preserveQueue ? [STORE_NOTES, STORE_DRAFTS] : [STORE_NOTES, STORE_DRAFTS, STORE_QUEUE];
        const tx = db.transaction(stores, 'readwrite');

        const notesStore = tx.objectStore(STORE_NOTES);
        notesStore.clear();

        const draftsStore = tx.objectStore(STORE_DRAFTS);
        draftsStore.clear();

        if (!preserveQueue) {
          const queueStore = tx.objectStore(STORE_QUEUE);
          queueStore.clear();
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },
};
