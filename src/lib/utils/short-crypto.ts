import { createHmac } from 'crypto';

const FEISTEL_ROUNDS = 4;
const SECRET_KEY = process.env.SHORT_LINK_KEY || 'default-onboarding-secret-key-987654321';
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const MASK_32 = BigInt(0xffffffff);
const SHIFT_32 = BigInt(32);
const BASE_58 = BigInt(58);

/**
 * Packs 32-bit contact serial and 32-bit page serial into a single 64-bit BigInt.
 */
export function packSerials(contactSerial: number, pageSerial: number): bigint {
  const contactBig = BigInt(contactSerial) & MASK_32;
  const pageBig = BigInt(pageSerial) & MASK_32;
  return (contactBig << SHIFT_32) | pageBig;
}

/**
 * Unpacks a 64-bit BigInt back into contact serial and page serial.
 */
export function unpackSerials(val: bigint): { contactSerial: number; pageSerial: number } {
  const contactSerial = Number((val >> SHIFT_32) & MASK_32);
  const pageSerial = Number(val & MASK_32);
  return { contactSerial, pageSerial };
}

/**
 * Helper function F for Feistel round.
 * Computes a pseudo-random 32-bit unsigned integer from the half-block and round index.
 */
function feistelF(val: bigint, round: number): bigint {
  const hmac = createHmac('sha256', `${SECRET_KEY}_round_${round}`);
  hmac.update(val.toString());
  const hash = hmac.digest();
  // Read first 32-bits (4 bytes) as Big Endian unsigned integer
  return BigInt(hash.readUInt32BE(0)) & MASK_32;
}

/**
 * Encrypts a 64-bit bigint using a 4-round Feistel cipher.
 */
export function encrypt64(val: bigint): bigint {
  let l = (val >> SHIFT_32) & MASK_32;
  let r = val & MASK_32;

  for (let round = 0; round < FEISTEL_ROUNDS; round++) {
    const nextL = r;
    const f = feistelF(r, round);
    const nextR = (l ^ f) & MASK_32;
    l = nextL;
    r = nextR;
  }

  return (l << SHIFT_32) | r;
}

/**
 * Decrypts a 64-bit bigint using a 4-round Feistel cipher.
 */
export function decrypt64(val: bigint): bigint {
  let l = (val >> SHIFT_32) & MASK_32;
  let r = val & MASK_32;

  for (let round = FEISTEL_ROUNDS - 1; round >= 0; round--) {
    const prevR = l;
    const f = feistelF(l, round);
    const prevL = (r ^ f) & MASK_32;
    l = prevL;
    r = prevR;
  }

  return (l << SHIFT_32) | r;
}

/**
 * Encodes a 64-bit BigInt into exactly 11 characters of Base58.
 */
export function encodeBase58(val: bigint): string {
  let temp = val;
  let result = '';
  for (let i = 0; i < 11; i++) {
    const rem = Number(temp % BASE_58);
    result = BASE58_ALPHABET[rem] + result;
    temp = temp / BASE_58;
  }
  return result;
}

/**
 * Decodes an 11-character Base58 string back into a 64-bit BigInt.
 */
export function decodeBase58(str: string): bigint {
  if (str.length !== 11) {
    throw new Error('Base58 short link token must be exactly 11 characters');
  }
  let result = BigInt(0);
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const val = BASE58_ALPHABET.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid Base58 character: ${char}`);
    }
    result = result * BASE_58 + BigInt(val);
  }
  return result;
}
