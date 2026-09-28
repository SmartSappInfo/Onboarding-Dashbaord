import { parsePhoneNumberFromString, getCountryCallingCode, CountryCode } from 'libphonenumber-js';

export interface ParsedPhone {
  isValid: boolean;
  e164?: string;
  countryCode?: string;
  callingCode?: string;
  original: string;
}

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 *
 * This module normalizes phone numbers cleanly across all 240+ countries.
 *
 * MULTI-TENANT ISOLATION (Rule 1 & Rule 2):
 * - Never inject a hardcoded 'GH' (Ghana) default!
 * - When `defaultCountry` is omitted, international numbers (with '+' or bare calling codes like
 *   '233...', '234...', '44...', '1...') parse accurately without assumptions.
 * - Domestic/local numbers starting with trunk prefix '0' (e.g. '0240488218') require an organization
 *   country context. If omitted, they fail safely rather than corrupting into Ghana numbers.
 *
 * DYNAMIC CALLING CODES:
 * - Uses `getCountryCallingCode` from `libphonenumber-js` dynamically instead of a static map.
 */

function resolveCallingCode(countryCode?: string): string | undefined {
  if (!countryCode || countryCode.length !== 2) return undefined;
  try {
    return getCountryCallingCode(countryCode.toUpperCase() as CountryCode);
  } catch {
    return undefined;
  }
}

/**
 * Parses and formats numbers that were converted to scientific notation (e.g. 2.33276E+11).
 */
export function sanitizeScientificNotation(value: string | number): string {
  const str = String(value).trim();
  if (/^\d+(\.\d+)?[eE]\+\d+$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) {
      return num.toFixed(0);
    }
  }
  return str;
}

/**
 * Generates the common storage formats of a phone number for database
 * equality/IN queries (E.164, bare digits, national 0-format, etc.).
 * Country-agnostic: national variants are derived from the parsed calling
 * code rather than any hardcoded prefix.
 */
export function getPhoneFormats(phone: string, defaultCountry?: string): string[] {
  if (!phone) return [];
  const trimmed = phone.trim();
  if (!trimmed) return [];

  const formats = new Set<string>([trimmed]);
  const digits = trimmed.replace(/\D/g, '');
  if (digits) {
    formats.add(digits);
    formats.add('+' + digits);
  }

  const parsed = normalizePhoneNumber(trimmed, defaultCountry);
  if (parsed.e164) {
    formats.add(parsed.e164);
    const e164Digits = parsed.e164.replace(/\D/g, '');
    formats.add(e164Digits);
    if (parsed.callingCode && e164Digits.startsWith(parsed.callingCode)) {
      const national = e164Digits.slice(parsed.callingCode.length);
      if (national) {
        formats.add(national);
        formats.add('0' + national);
      }
    }
  }

  return Array.from(formats).filter(Boolean);
}

/**
 * Normalizes phone numbers by stripping non-digit characters and prepending
 * the target country prefix intelligently if not already present.
 * Country-agnostic: does NOT inject a Ghana default if no defaultCountry is provided.
 */
export function normalizePhoneNumber(phone: string, defaultCountry?: string): ParsedPhone {
  if (!phone || phone.trim() === '') {
    return { isValid: false, original: phone };
  }

  // 1. Sanitize scientific notation
  const sanitized = sanitizeScientificNotation(phone);
  const startsWithPlus = sanitized.startsWith('+');
  const startsWithDoubleZero = sanitized.startsWith('00');
  const cleaned = sanitized.replace(/[\s\-()]/g, '');

  const targetCountry = defaultCountry ? (defaultCountry.toUpperCase() as CountryCode) : undefined;
  const prefix = resolveCallingCode(targetCountry);

  const attemptParse = (numStr: string, country?: CountryCode): ParsedPhone | null => {
    try {
      const parsed = parsePhoneNumberFromString(numStr, country);
      if (parsed && parsed.isValid()) {
        return {
          isValid: true,
          e164: parsed.number,
          countryCode: parsed.country,
          callingCode: parsed.countryCallingCode,
          original: phone,
        };
      }
    } catch {}
    return null;
  };

  // Try parsing original string directly with country hint (if any)
  let parseResult = attemptParse(cleaned, targetCountry);
  if (parseResult) return parseResult;

  const digits = cleaned.replace(/\D/g, '');
  if (!digits) {
    return { isValid: false, original: phone };
  }

  // Try parsing bare international numbers without '+' (e.g. '233242737120', '23480...', '447...', '1202...')
  if (!startsWithPlus && !cleaned.startsWith('0') && digits.length >= 10 && digits.length <= 15) {
    const intlResult = attemptParse('+' + digits);
    if (intlResult) return intlResult;
  }

  let normalizedDigits = digits;
  if (startsWithPlus || startsWithDoubleZero) {
    if (startsWithDoubleZero && digits.startsWith('00')) {
      normalizedDigits = digits.substring(2);
    }
    parseResult = attemptParse('+' + normalizedDigits, targetCountry);
    if (parseResult) return parseResult;
  } else if (prefix) {
    if (digits.startsWith(prefix) && digits.length >= (prefix.length + 7)) {
      normalizedDigits = digits;
    } else if (digits.startsWith('0')) {
      normalizedDigits = prefix + digits.substring(1);
    } else {
      normalizedDigits = prefix + digits;
    }

    parseResult = attemptParse('+' + normalizedDigits, targetCountry);
    if (parseResult) return parseResult;
  }

  // When no prefix or default country is supplied and the number starts with '0' (domestic format),
  // return invalid without assuming a country to prevent data corruption
  return {
    isValid: false,
    e164: (startsWithPlus || (prefix && normalizedDigits.startsWith(prefix)) ? '+' : '') + normalizedDigits,
    original: phone,
  };
}
