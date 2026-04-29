'use client';

import * as React from 'react';
import type { QRDesign } from '@/lib/types';
import { DEFAULT_QR_DESIGN } from '@/lib/qr-constants';

interface QRPreviewProps {
  data: string;
  design?: Partial<QRDesign>;
  size?: number;
  className?: string;
}

/**
 * Live QR code preview using qr-code-styling.
 * Renders on a canvas element with full design customization.
 * Dynamically imports qr-code-styling to avoid SSR issues.
 */
export default function QRPreview({ data, design: designOverrides, size, className }: QRPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const qrInstanceRef = React.useRef<any>(null);

  const design = React.useMemo(
    () => ({ ...DEFAULT_QR_DESIGN, ...designOverrides }),
    [designOverrides]
  );

  const resolvedSize = size || design.size || 300;

  // Build qr-code-styling options from our QRDesign type
  const qrOptions = React.useMemo(() => {
    const opts: any = {
      width: resolvedSize,
      height: resolvedSize,
      data: data || 'https://smartsapp.com',
      margin: design.quietZone ?? 20,
      qrOptions: {
        errorCorrectionLevel: design.errorCorrection || 'M',
      },
      dotsOptions: {
        color: design.foregroundColor || '#000000',
        type: mapDotStyle(design.dotStyle),
      },
      backgroundOptions: {
        color: design.backgroundColor || '#FFFFFF',
      },
      cornersSquareOptions: {
        color: design.cornerSquareColor || design.foregroundColor || '#000000',
        type: mapCornerSquareStyle(design.cornerSquareStyle),
      },
      cornersDotOptions: {
        color: design.cornerDotColor || design.foregroundColor || '#000000',
        type: mapCornerDotStyle(design.cornerDotStyle),
      },
    };

    // Gradient support
    if (design.gradient?.enabled && design.gradient.colorStops.length >= 2) {
      opts.dotsOptions.gradient = {
        type: design.gradient.type || 'linear',
        rotation: design.gradient.rotation || 0,
        colorStops: design.gradient.colorStops,
      };
    } else {
      opts.dotsOptions.gradient = null;
    }

    // Logo support
    if (design.logoUrl) {
      opts.image = design.logoUrl;
      opts.imageOptions = {
        crossOrigin: 'anonymous',
        margin: design.logoMargin ?? 5,
        imageSize: (design.logoSize || 20) / 100,
        hideBackgroundDots: true,
      };
    }

    return opts;
  }, [data, design, resolvedSize]);

  // Initialize and update QR code
  React.useEffect(() => {
    let cancelled = false;

    async function render() {
      const QRCodeStyling = (await import('qr-code-styling')).default;

      if (cancelled) return;

      if (!qrInstanceRef.current) {
        qrInstanceRef.current = new QRCodeStyling(qrOptions);
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          qrInstanceRef.current.append(containerRef.current);
        }
      } else {
        qrInstanceRef.current.update(qrOptions);
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [qrOptions]);

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center ${className || ''}`}
      style={{ width: resolvedSize, height: resolvedSize }}
    />
  );
}

// ─────────────────────────────────────────────────
// Export helpers
// ─────────────────────────────────────────────────

export async function downloadQR(
  data: string,
  design: Partial<QRDesign>,
  format: 'png' | 'jpg' | 'svg',
  filename?: string
) {
  const QRCodeStyling = (await import('qr-code-styling')).default;
  const merged = { ...DEFAULT_QR_DESIGN, ...design };
  const exportSize = merged.size || 1024;

  const opts: any = {
    width: exportSize,
    height: exportSize,
    data: data || 'https://smartsapp.com',
    margin: merged.quietZone ?? 20,
    qrOptions: { errorCorrectionLevel: merged.errorCorrection || 'M' },
    dotsOptions: {
      color: merged.foregroundColor || '#000000',
      type: mapDotStyle(merged.dotStyle),
    },
    backgroundOptions: { color: merged.backgroundColor || '#FFFFFF' },
    cornersSquareOptions: {
      color: merged.cornerSquareColor || merged.foregroundColor || '#000000',
      type: mapCornerSquareStyle(merged.cornerSquareStyle),
    },
    cornersDotOptions: {
      color: merged.cornerDotColor || merged.foregroundColor || '#000000',
      type: mapCornerDotStyle(merged.cornerDotStyle),
    },
  };

  if (merged.gradient?.enabled && merged.gradient.colorStops.length >= 2) {
    opts.dotsOptions.gradient = {
      type: merged.gradient.type || 'linear',
      rotation: merged.gradient.rotation || 0,
      colorStops: merged.gradient.colorStops,
    };
  } else {
    opts.dotsOptions.gradient = null;
  }

  if (merged.logoUrl) {
    opts.image = merged.logoUrl;
    opts.imageOptions = {
      crossOrigin: 'anonymous',
      margin: merged.logoMargin ?? 5,
      imageSize: (merged.logoSize || 20) / 100,
      hideBackgroundDots: true,
    };
  }

  const qr = new QRCodeStyling(opts);

  const extension = format === 'jpg' ? 'jpeg' : format;
  const name = filename || `qr-code-${Date.now()}`;
  await qr.download({ name, extension: extension as any });
}

// ─────────────────────────────────────────────────
// Style mappers (our types → qr-code-styling types)
// ─────────────────────────────────────────────────

function mapDotStyle(style: string): string {
  const map: Record<string, string> = {
    square: 'square',
    rounded: 'rounded',
    dots: 'dots',
    classy: 'classy',
    'classy-rounded': 'classy-rounded',
    'extra-rounded': 'extra-rounded',
  };
  return map[style] || 'square';
}

function mapCornerSquareStyle(style: string): string {
  const map: Record<string, string> = {
    square: 'square',
    dot: 'dot',
    'extra-rounded': 'extra-rounded',
  };
  return map[style] || 'square';
}

function mapCornerDotStyle(style: string): string {
  const map: Record<string, string> = {
    square: 'square',
    dot: 'dot',
  };
  return map[style] || 'square';
}
