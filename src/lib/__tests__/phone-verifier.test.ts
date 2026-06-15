import { describe, it, expect } from 'vitest';
import {
  PhoneVerificationEngine,
  StructureValidator,
  PossibilityValidator,
  LineTypeValidator,
  SuspiciousPatternValidator,
} from '../phone-verifier';

const engine = new PhoneVerificationEngine();

describe('PhoneVerificationEngine — country matrix (E.164 input)', () => {
  // Real, valid mobile ranges chosen to avoid 7+ digit sequential runs
  // (which the suspicious-pattern validator legitimately penalizes).
  const validMobiles: [string, string][] = [
    ['+233244123456', 'GH'], // Ghana MTN
    ['+12025550123', 'US'],  // US (DC range)
    ['+254722000111', 'KE'], // Kenya Safaricom
    ['+2348039051234', 'NG'], // Nigeria
    ['+27825550199', 'ZA'],  // South Africa
    ['+447400123987', 'GB'], // UK
  ];

  it.each(validMobiles)('accepts %s as format_valid (%s)', async (phone, country) => {
    const result = await engine.verify(phone);
    expect(result.status).toBe('format_valid');
    expect(result.valid).toBe(true);
    expect(result.country).toBe(country);
    expect(result.checks.structure).toBe(true);
    expect(result.checks.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('rejects an invalid country code', async () => {
    const result = await engine.verify('+999123456789');
    expect(result.status).toBe('invalid');
    expect(result.checks.structure).toBe(false);
  });

  it('rejects numbers that are far too short', async () => {
    const result = await engine.verify('+23312');
    expect(result.status).toBe('invalid');
  });

  it('penalizes a possible-but-unallocated number', async () => {
    // Right length for Ghana but 011 is not an allocated mobile/landline prefix
    const result = await engine.verify('+233111234567');
    expect(result.checks.possible).toBe(true);
    expect(result.checks.valid).toBe(false);
    expect(result.score).toBeLessThan(70);
  });

  it('rejects input with letters', async () => {
    const result = await engine.verify('+23324ABC4567');
    expect(result.status).toBe('invalid');
  });

  it('rejects empty input', async () => {
    const result = await engine.verify('');
    expect(result.status).toBe('invalid');
    expect(result.checks.structure).toBe(false);
  });
});

describe('PhoneVerificationEngine — default-country fallback (local formats)', () => {
  it('parses a Ghana local number with GH default', async () => {
    const result = await engine.verify('0244123456', 'GH');
    expect(result.status).toBe('format_valid');
    expect(result.e164).toBe('+233244123456');
    expect(result.country).toBe('GH');
    expect(result.callingCode).toBe('233');
  });

  it('parses a US local number with US default', async () => {
    const result = await engine.verify('(202) 555-0123', 'US');
    expect(result.status).toBe('format_valid');
    expect(result.e164).toBe('+12025550123');
  });

  it('treats a local number without any default country as invalid', async () => {
    const result = await engine.verify('0244123456');
    expect(result.status).toBe('invalid');
  });

  it('handles 00-prefixed international format', async () => {
    const result = await engine.verify('00233244123456', 'GH');
    expect(result.status).toBe('format_valid');
    expect(result.e164).toBe('+233244123456');
  });

  it('handles Excel scientific-notation artifacts', async () => {
    const result = await engine.verify('2.33244123456E+11', 'GH');
    expect(result.status).toBe('format_valid');
    expect(result.e164).toBe('+233244123456');
  });
});

describe('PhoneVerificationEngine — suspicious patterns', () => {
  it('flags all-identical digits', async () => {
    const result = await engine.verify('+233222222222');
    expect(result.checks.suspicious).toBe(true);
    expect(result.score).toBeLessThan(70);
  });

  it('flags long sequential runs', async () => {
    const result = await engine.verify('+233212345678'); // national 212345678 has 12345678 run
    expect(result.checks.suspicious).toBe(true);
  });

  it('flags repeated 3-digit blocks', async () => {
    const result = await engine.verify('+233244244244');
    expect(result.checks.suspicious).toBe(true);
  });

  it('does not flag a normal number', async () => {
    const result = await engine.verify('+233244123456');
    expect(result.checks.suspicious).toBe(false);
  });
});

describe('PhoneVerificationEngine — line type', () => {
  it('identifies mobiles', async () => {
    const result = await engine.verify('+233244123456');
    expect(result.lineType).toBe('mobile');
  });

  it('identifies UK premium-rate as undesirable', async () => {
    const result = await engine.verify('+449098780903'); // UK 909 premium range (libphonenumber example)
    expect(result.lineType).toBe('premium_rate');
    expect(result.checks.lineType).toBe(false);
    expect(result.score).toBeLessThan(70);
  });

  it('reports fixed_line_or_mobile for US numbers', async () => {
    const result = await engine.verify('+12025550123');
    expect(result.lineType).toBe('fixed_line_or_mobile');
  });
});

describe('PhoneVerificationEngine — result shape (Firestore safety)', () => {
  it('never returns undefined fields', async () => {
    for (const input of ['+233244123456', 'garbage', '']) {
      const result = await engine.verify(input);
      const walk = (obj: any, path = '') => {
        for (const [k, v] of Object.entries(obj)) {
          expect(v, `${path}${k} must not be undefined`).not.toBe(undefined);
          if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, `${path}${k}.`);
        }
      };
      walk(result);
    }
  });

  it('clamps score to [0, 100]', async () => {
    const result = await engine.verify('+233200000000'); // suspicious penalty
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('Individual validators — short-circuit guards', () => {
  it('PossibilityValidator requires parsed state', async () => {
    const result = await new PossibilityValidator().execute({ phone: 'x' }, {});
    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(0);
  });

  it('LineTypeValidator requires parsed state', async () => {
    const result = await new LineTypeValidator().execute({ phone: 'x' }, {});
    expect(result.passed).toBe(false);
  });

  it('SuspiciousPatternValidator requires parsed state', async () => {
    const result = await new SuspiciousPatternValidator().execute({ phone: 'x' }, {});
    expect(result.passed).toBe(false);
  });

  it('StructureValidator stashes the parsed number in shared state', async () => {
    const state: Record<string, any> = {};
    const result = await new StructureValidator().execute({ phone: '+233244123456' }, state);
    expect(result.passed).toBe(true);
    expect(state.parsed).toBeDefined();
    expect(state.parsed.number).toBe('+233244123456');
  });
});
