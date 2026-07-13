import { expect, test, describe } from 'vitest';
import { analyzeThumbnailCTR, getYIQLuminance, extractColorStop } from '../ctr-evaluator';
import type { ThumbnailDesign } from '../thumbnail-types';

describe('YIQ Color Contrast Calculations', () => {
  test('extractColorStop extracts first hex stop from gradients or string', () => {
    expect(extractColorStop('linear-gradient(90deg, #1e1b4b 0%, #311042 100%)')).toBe('#1e1b4b');
    expect(extractColorStop('#facc15')).toBe('#facc15');
    expect(extractColorStop('white')).toBe('#ffffff');
    expect(extractColorStop('')).toBe('#888888');
  });

  test('getYIQLuminance parses luminance values correctly', () => {
    // White (#ffffff) luminance should be 255
    expect(getYIQLuminance('#ffffff')).toBe(255);
    // Black (#000000) luminance should be 0
    expect(getYIQLuminance('#000000')).toBe(0);
  });
});

describe('analyzeThumbnailCTR Engine Rules', () => {
  const baseDesign: ThumbnailDesign = {
    workspaceId: 'ws-123',
    name: 'Test Design',
    backgroundColor: '#0f172a', // Dark blue (Luminance ~ 25)
    elements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  test('flags design with elements in the bottom-right timestamp dead zone', () => {
    const design: ThumbnailDesign = {
      ...baseDesign,
      elements: [
        { id: 'el-1', type: 'text', x: 85, y: 80, width: 10, height: 10, zIndex: 1, text: 'BAD ZONE' }
      ]
    };
    const res = analyzeThumbnailCTR(design);
    expect(res.score).toBeLessThan(80);
    expect(res.recommendations.some(r => r.type === 'safe-zone')).toBe(true);
  });

  test('flags low contrast text against background', () => {
    const design: ThumbnailDesign = {
      ...baseDesign,
      backgroundColor: '#000000', // Black
      elements: [
        { id: 'el-1', type: 'text', x: 10, y: 10, width: 40, height: 20, zIndex: 1, fill: '#0a0a0a', text: 'DARK TEXT' }
      ]
    };
    const res = analyzeThumbnailCTR(design);
    expect(res.recommendations.some(r => r.type === 'contrast')).toBe(true);
  });

  test('flags tiny text unreadable on mobile screens', () => {
    const design: ThumbnailDesign = {
      ...baseDesign,
      elements: [
        { id: 'el-1', type: 'text', x: 10, y: 10, width: 40, height: 20, zIndex: 1, fontSize: 18, text: 'TINY TEXT' }
      ]
    };
    const res = analyzeThumbnailCTR(design);
    expect(res.recommendations.some(r => r.id === 'violation-tiny-text')).toBe(true);
  });

  test('suggests outlines and arrows when subject is present', () => {
    const design: ThumbnailDesign = {
      ...baseDesign,
      elements: [
        { id: 'el-text', type: 'text', x: 10, y: 10, width: 40, height: 20, zIndex: 1, fontSize: 32, text: 'OKAY TITLE', fill: '#ffffff' },
        { id: 'el-img', type: 'image', x: 60, y: 10, width: 30, height: 80, zIndex: 2, imageSrc: 'face.png' }
      ]
    };
    const res = analyzeThumbnailCTR(design);
    expect(res.recommendations.some(r => r.id === 'suggestion-outline-glow')).toBe(true);
    expect(res.recommendations.some(r => r.id === 'suggestion-arrow-directive')).toBe(true);
  });
});
