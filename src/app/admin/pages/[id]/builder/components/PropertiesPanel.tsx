'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AutoBlockEditor } from '@/components/page-builder/AutoBlockEditor';
import type { PageBlock, BuilderResources, ResolvedTheme } from '@/lib/types';
import { Settings, Type, Layout, Activity, ShieldAlert } from 'lucide-react';

interface PropertiesPanelProps {
  readonly block: PageBlock;
  readonly resources: BuilderResources;
  readonly theme: ResolvedTheme;
  readonly workspaceId?: string;
  readonly onUpdate: (props: Record<string, unknown>) => void;
}

const TAB_TRIGGER_CLASS = 'text-[10px] py-1 rounded-md font-bold uppercase tracking-wider data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400';
const INPUT_CLASS = 'h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50';

export const PropertiesPanel = React.memo(function PropertiesPanel({
  block,
  resources,
  theme,
  workspaceId,
  onUpdate,
}: PropertiesPanelProps) {
  const props = block.props;

  // Spacing values helpers
  const handleSpacingChange = (key: string, value: string) => {
    onUpdate({ [key]: value });
  };

  // Typography values helpers
  const handleTypographyChange = (key: string, value: unknown) => {
    onUpdate({ [key]: value });
  };

  // Animation helpers
  const animation = (props.animation as Record<string, unknown> | undefined) || {};
  const handleAnimationChange = (key: string, value: unknown) => {
    const updatedAnim = { ...animation, [key]: value };
    onUpdate({ animation: updatedAnim });
  };

  // Check if typography is relevant (i.e. has title/subtitle/quote/content/heading fields)
  const hasText = ['hero', 'text', 'cta', 'testimonial', 'stats', 'faq', 'video_hero', 'testimonial_grid', 'choice_cards', 'app_download', 'step_section', 'countdown'].includes(block.type);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="grid grid-cols-5 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <TabsTrigger value="properties" className={TAB_TRIGGER_CLASS} title="Properties">
            <Settings className="w-3.5 h-3.5" />
          </TabsTrigger>
          <TabsTrigger value="typography" disabled={!hasText} className={TAB_TRIGGER_CLASS} title="Typography">
            <Type className="w-3.5 h-3.5" />
          </TabsTrigger>
          <TabsTrigger value="spacing" className={TAB_TRIGGER_CLASS} title="Spacing">
            <Layout className="w-3.5 h-3.5" />
          </TabsTrigger>
          <TabsTrigger value="animation" className={TAB_TRIGGER_CLASS} title="Animation">
            <Activity className="w-3.5 h-3.5" />
          </TabsTrigger>
          <TabsTrigger value="advanced" className={TAB_TRIGGER_CLASS} title="Advanced">
            <ShieldAlert className="w-3.5 h-3.5" />
          </TabsTrigger>
        </TabsList>

        {/* ─── PROPERTIES TAB ─── */}
        <TabsContent value="properties" className="space-y-4 pt-4">
          <AutoBlockEditor
            block={block}
            resources={resources}
            workspaceId={workspaceId}
            onUpdateProps={(_id, patch) => onUpdate(patch)}
          />
        </TabsContent>

        {/* ─── TYPOGRAPHY TAB ─── */}
        <TabsContent value="typography" className="space-y-4 pt-4 text-left">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Font Family</Label>
            <Select
              value={(props.fontFamily as string) || 'heading'}
              onValueChange={(v) => handleTypographyChange('fontFamily', v)}
            >
              <SelectTrigger className={INPUT_CLASS}>
                <SelectValue placeholder="Heading theme font" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                <SelectItem value="heading">Theme Heading Font</SelectItem>
                <SelectItem value="body">Theme Body Font</SelectItem>
                <SelectItem value="sans">System Sans-Serif</SelectItem>
                <SelectItem value="serif">System Serif</SelectItem>
                <SelectItem value="mono">System Monospace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Font Size Override</Label>
            <Select
              value={(props.fontSizeOverride as string) || 'default'}
              onValueChange={(v) => handleTypographyChange('fontSizeOverride', v)}
            >
              <SelectTrigger className={INPUT_CLASS}>
                <SelectValue placeholder="Default block size" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                <SelectItem value="default">Default size</SelectItem>
                <SelectItem value="text-xs">XS (12px)</SelectItem>
                <SelectItem value="text-sm">SM (14px)</SelectItem>
                <SelectItem value="text-base">Base (16px)</SelectItem>
                <SelectItem value="text-lg">LG (18px)</SelectItem>
                <SelectItem value="text-xl">XL (20px)</SelectItem>
                <SelectItem value="text-2xl">2XL (24px)</SelectItem>
                <SelectItem value="text-3xl">3XL (30px)</SelectItem>
                <SelectItem value="text-4xl">4XL (36px)</SelectItem>
                <SelectItem value="text-5xl">5XL (48px)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Font Weight</Label>
            <Select
              value={(props.fontWeight as string) || 'font-normal'}
              onValueChange={(v) => handleTypographyChange('fontWeight', v)}
            >
              <SelectTrigger className={INPUT_CLASS}>
                <SelectValue placeholder="Normal weight" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                <SelectItem value="font-light">Light (300)</SelectItem>
                <SelectItem value="font-normal">Regular (400)</SelectItem>
                <SelectItem value="font-medium">Medium (500)</SelectItem>
                <SelectItem value="font-semibold">Semibold (600)</SelectItem>
                <SelectItem value="font-bold">Bold (700)</SelectItem>
                <SelectItem value="font-black">Black (900)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Text Gradient</Label>
            <Switch
              checked={!!props.gradientText}
              onCheckedChange={(c) => handleTypographyChange('gradientText', c)}
            />
          </div>

          {props.gradientText ? (
            <div className="grid grid-cols-2 gap-2 pt-1 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-black text-slate-500">From Color</Label>
                <div className="flex gap-1.5 items-center">
                  <Input
                    type="color"
                    className="w-10 h-10 p-0 border border-slate-700 rounded bg-slate-900 cursor-pointer"
                    value={(props.gradientFrom as string) || '#3B5FFF'}
                    onChange={(e) => handleTypographyChange('gradientFrom', e.target.value)}
                  />
                  <Input
                    className="h-10 text-[10px] bg-slate-800 border-slate-700 text-slate-300 font-bold"
                    value={(props.gradientFrom as string) || '#3B5FFF'}
                    onChange={(e) => handleTypographyChange('gradientFrom', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-black text-slate-500">To Color</Label>
                <div className="flex gap-1.5 items-center">
                  <Input
                    type="color"
                    className="w-10 h-10 p-0 border border-slate-700 rounded bg-slate-900 cursor-pointer"
                    value={(props.gradientTo as string) || '#7C3AED'}
                    onChange={(e) => handleTypographyChange('gradientTo', e.target.value)}
                  />
                  <Input
                    className="h-10 text-[10px] bg-slate-800 border-slate-700 text-slate-300 font-bold"
                    value={(props.gradientTo as string) || '#7C3AED'}
                    onChange={(e) => handleTypographyChange('gradientTo', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* ─── SPACING TAB ─── */}
        <TabsContent value="spacing" className="space-y-4 pt-4 text-left">
          <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/50 flex flex-col gap-4">
            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Block Padding</h5>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-black text-slate-500">Top Padding</Label>
                <Input
                  className={INPUT_CLASS}
                  placeholder="e.g. 1.5rem"
                  value={(props.paddingTop as string) || ''}
                  onChange={(e) => handleSpacingChange('paddingTop', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-black text-slate-500">Bottom Padding</Label>
                <Input
                  className={INPUT_CLASS}
                  placeholder="e.g. 1.5rem"
                  value={(props.paddingBottom as string) || ''}
                  onChange={(e) => handleSpacingChange('paddingBottom', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-black text-slate-500">Left Padding</Label>
                <Input
                  className={INPUT_CLASS}
                  placeholder="e.g. 1rem"
                  value={(props.paddingLeft as string) || ''}
                  onChange={(e) => handleSpacingChange('paddingLeft', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-black text-slate-500">Right Padding</Label>
                <Input
                  className={INPUT_CLASS}
                  placeholder="e.g. 1rem"
                  value={(props.paddingRight as string) || ''}
                  onChange={(e) => handleSpacingChange('paddingRight', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/50 flex flex-col gap-4">
            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Block Margin</h5>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-black text-slate-500">Top Margin</Label>
                <Input
                  className={INPUT_CLASS}
                  placeholder="e.g. 0.5rem"
                  value={(props.marginTop as string) || ''}
                  onChange={(e) => handleSpacingChange('marginTop', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-black text-slate-500">Bottom Margin</Label>
                <Input
                  className={INPUT_CLASS}
                  placeholder="e.g. 0.5rem"
                  value={(props.marginBottom as string) || ''}
                  onChange={(e) => handleSpacingChange('marginBottom', e.target.value)}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── ANIMATION TAB ─── */}
        <TabsContent value="animation" className="space-y-4 pt-4 text-left">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Entrance Animation</Label>
            <Select
              value={(animation.type as string) || 'none'}
              onValueChange={(v) => handleAnimationChange('type', v)}
            >
              <SelectTrigger className={INPUT_CLASS}>
                <SelectValue placeholder="Select motion effect" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                <SelectItem value="none">None (Immediate render)</SelectItem>
                <SelectItem value="fade-in">Fade In</SelectItem>
                <SelectItem value="slide-up">Slide Up</SelectItem>
                <SelectItem value="slide-down">Slide Down</SelectItem>
                <SelectItem value="slide-left">Slide Left</SelectItem>
                <SelectItem value="slide-right">Slide Right</SelectItem>
                <SelectItem value="zoom-in">Zoom In</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {((animation.type as string) || 'none') !== 'none' ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Trigger</Label>
                <Select
                  value={(animation.trigger as string) || 'on-load'}
                  onValueChange={(v) => handleAnimationChange('trigger', v)}
                >
                  <SelectTrigger className={INPUT_CLASS}>
                    <SelectValue placeholder="Select trigger point" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="on-load">On Page Load</SelectItem>
                    <SelectItem value="on-scroll">On Scroll Into View</SelectItem>
                    <SelectItem value="on-hover">On Mouse Hover</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>DELAY</span>
                  <span>{typeof animation.delay === 'number' ? animation.delay : 0} ms</span>
                </div>
                <Slider
                  min={0}
                  max={2000}
                  step={50}
                  value={[typeof animation.delay === 'number' ? animation.delay : 0]}
                  onValueChange={(val) => handleAnimationChange('delay', val[0])}
                  className="bg-slate-800 h-2 rounded"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>DURATION</span>
                  <span>{typeof animation.duration === 'number' ? animation.duration : 400} ms</span>
                </div>
                <Slider
                  min={200}
                  max={3000}
                  step={100}
                  value={[typeof animation.duration === 'number' ? animation.duration : 400]}
                  onValueChange={(val) => handleAnimationChange('duration', val[0])}
                  className="bg-slate-800 h-2 rounded"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Stagger Children Items</Label>
                <Switch
                  checked={!!animation.stagger}
                  onCheckedChange={(c) => handleAnimationChange('stagger', c)}
                />
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* ─── ADVANCED TAB ─── */}
        <TabsContent value="advanced" className="space-y-4 pt-4 text-left">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Custom CSS Class Name</Label>
            <Input
              className={INPUT_CLASS}
              placeholder="e.g. custom-promo-card"
              value={(props.customCssClass as string) || ''}
              onChange={(e) => onUpdate({ customCssClass: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Block ID / Anchor Target</Label>
            <Input
              className={INPUT_CLASS}
              placeholder="e.g. signup-cta-anchor"
              value={(props.anchorId as string) || ''}
              onChange={(e) => onUpdate({ anchorId: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Device Visibility</Label>
            <Select
              value={(props.visibilityDevice as string) || 'all'}
              onValueChange={(v) => onUpdate({ visibilityDevice: v })}
            >
              <SelectTrigger className={INPUT_CLASS}>
                <SelectValue placeholder="All devices" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                <SelectItem value="all">Display on All Devices</SelectItem>
                <SelectItem value="desktop">Desktop Breakpoints Only</SelectItem>
                <SelectItem value="mobile">Mobile Devices Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tag Filter visibility</Label>
            <Select
              value={(props.visibilityBehavior as string) || 'all'}
              onValueChange={(v) => onUpdate({ visibilityBehavior: v })}
            >
              <SelectTrigger className={INPUT_CLASS}>
                <SelectValue placeholder="Always render" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                <SelectItem value="all">Always Render Block</SelectItem>
                <SelectItem value="has_tag">User Has Tenant Tags</SelectItem>
                <SelectItem value="no_tag">User Lacks Tenant Tags</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {((props.visibilityBehavior as string) || 'all') !== 'all' ? (
            <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
              <Label className="text-[9px] font-black text-slate-500">Filter Tag Name</Label>
              <Input
                className={INPUT_CLASS}
                placeholder="e.g. vip-client"
                value={(props.visibilityTag as string) || ''}
                onChange={(e) => onUpdate({ visibilityTag: e.target.value })}
              />
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
});

PropertiesPanel.displayName = 'PropertiesPanel';
