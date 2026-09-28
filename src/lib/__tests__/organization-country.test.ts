// src/lib/__tests__/organization-country.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveOrganizationCountryCode, clearOrganizationCountryCache } from '../organization-country';
import { adminDb } from '../firebase-admin';

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

describe('resolveOrganizationCountryCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOrganizationCountryCache();
  });

  it('returns undefined if organizationId is null or undefined', async () => {
    const result = await resolveOrganizationCountryCode(null);
    expect(result).toBeUndefined();
  });

  it('resolves valid 2-letter ISO country code from organization document', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ defaultCountryCode: 'NG' }),
    });
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: mockGet }),
    } as unknown as ReturnType<typeof adminDb.collection>);

    const code = await resolveOrganizationCountryCode('org_nigeria');
    expect(code).toBe('NG');
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Verify in-memory cache prevents second Firestore call (scale/load protection)
    const cachedCode = await resolveOrganizationCountryCode('org_nigeria');
    expect(cachedCode).toBe('NG');
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('uppercases country code and rejects invalid lengths', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ defaultCountryCode: 'gh' }),
    });
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: mockGet }),
    } as unknown as ReturnType<typeof adminDb.collection>);

    const code = await resolveOrganizationCountryCode('org_ghana');
    expect(code).toBe('GH');
  });

  it('returns undefined when organization document does not exist or has no defaultCountryCode', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ name: 'No Country Org' }),
    });
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: mockGet }),
    } as unknown as ReturnType<typeof adminDb.collection>);

    const code = await resolveOrganizationCountryCode('org_no_country');
    expect(code).toBeUndefined();
  });

  it('coalesces concurrent requests during cold start to a single Firestore fetch (stampede protection)', async () => {
    let callCount = 0;
    const mockGet = vi.fn().mockImplementation(async () => {
      callCount++;
      // Artificial delay to simulate network latency
      await new Promise(resolve => setTimeout(resolve, 20));
      return {
        exists: true,
        data: () => ({ defaultCountryCode: 'KE' }),
      };
    });

    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: mockGet }),
    } as unknown as ReturnType<typeof adminDb.collection>);

    // Fire 20 simultaneous concurrent calls
    const results = await Promise.all(
      Array.from({ length: 20 }, () => resolveOrganizationCountryCode('org_kenya'))
    );

    expect(results).toEqual(Array(20).fill('KE'));
    expect(callCount).toBe(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
