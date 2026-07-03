'use client';

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AutoBlockEditor } from '@/components/page-builder/AutoBlockEditor';
import type { PageBlock, BuilderResources, ResolvedTheme } from '@/lib/types';
import { Settings, Type, Layout, Activity, ShieldAlert, Sparkles, Sliders } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  const { toast } = useToast();
  const props = block.props;

  // State override controls: default, hover, focus, disabled
  const [activeState, setActiveState] = useState<'default' | 'hover' | 'focus' | 'disabled'>('default');

  // Data binding form states
  const [bindField, setBindField] = useState('title');
  const [bindVar, setBindVar] = useState('{{student.name}}');

  const getPrefixedKey = (key: string) => {
    if (activeState === 'default') return key;
    return `${activeState}_${key}`;
  };

  // Spacing values helpers
  const handleSpacingChange = (key: string, value: string) => {
    onUpdate({ [getPrefixedKey(key)]: value });
  };

  // Typography values helpers
  const handleTypographyChange = (key: string, value: unknown) => {
    onUpdate({ [getPrefixedKey(key)]: value });
  };

  // Animation helpers
  const animation = (props.animation as Record<string, unknown> | undefined) || {};
  const handleAnimationChange = (key: string, value: unknown) => {
    const updatedAnim = { ...animation, [key]: value };
    onUpdate({ animation: updatedAnim });
  };

  // Perform data binding injection
  const handleApplyBinding = () => {
    onUpdate({ [bindField]: bindVar });
    toast({
      title: "Data Binding Applied",
      description: `Bound attribute "${bindField}" to variable token "${bindVar}".`,
    });
  };

  const hasText = ['hero', 'text', 'cta', 'testimonial', 'stats', 'faq', 'video_hero', 'testimonial_grid', 'choice_cards', 'app_download', 'step_section', 'countdown'].includes(block.type);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 select-none text-slate-200">
      {/* State Override Selector Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            Style State Target
          </Label>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider bg-slate-950 border border-slate-850 px-1 rounded select-none">
            {activeState} override
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-950 rounded-lg">
          {(['default', 'hover', 'focus', 'disabled'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setActiveState(st)}
              className={cn(
                "py-1 text-[9px] font-black uppercase tracking-wider rounded transition-all",
                activeState === st 
                  ? "bg-emerald-500/10 text-emerald-400" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

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
              value={(props[getPrefixedKey('fontFamily')] as string) || 'heading'}
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
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Text Align</Label>
            <Select
              value={(props[getPrefixedKey('textAlign')] as string) || 'left'}
              onValueChange={(v) => handleTypographyChange('textAlign', v)}
            >
              <SelectTrigger className={INPUT_CLASS}>
                <SelectValue placeholder="Left align" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
                <SelectItem value="justify">Justify</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Text Size (CSS)</Label>
            <Input
              className={INPUT_CLASS}
              placeholder="e.g. 1.25rem, 16px"
              value={(props[getPrefixedKey('textSize')] as string) || ''}
              onChange={(e) => handleTypographyChange('textSize', e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Text Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="color"
                className="w-10 h-10 p-0 border border-slate-700 rounded-lg bg-slate-900 cursor-pointer shrink-0"
                value={(props[getPrefixedKey('textColor')] as string) || '#0f172a'}
                onChange={(e) => handleTypographyChange('textColor', e.target.value)}
              />
              <Input
                className={INPUT_CLASS}
                placeholder="#000000"
                value={(props[getPrefixedKey('textColor')] as string) || ''}
                onChange={(e) => handleTypographyChange('textColor', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Text Gradient</Label>
            <Switch
              checked={!!props[getPrefixedKey('gradientText')]}
              onCheckedChange={(c) => handleTypographyChange('gradientText', c)}
            />
          </div>

          {props[getPrefixedKey('gradientText')] ? (
            <div className="grid grid-cols-2 gap-2 pt-1 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-black text-slate-500">From Color</Label>
                <div className="flex gap-1.5 items-center">
                  <Input
                    type="color"
                    className="w-8 h-8 p-0 border border-slate-700 rounded bg-slate-900 cursor-pointer"
                    value={(props[getPrefixedKey('gradientFrom')] as string) || '#3B5FFF'}
                    onChange={(e) => handleTypographyChange('gradientFrom', e.target.value)}
                  />
                  <Input
                    className="h-8 text-[10px] bg-slate-800 border-slate-700 text-slate-350 font-bold"
                    value={(props[getPrefixedKey('gradientFrom')] as string) || '#3B5FFF'}
                    onChange={(e) => handleTypographyChange('gradientFrom', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-black text-slate-500">To Color</Label>
                <div className="flex gap-1.5 items-center">
                  <Input
                    type="color"
                    className="w-8 h-8 p-0 border border-slate-700 rounded bg-slate-900 cursor-pointer"
                    value={(props[getPrefixedKey('gradientTo')] as string) || '#7C3AED'}
                    onChange={(e) => handleTypographyChange('gradientTo', e.target.value)}
                  />
                  <Input
                    className="h-8 text-[10px] bg-slate-800 border-slate-700 text-slate-355 font-bold"
                    value={(props[getPrefixedKey('gradientTo')] as string) || '#7C3AED'}
                    onChange={(e) => handleTypographyChange('gradientTo', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* ─── SPACING TAB ─── */}
        <TabsContent value="spacing" className="space-y-4 pt-4 text-left">
          <div className="flex flex-col gap-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Visual Box Model (CSS)</Label>
            
            {/* Figma / Webflow style nested visual Box Model spacing editor */}
            <div className="relative w-full aspect-[16/10] border border-slate-800/80 rounded-2xl bg-slate-950 p-4 font-mono text-[9px] select-none text-slate-400">
              
              {/* Outer Margin Box wrapper */}
              <div className="absolute inset-2 border border-slate-800/80 border-dashed rounded-xl bg-slate-900/10 flex items-center justify-center">
                <span className="absolute top-1 left-2 text-[8px] text-slate-500 font-bold uppercase select-none">Margin</span>
                
                {/* Margin top input */}
                <input 
                  type="text" 
                  placeholder="0px"
                  className="absolute top-1 w-12 text-center bg-transparent border-0 hover:bg-slate-800/40 focus:bg-slate-800 text-slate-300 font-semibold p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500/30 text-[9px]"
                  value={(props[getPrefixedKey('marginTop')] as string) || ''}
                  onChange={(e) => handleSpacingChange('marginTop', e.target.value)}
                />
                {/* Margin bottom input */}
                <input 
                  type="text" 
                  placeholder="0px"
                  className="absolute bottom-1 w-12 text-center bg-transparent border-0 hover:bg-slate-800/40 focus:bg-slate-800 text-slate-300 font-semibold p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500/30 text-[9px]"
                  value={(props[getPrefixedKey('marginBottom')] as string) || ''}
                  onChange={(e) => handleSpacingChange('marginBottom', e.target.value)}
                />
                {/* Margin left input */}
                <input 
                  type="text" 
                  placeholder="0px"
                  className="absolute left-1 w-10 text-center bg-transparent border-0 hover:bg-slate-800/40 focus:bg-slate-800 text-slate-300 font-semibold p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500/30 text-[9px]"
                  value={(props[getPrefixedKey('marginLeft')] as string) || ''}
                  onChange={(e) => handleSpacingChange('marginLeft', e.target.value)}
                />
                {/* Margin right input */}
                <input 
                  type="text" 
                  placeholder="0px"
                  className="absolute right-1 w-10 text-center bg-transparent border-0 hover:bg-slate-800/40 focus:bg-slate-800 text-slate-300 font-semibold p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500/30 text-[9px]"
                  value={(props[getPrefixedKey('marginRight')] as string) || ''}
                  onChange={(e) => handleSpacingChange('marginRight', e.target.value)}
                />

                {/* Inner Padding Box */}
                <div className="absolute inset-x-12 inset-y-6 border border-slate-800/80 rounded-lg bg-slate-900/30 flex items-center justify-center">
                  <span className="absolute top-1 left-2 text-[8px] text-slate-500 font-bold uppercase select-none">Padding</span>
                  
                  {/* Padding top input */}
                  <input 
                    type="text" 
                    placeholder="0px"
                    className="absolute top-1 w-10 text-center bg-transparent border-0 hover:bg-slate-800/40 focus:bg-slate-800 text-slate-300 font-semibold p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500/30 text-[9px]"
                    value={(props[getPrefixedKey('paddingTop')] as string) || ''}
                    onChange={(e) => handleSpacingChange('paddingTop', e.target.value)}
                  />
                  {/* Padding bottom input */}
                  <input 
                    type="text" 
                    placeholder="0px"
                    className="absolute bottom-1 w-10 text-center bg-transparent border-0 hover:bg-slate-800/40 focus:bg-slate-800 text-slate-300 font-semibold p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500/30 text-[9px]"
                    value={(props[getPrefixedKey('paddingBottom')] as string) || ''}
                    onChange={(e) => handleSpacingChange('paddingBottom', e.target.value)}
                  />
                  {/* Padding left input */}
                  <input 
                    type="text" 
                    placeholder="0px"
                    className="absolute left-1 w-8 text-center bg-transparent border-0 hover:bg-slate-800/40 focus:bg-slate-800 text-slate-300 font-semibold p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500/30 text-[9px]"
                    value={(props[getPrefixedKey('paddingLeft')] as string) || ''}
                    onChange={(e) => handleSpacingChange('paddingLeft', e.target.value)}
                  />
                  {/* Padding right input */}
                  <input 
                    type="text" 
                    placeholder="0px"
                    className="absolute right-1 w-8 text-center bg-transparent border-0 hover:bg-slate-800/40 focus:bg-slate-800 text-slate-300 font-semibold p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500/30 text-[9px]"
                    value={(props[getPrefixedKey('paddingRight')] as string) || ''}
                    onChange={(e) => handleSpacingChange('paddingRight', e.target.value)}
                  />

                  {/* Absolute Center Content Label */}
                  <div className="absolute inset-x-8 inset-y-4 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center justify-center text-emerald-400 font-bold uppercase text-[7px] tracking-wider select-none pointer-events-none">
                    BLOCK
                  </div>
                </div>

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
          
          {/* Dynamic Data-Binding Selector Wizard */}
          <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/50 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-slate-800">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-300">Data-Binding Wizard</h5>
            </div>
            
            <p className="text-[10px] text-slate-500 leading-normal">
              Map and bind layout content inputs directly to dynamic student, parent or invoice attributes.
            </p>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-bold text-slate-400 uppercase">Target Field</Label>
                <Select
                  value={bindField}
                  onValueChange={setBindField}
                >
                  <SelectTrigger className="h-8 rounded-lg bg-slate-900 border-slate-800 text-[10px] font-bold">
                    <SelectValue placeholder="Select target..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="title">Title / Heading</SelectItem>
                    <SelectItem value="subtitle">Subtitle / Subheading</SelectItem>
                    <SelectItem value="content">Main Content Text</SelectItem>
                    <SelectItem value="href">Link Destination (href)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-[9px] font-bold text-slate-400 uppercase">Bind Variable</Label>
                <Select
                  value={bindVar}
                  onValueChange={setBindVar}
                >
                  <SelectTrigger className="h-8 rounded-lg bg-slate-900 border-slate-800 text-[10px] font-bold">
                    <SelectValue placeholder="Select variable..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="{{student.name}}">Student Name (Ama Serwaa)</SelectItem>
                    <SelectItem value="{{student.id}}">Student ID (STU-2026-092)</SelectItem>
                    <SelectItem value="{{parent.name}}">Parent Name (Kwame Mensah)</SelectItem>
                    <SelectItem value="{{invoice.amount}}">Invoice Amount (GH₵ 1,200)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                onClick={handleApplyBinding}
                className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition-all"
              >
                Establish Variable Link
              </Button>
            </div>
          </div>

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
