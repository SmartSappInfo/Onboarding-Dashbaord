'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Distribution Studio UI:
 *    Provides an interactive modal/dialog for creating direct short links, HTML iFrame embed snippets,
 *    and QR code graphics for any media asset or presentation experience.
 * 2. Mobile Accessibility & Touch Target Bounds:
 *    All copy buttons, tabs, and format controls strictly enforce `min-h-[44px] min-w-[44px]` touch target bounds
 *    with tactile micro-animations (`active:scale-[0.97]`).
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import type { MediaAsset } from '@/lib/types';
import { createDistributionLinkAction, generateEmbedCode } from '@/lib/media/media-link-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Copy, Check, Code, Link2, QrCode, ExternalLink, 
  Sparkles, Loader2, Share2 
} from 'lucide-react';

export interface MediaDistributionModalProps {
  asset: MediaAsset | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MediaDistributionModal({
  asset,
  isOpen,
  onClose,
}: MediaDistributionModalProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'link' | 'embed' | 'qr'>('link');
  const [customSlug, setCustomSlug] = useState('');
  const [generatedLinkUrl, setGeneratedLinkUrl] = useState('');
  const [embedSnippet, setEmbedSnippet] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  useEffect(() => {
    if (!asset || !isOpen) return;

    const host = typeof window !== 'undefined' ? window.location.origin : 'https://app.smartsapp.com';
    const initialUrl = `${host}/m/${asset.id}`;
    setGeneratedLinkUrl(initialUrl);

    const initialEmbed = generateEmbedCode(host, asset.id, {
      width: '100%',
      height: '500px',
      allowFullscreen: true,
      responsiveRatio: '16:9',
    });
    setEmbedSnippet(initialEmbed);
  }, [asset, isOpen]);

  if (!asset) return null;

  const handleCreateCustomLink = async () => {
    if (!firestore || !asset || isGenerating) return;
    setIsGenerating(true);

    try {
      const created = await createDistributionLinkAction(firestore, {
        assetId: asset.id,
        workspaceId: asset.workspaceIds?.[0] || 'global',
        shortSlug: customSlug.trim(),
        createdById: 'admin',
      });

      if (created) {
        const host = typeof window !== 'undefined' ? window.location.origin : 'https://app.smartsapp.com';
        const newUrl = `${host}/m/${created.shortSlug}`;
        setGeneratedLinkUrl(newUrl);
        setEmbedSnippet(generateEmbedCode(host, created.shortSlug));

        toast({
          title: 'Custom Link Created!',
          description: `Tracking link created: /m/${created.shortSlug}`,
        });
      }
    } catch (err: unknown) {
      console.error('[handleCreateCustomLink] Error:', err);
      toast({
        title: 'Link Creation Failed',
        description: 'Could not create custom link.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, type: 'link' | 'embed') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    }
    toast({
      title: 'Copied to Clipboard!',
      description: type === 'link' ? 'Tracking URL copied.' : 'HTML embed snippet copied.',
    });
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generatedLinkUrl)}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-background">
        {/* Header */}
        <DialogHeader className="p-6 bg-primary/10 border-b border-primary/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary text-primary-foreground rounded-2xl shadow-md">
              <Share2 className="h-5 w-5" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-lg font-black text-foreground">Distribution & Embed Studio</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Generate tracked links, HTML embeds, and QR codes for {asset.name}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Studio Content */}
        <div className="p-6 space-y-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
            <TabsList className="bg-muted/40 border border-border h-11 p-1 rounded-xl w-full grid grid-cols-3">
              <TabsTrigger value="link" className="rounded-lg font-bold text-xs gap-1.5 min-h-[44px]">
                <Link2 className="h-3.5 w-3.5" /> Direct Link
              </TabsTrigger>
              <TabsTrigger value="embed" className="rounded-lg font-bold text-xs gap-1.5 min-h-[44px]">
                <Code className="h-3.5 w-3.5" /> HTML Embed
              </TabsTrigger>
              <TabsTrigger value="qr" className="rounded-lg font-bold text-xs gap-1.5 min-h-[44px]">
                <QrCode className="h-3.5 w-3.5" /> QR Code
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Direct Link */}
            <TabsContent value="link" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Active Public Tracking Link</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={generatedLinkUrl}
                    className="h-11 text-xs rounded-xl font-mono bg-muted/20 border-border"
                  />
                  <Button
                    onClick={() => copyToClipboard(generatedLinkUrl, 'link')}
                    className="rounded-xl font-bold text-xs h-11 px-4 min-h-[44px] min-w-[44px] gap-1.5 shadow-md active:scale-[0.97]"
                  >
                    {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    Copy
                  </Button>
                </div>
              </div>

              {/* Custom Slug Generator */}
              <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-3">
                <Label className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> Create Custom Short Slug
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. school-brochure-2026"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    className="h-10 text-xs rounded-xl bg-background border-border"
                  />
                  <Button
                    disabled={!customSlug.trim() || isGenerating}
                    onClick={handleCreateCustomLink}
                    variant="outline"
                    className="rounded-xl font-bold text-xs h-10 px-4 min-h-[44px] active:scale-[0.97]"
                  >
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: HTML Embed Code */}
            <TabsContent value="embed" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Responsive HTML iFrame Embed Code</Label>
                <textarea
                  readOnly
                  rows={4}
                  value={embedSnippet}
                  className="w-full p-3 text-xs font-mono rounded-xl bg-muted/20 border border-border text-foreground resize-none focus:outline-none"
                />
                <Button
                  onClick={() => copyToClipboard(embedSnippet, 'embed')}
                  className="w-full rounded-xl font-bold text-xs h-11 min-h-[44px] gap-2 shadow-md active:scale-[0.97]"
                >
                  {copiedEmbed ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  Copy iFrame Snippet
                </Button>
              </div>
            </TabsContent>

            {/* Tab 3: QR Code Download */}
            <TabsContent value="qr" className="mt-4 space-y-4">
              <div className="flex flex-col items-center justify-center p-6 bg-muted/20 border border-border rounded-2xl gap-4">
                <div className="w-48 h-48 bg-white p-3 rounded-2xl shadow-md flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodeUrl} alt="Media QR Code" className="w-full h-full object-contain" />
                </div>
                <div className="flex gap-2 w-full max-w-xs">
                  <Button
                    onClick={() => window.open(qrCodeUrl, '_blank')}
                    className="w-full rounded-xl font-bold text-xs h-11 min-h-[44px] gap-2 shadow-md active:scale-[0.97]"
                  >
                    <ExternalLink className="h-4 w-4" /> Download QR Code
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MediaDistributionModal;
