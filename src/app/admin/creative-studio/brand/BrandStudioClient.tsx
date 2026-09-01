'use client';

/**
 * ARCHITECTURE:
 * Brand Studio Management Client (Phase 5 - Templates & Brand Intelligence)
 * 
 * Central hub for workspace brand tokens (palettes, typography, logos, watermark)
 * and AI design system compliance rules.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { BrandKit } from '@/lib/creative/creative-types';
import { THUMBNAIL_FONT_OPTIONS } from '@/lib/creative/creative-types';
import { saveBrandKitAction } from '@/app/actions/brand-kit-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  ArrowLeft,
  Save,
  Palette,
  Type,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface BrandStudioClientProps {
  initialBrandKit: BrandKit;
  workspaceId?: string;
}

export function BrandStudioClient({
  initialBrandKit,
}: BrandStudioClientProps) {
  const { toast } = useToast();
  const [brandKit, setBrandKit] = useState<BrandKit>(initialBrandKit);
  const [isPending, startTransition] = useTransition();

  const handleSaveBrandKit = () => {
    startTransition(async () => {
      const res = await saveBrandKitAction(brandKit.workspaceId || 'default', brandKit);
      if (res.success) {
        toast({
          title: 'Brand Kit Saved',
          description: 'Workspace brand tokens and AI rules updated.',
        });
      } else {
        toast({
          title: 'Save Error',
          description: res.error || 'Failed to save Brand Kit.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleToggleRule = (ruleId: string) => {
    const updatedRules = (brandKit.aiRules || []).map((r) =>
      r.id === ruleId ? { ...r, active: !r.active } : r
    );
    setBrandKit({ ...brandKit, aiRules: updatedRules });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/creative-studio/projects"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-foreground">Brand Studio</h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground max-w-2xl">
            Configure workspace brand design tokens, display typography, logos, and AI compliance rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/creative-studio/templates">
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-4 text-xs font-bold bg-card border-border text-foreground hover:bg-muted rounded-xl active:scale-[0.97]"
            >
              Template Marketplace
            </Button>
          </Link>
          <Button
            onClick={handleSaveBrandKit}
            disabled={isPending}
            className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 active:scale-[0.97] text-white dark:text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/10"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Brand Kit
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Palettes, Typography, Watermark */}
        <div className="lg:col-span-2 space-y-6">
          {/* Brand Identity & Name */}
          <div className="p-6 rounded-3xl bg-card border border-border space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Workspace Brand Identity</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Brand Kit Name</Label>
                <Input
                  value={brandKit.name}
                  onChange={(e) => setBrandKit({ ...brandKit, name: e.target.value })}
                  placeholder="e.g. SmartSapp Global Brand"
                  className="h-10 bg-background border-border text-xs font-semibold text-foreground placeholder:text-muted-foreground rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Watermark / Logo URL</Label>
                <Input
                  value={brandKit.watermarkUrl || ''}
                  onChange={(e) => setBrandKit({ ...brandKit, watermarkUrl: e.target.value })}
                  placeholder="https://.../logo-watermark.png"
                  className="h-10 bg-background border-border text-xs font-semibold text-foreground placeholder:text-muted-foreground rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Color Palettes */}
          <div className="p-6 rounded-3xl bg-card border border-border space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Brand Color Palette</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Primary Color 1 */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Primary Brand Accent</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandKit.colors.primary[0] || '#10b981'}
                    onChange={(e) => {
                      const updated = [...brandKit.colors.primary];
                      updated[0] = e.target.value;
                      setBrandKit({ ...brandKit, colors: { ...brandKit.colors, primary: updated } });
                    }}
                    className="w-10 h-10 rounded-xl border border-border bg-transparent cursor-pointer"
                  />
                  <Input
                    value={brandKit.colors.primary[0] || '#10b981'}
                    onChange={(e) => {
                      const updated = [...brandKit.colors.primary];
                      updated[0] = e.target.value;
                      setBrandKit({ ...brandKit, colors: { ...brandKit.colors, primary: updated } });
                    }}
                    className="h-10 bg-background border-border text-xs font-mono text-foreground rounded-xl"
                  />
                </div>
              </div>

              {/* Primary Color 2 / Secondary */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Secondary / Background Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandKit.colors.primary[1] || '#0f172a'}
                    onChange={(e) => {
                      const updated = [...brandKit.colors.primary];
                      updated[1] = e.target.value;
                      setBrandKit({ ...brandKit, colors: { ...brandKit.colors, primary: updated } });
                    }}
                    className="w-10 h-10 rounded-xl border border-border bg-transparent cursor-pointer"
                  />
                  <Input
                    value={brandKit.colors.primary[1] || '#0f172a'}
                    onChange={(e) => {
                      const updated = [...brandKit.colors.primary];
                      updated[1] = e.target.value;
                      setBrandKit({ ...brandKit, colors: { ...brandKit.colors, primary: updated } });
                    }}
                    className="h-10 bg-background border-border text-xs font-mono text-foreground rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Typography Governance */}
          <div className="p-6 rounded-3xl bg-card border border-border space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Type className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Typography Standards</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Display / Headline Font</Label>
                <Select
                  value={brandKit.typography.displayFont || 'Impact'}
                  onValueChange={(val) =>
                    setBrandKit({
                      ...brandKit,
                      typography: { ...brandKit.typography, displayFont: val },
                    })
                  }
                >
                  <SelectTrigger className="h-10 bg-background border-border text-xs font-bold text-foreground rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    {THUMBNAIL_FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs font-bold">
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Subtitle / Body Font</Label>
                <Select
                  value={brandKit.typography.bodyFont || 'Inter'}
                  onValueChange={(val) =>
                    setBrandKit({
                      ...brandKit,
                      typography: { ...brandKit.typography, bodyFont: val },
                    })
                  }
                >
                  <SelectTrigger className="h-10 bg-background border-border text-xs font-bold text-foreground rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    {THUMBNAIL_FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs font-bold">
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Brand Rules Engine */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-card border border-border space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>AI Brand Rules</span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Rules enforced by the AI Creative Director and real-time Health Linter during composition generation.
            </p>

            <div className="space-y-3 pt-2">
              {(brandKit.aiRules || []).map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 rounded-2xl bg-muted/40 border border-border space-y-2 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-background border border-border text-emerald-600 dark:text-emerald-400 uppercase font-mono">
                        {rule.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase">{rule.severity}</span>
                    </div>
                    <p className="text-xs font-medium text-foreground leading-relaxed">{rule.rule}</p>
                  </div>
                  <Switch
                    checked={rule.active}
                    onCheckedChange={() => handleToggleRule(rule.id)}
                    className="data-[state=checked]:bg-emerald-600 dark:data-[state=checked]:bg-emerald-500 shrink-0 mt-1"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
