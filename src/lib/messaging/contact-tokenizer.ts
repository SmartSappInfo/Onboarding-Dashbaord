/**
 * @fileoverview Dual-Mode Contact Tokenizer for Multi-Audience Message Composer.
 *
 * Core tokenizer utility that transforms raw delimited text (pasted or typed)
 * into strictly typed, deduplicated, and validated contact pills.
 *
 * KEY CAPABILITIES:
 * 1. Delimiter support: comma, semicolon, newline, carriage return, tab.
 * 2. Dual-mode colon disambiguation:
 *    - Both sides are contacts -> colon acts as list delimiter (2 items).
 *    - One side is name/label and other is contact -> paired into 1 item with displayName and target.
 * 3. Angle bracket parsing: "Name <target>" extracts label and target.
 * 4. Channel-specific validation & normalization:
 *    - Phone numbers (SMS, WhatsApp): Normalized to E.164 (+233...) via libphonenumber-js.
 *    - Emails: Normalized to lowercase and validated against standard email format.
 * 5. Deduplication: Removes repeated contacts based on canonical normalized target.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Rule 4 strictly enforced: Zero `any` or `any[]`.
 * - Do not hardcode calling codes; use the provided defaultCountry (e.g. 'GH').
 * - Phone parsing must handle bare international numbers (e.g. 23324...) as well as local numbers.
 */

import { parsePhoneNumberWithError, CountryCode } from 'libphonenumber-js';
import type { AdHocContactItem, TokenizeResult } from '../types/composer-audience';

/**
 * Standard RFC-compliant email matching pattern.
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Checks if a trimmed value strictly matches email format.
 */
function isEmailLike(val: string): boolean {
  return EMAIL_REGEX.test(val.trim());
}

/**
 * Checks whether a candidate string is a valid phone number for the given country.
 * Returns false immediately if the string contains alphabetic characters.
 */
function isPhoneLike(val: string, country: string): boolean {
  if (/[a-zA-Z]/.test(val)) return false;
  try {
    const cleaned = val.replace(/[\s\-\(\)]/g, '');
    if (!cleaned) return false;
    const parsed = parsePhoneNumberWithError(cleaned, (country || 'GH') as CountryCode);
    return parsed.isValid();
  } catch {
    return false;
  }
}

/**
 * Heuristic check to determine if a string looks like a contact candidate rather than a display name.
 */
function looksLikeContact(val: string, channel: 'email' | 'sms' | 'whatsapp', country: string): boolean {
  const trimmed = val.trim();
  if (channel === 'email') {
    return trimmed.includes('@');
  }
  // For phone channels, if it has letters, it is definitely a name/label
  if (/[a-zA-Z]/.test(trimmed)) {
    return false;
  }
  // If it's valid phone number or has digits
  return isPhoneLike(trimmed, country) || /\d{3,}/.test(trimmed);
}

/**
 * Splits raw input on delimiters (comma, semicolon, newline, tab) while preserving
 * characters enclosed within angle brackets <...> or double quotes "...".
 */
function splitDelimitedSegments(input: string): string[] {
  const segments: string[] = [];
  let current = '';
  let inQuotes = false;
  let inAngle = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === '<' && !inQuotes) {
      inAngle = true;
      current += char;
    } else if (char === '>' && !inQuotes) {
      inAngle = false;
      current += char;
    } else if (!inQuotes && !inAngle && (char === ',' || char === ';' || char === '\n' || char === '\r' || char === '\t')) {
      const trimmed = current.trim();
      if (trimmed) {
        segments.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  const lastTrimmed = current.trim();
  if (lastTrimmed) {
    segments.push(lastTrimmed);
  }

  return segments;
}

/**
 * Generates a unique, collision-resistant ID for parsed contact pills.
 */
function generateAdHocId(index: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `adhoc_${crypto.randomUUID()}`;
  }
  return `adhoc_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 9)}`;
}

interface RawToken {
  text: string;
  label?: string;
  rawInput: string;
}

/**
 * Tokenizes raw delimited contact inputs with dual-mode colon disambiguation,
 * angle bracket extraction, E.164 phone normalization, and deduplication.
 *
 * @param input Raw text containing contacts separated by commas, semicolons, newlines, colons, or tabs
 * @param channel Destination messaging channel ('email' | 'sms' | 'whatsapp')
 * @param defaultCountry ISO-2 country code for phone normalization (defaults to 'GH')
 * @returns TokenizeResult with deduplicated items, counts of valid/invalid contacts, and duplicate tally
 */
export function tokenizeDelimitedContacts(
  input: string,
  channel: 'email' | 'sms' | 'whatsapp',
  defaultCountry: string = 'GH'
): TokenizeResult {
  if (!input || !input.trim()) {
    return { items: [], duplicateCount: 0, validCount: 0, invalidCount: 0 };
  }

  // Pass 1: Split on primary list delimiters, respecting quotes and angle brackets
  const rawSegments = splitDelimitedSegments(input);
  const rawTokens: RawToken[] = [];

  // Pass 2: Handle colon disambiguation and angle bracket formatting
  for (const seg of rawSegments) {
    // Check for angle brackets: "Name <contact@domain.com>" or "Name <0244123456>"
    const angleMatch = seg.match(/^(.*?)\s*<([^>]+)>$/);
    if (angleMatch) {
      const cleanLabel = angleMatch[1].trim().replace(/^["']|["']$/g, '').trim();
      rawTokens.push({
        text: angleMatch[2].trim(),
        label: cleanLabel || undefined,
        rawInput: seg,
      });
      continue;
    }

    // Check for colon: "X : Y"
    if (seg.includes(':')) {
      const parts = seg.split(':').map(p => p.trim()).filter(Boolean);

      if (parts.length === 2) {
        const [left, right] = parts;
        const leftIsContact = looksLikeContact(left, channel, defaultCountry);
        const rightIsContact = looksLikeContact(right, channel, defaultCountry);

        if (leftIsContact && rightIsContact) {
          // Case 1: List separator (e.g. 0244123456:0201112222 or support@a.com:sales@b.com)
          rawTokens.push({ text: left, rawInput: left });
          rawTokens.push({ text: right, rawInput: right });
          continue;
        } else if (!leftIsContact && rightIsContact) {
          // Case 2: Label-Contact pair (e.g. Kwame Mensah: 0244123456 or Sales: sales@smartsapp.com)
          const cleanLabel = left.replace(/^["']|["']$/g, '').trim();
          rawTokens.push({ text: right, label: cleanLabel || undefined, rawInput: seg });
          continue;
        } else if (leftIsContact && !rightIsContact) {
          // Inverted label-contact pair (e.g. 0244123456: Kwame Mensah)
          const cleanLabel = right.replace(/^["']|["']$/g, '').trim();
          rawTokens.push({ text: left, label: cleanLabel || undefined, rawInput: seg });
          continue;
        }
      } else if (parts.length > 2) {
        const allContacts = parts.every(p => looksLikeContact(p, channel, defaultCountry));
        if (allContacts) {
          for (const p of parts) {
            rawTokens.push({ text: p, rawInput: p });
          }
          continue;
        }
      }
    }

    // Default: treat segment as a single contact token
    rawTokens.push({ text: seg, rawInput: seg });
  }

  // Pass 3: Normalize, validate, and deduplicate
  const seenTargets = new Set<string>();
  const items: AdHocContactItem[] = [];
  let duplicateCount = 0;

  for (let i = 0; i < rawTokens.length; i++) {
    const { text, label } = rawTokens[i];
    let target = text;
    let isValid = false;
    let validationError: string | undefined;

    if (channel === 'email') {
      const lower = text.toLowerCase().trim();
      if (isEmailLike(lower)) {
        target = lower;
        isValid = true;
      } else {
        target = text.trim();
        isValid = false;
        validationError = 'Invalid email address format';
      }
    } else {
      // SMS or WhatsApp
      try {
        const cleaned = text.trim().replace(/[\s\-\(\)]/g, '');
        if (!cleaned) {
          isValid = false;
          validationError = 'Phone number cannot be empty';
        } else if (/[a-zA-Z]/.test(cleaned)) {
          isValid = false;
          validationError = 'Phone number cannot contain letters';
        } else {
          const parsed = parsePhoneNumberWithError(cleaned, (defaultCountry || 'GH') as CountryCode);
          if (parsed.isValid()) {
            target = parsed.format('E.164');
            isValid = true;
          } else {
            isValid = false;
            validationError = 'Invalid phone number format';
          }
        }
      } catch (err: unknown) {
        isValid = false;
        validationError = err instanceof Error ? err.message : 'Invalid phone number format';
      }
    }

    // Deduplication check based on canonical target
    const dedupKey = target.toLowerCase();
    if (seenTargets.has(dedupKey)) {
      duplicateCount++;
      continue;
    }
    seenTargets.add(dedupKey);

    items.push({
      id: generateAdHocId(i),
      rawInput: text,
      target,
      displayName: label,
      isValid,
      validationError,
    });
  }

  const validCount = items.filter(it => it.isValid).length;
  const invalidCount = items.length - validCount;

  return { items, duplicateCount, validCount, invalidCount };
}
