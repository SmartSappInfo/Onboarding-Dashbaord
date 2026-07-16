import { adminDb } from '../firebase-admin';

// Simple structure to track the local cached range of serial numbers in-memory
interface LocalBlock {
  next: number;
  limit: number;
}

// In-memory cache for contact and page blocks (node-scoped)
const blockCache: Record<string, LocalBlock> = {
  contacts: { next: 0, limit: 0 },
  pages: { next: 0, limit: 0 }
};

const BLOCK_SIZES: Record<string, number> = {
  contacts: 2000, // Allocate 2000 IDs at a time for high-throughput contact creation
  pages: 50       // Allocate 50 IDs at a time for low-throughput pages
};

/**
 * Distributed batch serial allocator using Hi-Lo pattern.
 * Requests a block of serials dynamically via a Firestore transaction.
 */
async function allocateNextBlock(type: 'contacts' | 'pages'): Promise<LocalBlock> {
  const counterRef = adminDb.collection('system_counters').doc(type);
  const blockSize = BLOCK_SIZES[type];

  const block = await adminDb.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    let currentLast = 0;

    if (doc.exists) {
      currentLast = doc.data()?.last_allocated_serial ?? 0;
    }

    const nextLast = currentLast + blockSize;
    transaction.set(counterRef, { last_allocated_serial: nextLast }, { merge: true });

    return {
      next: currentLast + 1,
      limit: nextLast
    };
  });

  return block;
}

/**
 * Gets the next unique 32-bit serial number for a contact or page.
 * Synchronous in-memory lookup 99% of the time. Only runs a database transaction
 * when the local block range is exhausted.
 */
export async function getNextSerial(type: 'contacts' | 'pages'): Promise<number> {
  const cache = blockCache[type];

  // If local block is exhausted, fetch a new block from Firestore
  if (cache.next > cache.limit || cache.next === 0) {
    const newBlock = await allocateNextBlock(type);
    cache.next = newBlock.next;
    cache.limit = newBlock.limit;
  }

  const assigned = cache.next;
  cache.next++;
  return assigned;
}
