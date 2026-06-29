import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkVerificationService } from '../bulk-verifier';

// Defensive: inert Firestore so no test in this file can ever reach the real
// backend (which hangs on gRPC retries in CI). The per-test spies on the service
// methods are the primary isolation; this is the safety net for future tests.
vi.mock('../firebase-admin', () => {
  const docRef = {
    get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const query: Record<string, unknown> = {};
  query.where = vi.fn(() => query);
  query.orderBy = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.get = vi.fn().mockResolvedValue({ empty: true, docs: [] });
  query.doc = vi.fn(() => docRef);
  query.add = vi.fn().mockResolvedValue({ id: 'mock-id' });
  return {
    adminDb: {
      collection: vi.fn(() => query),
      batch: vi.fn(() => ({
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      })),
      runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
          set: vi.fn(),
          update: vi.fn(),
        }),
      ),
    },
  };
});

describe('BulkVerificationService - Domain Serialization & Batching', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups requests by domain and applies jitter to requests targeting the same domain', async () => {
    const service = new BulkVerificationService();
    
    // Mock the actual verification execution to resolve instantly
    const verifySpy = vi.spyOn(service as any, 'executeSingleVerification')
      .mockResolvedValue({ valid: true, score: 90, status: 'verified', checks: {}, details: {} });

    // Isolate from Firestore: cache read returns a miss, batch commit is a no-op.
    // Without these, getHygieneFromCache/commitBatchToFirestore hit real Firestore and hang.
    vi.spyOn(service as any, 'getHygieneFromCache').mockResolvedValue(null);
    vi.spyOn(service as any, 'commitBatchToFirestore').mockResolvedValue(undefined);

    // 2 Gmail addresses, 1 Yahoo address
    const emails = ['test1@gmail.com', 'test2@gmail.com', 'test1@yahoo.com'];

    const startTime = Date.now();
    await service.processBulk(emails);
    const duration = Date.now() - startTime;

    // The two 'gmail.com' addresses MUST be serialized to prevent rate limiting,
    // separated by at least 300ms of jitter. The yahoo.com address can run concurrently.
    expect(verifySpy).toHaveBeenCalledTimes(3);
    
    // If serialization works, it should take at least 300ms due to the minimum jitter delay.
    expect(duration).toBeGreaterThanOrEqual(300);
  });

  it('batches firestore updates to prevent write starvation', async () => {
    const service = new BulkVerificationService();
    
    vi.spyOn(service as any, 'executeSingleVerification')
      .mockResolvedValue({ valid: true, score: 90, status: 'verified', checks: {}, details: {} });

    // Isolate from Firestore: cache read returns a miss so each email gets verified + queued.
    vi.spyOn(service as any, 'getHygieneFromCache').mockResolvedValue(null);

    const batchUpdateSpy = vi.spyOn(service as any, 'commitBatchToFirestore').mockResolvedValue(undefined);

    // Provide 505 uniquely domained emails (so they run fully in parallel without jitter)
    const emails = Array.from({ length: 505 }, (_, i) => `user${i}@corporate${i}.com`);
    
    await service.processBulk(emails);

    // Firestore batch limit is 500. So processing 505 should result in exactly 2 batch commits.
    expect(batchUpdateSpy).toHaveBeenCalledTimes(2);
  });

  it('skips database writes if the newly calculated score is identical to the cached score', async () => {
    const service = new BulkVerificationService();

    // The email is already cached with a score of 95
    vi.spyOn(service as any, 'getHygieneFromCache').mockResolvedValue({ score: 95, status: 'verified' });
    
    // The new verification yields the exact same score
    vi.spyOn(service as any, 'executeSingleVerification')
      .mockResolvedValue({ valid: true, score: 95, status: 'verified', checks: {}, details: {} });

    const batchUpdateSpy = vi.spyOn(service as any, 'commitBatchToFirestore').mockResolvedValue(undefined);

    await service.processBulk(['cached@example.com'], { forceRefresh: true });

    // Because the score didn't change, it should not trigger a database write payload.
    // The chunk should be empty and the commit skipped.
    expect(batchUpdateSpy).not.toHaveBeenCalled();
  });
});
