import * as React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { AISeedResult } from '@/lib/types';

// Helpers
export function relativeLuminance(hex: string): number {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function darkenHex(hex: string, amount: number): string {
    const clean = hex.replace('#', '');
    const factor = 1 - amount;
    const r = Math.round(parseInt(clean.slice(0, 2), 16) * factor);
    const g = Math.round(parseInt(clean.slice(2, 4), 16) * factor);
    const b = Math.round(parseInt(clean.slice(4, 6), 16) * factor);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function ensureContrastReady(hex: string): string {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
    const lum = relativeLuminance(hex);
    if (lum > 0.85) return darkenHex(hex, 0.35);
    return hex;
}

interface SeedPreviewProps {
    seed: AISeedResult;
    onApply: () => void;
    onDismiss: () => void;
}

export function AISeedPreview({ seed, onApply, onDismiss }: SeedPreviewProps) {
    const primarySafe = ensureContrastReady(seed.brandPrimaryColor);
    const secondarySafe = ensureContrastReady(seed.brandSecondaryColor);
    const hasPrimary = !!seed.brandPrimaryColor;
    const hasSecondary = !!seed.brandSecondaryColor;

    return (
        <div
            className="rounded-2xl border border-violet-200/60 dark:border-violet-800/40 overflow-hidden shadow-md bg-background/50 dark:bg-background/10 backdrop-blur-md"
            style={{
                background: `linear-gradient(135deg, ${hasPrimary ? primarySafe + '10' : 'hsl(var(--muted)/0.3)'} 0%, ${hasSecondary ? secondarySafe + '10' : 'hsl(var(--muted)/0.3)'} 100%)`,
            }}
        >
            {/* Color mesh preview bar */}
            {(hasPrimary || hasSecondary) && (
                <div
                    className="h-2 w-full"
                    style={{
                        background:
                            hasPrimary && hasSecondary
                                ? `linear-gradient(90deg, ${primarySafe} 0%, ${secondarySafe} 100%)`
                                : hasPrimary
                                  ? primarySafe
                                  : secondarySafe,
                    }}
                />
            )}

            <div className="p-5 space-y-4 text-left">
                <div className="flex items-start gap-4">
                    {/* Logo preview */}
                    {seed.logoUrl && (
                        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-background/60 border border-border flex items-center justify-center overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={seed.logoUrl}
                                alt="Detected logo"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        {seed.name && (
                            <p className="font-bold text-sm truncate">{seed.name}</p>
                        )}
                        {seed.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 font-medium">
                                {seed.description}
                            </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {seed.country && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background/60 border border-border text-muted-foreground">
                                    🌍 {seed.country}
                                </span>
                            )}
                            {seed.language && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background/60 border border-border text-muted-foreground">
                                    🗣 {seed.language.toUpperCase()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Color swatches */}
                {(hasPrimary || hasSecondary) && (
                    <div className="flex gap-3">
                        {hasPrimary && (
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-7 h-7 rounded-lg border border-border shadow-sm"
                                    style={{ background: primarySafe }}
                                />
                                <span className="text-[10px] font-mono font-semibold text-muted-foreground">{primarySafe}</span>
                                <span className="text-[9px] text-muted-foreground/60 font-bold">PRIMARY</span>
                            </div>
                        )}
                        {hasSecondary && (
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-7 h-7 rounded-lg border border-border shadow-sm"
                                    style={{ background: secondarySafe }}
                                />
                                <span className="text-[10px] font-mono font-semibold text-muted-foreground">{secondarySafe}</span>
                                <span className="text-[9px] text-muted-foreground/60 font-bold">SECONDARY</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                    <Button
                        type="button"
                        size="sm"
                        onClick={onApply}
                        className="flex-1 rounded-xl font-bold text-xs h-9 gap-1.5"
                        style={
                            hasPrimary
                                ? { background: primarySafe, color: '#fff', boxShadow: `0 4px 14px ${primarySafe}40` }
                                : {}
                        }
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Apply Seeding
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onDismiss}
                        className="rounded-xl font-bold text-xs h-9 gap-1.5"
                    >
                        <XCircle className="h-3.5 w-3.5" />
                        Dismiss
                    </Button>
                </div>
            </div>
        </div>
    );
}
