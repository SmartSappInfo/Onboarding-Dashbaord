'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import type { Organization, AISeedResult } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { saveOrganizationAction } from '@/lib/organization-actions';
import {
    Palette,
    Loader2,
    Save,
    Sparkles,
    Globe,
    CheckCircle2,
    XCircle,
    Info,
    RefreshCw,
    FileCode,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_ORG_FOOTER_HTML, resolveOrgFooter } from '@/lib/services/org-footer-service';
import Footer from '@/components/footer';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Layout } from 'lucide-react';

interface OrganizationBrandingTabProps {
    organization: Organization;
    /** Called after a successful AI seed so the parent can merge regional fields too */
    onSeedApplied?: (seed: AISeedResult) => void;
}

import { AISeedPreview, ensureContrastReady } from '../../components/AISeedPreview';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function OrganizationBrandingTab({ organization, onSeedApplied }: OrganizationBrandingTabProps) {
    const { user } = useUser();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);

    // Branding form state
    const [brandPrimaryColor, setBrandPrimaryColor] = React.useState(organization.brandPrimaryColor || '#3B5FFF');
    const [brandSecondaryColor, setBrandSecondaryColor] = React.useState(organization.brandSecondaryColor || '#8B5CF6');
    const [brandFontFamily, setBrandFontFamily] = React.useState(organization.brandFontFamily || 'Figtree');
    const [unsubscribeCopy, setUnsubscribeCopy] = React.useState(organization.unsubscribeCopy || '');

    // Email footer state (strictly typed)
    const [footerHtml, setFooterHtml] = React.useState<string>(organization.footerHtml ?? DEFAULT_ORG_FOOTER_HTML);
    const [footerEnabled, setFooterEnabled] = React.useState<boolean>(organization.footerEnabled !== false);
    const [footerPreviewMode, setFooterPreviewMode] = React.useState<'code' | 'preview'>('preview');

    // Landing Page Footer states
    const [landingPageFooterEnabled, setLandingPageFooterEnabled] = React.useState<boolean>(organization.landingPageFooterEnabled !== false);
    const [landingPageFooterStyle, setLandingPageFooterStyle] = React.useState<'default' | 'minimalist' | 'centered' | 'custom'>(organization.landingPageFooterStyle || 'default');
    const [landingPageFooterCustomHtml, setLandingPageFooterCustomHtml] = React.useState<string>(organization.landingPageFooterCustomHtml || '');
    const [facebook, setFacebook] = React.useState<string>(organization.socialLinks?.facebook || '');
    const [twitter, setTwitter] = React.useState<string>(organization.socialLinks?.twitter || '');
    const [linkedin, setLinkedin] = React.useState<string>(organization.socialLinks?.linkedin || '');
    const [instagram, setInstagram] = React.useState<string>(organization.socialLinks?.instagram || '');
    const [youtube, setYoutube] = React.useState<string>(organization.socialLinks?.youtube || '');

    // AI Seeding state
    const [seedUrl, setSeedUrl] = React.useState('');
    const [isScraping, setIsScraping] = React.useState(false);
    const [seedResult, setSeedResult] = React.useState<AISeedResult | null>(null);
    const [scrapeError, setScrapeError] = React.useState<string | null>(null);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const result = await saveOrganizationAction(
                organization.id,
                {
                    brandPrimaryColor: brandPrimaryColor.trim(),
                    brandSecondaryColor: brandSecondaryColor.trim(),
                    brandFontFamily: brandFontFamily.trim(),
                    unsubscribeCopy: unsubscribeCopy.trim(),
                    footerHtml: footerHtml.trim(),
                    footerEnabled,
                    landingPageFooterEnabled,
                    landingPageFooterStyle,
                    landingPageFooterCustomHtml: landingPageFooterCustomHtml.trim(),
                    socialLinks: {
                        facebook: facebook.trim() || undefined,
                        twitter: twitter.trim() || undefined,
                        linkedin: linkedin.trim() || undefined,
                        instagram: instagram.trim() || undefined,
                        youtube: youtube.trim() || undefined,
                    },
                },
                user.uid,
            );

            if (result.success) {
                toast({ title: 'Branding Saved', description: 'Institutional theme colors updated successfully.' });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
            }
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred.';
            toast({ variant: 'destructive', title: 'Error', description: errorMsg });
        } finally {
            setIsSaving(false);
        }
    };

    const handleScrape = async () => {
        if (!seedUrl.trim()) return;
        setIsScraping(true);
        setSeedResult(null);
        setScrapeError(null);

        try {
            const response = await fetch('/api/organizations/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: seedUrl.trim() }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setScrapeError(data.error || 'Extraction failed. Please try a different URL or enter details manually.');
                return;
            }

            setSeedResult(data.result as AISeedResult);
        } catch (err: any) {
            setScrapeError('Network error. Please check your connection and try again.');
        } finally {
            setIsScraping(false);
        }
    };

    const handleApplySeed = () => {
        if (!seedResult) return;

        // Apply colors (with contrast correction)
        if (seedResult.brandPrimaryColor) {
            setBrandPrimaryColor(ensureContrastReady(seedResult.brandPrimaryColor));
        }
        if (seedResult.brandSecondaryColor) {
            setBrandSecondaryColor(ensureContrastReady(seedResult.brandSecondaryColor));
        }

        // Check if logo needs proxy upload
        if (seedResult.logoUrl && seedResult.logoUrl.startsWith('http')) {
            fetch('/api/organizations/upload-logo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: seedResult.logoUrl, organizationId: organization.id }),
            })
            .then(res => res.json())
            .then(data => {
                const logoToUse = (data.success && data.storageUrl) ? data.storageUrl : seedResult.logoUrl;
                onSeedApplied?.({
                    ...seedResult,
                    logoUrl: logoToUse
                });
            })
            .catch(err => {
                console.warn('Background logo upload failed:', err);
                onSeedApplied?.(seedResult);
            });
        } else {
            onSeedApplied?.(seedResult);
        }

        toast({
            title: '✨ AI Seeding Applied',
            description: 'Brand colors and organization details have been pre-filled from your website.',
        });
        setSeedResult(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleScrape();
    };

    return (
        <div className="space-y-6">
            {/* ---------------------------------------------------------------- */}
            {/* AI Website Seeding Assistant                                      */}
            {/* ---------------------------------------------------------------- */}
            <Card className="rounded-[2rem] border border-violet-200 dark:border-violet-800/50 shadow-sm overflow-hidden bg-gradient-to-br from-violet-50/50 to-indigo-50/30 dark:from-violet-950/20 dark:to-indigo-950/10">
                <CardHeader className="p-6 pb-4 border-b border-violet-200/60 dark:border-violet-800/40">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/60">
                            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        AI Seeding Assistant
                        <span className="ml-auto text-[9px] font-black text-violet-500 uppercase tracking-widest bg-violet-100 dark:bg-violet-900/50 px-2 py-0.5 rounded-full">
                            Beta
                        </span>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground/80 flex items-start gap-1.5">
                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0 text-violet-400" />
                        Enter your organization's website URL and let AI automatically extract your brand colors, logo, and localization settings.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    {/* URL Input row */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                            <Input
                                id="ai-seed-url"
                                value={seedUrl}
                                onChange={(e) => setSeedUrl(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="https://yourcompany.com"
                                className="h-11 pl-10 rounded-xl bg-background/70 border-violet-200 dark:border-violet-800/60 font-medium text-sm shadow-inner"
                                disabled={isScraping}
                            />
                        </div>
                        <Button
                            onClick={handleScrape}
                            disabled={isScraping || !seedUrl.trim()}
                            className="h-11 px-5 rounded-xl font-bold text-sm gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 transition-all"
                        >
                            {isScraping ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Extracting…
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    Extract Assets
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Error state */}
                    {scrapeError && !isScraping && (
                        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/8 border border-destructive/20 text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                            <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span>{scrapeError}</span>
                            <button
                                onClick={() => setScrapeError(null)}
                                className="ml-auto text-destructive/60 hover:text-destructive transition-colors"
                                aria-label="Dismiss error"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Loading skeleton */}
                    {isScraping && (
                        <div className="rounded-2xl border border-violet-200/60 p-5 space-y-3 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-muted/60" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 bg-muted/60 rounded-full w-1/3" />
                                    <div className="h-2.5 bg-muted/40 rounded-full w-2/3" />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="h-7 w-28 bg-muted/50 rounded-lg" />
                                <div className="h-7 w-28 bg-muted/50 rounded-lg" />
                            </div>
                        </div>
                    )}

                    {/* Seed preview */}
                    {seedResult && !isScraping && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <AISeedPreview
                                seed={seedResult}
                                onApply={handleApplySeed}
                                onDismiss={() => setSeedResult(null)}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ---------------------------------------------------------------- */}
            {/* Manual Branding Controls                                          */}
            {/* ---------------------------------------------------------------- */}
            <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
                <CardHeader className="p-8 border-b">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        Brand & Aesthetics
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                        Customize your institution's theme colors, fonts, and email footer compliance copies
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    {/* Live color mesh preview */}
                    <div
                        className="h-3 w-full rounded-full transition-all duration-500"
                        style={{
                            background: `linear-gradient(90deg, ${brandPrimaryColor} 0%, ${brandSecondaryColor} 100%)`,
                        }}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                Primary Accent Color
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    type="color"
                                    value={brandPrimaryColor}
                                    onChange={(e) => setBrandPrimaryColor(e.target.value)}
                                    className="w-12 h-11 p-1 bg-muted/20 border-none cursor-pointer rounded-xl"
                                />
                                <Input
                                    value={brandPrimaryColor}
                                    onChange={(e) => setBrandPrimaryColor(e.target.value)}
                                    placeholder="#3B5FFF"
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 flex-1"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                Secondary Accent Color
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    type="color"
                                    value={brandSecondaryColor}
                                    onChange={(e) => setBrandSecondaryColor(e.target.value)}
                                    className="w-12 h-11 p-1 bg-muted/20 border-none cursor-pointer rounded-xl"
                                />
                                <Input
                                    value={brandSecondaryColor}
                                    onChange={(e) => setBrandSecondaryColor(e.target.value)}
                                    placeholder="#8B5CF6"
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 flex-1"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                Typography Font Family
                            </Label>
                            <select
                                value={brandFontFamily}
                                onChange={(e) => setBrandFontFamily(e.target.value)}
                                className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-semibold px-4 text-sm"
                            >
                                <option value="Figtree">Figtree</option>
                                <option value="Inter">Inter</option>
                                <option value="Roboto">Roboto</option>
                                <option value="Outfit">Outfit</option>
                                <option value="Montserrat">Montserrat</option>
                                <option value="Poppins">Poppins</option>
                                <option value="DM Sans">DM Sans</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t animate-none">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                            Unsubscribe disclaimer copy (Max 300 characters)
                        </Label>
                        <Textarea
                            value={unsubscribeCopy}
                            onChange={(e) => {
                                if (e.target.value.length <= 300) {
                                    setUnsubscribeCopy(e.target.value);
                                }
                            }}
                            placeholder="You are receiving this email because you registered on our platform..."
                            className="min-h-[90px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed animate-none"
                        />
                        <div className="text-[9px] text-muted-foreground text-right font-bold">
                            {unsubscribeCopy.length}/300 characters
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Email Footer Card */}
            <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
                <CardHeader className="p-8 border-b flex flex-row items-center justify-between flex-wrap gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <FileCode className="h-5 w-5 text-primary" />
                            Email Footer
                        </CardTitle>
                        <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                            Customize the compliance footer appended to outbound email templates
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-muted-foreground">Always Appended</span>
                        <Switch
                            checked={footerEnabled}
                            onCheckedChange={setFooterEnabled}
                            className="data-[state=checked]:bg-primary transition-all duration-200 ease-out"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <Tabs value={footerPreviewMode} onValueChange={(v) => setFooterPreviewMode(v as 'code' | 'preview')} className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <TabsList className="bg-muted/10 border p-0.5 h-9 rounded-xl shadow-sm">
                                <TabsTrigger value="preview" className="text-[10px] font-bold px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">
                                    Preview
                                </TabsTrigger>
                                <TabsTrigger value="code" className="text-[10px] font-bold px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">
                                    HTML Source
                                </TabsTrigger>
                            </TabsList>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (confirm("Reset footer HTML to default? This will overwrite your changes.")) {
                                        setFooterHtml(DEFAULT_ORG_FOOTER_HTML);
                                    }
                                }}
                                className="h-8 rounded-lg text-[10px] font-bold border-muted/50 hover:bg-muted active:scale-[0.97] transition-all"
                            >
                                Reset to Default
                            </Button>
                        </div>

                        <TabsContent value="code" className="space-y-4 focus-visible:ring-0 mt-0">
                            <Textarea
                                value={footerHtml}
                                onChange={(e) => setFooterHtml(e.target.value)}
                                className="min-h-[200px] font-mono text-xs bg-slate-950 text-blue-400 p-4 rounded-2xl border-slate-800 shadow-inner focus-visible:ring-primary/20 leading-relaxed resize-none"
                                placeholder="Enter custom footer HTML here..."
                            />
                            
                            {/* Token Reference Chips */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground ml-1">
                                    Variable Reference Chips (Click to copy placeholder)
                                </Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in slide-in-from-bottom-1 duration-150">
                                    <FooterTokenChip token="unsubscribe_link" description="Recipient unsubscribe link" />
                                    <FooterTokenChip token="unsubscribe_copy" description="Unsubscribe disclaimer" />
                                    <FooterTokenChip token="org_name" description="Organization name" />
                                    <FooterTokenChip token="org_address" description="Physical address" />
                                    <FooterTokenChip token="org_email" description="Support email address" />
                                    <FooterTokenChip token="org_phone" description="Contact phone number" />
                                    <FooterTokenChip token="org_website" description="Website URL" />
                                    <FooterTokenChip token="current_year" description="Current calendar year" />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="preview" className="mt-0 focus-visible:ring-0">
                            <div className="rounded-2xl border bg-slate-50/50 dark:bg-slate-950/20 overflow-hidden shadow-inner h-[220px] transition-all duration-200">
                                {footerEnabled ? (
                                    <iframe
                                        srcDoc={`
                                            <html>
                                                <head>
                                                    <style>
                                                        body {
                                                            margin: 0;
                                                            padding: 0;
                                                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                                                            background-color: #F8FAFC;
                                                        }
                                                    </style>
                                                </head>
                                                <body>
                                                    ${resolveOrgFooter(footerHtml, true, {
                                                        unsubscribe_copy: unsubscribeCopy || 'You are receiving this email because you subscribed to our services. Click here to unsubscribe.',
                                                        unsubscribe_link: '#preview',
                                                        org_name: organization.name || 'Your Organization',
                                                        org_address: organization.address || '123 Main St, City, Country',
                                                        org_email: organization.email || 'contact@yourdomain.com',
                                                        org_phone: organization.phone || '+1 (555) 000-0000',
                                                        org_website: organization.website || 'https://yourdomain.com',
                                                        current_year: new Date().getFullYear().toString(),
                                                        brand_primary_color: brandPrimaryColor,
                                                    })}
                                                </body>
                                            </html>
                                        `}
                                        className="w-full h-full border-none"
                                        title="Footer Preview Frame"
                                        sandbox="allow-same-origin"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/60">
                                        <XCircle className="h-8 w-8 text-muted-foreground/40" />
                                        <p className="text-xs font-semibold">Footer is currently disabled</p>
                                        <p className="text-[10px] text-muted-foreground/40">Toggle "Always Appended" to enable and preview</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Landing Page Footer Card */}
            <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden mt-6">
                <CardHeader className="p-8 border-b flex flex-row items-center justify-between flex-wrap gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Layout className="h-5 w-5 text-primary" />
                            Landing Page Footer
                        </CardTitle>
                        <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                            Customize the dynamic footer rendered across forms, meetings, and survey landing pages
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-muted-foreground">Enabled</span>
                        <Switch
                            checked={landingPageFooterEnabled}
                            onCheckedChange={setLandingPageFooterEnabled}
                            className="data-[state=checked]:bg-primary transition-all duration-200 ease-out"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6 text-left">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Settings Form */}
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground ml-1">Footer Template Style</Label>
                                <Select value={landingPageFooterStyle} onValueChange={(v) => setLandingPageFooterStyle(v as any)}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-semibold text-sm">
                                        <SelectValue placeholder="Select Style Template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default" className="font-semibold text-sm">Default (Multi-column Detailed)</SelectItem>
                                        <SelectItem value="minimalist" className="font-semibold text-sm">Minimalist (Sleek Row)</SelectItem>
                                        <SelectItem value="centered" className="font-semibold text-sm">Centered (Creative Layout)</SelectItem>
                                        <SelectItem value="custom" className="font-semibold text-sm">Custom HTML Layout</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Social Profiles */}
                            <div className="space-y-4 pt-2">
                                <Label className="text-xs font-bold text-muted-foreground ml-1">Social Profiles (URLs)</Label>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Facebook</Label>
                                        <Input
                                            value={facebook}
                                            onChange={(e) => setFacebook(e.target.value)}
                                            placeholder="https://facebook.com/page"
                                            className="h-10 rounded-xl bg-muted/20 border-none text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Twitter / X</Label>
                                        <Input
                                            value={twitter}
                                            onChange={(e) => setTwitter(e.target.value)}
                                            placeholder="https://twitter.com/handle"
                                            className="h-10 rounded-xl bg-muted/20 border-none text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-semibold text-muted-foreground ml-1">LinkedIn</Label>
                                        <Input
                                            value={linkedin}
                                            onChange={(e) => setLinkedin(e.target.value)}
                                            placeholder="https://linkedin.com/company/name"
                                            className="h-10 rounded-xl bg-muted/20 border-none text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Instagram</Label>
                                        <Input
                                            value={instagram}
                                            onChange={(e) => setInstagram(e.target.value)}
                                            placeholder="https://instagram.com/handle"
                                            className="h-10 rounded-xl bg-muted/20 border-none text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-semibold text-muted-foreground ml-1">YouTube</Label>
                                        <Input
                                            value={youtube}
                                            onChange={(e) => setYoutube(e.target.value)}
                                            placeholder="https://youtube.com/c/channel"
                                            className="h-10 rounded-xl bg-muted/20 border-none text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Custom HTML and Live Preview */}
                        <div className="space-y-6 flex flex-col">
                            {landingPageFooterStyle === 'custom' ? (
                                <div className="space-y-3 flex-1 flex flex-col">
                                    <Label className="text-xs font-bold text-muted-foreground ml-1">Custom HTML Template</Label>
                                    <Textarea
                                        value={landingPageFooterCustomHtml}
                                        onChange={(e) => setLandingPageFooterCustomHtml(e.target.value)}
                                        className="flex-1 min-h-[160px] font-mono text-xs bg-slate-950 text-blue-400 p-4 rounded-2xl border-slate-800 shadow-inner focus-visible:ring-primary/20 leading-relaxed resize-none"
                                        placeholder="Enter custom landing footer HTML here..."
                                    />
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-bold text-muted-foreground ml-1">Variable Chips (Click to copy)</Label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <FooterTokenChip token="org_name" description="Org name" />
                                            <FooterTokenChip token="logo_url" description="Logo URL" />
                                            <FooterTokenChip token="org_address" description="Address" />
                                            <FooterTokenChip token="org_email" description="Email" />
                                            <FooterTokenChip token="org_phone" description="Phone" />
                                            <FooterTokenChip token="org_website" description="Website" />
                                            <FooterTokenChip token="facebook_link" description="FB URL" />
                                            <FooterTokenChip token="twitter_link" description="Twitter URL" />
                                            <FooterTokenChip token="linkedin_link" description="LinkedIn URL" />
                                            <FooterTokenChip token="instagram_link" description="Instagram URL" />
                                            <FooterTokenChip token="youtube_link" description="YouTube URL" />
                                            <FooterTokenChip token="current_year" description="Current year" />
                                        </div>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                                        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                        <p className="text-[9px] font-semibold text-amber-800/80 leading-relaxed">
                                            Custom HTML will be sanitized. Event handlers (e.g. <code>onclick</code>, <code>onerror</code>) and script elements will be removed automatically to ensure visitor safety.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 rounded-2xl bg-muted/5 border border-dashed flex-1 flex flex-col justify-center items-center text-center gap-3">
                                    <Layout className="h-8 w-8 text-muted-foreground/30" />
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-muted-foreground">Pre-built Layout Template Active</p>
                                        <p className="text-[10px] text-muted-foreground/60 max-w-[280px]">
                                            You are editing the <strong>{landingPageFooterStyle === 'default' ? 'Multi-column Detailed' : landingPageFooterStyle === 'minimalist' ? 'Minimalist Row' : 'Centered Creative'}</strong> footer template. Enter social URLs to populate handles dynamically.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Dynamic live preview */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground ml-1">Live Visual Preview</Label>
                                <div className="rounded-2xl border bg-slate-50/50 dark:bg-slate-950/20 overflow-hidden shadow-inner p-3 min-h-[140px] flex items-center justify-center">
                                    {landingPageFooterEnabled ? (
                                        <div className="w-full pointer-events-none scale-[0.85] origin-center">
                                            <Footer
                                                orgBranding={{
                                                    logoUrl: organization.logoUrl || '',
                                                    brandPrimaryColor: brandPrimaryColor,
                                                    brandSecondaryColor: brandSecondaryColor,
                                                    brandFontFamily: brandFontFamily,
                                                    name: organization.name || 'Your Organization',
                                                    address: organization.address || '123 Main Street, Suite 100, City, ST 12345',
                                                    email: organization.email || 'support@yourdomain.com',
                                                    phone: organization.phone || '+1 (555) 019-2834',
                                                    website: organization.website || 'https://yourdomain.com',
                                                    landingPageFooterEnabled: true,
                                                    landingPageFooterStyle: landingPageFooterStyle,
                                                    landingPageFooterCustomHtml: landingPageFooterCustomHtml,
                                                    socialLinks: {
                                                        facebook: facebook || undefined,
                                                        twitter: twitter || undefined,
                                                        linkedin: linkedin || undefined,
                                                        instagram: instagram || undefined,
                                                        youtube: youtube || undefined,
                                                    }
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-center space-y-1 text-muted-foreground/50">
                                            <XCircle className="h-6 w-6 mx-auto text-muted-foreground/30" />
                                            <p className="text-[10px] font-bold">Footer is currently disabled</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-xl font-bold h-11 px-8 shadow-lg shadow-primary/10"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Branding
                </Button>
            </div>
        </div>
    );
}

interface FooterTokenChipProps {
    token: string;
    description: string;
}

function FooterTokenChip({ token, description }: FooterTokenChipProps) {
    const { toast } = useToast();
    const handleCopy = () => {
        navigator.clipboard.writeText(`{{${token}}}`);
        toast({ title: 'Copied to Clipboard', description: `{{${token}}} copied.` });
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="flex flex-col items-start p-2.5 rounded-xl border bg-card hover:bg-violet-50/50 hover:border-violet-200/50 dark:hover:bg-violet-950/20 dark:hover:border-violet-800/30 transition-all text-left group active:scale-[0.97] transition-all duration-150"
        >
            <span className="text-[10px] font-bold font-mono text-violet-600 dark:text-violet-400 group-hover:text-violet-700">{`{{${token}}}`}</span>
            <span className="text-[8px] font-semibold text-muted-foreground mt-0.5">{description}</span>
        </button>
    );
}
