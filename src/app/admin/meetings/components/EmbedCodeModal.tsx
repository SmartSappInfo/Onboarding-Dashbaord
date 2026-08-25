'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Code, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmbedCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  slug: string;
  type?: 'booking' | 'routing';
}

export function EmbedCodeModal({
  open,
  onOpenChange,
  title,
  slug,
  type = 'booking',
}: EmbedCodeModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [primaryColor, setPrimaryColor] = React.useState('#3A86FF');
  const [iframeHeight, setIframeHeight] = React.useState('700');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.smartsapp.com';
  const embedUrl = `${origin}/embed/${type === 'routing' ? 'route' : 'booking'}/${slug}?primaryColor=${encodeURIComponent(primaryColor)}`;

  // Inline Iframe snippet
  const iframeSnippet = `<!-- SmartSapp Meetings Inline Booking Embed -->
<iframe
  src="${embedUrl}"
  width="100%"
  height="${iframeHeight}px"
  frameborder="0"
  style="border: none; border-radius: 16px; overflow: hidden; min-height: ${iframeHeight}px;"
  allow="camera; microphone; fullscreen; payment"
></iframe>
<script src="${origin}/embed-resizer.js" async></script>`;

  // Popup Button snippet
  const popupSnippet = `<!-- SmartSapp Meetings Popup Badge Button -->
<button
  onclick="window.SmartSappMeetings.open('${embedUrl}')"
  style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 24px; border-radius: 12px; font-weight: 600; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.15);"
>
  📅 Book a Call
</button>
<script src="${origin}/embed-popup.js" async></script>`;

  const handleCopy = (snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast({ title: 'Embed code copied to clipboard!' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            Embed "{title}" On Your Website
          </DialogTitle>
          <DialogDescription className="text-xs">
            Add responsive scheduling directly to WordPress, Webflow, React, or custom landing pages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Customization Options */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/30 border">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Brand Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="h-8 w-8 rounded-lg cursor-pointer border border-border"
                />
                <Input
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="h-8 text-xs font-mono rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Height (px)</Label>
              <Input
                type="number"
                value={iframeHeight}
                onChange={e => setIframeHeight(e.target.value)}
                className="h-8 text-xs rounded-lg"
              />
            </div>
          </div>

          <Tabs defaultValue="inline" className="w-full">
            <TabsList className="grid grid-cols-2 rounded-xl h-10 p-1 bg-muted/60">
              <TabsTrigger value="inline" className="rounded-lg text-xs font-semibold">
                Inline Embed (Iframe)
              </TabsTrigger>
              <TabsTrigger value="popup" className="rounded-lg text-xs font-semibold">
                Floating Popup Button
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inline" className="space-y-3 pt-3">
              <div className="relative">
                <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {iframeSnippet}
                </pre>
                <Button
                  size="sm"
                  onClick={() => handleCopy(iframeSnippet)}
                  className="absolute top-3 right-3 rounded-xl h-8 text-xs gap-1.5 active:scale-[0.97]"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy Code
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="popup" className="space-y-3 pt-3">
              <div className="relative">
                <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {popupSnippet}
                </pre>
                <Button
                  size="sm"
                  onClick={() => handleCopy(popupSnippet)}
                  className="absolute top-3 right-3 rounded-xl h-8 text-xs gap-1.5 active:scale-[0.97]"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy Code
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl min-h-[44px]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
