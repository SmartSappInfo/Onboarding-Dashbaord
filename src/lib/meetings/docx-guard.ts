import 'server-only';

/**
 * @fileOverview Safe DOCX → plain text (Phase 11 M1 · T3, Rule 8).
 *
 * WHY THIS EXISTS
 * mammoth performs no sanitization of source documents and crafted documents can cause high
 * resource use (mammoth README, via Context7 2026-10-05). A .docx is a ZIP archive, so a 5 MB upload
 * can declare small sizes in its directory yet inflate to gigabytes (a "zip bomb").
 *
 * DEFENCE (before mammoth ever sees the bytes)
 * 1. ZIP signature + size ≤ MAX_DOCX_BYTES.
 * 2. Walk the central directory: ≤ MAX_ENTRIES, no ZIP64, no encryption, only stored/deflate.
 * 3. ACTUALLY inflate every entry with zlib `maxOutputLength` against a shared budget
 *    (MAX_UNCOMPRESSED_BYTES). Lying headers can't help: the real output is what's counted.
 * 4. mammoth `extractRawText({ buffer })` only (no HTML, no images; external file access stays at its
 *    default OFF), raced against a timeout.
 *
 * CAUTION: never switch to `convertToHtml` here, and never enable `externalFileAccess`.
 *
 * Tests: src/lib/meetings/__tests__/docx-guard.test.ts
 */

import { inflateRawSync } from 'node:zlib';

export const MAX_DOCX_BYTES = 5 * 1024 * 1024;
export const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
export const MAX_ENTRIES = 2_000;
export const DOCX_TIMEOUT_MS = 10_000;

export class DocxRejectedError extends Error {
  readonly code = 'VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'DocxRejectedError';
  }
}

const UNREADABLE = "We couldn't read this document. Save it again as .docx and retry.";

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

function findEndOfCentralDirectory(buf: Buffer): number {
  const minStart = Math.max(0, buf.length - (0xffff + 22));
  for (let i = buf.length - 22; i >= minStart; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}

/**
 * Verifies the archive structure and real inflated size. Throws `DocxRejectedError` when unsafe.
 * Exported for tests.
 */
export function assertSafeDocxArchive(buf: Buffer): { entries: number; uncompressedBytes: number } {
  if (buf.length > MAX_DOCX_BYTES) throw new DocxRejectedError('This file is larger than 5 MB. Split it and try again.');
  if (buf.length < 22 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new DocxRejectedError(UNREADABLE);

  const eocd = findEndOfCentralDirectory(buf);
  if (eocd < 0) throw new DocxRejectedError(UNREADABLE);
  const entryCount = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new DocxRejectedError(UNREADABLE); // ZIP64
  if (entryCount > MAX_ENTRIES) throw new DocxRejectedError(UNREADABLE);
  if (cdOffset + cdSize > buf.length) throw new DocxRejectedError(UNREADABLE);

  let budget = MAX_UNCOMPRESSED_BYTES;
  let pos = cdOffset;
  for (let n = 0; n < entryCount; n += 1) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== CD_SIG) throw new DocxRejectedError(UNREADABLE);
    const flags = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const declaredSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    pos += 46 + nameLen + extraLen + commentLen;

    if (flags & 0x1) throw new DocxRejectedError('This document is password-protected. Remove the password and try again.');
    if (compressedSize === 0xffffffff || declaredSize === 0xffffffff || localOffset === 0xffffffff) throw new DocxRejectedError(UNREADABLE);
    if (method !== 0 && method !== 8) throw new DocxRejectedError(UNREADABLE);

    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== LOCAL_SIG) throw new DocxRejectedError(UNREADABLE);
    const dataStart = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buf.length) throw new DocxRejectedError(UNREADABLE);

    let actual: number;
    if (method === 0) {
      actual = compressedSize;
      if (actual > budget) throw new DocxRejectedError(UNREADABLE);
    } else {
      try {
        // maxOutputLength makes zlib stop (RangeError) instead of allocating past the budget.
        actual = inflateRawSync(buf.subarray(dataStart, dataEnd), { maxOutputLength: Math.max(1, budget) }).length;
      } catch {
        throw new DocxRejectedError(UNREADABLE);
      }
    }
    if (actual !== declaredSize) throw new DocxRejectedError(UNREADABLE);
    budget -= actual;
    if (budget < 0) throw new DocxRejectedError(UNREADABLE);
  }
  return { entries: entryCount, uncompressedBytes: MAX_UNCOMPRESSED_BYTES - budget };
}

/** Extracts plain text from a verified-safe DOCX. */
export async function extractDocxText(buf: Buffer): Promise<string> {
  assertSafeDocxArchive(buf);
  const mammoth = await import('mammoth');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      mammoth.extractRawText({ buffer: buf }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DocxRejectedError('This document took too long to read. Try a smaller file.')), DOCX_TIMEOUT_MS);
      }),
    ]);
    const text = typeof result.value === 'string' ? result.value : '';
    if (!text.trim()) throw new DocxRejectedError('This document has no transcript text.');
    return text;
  } catch (err) {
    if (err instanceof DocxRejectedError) throw err;
    throw new DocxRejectedError(UNREADABLE);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
