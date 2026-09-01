'use client';

/**
 * SmartSapp Forms 2.0: Embed Studio & Interactive Device Preview
 * 
 * Generates responsive inline iframes with cross-origin auto-resize script,
 * modal popup launchers, and slide-over drawers with simulated device frames.
 */

import React, { useState } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  Smartphone, 
  Tablet, 
  Monitor, 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateEmbedSnippet } from '@/lib/forms/form-utils';
import type { Form } from '@/lib/types';
import type { EmbedConfig } from '@/lib/forms/form-distribution-types';
import { cn } from '@/lib/utils';

interface EmbedStudioCardProps {
  form: Form;
}

export default function EmbedStudioCard({ form }: EmbedStudioCardProps) {
  const { toast } = useToast();
  const [embedType, setEmbedType] = useState<'inline' | 'popup' | 'slideover'>('inline');
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [hasCopied, setHasCopied] = useState(false);

  // Embed Customization Options
  const [config, setConfig] = useState<EmbedConfig>({
    embedType: 'inline',
    width: '100%',
    height: '650px',
    autoResize: true,
    triggerText: 'Fill Out Form',
    triggerColor: '#4f46e5',
  });

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.smartsapp.com';
  const slug = form.slug || form.id;
  const embedSnippet = generateEmbedSnippet(slug, { ...config, embedType }, origin);
  const livePreviewUrl = `${origin}/p/f/${slug}?embed=true`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setHasCopied(true);
      toast({ title: 'Embed Code Copied', description: 'Paste this snippet directly into your website HTML.' });
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      toast({ title: 'Copy Failed', description: 'Could not copy snippet.', variant: 'destructive' });
    }
  };

  const deviceWidths = {
    desktop: 'w-full',
    tablet: 'max-w-[768px]',
    mobile: 'max-w-[375px]',
  };

  return (
    <Card className="rounded-3xl border-border/60 bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Code2 className="h-4 w-4 text-primary" />
              Embed Studio
            </CardTitle>
            <CardDescription className="text-xs">
              Seamlessly embed this form into your WordPress, Webflow, Shopify, or custom website.
            </CardDescription>
          </div>

          <Tabs value={embedType} onValueChange={(val) => setEmbedType(val as 'inline' | 'popup' | 'slideover')}>
            <TabsList className="h-9 p-1 rounded-2xl bg-muted/30 border border-border/40">
              <TabsTrigger value="inline" className="text-xs font-bold rounded-xl">Inline Iframe</TabsTrigger>
              <TabsTrigger value="popup" className="text-xs font-bold rounded-xl">Popup Widget</TabsTrigger>
              <TabsTrigger value="slideover" className="text-xs font-bold rounded-xl">Slide-Over</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Embed Configuration Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-muted/20 border border-border/40">
          {embedType === 'inline' ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Width</Label>
                <Input
                  value={config.width}
                  onChange={(e) => setConfig(prev => ({ ...prev, width: e.target.value }))}
                  placeholder="100% or 600px"
                  className="h-9 text-xs rounded-xl bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Initial Height</Label>
                <Input
                  value={config.height}
                  onChange={(e) => setConfig(prev => ({ ...prev, height: e.target.value }))}
                  placeholder="650px"
                  className="h-9 text-xs rounded-xl bg-background"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                  ✓ Auto-Resizes to Content
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Trigger Button Text</Label>
                <Input
                  value={config.triggerText || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, triggerText: e.target.value }))}
                  placeholder="Contact Us"
                  className="h-9 text-xs rounded-xl bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Button Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.triggerColor || '#4f46e5'}
                    onChange={(e) => setConfig(prev => ({ ...prev, triggerColor: e.target.value }))}
                    className="h-9 w-9 rounded-xl border border-border/60 cursor-pointer p-0.5"
                  />
                  <Input
                    value={config.triggerColor || '#4f46e5'}
                    onChange={(e) => setConfig(prev => ({ ...prev, triggerColor: e.target.value }))}
                    className="h-9 text-xs font-mono rounded-xl bg-background flex-1"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Code Snippet Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              HTML / JavaScript Embed Code
            </span>
            <Button
              size="sm"
              onClick={handleCopyCode}
              className="h-8 px-3 rounded-xl text-xs font-bold gap-1.5"
            >
              {hasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {hasCopied ? 'Copied' : 'Copy Snippet'}
            </Button>
          </div>

          <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed select-all">
            {embedSnippet}
          </pre>
        </div>

        {/* Live Device Simulator Frame */}
        <div className="space-y-3 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              Live Embed Preview Simulator
            </span>

            {/* Device Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/30 border border-border/40">
              <Button
                variant={deviceView === 'desktop' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setDeviceView('desktop')}
                className="h-7 px-2.5 rounded-xl text-xs"
              >
                <Monitor className="h-3.5 w-3.5 mr-1" /> Desktop
              </Button>
              <Button
                variant={deviceView === 'tablet' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setDeviceView('tablet')}
                className="h-7 px-2.5 rounded-xl text-xs"
              >
                <Tablet className="h-3.5 w-3.5 mr-1" /> Tablet
              </Button>
              <Button
                variant={deviceView === 'mobile' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setDeviceView('mobile')}
                className="h-7 px-2.5 rounded-xl text-xs"
              >
                <Smartphone className="h-3.5 w-3.5 mr-1" /> Mobile
              </Button>
            </div>
          </div>

          {/* Iframe Viewport Container */}
          <div className="flex justify-center p-6 rounded-3xl bg-muted/10 border border-dashed border-border/60 overflow-hidden">
            <div className={cn("transition-all duration-300 rounded-2xl shadow-xl overflow-hidden bg-background border border-border/60", deviceWidths[deviceView])}>
              <div className="h-7 bg-muted/40 border-b border-border/40 px-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-mono text-muted-foreground ml-2 truncate">
                  {origin}/p/f/{slug}
                </span>
              </div>
              <iframe
                src={livePreviewUrl}
                width="100%"
                height="480px"
                className="w-full border-0"
                title="Embed Live Preview"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
