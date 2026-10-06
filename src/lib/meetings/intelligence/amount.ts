/**
 * @fileOverview Amounts mentioned in meetings (Phase 11 M2 · T3.1; plan §4.4 rule 5).
 *
 * A currency must be an ISO 4217 code we know, or a symbol that names exactly one currency.
 * Symbols shared by several currencies ("$", "¥", "kr") give `currency: null, ambiguous: true`
 * and the item goes to review; we never guess (Rule 31).
 *
 * Pure. Tests: src/lib/meetings/__tests__/intelligence-pure.test.ts
 */

const ISO_CODES = new Set([
  'GHS', 'NGN', 'KES', 'ZAR', 'UGX', 'TZS', 'RWF', 'XOF', 'XAF', 'EGP', 'MAD', 'ETB',
  'USD', 'CAD', 'AUD', 'NZD', 'EUR', 'GBP', 'CHF', 'JPY', 'CNY', 'INR', 'AED', 'SAR', 'SGD', 'HKD', 'BRL', 'MXN',
]);

/** Symbols or words that name exactly one currency. */
const UNIQUE_SYMBOLS: Readonly<Record<string, string>> = {
  'GH₵': 'GHS', '₵': 'GHS', 'GHC': 'GHS', CEDI: 'GHS', CEDIS: 'GHS',
  '₦': 'NGN', NAIRA: 'NGN',
  '€': 'EUR', EURO: 'EUR', EUROS: 'EUR',
  '£': 'GBP',
  '₹': 'INR', RUPEES: 'INR',
  KSH: 'KES', KSHS: 'KES',
  'US$': 'USD',
};

export interface ParsedAmount {
  value: number;
  currency: string | null;
  ambiguous: boolean;
}

export function normalizeAmount(value: number | undefined, currency: string | undefined): ParsedAmount | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
  const raw = (currency ?? '').trim().toUpperCase();
  if (!raw) return { value, currency: null, ambiguous: true };
  if (ISO_CODES.has(raw)) return { value, currency: raw, ambiguous: false };
  const mapped = UNIQUE_SYMBOLS[raw] ?? UNIQUE_SYMBOLS[(currency ?? '').trim()];
  return mapped ? { value, currency: mapped, ambiguous: false } : { value, currency: null, ambiguous: true };
}
