// @vitest-environment node
/**
 * @fileOverview DOCX guard (Phase 11 M1 · T3.3): zip bombs, lying headers, encryption, non-ZIP input.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  assertSafeDocxArchive,
  DocxRejectedError,
  extractDocxText,
  MAX_DOCX_BYTES,
} from '../docx-guard';
import { parseTranscriptText } from '../transcript-parsers';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
const doc = (paragraphs: string[]) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('')}
</w:body></w:document>`;

async function docx(paragraphs: string[], extra?: (zip: JSZip) => void): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/document.xml', doc(paragraphs));
  extra?.(zip);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** Rewrites every central-directory "uncompressed size" field (simulates lying headers). */
function lieAboutSizes(buf: Buffer, declared: number): Buffer {
  const out = Buffer.from(buf);
  for (let i = 0; i < out.length - 4; i += 1) {
    if (out.readUInt32LE(i) === 0x02014b50) out.writeUInt32LE(declared, i + 24);
  }
  return out;
}

describe('docx guard', () => {
  it('extracts text from a normal transcript document, which then parses', async () => {
    const text = await extractDocxText(await docx(['Ama: Good morning', 'Kwame: Let us review fees']));
    expect(text).toContain('Ama: Good morning');
    const parsed = parseTranscriptText(text);
    expect(parsed.speakers.map((s) => s.name)).toEqual(['Ama', 'Kwame']);
  });

  it('rejects a zip bomb by actual inflated size, not declared size', async () => {
    const bomb = await docx(['x'], (zip) => zip.file('word/media/pad.bin', Buffer.alloc(30 * 1024 * 1024)));
    expect(bomb.length).toBeLessThan(MAX_DOCX_BYTES);
    expect(() => assertSafeDocxArchive(bomb)).toThrow(DocxRejectedError);
  });

  it('rejects archives whose headers lie about entry sizes', async () => {
    const lying = lieAboutSizes(await docx(['Ama: hi'], (zip) => zip.file('pad.bin', Buffer.alloc(2 * 1024 * 1024))), 10);
    expect(() => assertSafeDocxArchive(lying)).toThrow(DocxRejectedError);
  });

  it('rejects non-ZIP input, oversize input and password-protected entries', async () => {
    await expect(extractDocxText(Buffer.from('plain text pretending to be docx'))).rejects.toBeInstanceOf(DocxRejectedError);
    expect(() => assertSafeDocxArchive(Buffer.concat([Buffer.from('PK'), Buffer.alloc(MAX_DOCX_BYTES)]))).toThrow('larger than 5 MB');

    const encrypted = Buffer.from(await docx(['Ama: hi']));
    for (let i = 0; i < encrypted.length - 4; i += 1) {
      if (encrypted.readUInt32LE(i) === 0x02014b50) encrypted.writeUInt16LE(encrypted.readUInt16LE(i + 8) | 1, i + 8);
    }
    expect(() => assertSafeDocxArchive(encrypted)).toThrow('password-protected');
  });

  it('rejects a document with no text', async () => {
    await expect(extractDocxText(await docx([]))).rejects.toThrow('no transcript text');
  });
});
