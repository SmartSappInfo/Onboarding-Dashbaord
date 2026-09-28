import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhoneHygieneRepository } from '../phone-hygiene-repository';
import { resolveOrganizationCountryCode } from '../organization-country';
import { PhoneVerificationEngine } from '../phone-verifier';

vi.mock('../phone-hygiene-repository', () => ({
  PhoneHygieneRepository: {
    getCache: vi.fn(),
    commitBatch: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../organization-country', () => ({
  resolveOrganizationCountryCode: vi.fn(),
}));

describe('SMS Delivery Guard JIT Self-Healing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('self-heals cached score 0 when bare international number is valid', async () => {
    (PhoneHygieneRepository.getCache as any).mockResolvedValue({
      status: 'invalid',
      score: 0,
    });
    (resolveOrganizationCountryCode as any).mockResolvedValue('GH');

    const engine = new PhoneVerificationEngine();
    const freshResult = await engine.verify('233242737120', 'GH');

    expect(freshResult.valid).toBe(true);
    expect(freshResult.status).toBe('format_valid');
    expect(freshResult.score).toBeGreaterThanOrEqual(70);
  });

  it('self-heals cached score 0 for all 5 user reported contact numbers', async () => {
    const userNumbers = [
      '233242737120', // Noah International Complex
      '233244363965', // MY REDEEMER SCHOOL
      '233242753266', // Bethel Methodist School
      '233233146361', // The Sanctuary Montessori
      '0240488218',   // Tulips Hill Academy
    ];

    const engine = new PhoneVerificationEngine();

    for (const phone of userNumbers) {
      const freshResult = await engine.verify(phone, 'GH');
      expect(freshResult.valid).toBe(true);
      expect(freshResult.status).toBe('format_valid');
      expect(freshResult.score).toBeGreaterThanOrEqual(70);
    }
  });

  it('correctly keeps truly invalid numbers blocked', async () => {
    const engine = new PhoneVerificationEngine();
    const badNumberResult = await engine.verify('invalid_phone_123', 'GH');

    expect(badNumberResult.valid).toBe(false);
    expect(badNumberResult.status).toBe('invalid');
  });
});
