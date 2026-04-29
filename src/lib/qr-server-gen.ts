import QRCode from 'qrcode';
import type { QRDesign } from './types';
import { DEFAULT_QR_DESIGN } from './qr-constants';

/**
 * Generates a PNG buffer of a QR Code on the server.
 * This provides a stable, backend-only way to generate codes for emails or batch exports
 * without relying on a browser DOM/canvas.
 */
export async function generateQRBuffer(data: string, designOverrides?: Partial<QRDesign>): Promise<Buffer> {
  const design = { ...DEFAULT_QR_DESIGN, ...designOverrides };
  const size = design.size || 1024;
  
  // Note: the node `qrcode` library doesn't support the complex dot shapes
  // of `qr-code-styling`, but it correctly handles colors, margin, and error correction.
  
  // Convert standard hex (#FFFFFF) to rgba string format expected by qrcode if needed, 
  // though qrcode handles standard hex strings fine.
  const darkColor = design.foregroundColor || '#000000';
  const lightColor = design.backgroundColor || '#FFFFFF';

  try {
    const buffer = await QRCode.toBuffer(data || 'https://smartsapp.com', {
      type: 'png',
      width: size,
      margin: design.quietZone ? Math.floor(design.quietZone / 10) : 4,
      errorCorrectionLevel: (design.errorCorrection || 'M') as any,
      color: {
        dark: darkColor, 
        light: lightColor 
      }
    });

    return buffer;
  } catch (err) {
    console.error('Error generating server QR buffer:', err);
    throw err;
  }
}
