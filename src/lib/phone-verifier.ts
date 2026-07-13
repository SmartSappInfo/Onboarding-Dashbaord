// Use the "max" metadata bundle so getType() resolves line types for ALL
// countries (the default "min" bundle only carries type info for a few like
// US/GB). The engine runs server-side only, so the larger metadata never
// reaches the client bundle.
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import type { CountryCode, PhoneNumber } from 'libphonenumber-js';
import { normalizePhoneNumber, sanitizeScientificNotation } from './phone-utils';

/**
 * @fileOverview Offline phone verification engine (all countries).
 *
 * Mirrors the strategy architecture of email-verifier.ts. Every decision is
 * driven by libphonenumber-js metadata — no country-specific rules live here.
 * All validators are pure and synchronous (wrapped in async for interface
 * parity with the email engine); the module is safe for serverless runtimes.
 *
 * Score model (max attainable offline: 85 — OTP ownership confirmation, when
 * implemented, sets the score to 100):
 *   Structure   +20  (parse failure short-circuits → invalid)
 *   Possibility +30 valid range / +10 possible-only
 *   LineType    +20 mobile … −20 premium-rate/shared-cost
 *   Suspicious  +15 clean / −40 flagged pattern
 */

export interface PhoneVerificationContext {
  phone: string;
  defaultCountry?: string;
}

export interface PhoneCheckResult {
  passed: boolean;
  scoreWeight: number;
  details?: Record<string, any>;
  error?: string;
}

export interface IPhoneVerificationStrategy {
  name: string;
  execute(context: PhoneVerificationContext, state: Record<string, any>): Promise<PhoneCheckResult>;
}

/** Contact-facing line type, persisted on EntityContact.phoneType */
export type ContactPhoneType =
  | 'mobile'
  | 'fixed_line'
  | 'fixed_line_or_mobile'
  | 'voip'
  | 'premium_rate'
  | 'other';

function toContactPhoneType(libType: string | undefined): ContactPhoneType {
  switch (libType) {
    case 'MOBILE': return 'mobile';
    case 'FIXED_LINE': return 'fixed_line';
    case 'FIXED_LINE_OR_MOBILE': return 'fixed_line_or_mobile';
    case 'VOIP': return 'voip';
    case 'PREMIUM_RATE':
    case 'SHARED_COST': return 'premium_rate';
    default: return 'other';
  }
}

// --- Strategy 1: Structure (E.164 parse) ---
export class StructureValidator implements IPhoneVerificationStrategy {
  name = 'Structure';

  async execute(context: PhoneVerificationContext, state: Record<string, any>): Promise<PhoneCheckResult> {
    const raw = sanitizeScientificNotation(context.phone || '').trim();
    if (!raw) {
      return { passed: false, scoreWeight: 0, error: 'Empty phone number' };
    }

    const defaultCountry = context.defaultCountry?.toUpperCase() as CountryCode | undefined;
    const cleaned = raw.replace(/[\s\-()]/g, '');
    const looksInternational = cleaned.startsWith('+') || cleaned.startsWith('00');

    // Direct parse first (handles E.164 and local formats when a default country is given)
    let parsed: PhoneNumber | undefined;
    try {
      parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
    } catch { /* fall through to normalization pre-pass */ }

    // Pre-pass for messy legacy input (00-prefix, missing '+', Excel artifacts).
    // Only runs when we have a country hint or the input is already
    // international — otherwise normalizePhoneNumber would inject its GH default
    // and a bare local number would be wrongly treated as Ghanaian.
    if (!parsed && (defaultCountry || looksInternational)) {
      const normalized = normalizePhoneNumber(raw, defaultCountry);
      if (normalized.e164) {
        try {
          parsed = parsePhoneNumberFromString(normalized.e164, defaultCountry);
        } catch { /* unparseable */ }
      }
    }

    if (!parsed) {
      return {
        passed: false,
        scoreWeight: 0,
        error: 'Not parseable as a phone number (unknown country code or malformed input)',
      };
    }

    state.parsed = parsed;
    return {
      passed: true,
      scoreWeight: 20,
      details: {
        e164: parsed.number,
        country: parsed.country || null,
        callingCode: parsed.countryCallingCode || null,
      },
    };
  }
}

// --- Strategy 2: Possibility / allocated range ---
export class PossibilityValidator implements IPhoneVerificationStrategy {
  name = 'Possibility';

  async execute(_context: PhoneVerificationContext, state: Record<string, any>): Promise<PhoneCheckResult> {
    const parsed = state.parsed as PhoneNumber | undefined;
    if (!parsed) {
      return { passed: false, scoreWeight: 0, error: 'No parsed number — structure must pass first' };
    }

    if (parsed.isValid()) {
      // Falls inside an allocated numbering-plan range for the country
      return { passed: true, scoreWeight: 30, details: { valid: true, possible: true } };
    }

    if (parsed.isPossible()) {
      // Right length for the country, but outside known allocated ranges
      return {
        passed: false,
        scoreWeight: 10,
        details: { valid: false, possible: true },
        error: 'Plausible length but outside allocated number ranges',
      };
    }

    return {
      passed: false,
      scoreWeight: 0,
      details: { valid: false, possible: false },
      error: 'Impossible number (wrong length for country)',
    };
  }
}

// --- Strategy 3: Line type ---
export class LineTypeValidator implements IPhoneVerificationStrategy {
  name = 'LineType';

  async execute(_context: PhoneVerificationContext, state: Record<string, any>): Promise<PhoneCheckResult> {
    const parsed = state.parsed as PhoneNumber | undefined;
    if (!parsed) {
      return { passed: false, scoreWeight: 0, error: 'No parsed number — structure must pass first' };
    }

    // getType() only resolves for valid numbers; undefined otherwise
    const libType = parsed.isValid() ? parsed.getType() : undefined;
    const contactType = toContactPhoneType(libType);
    state.lineType = libType || null;
    state.contactPhoneType = contactType;

    const details = { lineType: libType || null, contactPhoneType: contactType };

    switch (libType) {
      case 'MOBILE':
        return { passed: true, scoreWeight: 20, details };
      case 'FIXED_LINE_OR_MOBILE':
        return { passed: true, scoreWeight: 15, details };
      case 'FIXED_LINE':
        return { passed: true, scoreWeight: 10, details };
      case 'VOIP':
        return { passed: true, scoreWeight: 5, details };
      case 'PREMIUM_RATE':
      case 'SHARED_COST':
        return { passed: false, scoreWeight: -20, details, error: `Undesirable line type: ${libType}` };
      default:
        // Unknown type — common in countries without line-type metadata; neutral credit
        return { passed: true, scoreWeight: 5, details };
    }
  }
}

// --- Strategy 4: Suspicious patterns (country-agnostic) ---
export class SuspiciousPatternValidator implements IPhoneVerificationStrategy {
  name = 'Suspicious';

  /** Longest strictly ascending or descending digit run (e.g. 1234567) */
  private static longestSequentialRun(digits: string): number {
    let longest = 1;
    let asc = 1;
    let desc = 1;
    for (let i = 1; i < digits.length; i++) {
      const diff = digits.charCodeAt(i) - digits.charCodeAt(i - 1);
      asc = diff === 1 ? asc + 1 : 1;
      desc = diff === -1 ? desc + 1 : 1;
      longest = Math.max(longest, asc, desc);
    }
    return longest;
  }

  async execute(_context: PhoneVerificationContext, state: Record<string, any>): Promise<PhoneCheckResult> {
    const parsed = state.parsed as PhoneNumber | undefined;
    if (!parsed) {
      return { passed: false, scoreWeight: 0, error: 'No parsed number — structure must pass first' };
    }

    const national = String(parsed.nationalNumber);
    const reasons: string[] = [];

    if (/^(\d)\1+$/.test(national)) {
      reasons.push('All digits identical');
    }
    if (SuspiciousPatternValidator.longestSequentialRun(national) >= 7) {
      reasons.push('Long sequential digit run');
    }
    if (/(\d{3})\1\1/.test(national)) {
      reasons.push('Repeated 3-digit block');
    }

    if (reasons.length > 0) {
      return {
        passed: false,
        scoreWeight: -40,
        details: { suspicious: true, reasons },
        error: `Suspicious pattern: ${reasons.join('; ')}`,
      };
    }

    return { passed: true, scoreWeight: 15, details: { suspicious: false } };
  }
}

export interface VerifyPhoneResult {
  valid: boolean;
  score: number;
  /** Offline statuses only — OTP/delivery states are applied by the repository layer */
  status: 'format_valid' | 'invalid';
  e164: string | null;
  country: string | null;
  callingCode: string | null;
  lineType: ContactPhoneType | null;
  checks: {
    structure: boolean;
    possible: boolean;
    valid: boolean;
    lineType: boolean;
    suspicious: boolean; // true = IS suspicious (mirrors email's `disposable` semantics)
  };
  details: Record<string, any>;
}

export class PhoneVerificationEngine {
  constructor(private strategies: IPhoneVerificationStrategy[] = defaultStrategies()) {}

  async verify(phone: string, defaultCountry?: string): Promise<VerifyPhoneResult> {
    try {
      const { checkMessageDeliveryLogs } = await import('./services/delivery-telemetry');
      const telemetry = await checkMessageDeliveryLogs(phone, 'phone');
      if (telemetry.status !== null && telemetry.score !== null) {
        return {
          valid: telemetry.status === 'verified',
          score: telemetry.score,
          status: telemetry.status === 'verified' ? 'format_valid' : 'invalid',
          e164: phone,
          country: null,
          callingCode: null,
          lineType: null,
          checks: {
            structure: true,
            possible: telemetry.status === 'verified',
            valid: telemetry.status === 'verified',
            lineType: telemetry.status === 'verified',
            suspicious: false,
          },
          details: {
            telemetry: `delivery_${telemetry.status}`,
          },
        };
      }
    } catch (err) {
      console.warn('[PhoneVerifier] Failed checking delivery logs:', err);
    }

    const context: PhoneVerificationContext = { phone, defaultCountry };
    const state: Record<string, any> = {};

    let totalScore = 0;
    const checks = {
      structure: false,
      possible: false,
      valid: false,
      lineType: false,
      suspicious: false,
    };
    const details: Record<string, any> = {};

    for (const strategy of this.strategies) {
      try {
        const result = await strategy.execute(context, state);
        totalScore += result.scoreWeight;

        if (strategy.name === 'Structure') {
          checks.structure = result.passed;
          if (!result.passed) {
            details.structure = { error: result.error || 'Unparseable' };
            break; // Short-circuit: nothing downstream can run without a parsed number
          }
        }
        if (strategy.name === 'Possibility') {
          checks.valid = !!result.details?.valid;
          checks.possible = !!result.details?.possible;
        }
        if (strategy.name === 'LineType') {
          checks.lineType = result.passed;
        }
        if (strategy.name === 'Suspicious') {
          checks.suspicious = !result.passed; // true = IS suspicious
        }

        if (result.details) {
          details[strategy.name.toLowerCase()] = result.details;
        }
        if (result.error) {
          details[strategy.name.toLowerCase()] = {
            ...(details[strategy.name.toLowerCase()] || {}),
            error: result.error,
          };
        }
      } catch (err) {
        console.error(`[PhoneVerifier] Strategy "${strategy.name}" threw:`, err);
      }
    }

    totalScore = Math.max(0, Math.min(100, totalScore));

    const parsed = state.parsed as PhoneNumber | undefined;
    // An impossible number (wrong length for its country) is never format_valid,
    // regardless of the additive score — otherwise unknown-line-type + clean
    // pattern credit could push junk to the 40 threshold.
    const status: VerifyPhoneResult['status'] =
      checks.structure && checks.possible && totalScore >= 40 ? 'format_valid' : 'invalid';

    // All fields explicitly null when absent — firebase-admin rejects `undefined`
    return {
      valid: status === 'format_valid',
      score: totalScore,
      status,
      e164: parsed?.number || null,
      country: parsed?.country || null,
      callingCode: parsed?.countryCallingCode || null,
      lineType: (state.contactPhoneType as ContactPhoneType) || null,
      checks,
      details,
    };
  }
}

export function defaultStrategies(): IPhoneVerificationStrategy[] {
  return [
    new StructureValidator(),
    new PossibilityValidator(),
    new LineTypeValidator(),
    new SuspiciousPatternValidator(),
  ];
}
