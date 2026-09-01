/**
 * @fileoverview In-Designer AI Copywriting & CTA Assistant Drawer
 * Generates tailored CTA badges, poster headlines, WhatsApp broadcasts,
 * and email invitations directly within the QR Designer.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Employs 1-click apply callbacks that update parent QR design state.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  Sparkles,
  Copy,
  Check,
  MessageSquare,
  Mail,
  Smartphone,
  Layers,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateContextualCopyAction } from '@/app/actions/qr-ai-actions';
import type { ContextualCopyResult, QRCodeType } from '@/lib/types';

interface AiCopywriterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrName: string;
  destinationUrl: string;
  type: QRCodeType;
  onApplyCTA?: (ctaText: string) => void;
}

export default function AiCopywriterDrawer({
  open,
  onOpenChange,
  qrName,
  destinationUrl,
  type,
  onApplyCTA,
}: AiCopywriterDrawerProps) {
  const { toast } = useToast();
  const [tone, setTone] = React.useState<'promo' | 'b2b' | 'friendly' | 'luxury'>('friendly');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [copyResult, setCopyResult] = React.useState<ContextualCopyResult | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const fetchCopy = React.useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await generateContextualCopyAction(qrName || 'Our Experience', destinationUrl, type, tone);
      if (res.success && res.data) {
        setCopyResult(res.data);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate copy.' });
    } finally {
      setIsGenerating(false);
    }
  }, [qrName, destinationUrl, type, tone, toast]);

  React.useEffect(() => {
    if (open) {
      fetchCopy();
    }
  }, [open, fetchCopy]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({ title: 'Copied to Clipboard' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6 space-y-6 bg-card border-border shadow-2xl">
        <SheetHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold">AI Copywriter & CTA Assistant</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Generate high-converting CTAs, headlines, and multi-channel campaign messaging.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Tone Selector */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Select Campaign Tone
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['friendly', 'promo', 'b2b', 'luxury'] as const).map((t) => (
              <Button
                key={t}
                variant={tone === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTone(t)}
                className="h-9 rounded-xl text-xs font-semibold capitalize active:scale-[0.97]"
              >
                {t === 'promo' ? '🔥 Promo' : t === 'b2b' ? '💼 B2B' : t === 'luxury' ? '✨ Luxury' : '👋 Friendly'}
              </Button>
            ))}
          </div>
        </div>

        {isGenerating ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs font-semibold text-muted-foreground">Synthesizing campaign copy...</p>
          </div>
        ) : copyResult ? (
          <div className="space-y-6">
            {/* CTA Suggestions */}
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Recommended CTA Badge Text</span>
                <span className="text-[10px] font-normal lowercase text-muted-foreground">1-click apply</span>
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {copyResult.ctaSuggestions.map((cta, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-muted/20 hover:border-primary/40 transition-colors"
                  >
                    <span className="text-xs font-bold text-foreground font-mono">{cta}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onApplyCTA?.(cta);
                        toast({ title: 'CTA Applied', description: `Set frame text to "${cta}".` });
                      }}
                      className="h-7 px-2.5 text-[11px] font-semibold rounded-lg text-primary hover:bg-primary/10 active:scale-[0.97]"
                    >
                      <Check className="h-3 w-3 mr-1" /> Apply
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Multi-Channel Copy Tabs */}
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Multi-Channel Distribution Copy
              </Label>
              <Tabs defaultValue="whatsapp" className="w-full">
                <TabsList className="w-full grid grid-cols-3 rounded-xl h-10 p-1 bg-muted">
                  <TabsTrigger value="whatsapp" className="rounded-lg text-xs font-semibold">
                    <MessageSquare className="h-3.5 w-3.5 mr-1 text-emerald-500" /> WhatsApp
                  </TabsTrigger>
                  <TabsTrigger value="sms" className="rounded-lg text-xs font-semibold">
                    <Smartphone className="h-3.5 w-3.5 mr-1 text-blue-500" /> SMS
                  </TabsTrigger>
                  <TabsTrigger value="email" className="rounded-lg text-xs font-semibold">
                    <Mail className="h-3.5 w-3.5 mr-1 text-violet-500" /> Email
                  </TabsTrigger>
                </TabsList>

                {/* WhatsApp */}
                <TabsContent value="whatsapp" className="space-y-3 mt-3">
                  <div className="p-3.5 rounded-xl border border-border bg-muted/10 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                    {copyResult.whatsAppBroadcast}
                  </div>
                  <Button
                    onClick={() => copyToClipboard(copyResult.whatsAppBroadcast, 'whatsapp')}
                    variant="outline"
                    className="w-full h-9 rounded-xl text-xs font-semibold active:scale-[0.97]"
                  >
                    {copiedKey === 'whatsapp' ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                    {copiedKey === 'whatsapp' ? 'Copied to Clipboard' : 'Copy WhatsApp Message'}
                  </Button>
                </TabsContent>

                {/* SMS */}
                <TabsContent value="sms" className="space-y-3 mt-3">
                  <div className="p-3.5 rounded-xl border border-border bg-muted/10 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                    {copyResult.smsText}
                  </div>
                  <Button
                    onClick={() => copyToClipboard(copyResult.smsText, 'sms')}
                    variant="outline"
                    className="w-full h-9 rounded-xl text-xs font-semibold active:scale-[0.97]"
                  >
                    {copiedKey === 'sms' ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                    {copiedKey === 'sms' ? 'Copied to Clipboard' : 'Copy SMS Snippet'}
                  </Button>
                </TabsContent>

                {/* Email */}
                <TabsContent value="email" className="space-y-3 mt-3">
                  <div className="p-3.5 rounded-xl border border-border bg-muted/10 space-y-2 text-xs">
                    <p className="font-bold text-foreground">
                      <span className="text-muted-foreground font-normal">Subject:</span> {copyResult.emailSnippet.subject}
                    </p>
                    <div className="font-mono text-muted-foreground whitespace-pre-wrap border-t border-border pt-2">
                      {copyResult.emailSnippet.body}
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      copyToClipboard(
                        `Subject: ${copyResult.emailSnippet.subject}\n\n${copyResult.emailSnippet.body}`,
                        'email'
                      )
                    }
                    variant="outline"
                    className="w-full h-9 rounded-xl text-xs font-semibold active:scale-[0.97]"
                  >
                    {copiedKey === 'email' ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                    {copiedKey === 'email' ? 'Copied to Clipboard' : 'Copy Email Template'}
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
