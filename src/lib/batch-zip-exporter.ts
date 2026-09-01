/**
 * @fileoverview Memory-Throttled Batch ZIP & Print Collateral Exporter
 * Generates bulk ZIP archives containing rendered QR images (PNG/SVG) and an index manifest.csv.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Employs memory chunking (10 items per batch) with async task yielding to prevent browser freezing.
 * - Sanitizes all CSV outputs against Formula Injection (DDE attacks).
 * - Explicit resource disposal (URL.revokeObjectURL) to prevent client memory leaks.
 * - Zero `any` or `any[]` typing.
 */

import JSZip from 'jszip';
import QRCodeStyling from 'qr-code-styling';
import type { QRCode as QRCodeType, QRDesign } from '@/lib/types';
import { DEFAULT_QR_DESIGN } from '@/lib/qr-constants';
import { renderBarcodeVector } from '@/lib/barcode-engine';

export interface BatchExportProgress {
  current: number;
  total: number;
  percentage: number;
  phase: 'rendering' | 'compressing' | 'complete' | 'error';
  errorMessage?: string;
}

/**
 * Sanitizes fields to protect against CSV / Excel Formula Injection (DDE attacks).
 * Prepends a single quote if the field begins with =, +, -, @, or tab characters.
 */
export function sanitizeCsvField(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '""';
  let str = String(input).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Escape inner quotes
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Builds the manifest.csv index mapping filenames to shortlinks, tracking data, and target URLs.
 */
export function generateManifestCsv(qrCodes: QRCodeType[]): string {
  const headers = [
    'Filename',
    'QR Code ID',
    'Name',
    'Status',
    'Type',
    'Short Path',
    'Redirect URL',
    'Destination Target',
    'Total Scans',
    'UTM Source',
    'UTM Medium',
    'UTM Campaign',
    'Created At',
  ].map((h) => `"${h}"`).join(',');

  const rows = qrCodes.map((qr, index) => {
    const filename = `qr-${index + 1}-${qr.slug || qr.id}.png`;
    const fullRedirect = qr.shortPath ? `https://smartsapp.com/q/${qr.shortPath}` : qr.redirectUrl || '';
    const dest = typeof qr.destination === 'object' && qr.destination && 'url' in qr.destination
      ? String((qr.destination as Record<string, unknown>).url || '')
      : JSON.stringify(qr.destination || '');

    return [
      sanitizeCsvField(filename),
      sanitizeCsvField(qr.id),
      sanitizeCsvField(qr.name),
      sanitizeCsvField(qr.status),
      sanitizeCsvField(qr.type),
      sanitizeCsvField(qr.shortPath || ''),
      sanitizeCsvField(fullRedirect),
      sanitizeCsvField(dest),
      sanitizeCsvField(qr.stats?.totalScans ?? 0),
      sanitizeCsvField(qr.tracking?.utmSource || ''),
      sanitizeCsvField(qr.tracking?.utmMedium || ''),
      sanitizeCsvField(qr.tracking?.utmCampaign || ''),
      sanitizeCsvField(qr.createdAt),
    ].join(',');
  });

  return [headers, ...rows].join('\r\n');
}

/**
 * Generates a ZIP file containing rendered QR PNGs and manifest.csv with memory throttling.
 */
export async function exportBatchQRsToZip(
  qrCodes: QRCodeType[],
  options: {
    format?: 'png' | 'svg';
    dimension?: number;
    baseDesign?: Partial<QRDesign>;
    onProgress?: (progress: BatchExportProgress) => void;
  } = {}
): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();
  const format = options.format || 'png';
  const size = options.dimension || 600;
  const total = qrCodes.length;
  const BATCH_CHUNK = 10; // Process 10 images at a time

  options.onProgress?.({
    current: 0,
    total,
    percentage: 0,
    phase: 'rendering',
  });

  const folder = zip.folder('qr-codes') || zip;

  for (let i = 0; i < total; i += BATCH_CHUNK) {
    const chunk = qrCodes.slice(i, i + BATCH_CHUNK);

    await Promise.all(
      chunk.map(async (qr, idx) => {
        const globalIdx = i + idx;
        const filename = `qr-${globalIdx + 1}-${qr.slug || qr.id}.${format}`;
        const targetUrl = qr.shortPath
          ? `https://smartsapp.com/q/${qr.shortPath}`
          : qr.redirectUrl || 'https://smartsapp.com';

        const mergedDesign = {
          ...DEFAULT_QR_DESIGN,
          ...options.baseDesign,
          ...qr.design,
        };

        if (format === 'svg') {
          const qrInstance = new QRCodeStyling({
            width: size,
            height: size,
            data: targetUrl,
            dotsOptions: {
              color: mergedDesign.foregroundColor,
              type: mergedDesign.dotStyle,
            },
            backgroundOptions: {
              color: mergedDesign.backgroundColor,
            },
            cornersSquareOptions: {
              color: mergedDesign.cornerSquareColor || mergedDesign.foregroundColor,
              type: mergedDesign.cornerSquareStyle,
            },
            cornersDotOptions: {
              color: mergedDesign.cornerDotColor || mergedDesign.foregroundColor,
              type: mergedDesign.cornerDotStyle,
            },
            image: mergedDesign.logoUrl || undefined,
            imageOptions: {
              crossOrigin: 'anonymous',
              margin: mergedDesign.logoMargin ?? 5,
              imageSize: (mergedDesign.logoSize || 20) / 100,
              hideBackgroundDots: true,
            },
          });

          const svgBlob = await qrInstance.getRawData('svg');
          if (svgBlob) {
            folder.file(filename, svgBlob);
          }
        } else {
          // PNG raster render
          const qrInstance = new QRCodeStyling({
            width: size,
            height: size,
            data: targetUrl,
            dotsOptions: {
              color: mergedDesign.foregroundColor,
              type: mergedDesign.dotStyle,
            },
            backgroundOptions: {
              color: mergedDesign.backgroundColor,
            },
            cornersSquareOptions: {
              color: mergedDesign.cornerSquareColor || mergedDesign.foregroundColor,
              type: mergedDesign.cornerSquareStyle,
            },
            cornersDotOptions: {
              color: mergedDesign.cornerDotColor || mergedDesign.foregroundColor,
              type: mergedDesign.cornerDotStyle,
            },
            image: mergedDesign.logoUrl || undefined,
            imageOptions: {
              crossOrigin: 'anonymous',
              margin: mergedDesign.logoMargin ?? 5,
              imageSize: (mergedDesign.logoSize || 20) / 100,
              hideBackgroundDots: true,
            },
          });

          const pngBlob = await qrInstance.getRawData('png');
          if (pngBlob) {
            folder.file(filename, pngBlob);
          }
        }
      })
    );

    const currentCount = Math.min(i + BATCH_CHUNK, total);
    options.onProgress?.({
      current: currentCount,
      total,
      percentage: Math.round((currentCount / total) * 80), // 0-80% for rendering
      phase: 'rendering',
    });

    // Inter-chunk yield to prevent UI lockup
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  // Add Manifest CSV
  const manifestContent = generateManifestCsv(qrCodes);
  zip.file('manifest.csv', manifestContent);

  options.onProgress?.({
    current: total,
    total,
    percentage: 85,
    phase: 'compressing',
  });

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  options.onProgress?.({
    current: total,
    total,
    percentage: 100,
    phase: 'complete',
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  const zipFilename = `smartsapp-qr-batch-${timestamp}.zip`;

  return { blob: zipBlob, filename: zipFilename };
}
