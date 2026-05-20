/**
 * @fileOverview Import Data Cleaner
 * Inspired by the clean-data-xls skill, this module applies a pipeline of
 * data-cleaning transforms to raw spreadsheet rows BEFORE they enter the
 * ingestion engine. Each transform is a pure function that takes a value
 * and returns the cleaned value, making them easy to test and extend.
 *
 * Cleaning categories (applied in order):
 *  1. Whitespace — trim, collapse internal spaces
 *  2. Encoding — strip non-printable characters, fix mojibake
 *  3. Casing — ALL-CAPS → Title Case for name fields
 *  4. Phone — strip spaces/dashes, normalise with country code
 *  5. Email — lowercase, trim
 *  6. Dates — normalise to ISO 8601 (YYYY-MM-DD)
 *  7. Numbers-as-text — strip currency symbols, commas from numeric fields
 */

import { normalizePhoneNumber, type ParsedPhone } from './phone-utils';

// ─── Individual Transforms ───────────────────────────────────────────────────

/**
 * Trim leading/trailing whitespace and collapse internal runs of whitespace
 * to a single space. Also strips non-printable / zero-width characters.
 */
export function cleanWhitespace(value: string): string {
  if (!value) return value;
  // Strip non-printable chars (C0/C1 controls, zero-width joiners, BOM, etc.)
  let cleaned = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B\uFEFF]/g, '');
  // Collapse whitespace
  cleaned = cleaned.trim().replace(/\s+/g, ' ');
  return cleaned;
}

/**
 * Fix common mojibake / encoding artefacts that appear when CSVs are saved
 * from Excel in the wrong encoding.
 */
export function fixEncoding(value: string): string {
  if (!value) return value;
  return value
    .replace(/Ã©/g, 'é')
    .replace(/Ã¨/g, 'è')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã±/g, 'ñ')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€\u009D/g, '"')
    .replace(/â€"/g, '—')
    .replace(/â€"/g, '–')
    .replace(/Â /g, ' ');
}

/**
 * Detects if a string is ALL CAPS or all lowercase, and converts it to
 * Title Case. Respects common acronyms and short words.
 */
export function toTitleCase(value: string): string {
  if (!value || value.length <= 1) return value;

  // Only transform if the value is ALL CAPS or all lowercase
  const isAllCaps = value === value.toUpperCase() && /[A-Z]/.test(value);
  const isAllLower = value === value.toLowerCase() && /[a-z]/.test(value);

  if (!isAllCaps && !isAllLower) return value; // Already mixed — leave it alone

  // Preserve known acronyms/abbreviations
  const acronyms = new Set(['LLC', 'LTD', 'PLC', 'NGO', 'SHS', 'JHS', 'CEO', 'CTO', 'CFO', 'COO', 'PhD', 'MD', 'II', 'III', 'IV']);
  // Small words that stay lowercase (unless first word)
  const smallWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of', 'in', 'de', 'la', 'le']);

  const words = value.split(/\s+/);
  const result = words.map((word, index) => {
    const upper = word.toUpperCase();
    if (acronyms.has(upper)) return upper;

    const lower = word.toLowerCase();
    // Keep single-letter words capitalized if they are not the first word (e.g. "School A")
    if (index > 0 && smallWords.has(lower) && word.length > 1) return lower;

    // Capitalise first letter, lowercase the rest
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  return result.join(' ');
}

/**
 * Cleans a phone number: strips spaces, dashes, parentheses, and normalises
 * using `libphonenumber-js` with the provided default country code.
 * Returns the E.164 formatted number, or the best-effort cleaned string.
 */
export function cleanPhone(value: string, defaultCountryCode: string = 'GH'): string {
  if (!value) return value;
  const raw = String(value).trim();
  if (!raw) return '';

  const parsed: ParsedPhone = normalizePhoneNumber(raw, defaultCountryCode);
  // If the library produced a valid E.164, use it; otherwise return cleaned original
  return parsed.isValid && parsed.e164 ? parsed.e164 : raw.replace(/[\s\-()]/g, '');
}

/**
 * Normalises an email address: lowercase, trim, strip surrounding angle brackets.
 */
export function cleanEmail(value: string): string {
  if (!value) return value;
  let cleaned = String(value).trim().toLowerCase();
  // Strip surrounding angle brackets or quotes: <john@example.com> → john@example.com
  cleaned = cleaned.replace(/^[<"']+|[>"']+$/g, '');
  return cleaned;
}

/**
 * Attempts to normalise a date value to ISO 8601 (YYYY-MM-DD).
 * Handles: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, "January 1, 2024", Excel serial dates.
 * Returns the original string if parsing fails.
 */
export function cleanDate(value: string): string {
  if (!value) return value;
  const raw = String(value).trim();
  if (!raw) return '';

  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Excel serial number (a plain number like 45292)
  if (/^\d{5}$/.test(raw)) {
    const serial = parseInt(raw, 10);
    // Excel epoch is 1900-01-01, with a +1 offset for the 1900 leap year bug
    const date = new Date((serial - 25569) * 86400000);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }

  // DD/MM/YYYY or DD-MM-YYYY (common in African / European CSVs)
  const ddmmyyyy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    // If day > 12, it's definitely DD/MM/YYYY
    if (day > 12 || month <= 12) {
      const date = new Date(parseInt(y, 10), month - 1, day);
      if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    }
  }

  // Try native Date parsing as fallback (handles "January 1, 2024" etc.)
  const fallback = new Date(raw);
  if (!isNaN(fallback.getTime()) && fallback.getFullYear() > 1900) {
    return fallback.toISOString().split('T')[0];
  }

  return raw; // Give up — return original
}

/**
 * Strips currency symbols, commas, and percentage signs from a numeric string.
 * Returns the cleaned numeric string (not a number type, to preserve precision).
 */
export function cleanNumericText(value: string): string {
  if (!value) return value;
  const raw = String(value).trim();
  // Only clean if it looks like it could be a number with formatting
  if (!/[\d]/.test(raw)) return raw;
  // Strip common currency symbols and formatting
  const cleaned = raw
    .replace(/[₵$€£¥₦₹,\s]/g, '')
    .replace(/%$/, '');
  return cleaned;
}

// ─── Field Classification ────────────────────────────────────────────────────

type FieldCategory = 'name' | 'phone' | 'email' | 'date' | 'numeric' | 'text';

/**
 * Classifies a mapping key into a field category so we know which
 * cleaning transforms to apply. This is the central registry — when you
 * add new mapped fields, register them here.
 */
function classifyField(mappingKey: string): FieldCategory {
  const key = mappingKey.toLowerCase();

  // Name fields — apply Title Case
  if (
    key === 'name' ||
    key.includes('name') ||
    key.includes('firstname') ||
    key.includes('lastname') ||
    key === 'headofhousehold' ||
    key === 'company' ||
    key === 'assignedto' ||
    key === 'referee'
  ) return 'name';

  // Phone fields
  if (key.includes('phone') || key.includes('mobile') || key.includes('tel')) return 'phone';

  // Email fields
  if (key.includes('email') || key.includes('mail')) return 'email';

  // Date fields
  if (
    key.includes('date') ||
    key.includes('dob') ||
    key === 'dateofbirth' ||
    key === 'birthday' ||
    key === 'startdate' ||
    key === 'enddate'
  ) return 'date';

  // Numeric fields
  if (
    key.includes('rate') ||
    key.includes('amount') ||
    key.includes('price') ||
    key.includes('fee') ||
    key.includes('cost') ||
    key.includes('salary') ||
    key.includes('enrollment') ||
    key.includes('population') ||
    key === 'subscriptionrate'
  ) return 'numeric';

  return 'text';
}

// ─── Row-Level Pipeline ──────────────────────────────────────────────────────

export interface CleaningStats {
  trimmed: number;
  titleCased: number;
  phonesNormalized: number;
  emailsCleaned: number;
  datesNormalized: number;
  numericsCleaned: number;
  encodingFixed: number;
}

/**
 * Applies the full cleaning pipeline to a single row of data, using the
 * column mapping to determine which transforms to apply to each cell.
 *
 * @param row The raw row data object (header → value).
 * @param mapping The user's field mapping (variableName → headerName).
 * @param defaultCountryCode ISO alpha-2 country code for phone normalisation.
 * @returns The cleaned row (mutated in-place for performance) and stats.
 */
export function cleanRow(
  row: Record<string, any>,
  mapping: Record<string, string>,
  defaultCountryCode: string = 'GH',
  enableTitleCase: boolean = false
): { row: Record<string, any>; stats: CleaningStats } {
  const stats: CleaningStats = {
    trimmed: 0,
    titleCased: 0,
    phonesNormalized: 0,
    emailsCleaned: 0,
    datesNormalized: 0,
    numericsCleaned: 0,
    encodingFixed: 0,
  };

  // Build a reverse map: headerName → fieldCategory
  const headerCategories = new Map<string, FieldCategory>();
  for (const [variableName, headerName] of Object.entries(mapping)) {
    if (!headerName || headerName === 'none') continue;
    headerCategories.set(headerName, classifyField(variableName));
  }

  // Apply transforms to every cell in the row
  for (const [header, rawValue] of Object.entries(row)) {
    if (rawValue === null || rawValue === undefined) continue;
    const val = String(rawValue);
    if (!val) continue;

    let cleaned = val;
    const category = headerCategories.get(header) || 'text';

    // 1. Always: whitespace + encoding
    const afterWhitespace = cleanWhitespace(cleaned);
    if (afterWhitespace !== cleaned) stats.trimmed++;
    cleaned = afterWhitespace;

    const afterEncoding = fixEncoding(cleaned);
    if (afterEncoding !== cleaned) stats.encodingFixed++;
    cleaned = afterEncoding;

    // 2. Category-specific transforms
    switch (category) {
      case 'name': {
        const afterCase = toTitleCase(cleaned);
        if (afterCase !== cleaned) stats.titleCased++;
        cleaned = afterCase;
        break;
      }
      case 'phone': {
        const afterPhone = cleanPhone(cleaned, defaultCountryCode);
        if (afterPhone !== cleaned) stats.phonesNormalized++;
        cleaned = afterPhone;
        break;
      }
      case 'email': {
        const afterEmail = cleanEmail(cleaned);
        if (afterEmail !== cleaned) stats.emailsCleaned++;
        cleaned = afterEmail;
        break;
      }
      case 'date': {
        const afterDate = cleanDate(cleaned);
        if (afterDate !== cleaned) stats.datesNormalized++;
        cleaned = afterDate;
        break;
      }
      case 'numeric': {
        const afterNumeric = cleanNumericText(cleaned);
        if (afterNumeric !== cleaned) stats.numericsCleaned++;
        cleaned = afterNumeric;
        break;
      }
      case 'text': {
        if (enableTitleCase) {
          const afterCase = toTitleCase(cleaned);
          if (afterCase !== cleaned) stats.titleCased++;
          cleaned = afterCase;
        }
        break;
      }
    }

    row[header] = cleaned;
  }

  return { row, stats };
}

/**
 * Applies the cleaning pipeline to an entire batch of rows.
 * Returns the cleaned rows (mutated in-place) and aggregate stats.
 */
export function cleanBatch(
  rows: Record<string, any>[],
  mapping: Record<string, string>,
  defaultCountryCode: string = 'GH',
  enableTitleCase: boolean = false
): { rows: Record<string, any>[]; stats: CleaningStats } {
  const aggregate: CleaningStats = {
    trimmed: 0,
    titleCased: 0,
    phonesNormalized: 0,
    emailsCleaned: 0,
    datesNormalized: 0,
    numericsCleaned: 0,
    encodingFixed: 0,
  };

  for (const row of rows) {
    const { stats } = cleanRow(row, mapping, defaultCountryCode, enableTitleCase);
    aggregate.trimmed += stats.trimmed;
    aggregate.titleCased += stats.titleCased;
    aggregate.phonesNormalized += stats.phonesNormalized;
    aggregate.emailsCleaned += stats.emailsCleaned;
    aggregate.datesNormalized += stats.datesNormalized;
    aggregate.numericsCleaned += stats.numericsCleaned;
    aggregate.encodingFixed += stats.encodingFixed;
  }

  return { rows, stats: aggregate };
}
