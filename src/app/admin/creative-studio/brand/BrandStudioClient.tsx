'use client';

/**
 * ARCHITECTURE:
 * Brand Studio Client (Creative Studio 2.0 - Phase 1)
 * 
 * Provides cloud-persisted brand governance for colors, typography suites,
 * logo assets, and AI design rules.
 * 
 * CAUTION:
 * Mobile responsive layout with min-h-[44px] touch targets.
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getWorkspaceBrandKitAction, saveWorkspaceBrandKitAction } from '@/app/actions/brand-kit-actions';
import type { BrandKit, BrandAIRule } from '@/lib/creative/creative-types';
import { THUMBNAIL_FONT_OPTIONS, makeUniqueId } from '@/lib/creative/creative-types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, Type, Image as ImageIcon, Shield, Plus, Trash2, Save, Loader2 } from 'lucide-react';

export function BrandStudioClient() {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [newRuleText, setNewRuleText] = useState('');
  const newRuleSeverity: 'required' | 'recommended' | 'optional' = 'required';

  useEffect(() => {
    let active = true;
    async function loadBrandKit() {
      if (!activeWorkspaceId) return;
      setIsLoading(true);
      const res = await getWorkspaceBrandKitAction(activeWorkspaceId);
      if (active && res.success && res.data) {
        setBrandKit(res.data);
      }
      setIsLoading(false);
    }
    loadBrandKit();
    return () => {
      active = false;
    };
  }, [activeWorkspaceId]);

  const handleSave = async () => {
    if (!activeWorkspaceId || !brandKit) return;
    setIsSaving(true);

    const res = await saveWorkspaceBrandKitAction(activeWorkspaceId, brandKit);
    setIsSaving(false);

    if (res.success && res.data) {
      setBrandKit(res.data);
      toast({ title: 'Brand Kit Saved', description: 'Workspace brand assets are synchronized in the cloud.' });
    } else {
      toast({ title: 'Save Failed', description: res.error || 'Could not save brand kit.', variant: 'destructive' });
    }
  };

  const handleColorChange = (category: 'primary' | 'secondary' | 'accent', index: number, value: string) => {
    if (!brandKit) return;
    const newColors = [...brandKit.colors[category]];
    newColors[index] = value;
    setBrandKit({
      ...brandKit,
      colors: {
        ...brandKit.colors,
        [category]: newColors,
      },
    });
  };

  const handleAddRule = () => {
    if (!brandKit || !newRuleText.trim()) return;
    const newRule: BrandAIRule = {
      id: makeUniqueId(),
      type: 'tone',
      rule: newRuleText.trim(),
      severity: newRuleSeverity,
      active: true,
    };
    setBrandKit({
      ...brandKit,
      aiRules: [...(brandKit.aiRules || []), newRule],
    });
    setNewRuleText('');
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!brandKit) return;
    setBrandKit({
      ...brandKit,
      aiRules: (brandKit.aiRules || []).filter((r) => r.id !== ruleId),
    });
  };

  if (isLoading || !brandKit) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center space-y-4 bg-slate-950 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <div className="text-sm font-bold">Loading Brand Studio Assets...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
            <Palette className="w-3.5 h-3.5" /> Workspace Brand Governance
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Brand Studio</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1">
            Configure official brand colors, typography pairings, and AI design rules for your team.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-slate-950 font-black rounded-xl text-xs h-10 px-5 shadow-lg shadow-emerald-500/20 transition-all min-h-[44px]"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
          Save Brand Kit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Color Palette Card */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-6 shadow-xl">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Color Palettes</h2>
              <p className="text-[11px] text-slate-400 font-medium">Primary, secondary, and accent swatches</p>
            </div>
          </div>

          {/* Primary Swatches */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-300">Primary Colors (Canvas & Backgrounds)</Label>
            <div className="grid grid-cols-3 gap-2">
              {brandKit.colors.primary.map((color, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange('primary', idx, e.target.value)}
                    className="w-7 h-7 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => handleColorChange('primary', idx, e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-transparent text-white focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Accent Swatches */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-300">Accent Colors (Badges & Outlines)</Label>
            <div className="grid grid-cols-3 gap-2">
              {brandKit.colors.accent.map((color, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange('accent', idx, e.target.value)}
                    className="w-7 h-7 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => handleColorChange('accent', idx, e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-transparent text-white focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Typography Card */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-6 shadow-xl">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Type className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Typography Suite</h2>
              <p className="text-[11px] text-slate-400 font-medium">Standardized font pairings for your designs</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Display Headline Font</Label>
              <Select
                value={brandKit.typography.displayFont}
                onValueChange={(val) =>
                  setBrandKit({
                    ...brandKit,
                    typography: { ...brandKit.typography, displayFont: val },
                  })
                }
              >
                <SelectTrigger className="h-10 bg-slate-950 border-slate-800 text-xs font-bold text-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  {THUMBNAIL_FONT_OPTIONS.map((f: string) => (
                    <SelectItem key={f} value={f} className="text-xs font-bold">
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Heading & Subtitle Font</Label>
              <Select
                value={brandKit.typography.headingFont}
                onValueChange={(val) =>
                  setBrandKit({
                    ...brandKit,
                    typography: { ...brandKit.typography, headingFont: val },
                  })
                }
              >
                <SelectTrigger className="h-10 bg-slate-950 border-slate-800 text-xs font-bold text-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  {THUMBNAIL_FONT_OPTIONS.map((f: string) => (
                    <SelectItem key={f} value={f} className="text-xs font-bold">
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Watermark Logo URL */}
          <div className="space-y-1.5 pt-2 border-t border-slate-850">
            <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" /> Default Watermark Logo URL
            </Label>
            <Input
              value={brandKit.watermarkUrl || ''}
              onChange={(e) => setBrandKit({ ...brandKit, watermarkUrl: e.target.value })}
              placeholder="https://storage.googleapis.com/.../logo.png"
              className="h-10 bg-slate-950 border-slate-800 text-xs font-semibold text-white rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* AI Brand Rules */}
      <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-5 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">AI Brand Rules</h2>
            <p className="text-[11px] text-slate-400 font-medium">Rules enforced by the AI Creative Director</p>
          </div>
        </div>

        {/* Existing Rules */}
        <div className="space-y-2">
          {(brandKit.aiRules || []).map((rule) => (
            <div
              key={rule.id}
              className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-0.5 flex-1">
                <span className="font-semibold text-slate-200">{rule.rule}</span>
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Severity: {rule.severity}
                </div>
              </div>
              <button
                onClick={() => handleDeleteRule(rule.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add New Rule */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Input
            value={newRuleText}
            onChange={(e) => setNewRuleText(e.target.value)}
            placeholder="Add new AI governance rule (e.g. Always include CTA badge)..."
            className="h-10 bg-slate-950 border-slate-800 text-xs text-white rounded-xl flex-1"
          />
          <Button
            onClick={handleAddRule}
            disabled={!newRuleText.trim()}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs h-10 px-4 rounded-xl min-h-[40px] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Rule
          </Button>
        </div>
      </div>
    </div>
  );
}
