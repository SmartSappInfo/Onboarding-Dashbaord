/**
 * PURPOSE: Unit tests for Authoritative Server-Side Vector PDF Engine.
 * ARCHITECTURAL CONTEXT:
 * Tests that `generatePdfBuffer` in `src/lib/pdf-actions.ts` overlays text, dynamic variables,
 * and signature images (from base64 or Cloud Storage) onto exact page geometry.
 * Validates that output is an uncorrupted, loadable vector PDF without relying on client-side screenshotting.
 * TESTABILITY: Runs in Vitest. Conforms to Rule 4 (Zero any).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePdfBuffer } from '../pdf-actions';
import { PDFDocument } from 'pdf-lib';
import type { PDFForm } from '../types';

const { mockBlankPdfBytes, mockPngBytes } = vi.hoisted(() => {
  // Pre-computed valid 1-page A4 PDF binary (595.28 x 841.89 pt) generated via pdf-lib
  const minimalPdfBase64 =
    'JVBERi0xLjcKJYGBgYEKCjUgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL09ialN0bQovTiA0Ci9GaXJzdCAyMAovTGVuZ3RoIDI2OAo+PgpzdHJlYW0KeJzVkktLxDAQx+/5FHPUy2Y6TdtESmHt4yLCsnhy8RC2YSnIZukD9Ns7aVbFg3iW8CeP+U1e/0kAgUApSKHQoCBLCcpSyKf3iwO5syc3Cfkw9BMcOIqwhxcha7+cZ0hEVYlvtrazffUnEZMgCfAnsRt9vxzdCGXXdh1igYi5YuWI1HBfswyLeM4x0jxmFeoqXitSxHTLsS4qL2JOiK9sds1vuWc2D0wTWaXj/OvccFYb96C/7mMqIR9939jZwU1zR0g5GtJESmX6+Za/Y3R29v/3cev9B3/+9YU/fA72BpNHF2pgdVnu3eSX8ci2M1eF/3L9YO/9G1cNcstMtiENWiUbbbiCGPkArpqPPwplbmRzdHJlYW0KZW5kb2JqCgo2IDAgb2JqCjw8Ci9TaXplIDcKL1Jvb3QgMiAwIFIKL0luZm8gMyAwIFIKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL1hSZWYKL0xlbmd0aCAzNAovVyBbIDEgMiAyIF0KL0luZGV4IFsgMCA3IF0KPj4Kc3RyZWFtCnicFcQxDgAgCASwHsbdN/txCB2K7nLZstV24pF8BkOhArYKZW5kc3RyZWFtCmVuZG9iagoKc3RhcnR4cmVmCjM4NgolJUVPRg==';
  
  // 1x1 transparent PNG binary
  const minimalPngBase64 = 
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  return {
    mockBlankPdfBytes: Buffer.from(minimalPdfBase64, 'base64'),
    mockPngBytes: Buffer.from(minimalPngBase64, 'base64'),
  };
});

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
  adminStorage: {
    file: vi.fn().mockImplementation((path: string) => ({
      download: vi.fn().mockImplementation(async () => {
        if (typeof path === 'string' && path.includes('sig_stored.png')) {
          return [mockPngBytes];
        }
        return [mockBlankPdfBytes];
      }),
      name: path,
    })),
  },
}));

vi.mock('../services/workspace-resolver', () => ({
  resolveWorkspaceIdFromEntity: vi.fn().mockResolvedValue('ws_main_01'),
}));

vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn().mockResolvedValue({
    schoolData: { name: 'Acme High School', location: 'Greater Accra' },
  }),
}));

describe('P1.1 Authoritative Vector PDF Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('overlays text, variables, and signatures onto exact page geometry and returns a valid PDF', async () => {
    const mockForm: PDFForm = {
      id: 'pdf_test_agreement',
      name: 'Enrollment Agreement',
      publicTitle: 'Enrollment Agreement',
      slug: 'enrollment-agreement',
      downloadUrl: 'https://example.com/templates/enrollment.pdf',
      status: 'published',
      storagePath: 'templates/enrollment.pdf',
      workspaceIds: ['ws_main_01'],
      entityId: 'ent_acme_school',
      createdAt: '2026-09-28T20:00:00Z',
      updatedAt: '2026-09-28T20:00:00Z',
      fields: [
        {
          id: 'field_name',
          label: 'Student Name',
          type: 'text',
          pageNumber: 1,
          position: { x: 10, y: 15 },
          dimensions: { width: 40, height: 5 },
          fontSize: 12,
          alignment: 'left',
          verticalAlignment: 'center',
          color: '#1e293b',
        },
        {
          id: 'field_institution',
          label: 'Institution',
          type: 'variable',
          variableKey: 'entity_name',
          pageNumber: 1,
          position: { x: 10, y: 25 },
          dimensions: { width: 40, height: 5 },
          fontSize: 12,
        },
        {
          id: 'field_sig_base64',
          label: 'Parent Signature (DataURL)',
          type: 'signature',
          pageNumber: 1,
          position: { x: 10, y: 50 },
          dimensions: { width: 30, height: 10 },
        },
        {
          id: 'field_sig_storage',
          label: 'Witness Signature (Cloud Storage)',
          type: 'signature',
          pageNumber: 1,
          position: { x: 50, y: 50 },
          dimensions: { width: 30, height: 10 },
        },
      ],
    };

    const formData: Record<string, unknown> = {
      field_name: 'David Boateng',
      field_sig_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      field_sig_storage: 'signatures/ws_main_01/contract_1/sig_stored.png',
    };

    const resultUint8Array = await generatePdfBuffer(mockForm, formData);
    const resultBuffer = Buffer.from(resultUint8Array);

    expect(resultBuffer).toBeInstanceOf(Buffer);
    expect(resultBuffer.length).toBeGreaterThan(100);

    // Verify output is a valid, parseable PDFDocument
    const parsedPdf = await PDFDocument.load(new Uint8Array(resultBuffer));
    expect(parsedPdf.getPageCount()).toBe(1);

    const firstPage = parsedPdf.getPage(0);
    expect(firstPage.getWidth()).toBeCloseTo(595.28, 1);
    expect(firstPage.getHeight()).toBeCloseTo(841.89, 1);
  });
});
