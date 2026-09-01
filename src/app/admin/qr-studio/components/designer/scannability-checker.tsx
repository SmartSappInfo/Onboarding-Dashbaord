'use client';

import * as React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, ShieldCheck } from 'lucide-react';
import type { QRDesign } from '@/lib/types';

interface ScannabilityCheckerProps {
  design: QRDesign;
  className?: string;
}

export type CheckSeverity = 'pass' | 'warning' | 'critical' | 'info';

export interface CheckResult {
  id: string;
  label: string;
  severity: CheckSeverity;
  message: string;
  fix?: string;
}

/**
 * Calculates relative luminance of a hex color for WCAG contrast.
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isLightColor(hex: string): boolean {
  return getLuminance(hex) > 0.5;
}

/**
 * Computes an overall 0-100% Scannability Score and Letter Grade for a given QR design.
 */
export function computeScannabilityScore(design: QRDesign): {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  label: string;
  criticalCount: number;
  warningCount: number;
  colorClass: string;
  bgClass: string;
  contrastRatio: number;
} {
  const fg = design.foregroundColor || '#000000';
  const bg = design.backgroundColor || '#FFFFFF';
  const contrastRatio = getContrastRatio(fg, bg);
  
  let score = 100;
  let criticalCount = 0;
  let warningCount = 0;

  // Contrast penalty
  if (contrastRatio >= 7.0) {
    // Perfect contrast
  } else if (contrastRatio >= 4.5) {
    score -= 5;
  } else if (contrastRatio >= 3.0) {
    score -= 25;
    warningCount++;
  } else {
    score -= 55;
    criticalCount++;
  }

  // Inverted colors penalty
  if (isLightColor(fg) && !isLightColor(bg)) {
    score -= 15;
    warningCount++;
  }

  // Logo penalty
  if (design.logoUrl) {
    const logoSize = design.logoSize || 20;
    if (logoSize > 25) {
      score -= 15;
      warningCount++;
    }
    if (design.errorCorrection === 'L' || design.errorCorrection === 'M') {
      score -= 30;
      criticalCount++;
    }
  }

  // Quiet zone penalty
  const quietZone = design.quietZone ?? 20;
  if (quietZone < 8) {
    score -= 20;
    warningCount++;
  }

  // Clamp score
  const finalScore = Math.max(10, Math.min(100, score));

  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'A+';
  let label = 'Instant Scan Ready';
  let colorClass = 'text-emerald-500';
  let bgClass = 'bg-emerald-500/10 border-emerald-500/30';

  if (finalScore >= 95) {
    grade = 'A+';
    label = 'Excellent Scannability';
    colorClass = 'text-emerald-500';
    bgClass = 'bg-emerald-500/10 border-emerald-500/30';
  } else if (finalScore >= 80) {
    grade = 'A';
    label = 'High Scannability';
    colorClass = 'text-emerald-500';
    bgClass = 'bg-emerald-500/10 border-emerald-500/30';
  } else if (finalScore >= 65) {
    grade = 'B';
    label = 'Good Scannability';
    colorClass = 'text-blue-500';
    bgClass = 'bg-blue-500/10 border-blue-500/30';
  } else if (finalScore >= 50) {
    grade = 'C';
    label = 'Fair (Potential Scan Delay)';
    colorClass = 'text-amber-500';
    bgClass = 'bg-amber-500/10 border-amber-500/30';
  } else {
    grade = 'D';
    label = 'Critical (Scan May Fail)';
    colorClass = 'text-red-500';
    bgClass = 'bg-red-500/10 border-red-500/30';
  }

  return {
    score: finalScore,
    grade,
    label,
    criticalCount,
    warningCount,
    colorClass,
    bgClass,
    contrastRatio,
  };
}

export default function ScannabilityChecker({ design, className }: ScannabilityCheckerProps) {
  const scoreData = React.useMemo(() => computeScannabilityScore(design), [design]);

  const checks = React.useMemo((): CheckResult[] => {
    const results: CheckResult[] = [];
    const fg = design.foregroundColor || '#000000';
    const bg = design.backgroundColor || '#FFFFFF';

    // 1. Contrast ratio
    const contrast = getContrastRatio(fg, bg);
    if (contrast >= 4.5) {
      results.push({ id: 'contrast', label: 'Contrast Ratio', severity: 'pass', message: `${contrast.toFixed(1)}:1 — Excellent WCAG AAA standard` });
    } else if (contrast >= 3) {
      results.push({ id: 'contrast', label: 'Contrast Ratio', severity: 'warning', message: `${contrast.toFixed(1)}:1 — May have issues in direct sunlight`, fix: 'Increase contrast between foreground and background colors' });
    } else {
      results.push({ id: 'contrast', label: 'Contrast Ratio', severity: 'critical', message: `${contrast.toFixed(1)}:1 — Too low to scan reliably`, fix: 'Use darker foreground or lighter background' });
    }

    // 2. Color inversion check
    const fgIsLight = isLightColor(fg);
    const bgIsDark = !isLightColor(bg);
    if (fgIsLight && bgIsDark) {
      results.push({ id: 'inversion', label: 'Color Inversion', severity: 'warning', message: 'Light dots on dark background — older barcode scanners may fail', fix: 'Swap foreground and background colors' });
    } else {
      results.push({ id: 'inversion', label: 'Color Scheme', severity: 'pass', message: 'Dark dots on light background — 100% optimal' });
    }

    // 3. Logo coverage
    if (design.logoUrl) {
      const logoSize = design.logoSize || 20;
      if (logoSize > 25) {
        results.push({ id: 'logo', label: 'Logo Size', severity: 'warning', message: `${logoSize}% — Logo may obscure error correction blocks`, fix: 'Reduce logo size to 20% or less' });
      } else {
        results.push({ id: 'logo', label: 'Logo Size', severity: 'pass', message: `${logoSize}% — Within safe threshold` });
      }

      // Logo + error correction
      if (design.errorCorrection === 'L' || design.errorCorrection === 'M') {
        results.push({ id: 'logo-ec', label: 'Logo + Error Correction', severity: 'critical', message: `EC level ${design.errorCorrection} is too low for logo overlay`, fix: 'Set error correction to Q (25%) or H (30%)' });
      } else {
        results.push({ id: 'logo-ec', label: 'Logo + Error Correction', severity: 'pass', message: `EC level ${design.errorCorrection} — sufficient for logo overlay` });
      }
    }

    // 4. Quiet zone
    const quietZone = design.quietZone ?? 20;
    if (quietZone < 8) {
      results.push({ id: 'quiet', label: 'Quiet Zone', severity: 'warning', message: `${quietZone}px — Too narrow for reliable camera autofocus`, fix: 'Set quiet zone to at least 16px' });
    } else {
      results.push({ id: 'quiet', label: 'Quiet Zone', severity: 'pass', message: `${quietZone}px — Clean border clearance` });
    }

    // 5. Print Format Guidance
    if (design.logoUrl && (design.errorCorrection === 'L' || design.errorCorrection === 'M')) {
      results.push({ id: 'print-svg', label: 'Print Readiness', severity: 'critical', message: 'Not recommended for physical print with current low EC settings.', fix: 'Increase EC to High (H) and download as SVG or 300 DPI PDF.' });
    } else {
      results.push({ id: 'print-svg', label: 'Print Readiness', severity: 'info', message: 'For high-DPI posters or billboards, download as SVG vector or 300 DPI PDF.' });
    }

    return results;
  }, [design]);

  const SeverityIcon = {
    pass: CheckCircle2,
    warning: AlertTriangle,
    critical: XCircle,
    info: Info,
  };

  const severityColor = {
    pass: 'text-emerald-500',
    warning: 'text-amber-500',
    critical: 'text-red-500',
    info: 'text-blue-500',
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Scannability Header Card with Live Grade */}
      <div className={`p-3.5 rounded-xl border flex items-center justify-between ${scoreData.bgClass}`}>
        <div className="flex items-center gap-2.5">
          <ShieldCheck className={`h-5 w-5 ${scoreData.colorClass}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-base font-extrabold font-mono ${scoreData.colorClass}`}>
                {scoreData.grade} ({scoreData.score}%)
              </span>
              <span className="text-xs font-semibold text-foreground">{scoreData.label}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              WCAG Contrast: <span className="font-semibold font-mono text-foreground">{scoreData.contrastRatio.toFixed(1)}:1</span>
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Diagnostics Checklist */}
      <div className="space-y-2">
        {checks.map((check) => {
          const Icon = SeverityIcon[check.severity];
          return (
            <div
              key={check.id}
              className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/60 bg-muted/10 text-xs"
            >
              <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${severityColor[check.severity]}`} />
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-[11px]">{check.label}</span>
                  <span className={`text-[9px] uppercase font-bold tracking-wider ${severityColor[check.severity]}`}>
                    {check.severity}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{check.message}</p>
                {check.fix && (
                  <p className="text-[10px] text-primary font-medium mt-0.5">
                    💡 <span className="underline">{check.fix}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
