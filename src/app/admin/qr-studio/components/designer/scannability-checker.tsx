'use client';

import * as React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { QRDesign } from '@/lib/types';

interface ScannabilityCheckerProps {
  design: QRDesign;
}

type CheckSeverity = 'pass' | 'warning' | 'critical' | 'info';

interface CheckResult {
  id: string;
  label: string;
  severity: CheckSeverity;
  message: string;
  fix?: string;
}

/**
 * Calculates relative luminance of a hex color for WCAG contrast.
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isLightColor(hex: string): boolean {
  return getLuminance(hex) > 0.5;
}

export default function ScannabilityChecker({ design }: ScannabilityCheckerProps) {
  const checks = React.useMemo((): CheckResult[] => {
    const results: CheckResult[] = [];
    const fg = design.foregroundColor || '#000000';
    const bg = design.backgroundColor || '#FFFFFF';

    // 1. Contrast ratio
    const contrast = getContrastRatio(fg, bg);
    if (contrast >= 4.5) {
      results.push({ id: 'contrast', label: 'Contrast Ratio', severity: 'pass', message: `${contrast.toFixed(1)}:1 — Excellent` });
    } else if (contrast >= 3) {
      results.push({ id: 'contrast', label: 'Contrast Ratio', severity: 'warning', message: `${contrast.toFixed(1)}:1 — May have issues in poor lighting`, fix: 'Increase contrast between foreground and background colors' });
    } else {
      results.push({ id: 'contrast', label: 'Contrast Ratio', severity: 'critical', message: `${contrast.toFixed(1)}:1 — Too low to scan reliably`, fix: 'Use darker foreground or lighter background' });
    }

    // 2. Color inversion check
    const fgIsLight = isLightColor(fg);
    const bgIsDark = !isLightColor(bg);
    if (fgIsLight && bgIsDark) {
      results.push({ id: 'inversion', label: 'Color Inversion', severity: 'warning', message: 'Light dots on dark background — some scanners struggle with this', fix: 'Swap foreground and background colors' });
    } else {
      results.push({ id: 'inversion', label: 'Color Scheme', severity: 'pass', message: 'Dark dots on light background — optimal' });
    }

    // 3. Logo coverage
    if (design.logoUrl) {
      const logoSize = design.logoSize || 20;
      if (logoSize > 25) {
        results.push({ id: 'logo', label: 'Logo Size', severity: 'warning', message: `${logoSize}% — Logo may cover too many data modules`, fix: 'Reduce logo size to 20% or less' });
      } else {
        results.push({ id: 'logo', label: 'Logo Size', severity: 'pass', message: `${logoSize}% — Within safe range` });
      }

      // Logo + error correction
      if (design.errorCorrection === 'L' || design.errorCorrection === 'M') {
        results.push({ id: 'logo-ec', label: 'Logo + Error Correction', severity: 'critical', message: `EC level ${design.errorCorrection} is too low for logos`, fix: 'Set error correction to Q or H when using a logo' });
      } else {
        results.push({ id: 'logo-ec', label: 'Logo + Error Correction', severity: 'pass', message: `EC level ${design.errorCorrection} — sufficient for logo overlay` });
      }
    }

    // 4. Quiet zone
    const quietZone = design.quietZone ?? 20;
    if (quietZone < 8) {
      results.push({ id: 'quiet', label: 'Quiet Zone', severity: 'warning', message: `${quietZone}px — Too narrow for reliable scanning`, fix: 'Set quiet zone to at least 16px' });
    } else if (quietZone < 16) {
      results.push({ id: 'quiet', label: 'Quiet Zone', severity: 'info', message: `${quietZone}px — Acceptable but tight` });
    } else {
      results.push({ id: 'quiet', label: 'Quiet Zone', severity: 'pass', message: `${quietZone}px — Good` });
    }

    // 5. Print size guidance
    const size = design.size || 300;
    if (size < 250) {
      results.push({ id: 'size', label: 'Minimum Print Size', severity: 'info', message: 'Print at 2cm × 2cm minimum for reliable scanning' });
    }

    // 6. Print Format Check
    if (design.logoUrl && (design.errorCorrection === 'L' || design.errorCorrection === 'M')) {
      results.push({ id: 'print-svg', label: 'Print Readiness', severity: 'critical', message: 'Not recommended for print with current logo and low EC settings.', fix: 'Increase EC to High (H) and download as SVG for printing.' });
    } else {
      results.push({ id: 'print-svg', label: 'Print Readiness', severity: 'info', message: 'For physical marketing materials, always download as SVG to ensure crisp edges at any scale.' });
    }

    return results;
  }, [design]);

  const criticalCount = checks.filter((c) => c.severity === 'critical').length;
  const warningCount = checks.filter((c) => c.severity === 'warning').length;
  const passCount = checks.filter((c) => c.severity === 'pass').length;

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
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        {criticalCount > 0 ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : warningCount > 0 ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        )}
        <p className="text-xs font-semibold text-foreground">
          {criticalCount > 0
            ? `${criticalCount} issue${criticalCount > 1 ? 's' : ''} found`
            : warningCount > 0
            ? `${warningCount} warning${warningCount > 1 ? 's' : ''}`
            : `All ${passCount} checks passed`}
        </p>
      </div>

      {/* Check Items */}
      <div className="space-y-2">
        {checks.map((check) => {
          const Icon = SeverityIcon[check.severity];
          return (
            <div key={check.id} className="flex items-start gap-2.5">
              <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${severityColor[check.severity]}`} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-foreground">{check.label}</p>
                <p className="text-[9px] text-muted-foreground">{check.message}</p>
                {check.fix && (
                  <p className="text-[9px] text-primary mt-0.5">💡 {check.fix}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
