'use client';

import * as React from 'react';
import { Camera, ArrowDown, Sparkles, Lock, Link as LinkIcon, Phone, Star, ShoppingBag } from 'lucide-react';
import type { QRDesign, QRFrameStyle, QRFrameIcon } from '@/lib/types';
import { DEFAULT_QR_DESIGN } from '@/lib/qr-constants';

interface QRPreviewProps {
  data: string;
  design?: Partial<QRDesign>;
  size?: number;
  className?: string;
  showFrame?: boolean;
}

const ICON_MAP: Record<QRFrameIcon, React.ComponentType<{ className?: string }>> = {
  camera: Camera,
  'arrow-down': ArrowDown,
  sparkles: Sparkles,
  lock: Lock,
  link: LinkIcon,
  phone: Phone,
  star: Star,
  'shopping-bag': ShoppingBag,
  none: () => null,
};

/**
 * Live QR code preview using qr-code-styling with full frame, badge, dual-color eye,
 * and multi-gradient visual rendering.
 */
export default function QRPreview({
  data,
  design: designOverrides,
  size,
  className,
  showFrame = true,
}: QRPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Using generic object ref for third-party qr-code-styling instance
  const qrInstanceRef = React.useRef<{ update: (opts: Record<string, unknown>) => void; append: (el: HTMLElement) => void } | null>(null);

  // Extract properties that affect the inner QR graphic
  const qrSpecificDesignStr = React.useMemo(() => {
    const { posterData, ...qrOnlyDesign } = designOverrides || {};
    return JSON.stringify(qrOnlyDesign);
  }, [designOverrides]);

  const resolvedSize = size || designOverrides?.size || 300;
  const mergedDesign: QRDesign = React.useMemo(() => {
    return { ...DEFAULT_QR_DESIGN, ...JSON.parse(qrSpecificDesignStr) };
  }, [qrSpecificDesignStr]);

  const frameStyle: QRFrameStyle = mergedDesign.frameStyle || 'none';
  const frameText = mergedDesign.frameText || 'SCAN ME';
  const frameColor = mergedDesign.frameColor || mergedDesign.foregroundColor || '#000000';
  const frameTextColor = mergedDesign.frameTextColor || '#FFFFFF';
  const FrameIconComp = ICON_MAP[mergedDesign.frameIcon || 'camera'] || Camera;

  // Build qr-code-styling options
  const qrOptions = React.useMemo(() => {
    const opts: Record<string, unknown> = {
      width: resolvedSize,
      height: resolvedSize,
      data: data || 'https://smartsapp.com',
      margin: mergedDesign.quietZone ?? 20,
      qrOptions: {
        errorCorrectionLevel: mergedDesign.errorCorrection || 'M',
      },
      dotsOptions: {
        color: mergedDesign.foregroundColor || '#000000',
        type: mapDotStyle(mergedDesign.dotStyle),
      },
      backgroundOptions: {
        color: mergedDesign.backgroundColor || '#FFFFFF',
      },
      cornersSquareOptions: {
        color: mergedDesign.cornerSquareColor || mergedDesign.foregroundColor || '#000000',
        type: mapCornerSquareStyle(mergedDesign.cornerSquareStyle),
      },
      cornersDotOptions: {
        color: mergedDesign.cornerDotColor || mergedDesign.foregroundColor || '#000000',
        type: mapCornerDotStyle(mergedDesign.cornerDotStyle),
      },
    };

    // Gradient support
    if (mergedDesign.gradient?.enabled && mergedDesign.gradient.colorStops.length >= 2) {
      (opts.dotsOptions as Record<string, unknown>).gradient = {
        type: mergedDesign.gradient.type || 'linear',
        rotation: mergedDesign.gradient.rotation || 0,
        colorStops: mergedDesign.gradient.colorStops,
      };
    } else {
      (opts.dotsOptions as Record<string, unknown>).gradient = null;
    }

    // Logo support
    if (mergedDesign.logoUrl) {
      let finalLogoUrl = mergedDesign.logoUrl;
      if (
        typeof window !== 'undefined' &&
        finalLogoUrl.startsWith('http') &&
        !finalLogoUrl.includes(window.location.host) &&
        !finalLogoUrl.includes('firebasestorage.googleapis.com')
      ) {
        finalLogoUrl = `/api/proxy-image?url=${encodeURIComponent(finalLogoUrl)}`;
      }

      opts.image = finalLogoUrl;
      opts.imageOptions = {
        crossOrigin: 'anonymous',
        margin: mergedDesign.logoMargin ?? 5,
        imageSize: (mergedDesign.logoSize || 20) / 100,
        hideBackgroundDots: true,
      };
    }

    return opts;
  }, [data, mergedDesign, resolvedSize]);

  // Initialize and update QR code
  React.useEffect(() => {
    let cancelled = false;

    async function render() {
      const QRCodeStyling = (await import('qr-code-styling')).default;

      if (cancelled) return;

      if (!qrInstanceRef.current) {
        // @ts-expect-error - qr-code-styling accepts dynamic opts
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

  // Render pure QR without frame
  const qrCanvasElement = (
    <div
      ref={containerRef}
      className="flex items-center justify-center overflow-hidden"
      style={{ width: resolvedSize, height: resolvedSize }}
    />
  );

  if (!showFrame || frameStyle === 'none') {
    return <div className={`flex items-center justify-center ${className || ''}`}>{qrCanvasElement}</div>;
  }

  // Render Framed Variations
  return (
    <div className={`flex flex-col items-center justify-center ${className || ''}`}>
      {/* 1. Top Banner */}
      {(frameStyle === 'top-banner' || frameStyle === 'banner-top') && (
        <div className="overflow-hidden rounded-2xl shadow-md border border-border bg-card">
          <div
            className="flex items-center justify-center gap-1.5 py-2 px-4 font-bold text-xs uppercase tracking-wider"
            style={{ backgroundColor: frameColor, color: frameTextColor }}
          >
            {mergedDesign.frameIcon !== 'none' && <FrameIconComp className="h-3.5 w-3.5 shrink-0" />}
            <span>{frameText}</span>
          </div>
          <div className="p-2 bg-white flex items-center justify-center">{qrCanvasElement}</div>
        </div>
      )}

      {/* 2. Bottom Banner */}
      {(frameStyle === 'bottom-banner' || frameStyle === 'banner-bottom') && (
        <div className="overflow-hidden rounded-2xl shadow-md border border-border bg-card">
          <div className="p-2 bg-white flex items-center justify-center">{qrCanvasElement}</div>
          <div
            className="flex items-center justify-center gap-1.5 py-2 px-4 font-bold text-xs uppercase tracking-wider"
            style={{ backgroundColor: frameColor, color: frameTextColor }}
          >
            {mergedDesign.frameIcon !== 'none' && <FrameIconComp className="h-3.5 w-3.5 shrink-0" />}
            <span>{frameText}</span>
          </div>
        </div>
      )}

      {/* 3. Rounded Box */}
      {(frameStyle === 'rounded-box' || frameStyle === 'rounded-bottom') && (
        <div
          className="p-3 rounded-3xl shadow-lg border-2 flex flex-col items-center gap-2 bg-white"
          style={{ borderColor: frameColor }}
        >
          {qrCanvasElement}
          <div
            className="flex items-center gap-1.5 py-1 px-4 rounded-full font-bold text-[11px] uppercase tracking-wider shadow-sm"
            style={{ backgroundColor: frameColor, color: frameTextColor }}
          >
            {mergedDesign.frameIcon !== 'none' && <FrameIconComp className="h-3 w-3 shrink-0" />}
            <span>{frameText}</span>
          </div>
        </div>
      )}

      {/* 4. Polaroid Frame */}
      {frameStyle === 'polaroid' && (
        <div className="p-4 pb-8 rounded-xl shadow-xl border border-border bg-white flex flex-col items-center">
          <div className="border border-border/40 p-1 rounded-lg">{qrCanvasElement}</div>
          <p
            className="mt-4 font-bold text-sm tracking-wide text-center"
            style={{ color: frameColor === '#FFFFFF' ? '#111827' : frameColor }}
          >
            {frameText}
          </p>
        </div>
      )}

      {/* 5. Smartphone Shell Mockup */}
      {frameStyle === 'phone-mockup' && (
        <div className="relative p-3 pt-6 pb-6 rounded-[36px] border-4 border-zinc-800 bg-zinc-900 shadow-2xl flex flex-col items-center">
          {/* Dynamic Island Notch */}
          <div className="h-3.5 w-20 bg-black rounded-full mb-3 shadow-inner" />
          <div className="rounded-2xl overflow-hidden bg-white p-2">{qrCanvasElement}</div>
          {/* Bottom Home Indicator */}
          <div
            className="mt-3 flex items-center gap-1.5 font-bold text-[10px] tracking-wider uppercase px-3 py-0.5 rounded-full"
            style={{ backgroundColor: frameColor, color: frameTextColor }}
          >
            {mergedDesign.frameIcon !== 'none' && <FrameIconComp className="h-2.5 w-2.5" />}
            <span>{frameText}</span>
          </div>
        </div>
      )}

      {/* 6. Scan Ribbon Badge */}
      {frameStyle === 'scan-me-badge' && (
        <div className="relative p-3 rounded-2xl bg-white shadow-xl border border-border">
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full font-extrabold text-[10px] uppercase tracking-widest shadow-md z-10"
            style={{ backgroundColor: frameColor, color: frameTextColor }}
          >
            {mergedDesign.frameIcon !== 'none' && <FrameIconComp className="h-3 w-3" />}
            <span>{frameText}</span>
          </div>
          <div className="mt-1">{qrCanvasElement}</div>
        </div>
      )}

      {/* 7. Ticket Stub / Coupon */}
      {frameStyle === 'ticket-stub' && (
        <div
          className="relative p-4 rounded-2xl border-2 border-dashed bg-white shadow-lg flex flex-col items-center gap-2"
          style={{ borderColor: frameColor }}
        >
          {/* Ticket cutout notches */}
          <div className="absolute top-1/2 -left-3 -translate-y-1/2 h-5 w-5 bg-background rounded-full border-r-2" style={{ borderColor: frameColor }} />
          <div className="absolute top-1/2 -right-3 -translate-y-1/2 h-5 w-5 bg-background rounded-full border-l-2" style={{ borderColor: frameColor }} />
          <div
            className="font-mono font-bold text-[10px] tracking-widest uppercase py-0.5 px-3 rounded"
            style={{ backgroundColor: `${frameColor}20`, color: frameColor }}
          >
            🎟️ ADMIT ONE / COUPON
          </div>
          {qrCanvasElement}
          <p className="font-bold text-xs uppercase tracking-wider" style={{ color: frameColor }}>
            {frameText}
          </p>
        </div>
      )}

      {/* 8. Minimalist Pill */}
      {(frameStyle === 'minimalist-pill' || frameStyle === 'pill') && (
        <div className="p-3 rounded-2xl bg-white shadow-md border border-border/80 flex flex-col items-center gap-2">
          {qrCanvasElement}
          <div
            className="flex items-center gap-1.5 py-1 px-3.5 rounded-full font-bold text-[10px] uppercase tracking-wider"
            style={{ backgroundColor: frameColor, color: frameTextColor }}
          >
            {mergedDesign.frameIcon !== 'none' && <FrameIconComp className="h-3 w-3" />}
            <span>{frameText}</span>
          </div>
        </div>
      )}

      {/* 9. Speech Bubble Callout */}
      {frameStyle === 'bubble-callout' && (
        <div className="flex flex-col items-center">
          <div
            className="relative px-4 py-2 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md mb-2 flex items-center gap-1.5"
            style={{ backgroundColor: frameColor, color: frameTextColor }}
          >
            {mergedDesign.frameIcon !== 'none' && <FrameIconComp className="h-3.5 w-3.5" />}
            <span>{frameText}</span>
            {/* Pointer notch */}
            <div
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
              style={{ backgroundColor: frameColor }}
            />
          </div>
          <div className="p-2 rounded-2xl bg-white shadow-lg border border-border">{qrCanvasElement}</div>
        </div>
      )}
    </div>
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

  const opts: Record<string, unknown> = {
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
    (opts.dotsOptions as Record<string, unknown>).gradient = {
      type: merged.gradient.type || 'linear',
      rotation: merged.gradient.rotation || 0,
      colorStops: merged.gradient.colorStops,
    };
  } else {
    (opts.dotsOptions as Record<string, unknown>).gradient = null;
  }

  if (merged.logoUrl) {
    let finalLogoUrl = merged.logoUrl;
    if (
      typeof window !== 'undefined' &&
      finalLogoUrl.startsWith('http') &&
      !finalLogoUrl.includes(window.location.host) &&
      !finalLogoUrl.includes('firebasestorage.googleapis.com')
    ) {
      finalLogoUrl = `/api/proxy-image?url=${encodeURIComponent(finalLogoUrl)}`;
    }

    opts.image = finalLogoUrl;
    opts.imageOptions = {
      crossOrigin: 'anonymous',
      margin: merged.logoMargin ?? 5,
      imageSize: (merged.logoSize || 20) / 100,
      hideBackgroundDots: true,
    };
  }

  // @ts-expect-error - qr-code-styling accepts dynamic opts
  const qr = new QRCodeStyling(opts);
  const extension = format === 'jpg' ? 'jpeg' : format;
  const name = filename || `qr-code-${Date.now()}`;
  await qr.download({ name, extension: extension as 'png' | 'jpeg' | 'svg' });
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
