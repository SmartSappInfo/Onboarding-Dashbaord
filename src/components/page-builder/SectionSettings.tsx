'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal, Layout, Image as ImageIcon, ShieldAlert, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PageSection } from '@/lib/types';

interface SectionSettingsProps {
  section: PageSection;
  onUpdate: (patch: Record<string, unknown>) => void;
}

export function SectionSettings({ section, onUpdate }: SectionSettingsProps) {
  const props = (section.props || {}) as {
    backgroundType?: string;
    backgroundColor?: string;
    backgroundImageUrl?: string;
    backgroundVideoUrl?: string;
    backgroundSize?: string;
    backgroundPosition?: string;
    backgroundRepeat?: string;
    backgroundAttachment?: string;
    gradientFrom?: string;
    gradientTo?: string;
    gradientAngle?: number;
    overlayColor?: string;
    overlayOpacity?: number;
    paddingTop?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    paddingRight?: string;
    minHeight?: string;
    layout?: string;
    columnGap?: string;
    verticalAlign?: string;
    visibilityDevice?: string;
    visibilityBehavior?: string;
    visibilityTag?: string;
  };

  // Resolve presets for padding/spacing
  const getSpacingPreset = (val: string | undefined): string => {
    if (!val) return 'none';
    if (val === '0') return 'none';
    if (val === '2rem') return 'small';
    if (val === '4rem') return 'medium';
    if (val === '6rem') return 'large';
    if (val === '8rem') return 'xl';
    return 'custom';
  };

  const getSpacingValueFromPreset = (preset: string): string => {
    switch (preset) {
      case 'none': return '0';
      case 'small': return '2rem';
      case 'medium': return '4rem';
      case 'large': return '6rem';
      case 'xl': return '8rem';
      default: return '4rem';
    }
  };

  // Resolve presets for minHeight
  const getHeightPreset = (val: string | undefined): string => {
    if (!val || val === 'auto') return 'auto';
    if (val === '300px') return 'small';
    if (val === '500px') return 'medium';
    if (val === '700px') return 'large';
    if (val === '100vh') return 'screen';
    return 'custom';
  };

  const getHeightValueFromPreset = (preset: string): string => {
    switch (preset) {
      case 'auto': return 'auto';
      case 'small': return '300px';
      case 'medium': return '500px';
      case 'large': return '700px';
      case 'screen': return '100vh';
      default: return 'auto';
    }
  };

  const layout = props.layout || '1-col';
  const backgroundType = props.backgroundType || 'none';
  const verticalAlign = props.verticalAlign || 'top';
  const columnGap = props.columnGap || 'medium';
  const visibilityDevice = props.visibilityDevice || 'all';
  const visibilityBehavior = props.visibilityBehavior || 'all';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Section Settings</h4>
      </div>

      <Tabs defaultValue="layout" className="w-full">
        <TabsList className="grid grid-cols-4 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <TabsTrigger value="layout" className="text-[10px] py-1 rounded-md font-bold uppercase tracking-wider data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
            <Layout className="w-3.5 h-3.5 mr-1" /> Layout
          </TabsTrigger>
          <TabsTrigger value="bg" className="text-[10px] py-1 rounded-md font-bold uppercase tracking-wider data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
            <ImageIcon className="w-3.5 h-3.5 mr-1" /> Media
          </TabsTrigger>
          <TabsTrigger value="spacing" className="text-[10px] py-1 rounded-md font-bold uppercase tracking-wider data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Space
          </TabsTrigger>
          <TabsTrigger value="visibility" className="text-[10px] py-1 rounded-md font-bold uppercase tracking-wider data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
            <Eye className="w-3.5 h-3.5 mr-1" /> View
          </TabsTrigger>
        </TabsList>

        {/* ─── LAYOUT TAB ─── */}
        <TabsContent value="layout" className="space-y-4 pt-4 outline-none">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Column Layout</Label>
            <Select value={layout} onValueChange={(val) => onUpdate({ layout: val })}>
              <SelectTrigger className="bg-slate-900 border border-slate-700 text-slate-200">
                <SelectValue placeholder="Select Columns" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border border-slate-700 text-slate-200">
                <SelectItem value="1-col">1 Column (Full Width)</SelectItem>
                <SelectItem value="2-col">2 Columns (50 / 50)</SelectItem>
                <SelectItem value="3-col">3 Columns (33 / 33 / 33)</SelectItem>
                <SelectItem value="4-col">4 Columns (25 / 25 / 25 / 25)</SelectItem>
                <SelectItem value="grid">Grid (Responsive Flex)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Vertical Alignment</Label>
            <Select value={verticalAlign} onValueChange={(val) => onUpdate({ verticalAlign: val })}>
              <SelectTrigger className="bg-slate-900 border border-slate-700 text-slate-200">
                <SelectValue placeholder="Alignment" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border border-slate-700 text-slate-200">
                <SelectItem value="top">Top Align</SelectItem>
                <SelectItem value="center">Center Align</SelectItem>
                <SelectItem value="bottom">Bottom Align</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Column Gap Size</Label>
            <Select value={columnGap} onValueChange={(val) => onUpdate({ columnGap: val })}>
              <SelectTrigger className="bg-slate-900 border border-slate-700 text-slate-200">
                <SelectValue placeholder="Gap" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border border-slate-700 text-slate-200">
                <SelectItem value="small">Small (16px)</SelectItem>
                <SelectItem value="medium">Medium (32px)</SelectItem>
                <SelectItem value="large">Large (48px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* ─── MEDIA/BACKGROUND TAB ─── */}
        <TabsContent value="bg" className="space-y-4 pt-4 outline-none">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Background Type</Label>
            <Select value={backgroundType} onValueChange={(val) => onUpdate({ backgroundType: val })}>
              <SelectTrigger className="bg-slate-900 border border-slate-700 text-slate-200">
                <SelectValue placeholder="Background Type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border border-slate-700 text-slate-200">
                <SelectItem value="none">Transparent / Clean</SelectItem>
                <SelectItem value="color">Solid Color</SelectItem>
                <SelectItem value="image">Background Image</SelectItem>
                <SelectItem value="video">Autoplay Video</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {backgroundType === 'color' && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Select Color</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="color"
                  value={props.backgroundColor || '#ffffff'}
                  onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                  className="w-10 h-10 p-0 border border-slate-700 rounded-md cursor-pointer bg-slate-900"
                />
                <Input
                  type="text"
                  value={props.backgroundColor || '#ffffff'}
                  onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                  placeholder="#ffffff"
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono h-10"
                />
              </div>
            </div>
          )}

          {backgroundType === 'image' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Image Address (URL)</Label>
                <Input
                  type="url"
                  value={props.backgroundImageUrl || ''}
                  onChange={(e) => onUpdate({ backgroundImageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs h-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold text-slate-600 uppercase">Size</Label>
                  <Select value={props.backgroundSize || 'cover'} onValueChange={(val) => onUpdate({ backgroundSize: val })}>
                    <SelectTrigger className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px]">
                      <SelectItem value="cover">Cover (Fill)</SelectItem>
                      <SelectItem value="contain">Contain (Fit)</SelectItem>
                      <SelectItem value="auto">Auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold text-slate-600 uppercase">Alignment</Label>
                  <Select value={props.backgroundPosition || 'center'} onValueChange={(val) => onUpdate({ backgroundPosition: val })}>
                    <SelectTrigger className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px]">
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {backgroundType === 'video' && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Video URL (.mp4 or .webm link)</Label>
              <Input
                type="url"
                value={props.backgroundVideoUrl || ''}
                onChange={(e) => onUpdate({ backgroundVideoUrl: e.target.value })}
                placeholder="https://example.com/video.mp4"
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs h-10"
              />
            </div>
          )}

          {(backgroundType === 'image' || backgroundType === 'video') && (
            <div className="space-y-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Add Color Overlay</Label>
                <div className="w-8 h-8 rounded border border-slate-700 overflow-hidden relative">
                  <Input
                    type="color"
                    value={props.overlayColor || '#000000'}
                    onChange={(e) => onUpdate({ overlayColor: e.target.value })}
                    className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Overlay Opacity</span>
                  <span>{props.overlayOpacity !== undefined ? Math.round(props.overlayOpacity * 100) : 0}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[props.overlayOpacity !== undefined ? Math.round(props.overlayOpacity * 100) : 0]}
                  onValueChange={(val) => onUpdate({ overlayOpacity: val[0] / 100 })}
                  className="py-2"
                />
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── SPACING TAB ─── */}
        <TabsContent value="spacing" className="space-y-4 pt-4 outline-none">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Padding Top</Label>
              <Select
                value={getSpacingPreset(props.paddingTop)}
                onValueChange={(val) => onUpdate({ paddingTop: getSpacingValueFromPreset(val) })}
              >
                <SelectTrigger className="bg-slate-900 border border-slate-700 text-slate-200 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border border-slate-700 text-slate-200">
                  <SelectItem value="none">None (0)</SelectItem>
                  <SelectItem value="small">Small (32px)</SelectItem>
                  <SelectItem value="medium">Medium (64px)</SelectItem>
                  <SelectItem value="large">Large (96px)</SelectItem>
                  <SelectItem value="xl">Extra Large (128px)</SelectItem>
                  <SelectItem value="custom">Custom CSS</SelectItem>
                </SelectContent>
              </Select>
              {getSpacingPreset(props.paddingTop) === 'custom' && (
                <Input
                  type="text"
                  value={props.paddingTop || ''}
                  onChange={(e) => onUpdate({ paddingTop: e.target.value })}
                  placeholder="e.g. 5rem"
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs h-9 mt-1.5"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Padding Bottom</Label>
              <Select
                value={getSpacingPreset(props.paddingBottom)}
                onValueChange={(val) => onUpdate({ paddingBottom: getSpacingValueFromPreset(val) })}
              >
                <SelectTrigger className="bg-slate-900 border border-slate-700 text-slate-200 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border border-slate-700 text-slate-200">
                  <SelectItem value="none">None (0)</SelectItem>
                  <SelectItem value="small">Small (32px)</SelectItem>
                  <SelectItem value="medium">Medium (64px)</SelectItem>
                  <SelectItem value="large">Large (96px)</SelectItem>
                  <SelectItem value="xl">Extra Large (128px)</SelectItem>
                  <SelectItem value="custom">Custom CSS</SelectItem>
                </SelectContent>
              </Select>
              {getSpacingPreset(props.paddingBottom) === 'custom' && (
                <Input
                  type="text"
                  value={props.paddingBottom || ''}
                  onChange={(e) => onUpdate({ paddingBottom: e.target.value })}
                  placeholder="e.g. 5rem"
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs h-9 mt-1.5"
                />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Section Min Height</Label>
            <Select
              value={getHeightPreset(props.minHeight)}
              onValueChange={(val) => onUpdate({ minHeight: getHeightValueFromPreset(val) })}
            >
              <SelectTrigger className="bg-slate-900 border border-slate-700 text-slate-200 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border border-slate-700 text-slate-200">
                <SelectItem value="auto">Auto-Fit (Default)</SelectItem>
                <SelectItem value="small">300px</SelectItem>
                <SelectItem value="medium">500px</SelectItem>
                <SelectItem value="large">700px</SelectItem>
                <SelectItem value="screen">100% Screen Height (100vh)</SelectItem>
                <SelectItem value="custom">Custom Height</SelectItem>
              </SelectContent>
            </Select>
            {getHeightPreset(props.minHeight) === 'custom' && (
              <Input
                type="text"
                value={props.minHeight || ''}
                onChange={(e) => onUpdate({ minHeight: e.target.value })}
                placeholder="e.g. 450px"
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs h-9 mt-1.5"
              />
            )}
          </div>
        </TabsContent>

        {/* ─── VISIBILITY TAB ─── */}
        <TabsContent value="visibility" className="space-y-4 pt-4 outline-none">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Device Viewport visibility</Label>
            <Select value={visibilityDevice} onValueChange={(val) => onUpdate({ visibilityDevice: val })}>
              <SelectTrigger className="bg-slate-900 border border-slate-700 text-slate-200 h-10">
                <SelectValue placeholder="Devices" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border border-slate-700 text-slate-200">
                <SelectItem value="all">Show on all devices</SelectItem>
                <SelectItem value="desktop">Desktop and tablet only</SelectItem>
                <SelectItem value="mobile">Mobile viewport only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Behavioral rules (Kartra)</Label>
            </div>
            <Select value={visibilityBehavior} onValueChange={(val) => onUpdate({ visibilityBehavior: val })}>
              <SelectTrigger className="bg-slate-900 border border-slate-700 text-slate-200 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border border-slate-700 text-slate-200">
                <SelectItem value="all">Show to all visitors</SelectItem>
                <SelectItem value="has_tag">Show only if visitor has Tag</SelectItem>
                <SelectItem value="no_tag">Hide if visitor has Tag</SelectItem>
              </SelectContent>
            </Select>

            {visibilityBehavior !== 'all' && (
              <div className="space-y-1.5 pt-1.5 animate-in fade-in duration-200">
                <Label className="text-[9px] font-bold text-slate-600 uppercase">Tag Identifier (Name / ID)</Label>
                <Input
                  type="text"
                  value={props.visibilityTag || ''}
                  onChange={(e) => onUpdate({ visibilityTag: e.target.value })}
                  placeholder="Enter Tag name, e.g. vip_member"
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs h-10"
                />
                <p className="text-[9px] text-slate-500 italic mt-1 leading-normal">
                  Matches contact database profiles identified by cookie tracking.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
