/**
 * @fileOverview Certificate verification codes (audit F7).
 *
 * The previous scheme was `CERT-${year}-${Math.floor(1000 + Math.random() * 9000)}`:
 * exactly 9000 possible codes per year, drawn from a non-cryptographic PRNG. At a few
 * hundred certificates a year the birthday bound makes a collision likely rather than
 * unlikely, and the lookup was `.where('verificationCode','==',code).limit(1)` — so a
 * collision does not error, it silently returns the FIRST match. That means a real
 * verification page can display the wrong person's credential as valid.
 *
 * This is therefore a data-integrity fix before it is a security one. Two changes:
 *
 *   1. Codes are 12 characters of CSPRNG entropy over an unambiguous uppercase alphabet
 *      (~60 bits), so collisions stop being a practical concern.
 *   2. Uniqueness is enforced STRUCTURALLY: each code is claimed as a document id in
 *      `certificate_codes` using `.create()`, which fails if the id already exists. A
 *      duplicate can no longer be written at all, regardless of what the generator does.
 */
import crypto from 'crypto';

/**
 * Crockford-style base32: uppercase, and without I, L, O or U — the characters people
 * misread or mistype when copying a code off a printed certificate. The verification
 * path upper-cases input, so the alphabet must be uppercase-safe.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 12;

/** Random body of a verification code — no prefix, no year. */
export function generateCertificateCodeBody(): string {
  // Rejection sampling keeps the distribution uniform. A plain `% 32` would bias the
  // first 8 symbols, since 256 is not a multiple of 32 — here it is, but the guard keeps
  // the property if ALPHABET ever changes length.
  const out: string[] = [];
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  while (out.length < CODE_LENGTH) {
    for (const byte of crypto.randomBytes(CODE_LENGTH)) {
      if (byte >= limit) continue;
      out.push(ALPHABET[byte % ALPHABET.length]);
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out.join('');
}

/**
 * Full verification code, e.g. `CERT-2026-7K3QX9ZM2H4T`.
 *
 * The `CERT-<year>-` prefix is kept for human recognisability; all the entropy is in the
 * body, so the prefix leaking the issue year costs nothing.
 */
export function generateCertificateCode(year: number = new Date().getFullYear()): string {
  return `CERT-${year}-${generateCertificateCodeBody()}`;
}

/** Normalise user input before lookup: codes are uppercase and space-insensitive. */
export function normaliseCertificateCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}
