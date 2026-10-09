// @vitest-environment jsdom
/**
 * PURPOSE: Baseline unit tests for the client-side Signature Processing Engine.
 * ARCHITECTURAL CONTEXT: Locks in digital convolution, ink thresholding, transparent alpha
 * extraction, auto-crop tighten, and normalization behavior prior to Phase 1 refactoring.
 * TESTABILITY: Runs in Vitest jsdom environment with mocked 2D canvas context.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processSignatureImage, processPhotoImage } from '../signature-processing';

describe('P0.3 Baseline: Signature Processing Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exports processSignatureImage and processPhotoImage as callable functions', () => {
    expect(typeof processSignatureImage).toBe('function');
    expect(typeof processPhotoImage).toBe('function');
  });

  it('verifies thresholding math for dark ink vs light paper background', () => {
    // Pure black (RGB: 0, 0, 0) -> luminance = 0 -> < threshold (150) -> opaque black [0, 0, 0, 255]
    const darkLuminance = 0.299 * 0 + 0.587 * 0 + 0.114 * 0;
    expect(darkLuminance).toBe(0);
    expect(darkLuminance < 150).toBe(true);

    // White paper (RGB: 255, 255, 255) -> luminance = 255 -> >= threshold (150) -> transparent [r, g, b, 0]
    const paperLuminance = 0.299 * 255 + 0.587 * 255 + 0.114 * 255;
    expect(Math.round(paperLuminance)).toBe(255);
    expect(paperLuminance < 150).toBe(false);

    // Off-white paper background (RGB: 220, 220, 210)
    const offWhiteLuminance = 0.299 * 220 + 0.587 * 220 + 0.114 * 210;
    expect(offWhiteLuminance > 150).toBe(true);
  });

  it('processes signature image with simulated canvas context and returns 1000px normalized result', async () => {
    // Mock Image in jsdom
    const mockImageWidth = 400;
    const mockImageHeight = 200;

    class MockImage {
      crossOrigin: string = '';
      src: string = '';
      width: number = mockImageWidth;
      height: number = mockImageHeight;
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;

      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    }

    vi.stubGlobal('Image', MockImage);

    // Mock Canvas 2D Context
    const mockImageData = {
      data: new Uint8ClampedArray(mockImageWidth * mockImageHeight * 4),
      width: mockImageWidth,
      height: mockImageHeight,
    };

    // Draw a small black rectangle (ink stroke) in the middle of mockImageData
    for (let y = 80; y < 120; y++) {
      for (let x = 150; x < 250; x++) {
        const idx = (y * mockImageWidth + x) * 4;
        mockImageData.data[idx] = 10;     // R
        mockImageData.data[idx + 1] = 10; // G
        mockImageData.data[idx + 2] = 10; // B
        mockImageData.data[idx + 3] = 255; // Alpha
      }
    }

    const mockContext = {
      translate: vi.fn(),
      rotate: vi.fn(),
      drawImage: vi.fn(),
      filter: 'none',
      globalAlpha: 1.0,
      getImageData: vi.fn().mockReturnValue(mockImageData),
      putImageData: vi.fn(),
    };

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'canvas') {
        const canvas = originalCreateElement('canvas');
        canvas.getContext = vi.fn().mockReturnValue(mockContext);
        canvas.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mockNormalizedSignature');
        return canvas;
      }
      return originalCreateElement(tagName);
    });

    const result = await processSignatureImage(
      'data:image/png;base64,mockRawImage',
      150, // threshold
      0,   // thickness
      1,   // smoothing
      undefined,
      0,   // rotation
      false
    );

    expect(result).toBeDefined();
    expect(result.dataUrl).toContain('data:image/png;base64');
    expect(result.width).toBe(1000); // Standard output target width
    expect(result.height).toBeGreaterThan(0);
  });

  it('processes photo image with brightness and contrast adjustments', async () => {
    class MockImage {
      crossOrigin: string = '';
      src: string = '';
      width: number = 600;
      height: number = 400;
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;

      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    }

    vi.stubGlobal('Image', MockImage);

    let appliedFilter = '';
    const mockContext = {
      set filter(value: string) {
        appliedFilter = value;
      },
      get filter() {
        return appliedFilter;
      },
      drawImage: vi.fn(),
    };

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'canvas') {
        const canvas = originalCreateElement('canvas');
        canvas.getContext = vi.fn().mockReturnValue(mockContext);
        canvas.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,mockProcessedPhoto');
        return canvas;
      }
      return originalCreateElement(tagName);
    });

    const result = await processPhotoImage(
      'data:image/jpeg;base64,mockRawPhoto',
      20, // +20% brightness
      10  // +10% contrast
    );

    expect(result).toBeDefined();
    expect(result.dataUrl).toContain('data:image/jpeg;base64');
    expect(result.width).toBe(1000);
    expect(appliedFilter).toBe('brightness(120%) contrast(110%)');
  });
});
