import type { QRDesign } from '@/lib/types';

/**
 * Default QR code design configuration.
 * Extracted to a shared constants file so it can be imported from both
 * server actions ('use server') and client components without violating
 * Next.js constraints (server action files can only export async functions).
 */
export const DEFAULT_QR_DESIGN: QRDesign = {
  foregroundColor: '#000000',
  backgroundColor: '#FFFFFF',
  dotStyle: 'square',
  cornerSquareStyle: 'square',
  cornerDotStyle: 'square',
  errorCorrection: 'M',
  quietZone: 20,
  size: 300,
  frameStyle: 'none',
};
