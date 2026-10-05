/**
 * @fileOverview Browser-safe SDR outbound helpers.
 *
 * Client components import from here, never from `sdr-outbound-engine.ts`: the engine pulls in
 * FieldsVariablesService (firebase-admin, next/headers) and node:crypto, which breaks the
 * client bundle. Everything in this module must stay free of Node-only imports.
 */

/**
 * Normalizes a raw Ghanaian phone number to its international digits (no '+').
 */
function toInternationalDigits(phone: string): string {
  let digits = phone.replace(/\D/g, '');

  // Handle leading 2330 -> 233
  if (digits.startsWith('2330')) {
    digits = '233' + digits.substring(4);
  } else if (digits.startsWith('0') && digits.length === 10) {
    digits = '233' + digits.substring(1);
  } else if (digits.length === 9) {
    digits = '233' + digits;
  }

  return digits;
}

/**
 * Normalizes raw or local phone numbers to E.164 with country code.
 * Special handling for West Africa / Ghana (+233) formats.
 */
export function normalizeSdrPhoneNumber(phone?: string): string {
  if (!phone) return '';
  const digits = toInternationalDigits(phone);
  return digits ? `+${digits}` : '';
}

/**
 * Sanitizes a phone number and returns a WhatsApp click-to-chat URL.
 */
export function formatWhatsAppLauncherUrl(phone: string, message: string): string {
  if (!phone) return '';
  return `https://wa.me/${toInternationalDigits(phone)}?text=${encodeURIComponent(message)}`;
}

/**
 * Canonical JSON of an outreach payload with keys sorted recursively, so the hash does not
 * depend on key order. The server (node:crypto) and the browser (Web Crypto) hash this same string.
 */
export function canonicalizeOutreachPayload(payload: Record<string, unknown>): string {
  const sortObject = (obj: unknown): unknown => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortObject);
    const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = sortObject((obj as Record<string, unknown>)[key]);
    }
    return result;
  };

  return JSON.stringify(sortObject(payload));
}

/**
 * Browser-side SHA-256 payloadHash via Web Crypto. Produces the same hex digest as
 * `SdrOutboundEngine.computeOutreachPayloadHash` on the server.
 */
export async function computeOutreachPayloadHashInBrowser(
  payload: Record<string, unknown>
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeOutreachPayload(payload));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
