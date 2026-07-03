'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Palette, Loader2, Save, Download, Sparkles } from 'lucide-react';
import type { SocialBrandKit } from '@/lib/types';

export default function BrandKitClient() {
  const db = useFirestore();
  const { activeWorkspaceId } = useTenant();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Brand state variables
  const [primaryColor, setPrimaryColor] = React.useState('#10b981'); // Emerald
  const [secondaryColor, setSecondaryColor] = React.useState('#06b6d4'); // Cyan
  const [fontFamily, setFontFamily] = React.useState('Outfit');
  const [logoUrl, setLogoUrl] = React.useState('');
  const [bannerText, setBannerText] = React.useState('Empowering the Next Generation of Creative Leaders');

  const svgRef = React.useRef<SVGSVGElement | null>(null);

  // 1. Fetch default Brand Kit parameters from Firestore
  React.useEffect(() => {
    async function loadBrandKit() {
      if (!db || !activeWorkspaceId) return;
      setIsLoading(true);
      try {
        const brandDoc = await getDoc(doc(db, 'socialBrandKits', `default_${activeWorkspaceId}`));
        if (brandDoc.exists()) {
          const data = brandDoc.data() as SocialBrandKit;
          setPrimaryColor(data.primaryColor || '#10b981');
          setSecondaryColor(data.secondaryColor || '#06b6d4');
          setFontFamily(data.fontFamily || 'Outfit');
          setLogoUrl(data.logoUrl || '');
          setBannerText(data.bannerText || 'Empowering the Next Generation of Creative Leaders');
        }
      } catch (err: unknown) {
        console.error('[BRANDKIT:LOAD] Error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadBrandKit();
  }, [db, activeWorkspaceId]);

  // 2. Save brand assets
  const handleSaveBrandKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !activeWorkspaceId) return;

    setIsSaving(true);
    try {
      const payload: SocialBrandKit = {
        id: `default_${activeWorkspaceId}`,
        workspaceId: activeWorkspaceId,
        primaryColor,
        secondaryColor,
        fontFamily,
        logoUrl: logoUrl.trim() || undefined,
        bannerText: bannerText.trim(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'socialBrandKits', payload.id), payload);

      toast({
        title: 'Brand Assets Saved',
        description: 'Vibe custom colors, fonts, and slogans are loaded and synchronized.',
      });
    } catch (err: unknown) {
      console.error('[BRANDKIT:SAVE] Error:', err);
      const msg = err instanceof Error ? err.message : 'Save brand kit failed';
      toast({
        title: 'Save Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Export generated SVG card banner
  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    try {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgRef.current);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `brand_flyer_announcement_${activeWorkspaceId}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Download Started',
        description: 'Vector poster flyer saved successfully.',
      });
    } catch (err: unknown) {
      console.error('[BRANDKIT:DOWNLOAD] Error:', err);
      toast({
        title: 'Download Failed',
        description: 'Could not export vector image.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-8 px-4">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Palette className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Media Brand Kits</h1>
            <p className="text-muted-foreground text-xs font-medium">Define your colors, logo, and slogan assets to style promotional media cards on the fly.</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Card className="border border-border/30 rounded-3xl bg-card/40 backdrop-blur-md">
          <CardContent className="h-96 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Loading Brand Guidelines...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Column 1: Config Form (5/12) */}
          <form onSubmit={handleSaveBrandKit} className="lg:col-span-5 space-y-6">
            <Card className="border border-border/30 bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl">
              <CardHeader>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Asset Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Brand Colors row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="primary-color-input" className="text-[10px] font-bold uppercase text-muted-foreground">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="primary-color-input"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-9 w-12 rounded-lg border-border/30 p-1 bg-background cursor-pointer"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-9 rounded-lg border-border/30 bg-background text-xs uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="secondary-color-input" className="text-[10px] font-bold uppercase text-muted-foreground">Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="secondary-color-input"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="h-9 w-12 rounded-lg border-border/30 p-1 bg-background cursor-pointer"
                      />
                      <Input
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="h-9 rounded-lg border-border/30 bg-background text-xs uppercase font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Typography Font */}
                <div className="space-y-1.5">
                  <Label htmlFor="font-family-select" className="text-[10px] font-bold uppercase text-muted-foreground">Font Family</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger id="font-family-select" className="h-10 rounded-xl border-border/30 bg-background text-xs font-semibold">
                      <SelectValue placeholder="Select typography font" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl font-medium text-xs">
                      <SelectItem value="Outfit">Outfit</SelectItem>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Logo Url */}
                <div className="space-y-1.5">
                  <Label htmlFor="logo-url-input" className="text-[10px] font-bold uppercase text-muted-foreground">Logo URL (Optional)</Label>
                  <Input
                    id="logo-url-input"
                    placeholder="https://example.com/logo.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="h-10 rounded-xl border-border/30 bg-background text-xs"
                  />
                  <p className="text-[9px] text-amber-500 font-semibold leading-relaxed mt-1">
                    ⚠️ Note: External logo image URLs must support CORS headers (cross-origin sharing) to render correctly in SVG-to-vector image downloads.
                  </p>
                </div>

                {/* Slogan */}
                <div className="space-y-1.5">
                  <Label htmlFor="slogan-input" className="text-[10px] font-bold uppercase text-muted-foreground">Flyer Announcement Slogan</Label>
                  <Textarea
                    id="slogan-input"
                    placeholder="Type slogan overlay text..."
                    rows={3}
                    value={bannerText}
                    onChange={(e) => setBannerText(e.target.value)}
                    className="rounded-xl border-border/30 bg-background text-xs leading-relaxed"
                  />
                </div>
              </CardContent>

              <div className="border-t border-border/10 p-4 bg-muted/10 flex justify-end gap-2">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wider uppercase active:scale-[0.97] transition-all gap-1.5 shadow-lg shadow-emerald-500/10"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Brand Kit
                </Button>
              </div>
            </Card>
          </form>

          {/* Column 2: Live SVG Flyer Canvas (7/12) */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border border-border/30 bg-card/10 backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/2 to-transparent pointer-events-none" />
              <CardHeader className="border-b border-border/10 bg-muted/5 py-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-500 animate-pulse" /> Live Canvas Flyer Preview
                </CardTitle>
                
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadSVG}
                  className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-1.5 active:scale-[0.97] transition-all"
                >
                  <Download className="h-3.5 w-3.5" /> Download SVG
                </Button>
              </CardHeader>
              <CardContent className="p-6 flex items-center justify-center bg-muted/20">
                {/* SVG Poster announcement card container */}
                <div className="border border-border/40 rounded-2xl overflow-hidden shadow-2xl bg-background max-w-full">
                  <svg
                    ref={svgRef}
                    width="460"
                    height="320"
                    viewBox="0 0 460 320"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ fontFamily }}
                    className="transition-all duration-300"
                  >
                    {/* Color Gradients definitions */}
                    <defs>
                      <linearGradient id="flyerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={primaryColor} />
                        <stop offset="100%" stopColor={secondaryColor} />
                      </linearGradient>
                    </defs>

                    {/* Gradient background border */}
                    <rect width="460" height="320" fill="url(#flyerGrad)" />

                    {/* Inner layout border wrapper */}
                    <rect x="15" y="15" width="430" height="290" rx="16" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

                    {/* Logo Monogram badge */}
                    {logoUrl ? (
                      <image
                        href={logoUrl}
                        x="205"
                        y="35"
                        width="50"
                        height="50"
                        clipPath="inset(0% round 12px)"
                      />
                    ) : (
                      <g>
                        <rect x="210" y="35" width="40" height="40" rx="10" fill="url(#flyerGrad)" />
                        <text x="230" y="60" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle">VA</text>
                      </g>
                    )}

                    {/* Flyer Slogan using foreignObject for HTML auto-wrapping */}
                    <foreignObject x="40" y="95" width="380" height="110">
                      <div 
                        style={{ fontFamily }}
                        className="w-full h-full flex items-center justify-center text-center text-white font-extrabold text-sm leading-relaxed break-words px-2"
                      >
                        {bannerText || 'School Slogan placeholder'}
                      </div>
                    </foreignObject>

                    {/* CTA Admission badge */}
                    <g>
                      <rect x="150" y="225" width="160" height="32" rx="10" fill="url(#flyerGrad)" />
                      <text x="230" y="245" fill="#fff" fontSize="9" fontWeight="bold" letterSpacing="1" textAnchor="middle" transform="translate(0, 1)">
                        ADMISSIONS OPEN 2026
                      </text>
                    </g>

                    {/* Bottom stamp */}
                    <text x="230" y="285" fill="rgba(255,255,255,0.4)" fontSize="8" letterSpacing="0.5" textAnchor="middle">
                      POWERED BY SMARTSAPP SOCIAL
                    </text>
                  </svg>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
