'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Share2,
  Copy,
  Code,
  QrCode,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { EventType } from '@/lib/meetings/types';

interface ShareEventTypeModalProps {
  eventType: EventType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareEventTypeModal({
  eventType,
  open,
  onOpenChange,
}: ShareEventTypeModalProps) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedEmbed, setCopiedEmbed] = React.useState(false);

  if (!eventType) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const bookingUrl = `${origin}/book/${eventType.slug}`;
  const embedCode = `<iframe\n  src="${origin}/embed/booking/${eventType.slug}"\n  width="100%"\n  height="700px"\n  frameborder="0"\n></iframe>`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopiedLink(true);
    toast({
      title: 'Link Copied! 🔗',
      description: 'Public booking URL copied to clipboard.',
    });
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    toast({
      title: 'Embed Snippet Copied! 💻',
      description: 'Iframe embed HTML copied to clipboard.',
    });
    setTimeout(() => setCopiedEmbed(false), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-6 space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Share2 className="w-5 h-5 text-primary" />
            Share &quot;{eventType.name}&quot;
          </DialogTitle>
          <DialogDescription className="text-xs">
            Distribute this booking page directly to clients, embed it on your website, or share via QR code.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full space-y-4">
          <TabsList className="grid grid-cols-3 rounded-2xl p-1 bg-muted/50">
            <TabsTrigger value="link" className="rounded-xl text-xs font-semibold gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Direct Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="rounded-xl text-xs font-semibold gap-1.5">
              <Code className="w-3.5 h-3.5" /> Embed Code
            </TabsTrigger>
            <TabsTrigger value="qr" className="rounded-xl text-xs font-semibold gap-1.5">
              <QrCode className="w-3.5 h-3.5" /> QR Code
            </TabsTrigger>
          </TabsList>

          {/* Direct Link Tab */}
          <TabsContent value="link" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Public Booking URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={bookingUrl}
                  className="rounded-xl text-xs font-mono bg-muted/20"
                />
                <Button
                  size="sm"
                  onClick={handleCopyLink}
                  className="rounded-xl text-xs font-bold gap-1.5 shrink-0 active:scale-[0.97] transition-transform"
                >
                  {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
              >
                Preview Live Page <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </TabsContent>

          {/* Embed Code Tab */}
          <TabsContent value="embed" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">HTML Iframe Embed</Label>
              <Textarea
                readOnly
                rows={4}
                value={embedCode}
                className="rounded-xl text-xs font-mono bg-muted/20 resize-none"
              />
            </div>
            <Button
              className="w-full rounded-2xl min-h-[44px] text-xs font-bold gap-2 active:scale-[0.97] transition-transform"
              onClick={handleCopyEmbed}
            >
              {copiedEmbed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedEmbed ? 'Snippet Copied to Clipboard' : 'Copy Embed Code'}
            </Button>
          </TabsContent>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="space-y-4 pt-2 text-center">
            <div className="p-6 rounded-3xl bg-white border border-border inline-block mx-auto shadow-inner">
              {/* QR Code Vector Representation */}
              <svg viewBox="0 0 100 100" className="w-40 h-40 mx-auto text-foreground">
                <path
                  fill="currentColor"
                  d="M0 0h30v30H0zm5 5h20v20H5zM10 10h10v10H10zm60-10h30v30H70zm5 5h20v20H75zM80 10h10v10H80zM0 70h30v30H0zm5 5h20v20H5zM10 80h10v10H10zm35-70h10v10H45zm0 20h10v10H45zm0 20h10v10H45zm20 0h10v10H65zm10 10h10v10H75zm-30 20h10v10H45zm20 0h10v10H65zm10 10h10v10H75zm10-10h10v10H85zm0 20h10v10H85z"
                />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground">
              Scan with any mobile camera to open the public booking experience.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
