import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export interface ParsedPhone {
  isValid: boolean;
  e164?: string;
  countryCode?: string;
  callingCode?: string;
  original: string;
}

/**
 * Normalizes a phone number by stripping spaces, dashes, and other non-standard characters,
 * and parsing it using the specified default country code.
 *
 * @param phone The raw phone number string (e.g., "024 273 7120" or "+233 24 273 7120")
 * @param defaultCountry ISO 3166-1 alpha-2 country code (e.g., "GH", "US") to use if the number doesn't have a + prefix.
 * @returns A ParsedPhone object containing the E.164 formatted number, country code, and calling code.
 */
export function normalizePhoneNumber(phone: string, defaultCountry?: string): ParsedPhone {
  if (!phone || phone.trim() === '') {
    return { isValid: false, original: phone };
  }

  // Initial cleanup: remove spaces and dashes (libphonenumber handles this anyway, but good for safety)
  const cleanedPhone = phone.replace(/[\s-]/g, '');

  try {
    // Attempt to parse
    const defaultCountryCode = (defaultCountry?.toUpperCase() as CountryCode) || 'GH'; // Fallback to GH if absolutely nothing is provided
    const parsed = parsePhoneNumberFromString(cleanedPhone, defaultCountryCode);

    if (parsed && parsed.isValid()) {
      return {
        isValid: true,
        e164: parsed.number, // The E.164 formatted number (e.g., +233242737120)
        countryCode: parsed.country, // The ISO 3166-1 alpha-2 code (e.g., "GH")
        callingCode: parsed.countryCallingCode, // The calling code (e.g., "233")
        original: phone
      };
    }

    return { isValid: false, original: phone };
  } catch (error) {
    console.error('Error parsing phone number:', error);
    return { isValid: false, original: phone };
  }
}
