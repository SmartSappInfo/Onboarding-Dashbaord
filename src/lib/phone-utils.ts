import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export interface ParsedPhone {
  isValid: boolean;
  e164?: string;
  countryCode?: string;
  callingCode?: string;
  original: string;
}

const COUNTRY_PREFIX_MAP: Record<string, string> = {
  GH: '233',
  NG: '234',
  KE: '254',
  US: '1',
  CA: '1',
  GB: '44',
  UK: '44',
};

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
 * Normalizes phone numbers by stripping non-digit characters and prepending
 * the target country prefix intelligently if not already present.
 */
export function normalizePhoneNumber(phone: string, defaultCountry?: string): ParsedPhone {
  if (!phone || phone.trim() === '') {
    return { isValid: false, original: phone };
  }

  // 1. Sanitize scientific notation
  const sanitized = sanitizeScientificNotation(phone);
  
  const startsWithPlus = sanitized.startsWith('+');
  const startsWithDoubleZero = sanitized.startsWith('00');

  // Strip spaces, dashes, parentheses to make it cleaner for parsing
  const cleaned = sanitized.replace(/[\s\-()]/g, '');

  const defaultCountryCode = (defaultCountry?.toUpperCase() as CountryCode) || 'GH';
  const prefix = COUNTRY_PREFIX_MAP[defaultCountryCode] || '233';

  // Helper to construct a ParsedPhone result
  const attemptParse = (numStr: string): ParsedPhone | null => {
    try {
      const parsed = parsePhoneNumberFromString(numStr, defaultCountryCode);
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

  // Try parsing the cleaned original string first
  let parseResult = attemptParse(cleaned);
  if (parseResult) return parseResult;

  // Fallback: If it didn't parse, let's normalize digits and prepend country prefix if needed
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) {
    return { isValid: false, original: phone };
  }

  let normalizedDigits = digits;
  if (startsWithPlus || startsWithDoubleZero) {
    if (startsWithDoubleZero && digits.startsWith('00')) {
      normalizedDigits = digits.substring(2);
    }
    // Already international, try parsing with a '+' prefix
    parseResult = attemptParse('+' + normalizedDigits);
    if (parseResult) return parseResult;
  } else {
    // If it already starts with the country prefix (and is sufficiently long)
    if (digits.startsWith(prefix) && digits.length >= (prefix.length + 7)) {
      normalizedDigits = digits;
    } else if (digits.startsWith('0')) {
      // Strips leading zero and prepends prefix
      normalizedDigits = prefix + digits.substring(1);
    } else {
      normalizedDigits = prefix + digits;
    }

    // Try parsing with a '+' prefix
    parseResult = attemptParse('+' + normalizedDigits);
    if (parseResult) return parseResult;
  }

  // If even libphonenumber-js says it is invalid, return a best-effort result
  return {
    isValid: false,
    e164: (startsWithPlus || normalizedDigits.startsWith(prefix) ? '+' : '') + normalizedDigits,
    original: phone,
  };
}
