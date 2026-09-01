'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Vector QR Studio & Print Kits
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Powered by qr-code-styling for high-fidelity vector rendering and logo overlay.
 * 2. Level H error correction (30% recovery) preventing scan degradation when logo is overlaid.
 * 3. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Printer, Sliders } from 'lucide-react';
import type { Survey } from '@/lib/types';

export interface QrStudioTabProps {
  survey: Survey;
  defaultUrl: string;
}

export function QrStudioTab({ survey, defaultUrl }: QrStudioTabProps) {
  const { toast } = useToast();
  const qrContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [dotColor, setDotColor] = React.useState('#1e293b');
  const [bgColor, setBgColor] = React.useState('#ffffff');
  const [dotType, setDotType] = React.useState<'rounded' | 'dots' | 'classy' | 'square'>('rounded');
  const [includeLogo, setIncludeLogo] = React.useState(true);
  const [qrEngine, setQrEngine] = React.useState<unknown | null>(null);

  React.useEffect(() => {
    let active = true;
    async function initQR() {
      if (!qrContainerRef.current) return;
      try {
        const QRCodeStylingModule = (await import('qr-code-styling')).default;
        if (!active) return;

        qrContainerRef.current.innerHTML = '';
        const qrCode = new QRCodeStylingModule({
          width: 260,
          height: 260,
          type: 'svg',
          data: defaultUrl,
          image: includeLogo ? '/logo.png' : undefined,
          dotsOptions: {
            color: dotColor,
            type: dotType,
          },
          backgroundOptions: {
            color: bgColor,
          },
          imageOptions: {
            crossOrigin: 'anonymous',
            margin: 6,
            imageSize: 0.35,
          },
          qrOptions: {
            errorCorrectionLevel: 'H',
          },
        });

        qrCode.append(qrContainerRef.current);
        setQrEngine(qrCode);
      } catch (err) {
        console.error('Failed to initialize QR engine:', err);
      }
    }
    initQR();
    return () => {
      active = false;
    };
  }, [defaultUrl, dotColor, bgColor, dotType, includeLogo]);

  const handleDownload = async (extension: 'png' | 'svg') => {
    if (!qrEngine) return;
    try {
      const engine = qrEngine as { download: (options: { name: string; extension: string }) => Promise<void> };
      await engine.download({
        name: `${survey.slug || 'survey'}-qr-code`,
        extension,
      });
      toast({
        title: 'QR Code Downloaded',
        description: `Saved as ${extension.toUpperCase()} vector file.`,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not export QR code.' });
    }
  };

  const handlePrintTentCard = () => {
    window.print();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Customizer Controls */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">QR Design Studio</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Customize colors, pattern geometry, and brand logos for physical touchpoints.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Foreground Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={dotColor}
                    onChange={(e) => setDotColor(e.target.value)}
                    className="h-10 w-12 rounded-lg border border-border cursor-pointer bg-transparent"
                  />
                  <Input
                    value={dotColor}
                    onChange={(e) => setDotColor(e.target.value)}
                    className="font-mono text-xs h-10 rounded-lg uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Background Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-10 w-12 rounded-lg border border-border cursor-pointer bg-transparent"
                  />
                  <Input
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="font-mono text-xs h-10 rounded-lg uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dot Pattern Geometry</Label>
              <div className="grid grid-cols-4 gap-2">
                {(['rounded', 'dots', 'classy', 'square'] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={dotType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDotType(type)}
                    className="capitalize text-xs h-10 rounded-xl active:scale-[0.97]"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold">Brand Logo Center Overlay</Label>
                <p className="text-[11px] text-muted-foreground">Embeds SmartSapp brand insignia with 30% error correction protection.</p>
              </div>
              <input
                type="checkbox"
                checked={includeLogo}
                onChange={(e) => setIncludeLogo(e.target.checked)}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right QR Live Preview & Action Kits */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="rounded-2xl border-border bg-card shadow-sm text-center">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Print & Digital Vector Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 flex flex-col items-center">
            <div className="p-4 rounded-2xl bg-white shadow-md border border-slate-200 inline-flex items-center justify-center min-h-[280px] min-w-[280px]">
              <div ref={qrContainerRef} />
            </div>

            <div className="w-full space-y-2">
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button
                  type="button"
                  onClick={() => handleDownload('png')}
                  className="h-11 rounded-xl font-semibold shadow-sm active:scale-[0.97]"
                >
                  <Download className="h-4 w-4 mr-1.5" /> High-DPI PNG
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDownload('svg')}
                  className="h-11 rounded-xl font-semibold active:scale-[0.97]"
                >
                  <Download className="h-4 w-4 mr-1.5" /> Vector SVG
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={handlePrintTentCard}
                className="w-full h-10 rounded-xl text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" /> Print-Ready Tent Card
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
