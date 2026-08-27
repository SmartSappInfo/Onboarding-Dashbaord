/**
 * Dynamic Currency Formatting Utility
 *
 * ARCHITECTURAL POINTER (Rule 10):
 * Provides resilient, localized number and currency formatting for all pipeline cards,
 * tables, metrics, and modals across the application.
 *
 * CAUTION FOR MAINTAINERS:
 * Always wrap Intl.NumberFormat in try/catch to safely handle non-standard or custom currency
 * symbols without crashing client renders.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  GHS: 'GH₵',
  NGN: '₦',
  CAD: 'CA$',
  AUD: 'AU$',
  KES: 'KSh',
  ZAR: 'R',
  INR: '₹',
  JPY: '¥',
};

/**
 * Formats a monetary amount into a clean, localized string.
 *
 * @param amount - Numeric value of the deal or metric
 * @param currencyCode - Optional 3-letter currency code (defaults to USD or '$')
 * @param options - Additional formatting configuration
 */
export function formatCurrency(
  amount: number | null | undefined,
  currencyCode: string = 'USD',
  options: { showDecimals?: boolean; compact?: boolean } = {}
): string {
  const numericAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const normalizedCode = (currencyCode || 'USD').toUpperCase().trim();

  const { showDecimals = false, compact = false } = options;

  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCode,
      notation: compact ? 'compact' : 'standard',
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    });

    return formatter.format(numericAmount);
  } catch {
    // Fallback for custom or unsupported currency codes
    const symbol = CURRENCY_SYMBOLS[normalizedCode] || normalizedCode;
    const formattedNumber = numericAmount.toLocaleString('en-US', {
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    });

    return `${symbol} ${formattedNumber}`;
  }
}

/**
 * Returns the currency symbol for a given currency code.
 */
export function getCurrencySymbol(currencyCode: string = 'USD'): string {
  const normalized = (currencyCode || 'USD').toUpperCase().trim();
  if (CURRENCY_SYMBOLS[normalized]) {
    return CURRENCY_SYMBOLS[normalized];
  }
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalized,
    }).formatToParts(0);
    const symbolPart = parts.find((p) => p.type === 'currency');
    return symbolPart ? symbolPart.value : normalized;
  } catch {
    return normalized;
  }
}
