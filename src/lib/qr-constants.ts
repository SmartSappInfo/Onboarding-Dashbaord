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

export const GLOBAL_QR_TEMPLATES: Array<{ id: string; name: string; design: QRDesign }> = [
  {
    id: 'tpl-modern-blue',
    name: 'Modern Blue',
    design: {
      ...DEFAULT_QR_DESIGN,
      foregroundColor: '#3B5FFF',
      backgroundColor: '#FFFFFF',
      dotStyle: 'rounded',
      cornerSquareStyle: 'extra-rounded',
      cornerDotStyle: 'dot' as any,
      gradient: undefined,
    },
  },
  {
    id: 'tpl-luxury-dark',
    name: 'Luxury Dark',
    design: {
      ...DEFAULT_QR_DESIGN,
      foregroundColor: '#0F172A',
      backgroundColor: '#FFFFFF',
      dotStyle: 'dots',
      cornerSquareStyle: 'square',
      cornerDotStyle: 'square',
      gradient: undefined,
    },
  },
  {
    id: 'tpl-emerald-eco',
    name: 'Emerald Eco',
    design: {
      ...DEFAULT_QR_DESIGN,
      foregroundColor: '#059669',
      backgroundColor: '#FFFFFF',
      dotStyle: 'classy',
      cornerSquareStyle: 'extra-rounded',
      cornerDotStyle: 'dot' as any,
      gradient: undefined,
    },
  },
  {
    id: 'tpl-sunset',
    name: 'Sunset Gradient',
    design: {
      ...DEFAULT_QR_DESIGN,
      foregroundColor: '#F43F5E',
      backgroundColor: '#FFFFFF',
      dotStyle: 'rounded',
      cornerSquareStyle: 'square',
      cornerDotStyle: 'square',
      gradient: {
        enabled: true,
        type: 'linear',
        rotation: 45,
        colorStops: [
          { offset: 0, color: '#F43F5E' },
          { offset: 1, color: '#FB923C' },
        ],
      },
    },
  },
];
