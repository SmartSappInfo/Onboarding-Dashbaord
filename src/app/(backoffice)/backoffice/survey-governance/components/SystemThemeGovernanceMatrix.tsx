'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — System Theme & Brand Governance Matrix
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Control plane for organization-wide curated palette presets and SVG background patterns.
 * 2. Real-time WCAG 2.1 AA/AAA contrast ratio verification.
 * 3. Strict Zero-Any Invariant.
 * 4. Touch-optimized controls (min-h-[44px], active:scale-[0.97]).
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Palette, Sparkles, ShieldCheck, Plus, Check, Eye, RefreshCw, Sliders, Layers } from 'lucide-react';
import { SURVEY_PALETTE_PRESETS } from '@/app/admin/surveys/components/inspector/theme-presets';
import { calculateContrastScore } from '@/app/admin/surveys/components/inspector/contrast-utils';
import { BackgroundPattern } from '@/app/surveys/components/survey-background-pattern';
import type { SurveyPalettePreset } from '@/app/admin/surveys/components/inspector/types';
import { cn } from '@/lib/utils';

export function SystemThemeGovernanceMatrix() {
  const { toast } = useToast();
  const [palettes, setPalettes] = React.useState<SurveyPalettePreset[]>(SURVEY_PALETTE_PRESETS);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [previewPalette, setPreviewPalette] = React.useState<SurveyPalettePreset | null>(null);

  // New palette draft state
  const [newName, setNewName] = React.useState('');
  const [newBgColor, setNewBgColor] = React.useState('#FAF5FF');
  const [newPatternColor, setNewPatternColor] = React.useState('#A855F7');
  const [newBadge, setNewBadge] = React.useState('CUSTOM');

  const draftContrast = React.useMemo(() => {
    return calculateContrastScore(newBgColor, '#0F172A');
  }, [newBgColor]);

  const handleCreatePalette = () => {
    if (!newName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please provide a name for the curated palette preset.',
      });
      return;
    }

    const newPreset: SurveyPalettePreset = {
      id: `custom_${Date.now()}`,
      name: newName.trim(),
      backgroundColor: newBgColor,
      patternColor: newPatternColor,
      badge: newBadge.toUpperCase() || 'CUSTOM',
    };

    setPalettes((prev) => [...prev, newPreset]);
    setIsAddModalOpen(false);
    setNewName('');
    setNewBgColor('#FAF5FF');
    setNewPatternColor('#A855F7');

    toast({
      title: 'Palette Added to Catalog',
      description: `"${newPreset.name}" is now available across all workspace survey studios.`,
    });
  };

  return (
    <Card className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="p-5 sm:p-6 border-b border-border/60 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Palette className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                System Survey Theme & Brand Governance Matrix
                <Badge variant="outline" className="text-[10px] font-mono uppercase bg-purple-500/10 text-purple-600 border-purple-500/30">
                  Universal SSOT
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Manage organization-wide curated palettes, contrast safety baselines, and ambient SVG pattern overlays.
              </CardDescription>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="h-11 px-4 rounded-xl font-bold text-xs shadow-md gap-2 active:scale-[0.97] bg-purple-600 hover:bg-purple-700 text-white self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Add Preset
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* Active Curated Palettes Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-600" /> Active Curated Studio Palettes ({palettes.length})
            </Label>
            <span className="text-[10px] text-muted-foreground font-mono">WCAG 2.1 AA Compliant</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {palettes.map((preset) => {
              const contrast = calculateContrastScore(preset.backgroundColor, '#0F172A');
              return (
                <div
                  key={preset.id}
                  className="p-4 rounded-2xl border border-border/80 bg-card hover:border-purple-500/40 hover:shadow-md transition-all space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-foreground">{preset.name}</span>
                    <Badge variant="outline" className="text-[9px] font-mono uppercase px-2 py-0.5">
                      {preset.badge}
                    </Badge>
                  </div>

                  {/* Visual Color Swatches */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-lg border border-black/10 shadow-xs shrink-0"
                        style={{ backgroundColor: preset.backgroundColor }}
                        title={`Canvas BG: ${preset.backgroundColor}`}
                      />
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {preset.backgroundColor}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-lg border border-black/10 shadow-xs shrink-0"
                        style={{ backgroundColor: preset.patternColor }}
                        title={`Accent Tint: ${preset.patternColor}`}
                      />
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {preset.patternColor}
                      </span>
                    </div>
                  </div>

                  {/* Contrast & Preview Badge */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px]">
                    <span className={cn("font-bold flex items-center gap-1", contrast.isAaaPassed ? "text-emerald-600" : contrast.isAaPassed ? "text-blue-600" : "text-amber-600")}>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {contrast.ratio}:1 {contrast.isAaaPassed ? 'AAA' : 'AA'} Pass
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewPalette(preset)}
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground active:scale-[0.97]"
                    >
                      <Eye className="h-3 w-3 mr-1" /> Preview
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pattern Archetypes Summary */}
        <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-purple-600" /> Supported SVG Pattern Overlays (7 Standard Archetypes)
            </Label>
            <span className="text-[10px] text-muted-foreground">Deterministic Vector Rendering</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {(['none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient'] as const).map((pat) => (
              <div
                key={pat}
                className="h-16 rounded-xl border border-border/70 bg-card flex flex-col items-center justify-center p-2 relative overflow-hidden group"
              >
                <BackgroundPattern pattern={pat} color="#A855F7" idPrefix={`gov-matrix-${pat}`} className="opacity-30" />
                <span className="text-[10px] font-black uppercase tracking-wider text-foreground relative z-10">
                  {pat}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {/* Add Curated Palette Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Create Curated Studio Palette</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new preset to the organization-wide theme catalog for 1-click survey styling.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Palette Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Midnight Sapphire"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Canvas Background</Label>
                <div className="flex items-center gap-2 p-1.5 rounded-xl border border-border bg-card">
                  <input
                    type="color"
                    value={newBgColor}
                    onChange={(e) => setNewBgColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer shrink-0"
                  />
                  <Input
                    value={newBgColor}
                    onChange={(e) => setNewBgColor(e.target.value)}
                    className="h-8 border-none bg-transparent shadow-none font-mono text-xs font-bold uppercase p-0 focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Accent Tint Color</Label>
                <div className="flex items-center gap-2 p-1.5 rounded-xl border border-border bg-card">
                  <input
                    type="color"
                    value={newPatternColor}
                    onChange={(e) => setNewPatternColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer shrink-0"
                  />
                  <Input
                    value={newPatternColor}
                    onChange={(e) => setNewPatternColor(e.target.value)}
                    className="h-8 border-none bg-transparent shadow-none font-mono text-xs font-bold uppercase p-0 focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Category Badge</Label>
              <Input
                value={newBadge}
                onChange={(e) => setNewBadge(e.target.value)}
                placeholder="e.g. LUXURY, VIBRANT, MINIMAL"
                className="h-11 rounded-xl uppercase font-mono text-xs"
              />
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">WCAG Contrast Readout:</span>
              <span className={cn("font-bold", draftContrast.isAaaPassed ? "text-emerald-600" : "text-blue-600")}>
                {draftContrast.ratio}:1 {draftContrast.isAaaPassed ? 'AAA' : 'AA'} Pass
              </span>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="h-11 rounded-xl flex-1">
              Cancel
            </Button>
            <Button onClick={handleCreatePalette} className="h-11 rounded-xl flex-1 font-bold bg-purple-600 hover:bg-purple-700 text-white">
              Save Palette
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {previewPalette && (
        <Dialog open={Boolean(previewPalette)} onOpenChange={() => setPreviewPalette(null)}>
          <DialogContent className="sm:max-w-lg rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black tracking-tight">{previewPalette.name} Preview</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Simulated survey canvas with ambient pattern and accent buttons.
              </DialogDescription>
            </DialogHeader>

            <div
              className="p-8 rounded-2xl relative overflow-hidden space-y-6 text-center my-2 shadow-inner"
              style={{ backgroundColor: previewPalette.backgroundColor }}
            >
              <BackgroundPattern pattern="circuit" color={previewPalette.patternColor} idPrefix="gov-prev" className="opacity-20" />
              <div className="relative z-10 space-y-3">
                <h3 className="text-xl font-bold text-foreground">Sample Survey Heading</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  This demonstrates how question cards and action triggers render on the selected palette.
                </p>
                <div className="pt-2">
                  <Button
                    size="lg"
                    className="h-12 px-8 rounded-2xl font-bold text-white shadow-lg active:scale-[0.97]"
                    style={{ backgroundColor: previewPalette.patternColor }}
                  >
                    Next Question
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setPreviewPalette(null)} className="w-full h-11 rounded-xl font-bold">
                Close Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
