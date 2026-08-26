'use client';

/**
 * {{Org_name}} Experience Platform — Portal Theme & Brand Customizer
 *
 * Interactive visual token editor for palettes, typography, border radius,
 * button treatments, and logo/favicon assets.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paintbrush, Type, Layout, ImageIcon, FolderOpen, RotateCcw, Trash2, Building2 } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import type { MediaAsset } from '@/lib/types';
import type { PortalThemeConfig, PortalBranding } from '@/lib/types/portal';

interface PortalThemeCustomizerProps {
  theme: PortalThemeConfig;
  branding: PortalBranding;
  onChangeTheme: (theme: PortalThemeConfig) => void;
  onChangeBranding: (branding: PortalBranding) => void;
}

const FONT_OPTIONS = [
  { label: 'Plus Jakarta Sans (Modern / Tech)', value: 'Plus Jakarta Sans' },
  { label: 'Inter (Clean / Neutral)', value: 'Inter' },
  { label: 'Geist (Sleek / Developer)', value: 'Geist' },
  { label: 'Outfit (Friendly / Modern)', value: 'Outfit' },
  { label: 'Playfair Display (Editorial / Luxury)', value: 'Playfair Display' },
  { label: 'Space Grotesk (Bold / Distinct)', value: 'Space Grotesk' },
];

const PRESET_PALETTES: { name: string; primary: string; secondary: string; accent: string }[] = [
  { name: 'Corporate Indigo', primary: '#3B82F6', secondary: '#1E293B', accent: '#6366F1' },
  { name: 'Emerald Growth', primary: '#10B981', secondary: '#064E3B', accent: '#059669' },
  { name: 'Violet Academy', primary: '#8B5CF6', secondary: '#2E1065', accent: '#7C3AED' },
  { name: 'Warm Amber', primary: '#F59E0B', secondary: '#451A03', accent: '#D97706' },
  { name: 'Rose Creator', primary: '#EC4899', secondary: '#831843', accent: '#DB2777' },
  { name: 'Dark Slate', primary: '#64748B', secondary: '#0F172A', accent: '#475569' },
];

export function PortalThemeCustomizer({
  theme,
  branding,
  onChangeTheme,
  onChangeBranding,
}: PortalThemeCustomizerProps) {
  const { activeOrganization, activeWorkspaceId } = useTenant();

  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = React.useState(false);
  const [activeMediaTarget, setActiveMediaTarget] = React.useState<'logoUrl' | 'darkLogoUrl' | 'faviconUrl' | null>(null);

  // Organization defaults for automatic inheritance
  const orgBrandLogo = activeOrganization?.logoUrl || activeOrganization?.logoUrl || '';
  const effectiveLightLogo = branding.logoUrl || orgBrandLogo;
  const effectiveDarkLogo = branding.darkLogoUrl || branding.logoUrl || orgBrandLogo;

  const handleOpenMediaSelector = (target: 'logoUrl' | 'darkLogoUrl' | 'faviconUrl') => {
    setActiveMediaTarget(target);
    setIsMediaSelectorOpen(true);
  };

  const handleSelectMediaAsset = (asset: MediaAsset) => {
    if (!activeMediaTarget) return;
    onChangeBranding({
      ...branding,
      [activeMediaTarget]: asset.url,
    });
    setIsMediaSelectorOpen(false);
    setActiveMediaTarget(null);
  };

  const handleResetToOrgLogo = (target: 'logoUrl' | 'darkLogoUrl') => {
    onChangeBranding({
      ...branding,
      [target]: orgBrandLogo,
    });
  };

  const handleColorChange = (key: keyof PortalThemeConfig['colors'], value: string) => {
    onChangeTheme({
      ...theme,
      colors: {
        ...theme.colors,
        [key]: value,
      },
    });
  };

  const handleApplyPalette = (palette: typeof PRESET_PALETTES[0]) => {
    onChangeTheme({
      ...theme,
      colors: {
        ...theme.colors,
        primary: palette.primary,
        secondary: palette.secondary,
        accent: palette.accent,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Brand Assets & Identity ───────────────────────────────────── */}
      <Card className="rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <ImageIcon className="w-4 h-4" /> Brand Assets & Identity
            </div>
            {orgBrandLogo && (
              <Badge variant="outline" className="text-[10px] font-bold gap-1 text-muted-foreground">
                <Building2 className="w-3 h-3 text-primary" /> Auto-syncs with Org Setup
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Light Mode Logo */}
            <div className="space-y-2 p-3.5 rounded-xl border border-border bg-card/50">
              <div className="flex items-center justify-between">
                <Label htmlFor="brand-logo" className="text-xs font-bold">
                  Light Mode Logo
                </Label>
                {orgBrandLogo && (
                  <button
                    type="button"
                    onClick={() => handleResetToOrgLogo('logoUrl')}
                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Inherit Org Logo
                  </button>
                )}
              </div>

              {effectiveLightLogo ? (
                <div className="flex items-center gap-3 p-2 rounded-xl bg-muted/40 border border-border/80">
                  <div className="h-10 w-16 rounded-lg bg-white p-1 border border-border flex items-center justify-center overflow-hidden">
                    <img src={effectiveLightLogo} alt="Light Logo Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono text-muted-foreground truncate">{effectiveLightLogo}</p>
                    <span className="text-[10px] text-emerald-600 font-semibold">Active in Light Mode</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChangeBranding({ ...branding, logoUrl: '' })}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500 rounded-lg"
                    title="Remove custom logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Input
                  id="brand-logo"
                  placeholder="https://... or select from media"
                  value={branding.logoUrl || ''}
                  onChange={e => onChangeBranding({ ...branding, logoUrl: e.target.value })}
                  className="h-10 rounded-xl text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenMediaSelector('logoUrl')}
                  className="h-10 px-3 rounded-xl text-xs font-bold gap-1.5 shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-primary" /> Media
                </Button>
              </div>
            </div>

            {/* Dark Mode Logo */}
            <div className="space-y-2 p-3.5 rounded-xl border border-border bg-card/50">
              <div className="flex items-center justify-between">
                <Label htmlFor="brand-dark-logo" className="text-xs font-bold">
                  Dark Mode Logo
                </Label>
                {orgBrandLogo && (
                  <button
                    type="button"
                    onClick={() => handleResetToOrgLogo('darkLogoUrl')}
                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Inherit Org Logo
                  </button>
                )}
              </div>

              {effectiveDarkLogo ? (
                <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-950 border border-slate-800 text-white">
                  <div className="h-10 w-16 rounded-lg bg-slate-900 p-1 border border-slate-700 flex items-center justify-center overflow-hidden">
                    <img src={effectiveDarkLogo} alt="Dark Logo Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono text-slate-300 truncate">{effectiveDarkLogo}</p>
                    <span className="text-[10px] text-emerald-400 font-semibold">Active in Dark Mode</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChangeBranding({ ...branding, darkLogoUrl: '' })}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400 rounded-lg"
                    title="Remove custom dark logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Input
                  id="brand-dark-logo"
                  placeholder="https://... or select from media"
                  value={branding.darkLogoUrl || ''}
                  onChange={e => onChangeBranding({ ...branding, darkLogoUrl: e.target.value })}
                  className="h-10 rounded-xl text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenMediaSelector('darkLogoUrl')}
                  className="h-10 px-3 rounded-xl text-xs font-bold gap-1.5 shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-primary" /> Media
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Favicon URL */}
            <div className="space-y-1.5">
              <Label htmlFor="brand-favicon" className="text-xs font-bold">
                Favicon URL
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="brand-favicon"
                  placeholder="https://.../favicon.ico"
                  value={branding.faviconUrl || ''}
                  onChange={e => onChangeBranding({ ...branding, faviconUrl: e.target.value })}
                  className="h-10 rounded-xl text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenMediaSelector('faviconUrl')}
                  className="h-10 px-3 rounded-xl text-xs font-bold gap-1.5 shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-primary" /> Media
                </Button>
              </div>
            </div>

            {/* Copyright Statement */}
            <div className="space-y-1.5">
              <Label htmlFor="brand-copyright" className="text-xs font-bold">
                Copyright Text
              </Label>
              <Input
                id="brand-copyright"
                placeholder={`© ${new Date().getFullYear()} ${activeOrganization?.name || 'SmartSapp Academy'}. All rights reserved.`}
                value={branding.copyrightText || ''}
                onChange={e => onChangeBranding({ ...branding, copyrightText: e.target.value })}
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Color System Tokens ───────────────────────────────────────── */}
      <Card className="rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Paintbrush className="w-4 h-4" /> Color System Tokens
            </div>
            <Badge variant="outline" className="text-[10px] font-bold">
              CSS Variables
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          {/* Quick Palettes */}
          <div>
            <Label className="text-xs font-bold mb-2 block">Curated Palettes</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {PRESET_PALETTES.map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPalette(p)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-center"
                >
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.primary }} />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.accent }} />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.secondary }} />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground truncate w-full">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Individual Pickers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center justify-between">
                <span>Primary</span>
                <span className="text-[10px] font-mono text-muted-foreground">{theme.colors.primary}</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.colors.primary}
                  onChange={e => handleColorChange('primary', e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-background"
                />
                <Input
                  value={theme.colors.primary}
                  onChange={e => handleColorChange('primary', e.target.value)}
                  className="h-10 rounded-xl font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center justify-between">
                <span>Accent</span>
                <span className="text-[10px] font-mono text-muted-foreground">{theme.colors.accent}</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.colors.accent}
                  onChange={e => handleColorChange('accent', e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-background"
                />
                <Input
                  value={theme.colors.accent}
                  onChange={e => handleColorChange('accent', e.target.value)}
                  className="h-10 rounded-xl font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center justify-between">
                <span>Secondary</span>
                <span className="text-[10px] font-mono text-muted-foreground">{theme.colors.secondary}</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.colors.secondary}
                  onChange={e => handleColorChange('secondary', e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-background"
                />
                <Input
                  value={theme.colors.secondary}
                  onChange={e => handleColorChange('secondary', e.target.value)}
                  className="h-10 rounded-xl font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center justify-between">
                <span>Background</span>
                <span className="text-[10px] font-mono text-muted-foreground">{theme.colors.background}</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.colors.background}
                  onChange={e => handleColorChange('background', e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-background"
                />
                <Input
                  value={theme.colors.background}
                  onChange={e => handleColorChange('background', e.target.value)}
                  className="h-10 rounded-xl font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Typography & UI Shape ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-2 border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Type className="w-4 h-4" /> Typography
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Heading Font</Label>
              <Select
                value={theme.typography.headingFont}
                onValueChange={val =>
                  onChangeTheme({
                    ...theme,
                    typography: { ...theme.typography, headingFont: val },
                  })
                }
              >
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {FONT_OPTIONS.map(f => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Body Font</Label>
              <Select
                value={theme.typography.bodyFont}
                onValueChange={val =>
                  onChangeTheme({
                    ...theme,
                    typography: { ...theme.typography, bodyFont: val },
                  })
                }
              >
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {FONT_OPTIONS.map(f => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Layout className="w-4 h-4" /> UI Radius & Button Style
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Corner Radius</Label>
              <div className="grid grid-cols-5 gap-2">
                {(['none', 'sm', 'md', 'lg', 'full'] as const).map(radius => (
                  <button
                    key={radius}
                    type="button"
                    onClick={() =>
                      onChangeTheme({
                        ...theme,
                        ui: { ...theme.ui, borderRadius: radius },
                      })
                    }
                    className={`py-2 px-1 text-center text-xs font-bold border rounded-xl capitalize transition-all ${
                      theme.ui.borderRadius === radius
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                    }`}
                  >
                    {radius}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Button Style</Label>
              <div className="grid grid-cols-4 gap-2">
                {(['flat', 'glow', 'glass', 'pill'] as const).map(style => (
                  <button
                    key={style}
                    type="button"
                    onClick={() =>
                      onChangeTheme({
                        ...theme,
                        ui: { ...theme.ui, buttonStyle: style },
                      })
                    }
                    className={`py-2 px-1 text-center text-xs font-bold border rounded-xl capitalize transition-all ${
                      theme.ui.buttonStyle === style
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Unified Media Selector Dialog ──────────────────────────────── */}
      {isMediaSelectorOpen && (
        <MediaSelectorDialog
          open={isMediaSelectorOpen}
          onOpenChange={setIsMediaSelectorOpen}
          onSelectAsset={handleSelectMediaAsset}
          filterType="image"
          workspaceId={activeWorkspaceId}
          title={
            activeMediaTarget === 'faviconUrl'
              ? 'Select Brand Favicon (.ico / .png)'
              : activeMediaTarget === 'darkLogoUrl'
              ? 'Select Dark Mode Brand Logo'
              : 'Select Light Mode Brand Logo'
          }
          description="Choose a high-resolution institutional brand asset or upload a new logo file directly."
        />
      )}
    </div>
  );
}
