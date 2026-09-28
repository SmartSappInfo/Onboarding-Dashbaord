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
    vi.mocked(PhoneHygieneRepository.getCache).mockResolvedValue({
      status: 'invalid',
      score: 0,
    } as unknown as Awaited<ReturnType<typeof PhoneHygieneRepository.getCache>>);
    vi.mocked(resolveOrganizationCountryCode).mockResolvedValue('GH');

    const engine = new PhoneVerificationEngine();
    const freshResult = await engine.verify('233242737120', 'GH');

    expect(freshResult.valid).toBe(true);
    expect(freshResult.status).toBe('format_valid');
    expect(freshResult.score).toBeGreaterThanOrEqual(70);
  });

  it('self-heals cached score 0 for all 5 user reported contact numbers', async () => {
    const bareNumbers = [
      { phone: '233242737120', e164: '+233242737120', label: 'Noah International Complex' },
      { phone: '233244363965', e164: '+233244363965', label: 'MY REDEEMER SCHOOL' },
      { phone: '233242753266', e164: '+233242753266', label: 'Bethel Methodist School' },
      { phone: '233233146361', e164: '+233233146361', label: 'The Sanctuary Montessori' },
    ];

    const engine = new PhoneVerificationEngine();

    // Bare numbers resolve globally even with NO defaultCountry hint
    for (const item of bareNumbers) {
      const freshResult = await engine.verify(item.phone);
      expect(freshResult.valid).toBe(true);
      expect(freshResult.status).toBe('format_valid');
      expect(freshResult.e164).toBe(item.e164);
      expect(freshResult.country).toBe('GH');
      expect(freshResult.score).toBe(85);
    }

    // Domestic number 0240488218 resolves via organization country setting ('GH')
    const domesticResult = await engine.verify('0240488218', 'GH');
    expect(domesticResult.valid).toBe(true);
    expect(domesticResult.status).toBe('format_valid');
    expect(domesticResult.e164).toBe('+233240488218');
    expect(domesticResult.country).toBe('GH');
    expect(domesticResult.score).toBe(85);
  });

  it('correctly keeps truly invalid numbers blocked', async () => {
    const engine = new PhoneVerificationEngine();
    const badNumberResult = await engine.verify('invalid_phone_123', 'GH');

    expect(badNumberResult.valid).toBe(false);
    expect(badNumberResult.status).toBe('invalid');
  });
});
