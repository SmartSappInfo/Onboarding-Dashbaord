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
} from 'lucide-react';

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
                },
                user.uid,
            );

            if (result.success) {
                toast({ title: 'Branding Saved', description: 'Institutional theme colors updated successfully.' });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
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

                    <div className="space-y-2 pt-4 border-t">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                            Unsubscribe compliance text (Max 300 characters)
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
                </CardContent>
            </Card>
        </div>
    );
}
