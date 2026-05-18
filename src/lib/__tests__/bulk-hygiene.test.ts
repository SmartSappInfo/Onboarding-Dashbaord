import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkVerificationService } from '../bulk-verifier';

describe('BulkVerificationService - Domain Serialization & Batching', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups requests by domain and applies jitter to requests targeting the same domain', async () => {
    const service = new BulkVerificationService();
    
    // Mock the actual verification execution to resolve instantly
    const verifySpy = vi.spyOn(service as any, 'executeSingleVerification')
      .mockResolvedValue({ valid: true, score: 90, status: 'verified', checks: {}, details: {} });

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
