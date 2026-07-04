'use client';

import * as React from 'react';
import type { SeoConfig, OgImageMode } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Globe, Sparkles, Loader2, Search, Share2, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Recommended max lengths used for the live preview truncation + counters. */
const TITLE_MAX = 60;
const DESC_MAX = 155;

export interface SeoSettingsCardProps {
  /** Controlled SEO config value. */
  value: SeoConfig;
  /** Called with the full next config on any field change. */
  onChange: (next: SeoConfig) => void;
  /** Human label for the `asset` image mode, e.g. "Survey Banner", "Hero Image". */
  assetLabel: string;
  /** The content's own image (banner/hero/cover), previewed for `asset` mode. */
  assetImageUrl?: string;
  /** The org/entity logo, previewed for `entity_logo` mode. */
  entityLogoUrl?: string;
  /** Content title — placeholder + fallback used in the preview. */
  contentTitle?: string;
  /** Content description — placeholder + fallback used in the preview. */
  contentDescription?: string;
  /** Public URL shown in the search/social preview, e.g. "smartsapp.com/surveys/x". */
  previewUrl?: string;
  /** Optional AI keyword generation handler; shows the ✨ button when provided. */
  onGenerateKeywords?: () => void;
  /** AI keyword generation in-flight flag. */
  isGeneratingKeywords?: boolean;
  /**
   * Injects a surface-specific image picker for `custom` mode (e.g. MediaSelect).
   * Falls back to a plain URL input when omitted (keeps this component decoupled
   * from any media library).
   */
  renderImagePicker?: (value: string, onChange: (url: string) => void) => React.ReactNode;
  /** Short hint under the card title, e.g. "…how this survey appears when shared." */
  description?: string;
  className?: string;
}

const IMAGE_MODES: { mode: OgImageMode; label: string; hint: (assetLabel: string) => string }[] = [
  { mode: 'asset', label: 'Content Image', hint: (l) => `Uses the ${l.toLowerCase()}` },
  { mode: 'entity_logo', label: 'Organization Logo', hint: () => 'Uses the brand/entity logo' },
  { mode: 'custom', label: 'Custom Image', hint: () => 'Pick a distinct image for sharing' },
];

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Surface-agnostic SEO & social-sharing editor with a live Google search-result
 * and social-card preview. Controlled via {@link SeoConfig}; mirror of the
 * resolution rules in `resolveSeoMetadata` so the preview matches what ships.
 *
 * Mounted in the publish step of every public surface (surveys, pages, meetings,
 * forms, signing documents).
 */
export function SeoSettingsCard({
  value,
  onChange,
  assetLabel,
  assetImageUrl,
  entityLogoUrl,
  contentTitle,
  contentDescription,
  previewUrl = 'smartsapp.com',
  onGenerateKeywords,
  isGeneratingKeywords,
  renderImagePicker,
  description = 'Configure how this page appears in search engines and when shared on social.',
  className,
}: SeoSettingsCardProps) {
  const patch = React.useCallback(
    (delta: Partial<SeoConfig>) => onChange({ ...value, ...delta }),
    [onChange, value],
  );

  const useFallback = value.useContentFallback === true;
  const mode: OgImageMode = value.ogImageMode ?? 'asset';

  // Effective values — mirror resolveSeoMetadata so the preview is truthful.
  const displayTitle = (!useFallback ? value.title?.trim() : '') || contentTitle?.trim() || 'Untitled page';
  const displayDescription =
    (!useFallback ? value.description?.trim() : '') ||
    contentDescription?.trim() ||
    'No description provided yet.';

  const previewImage =
    mode === 'custom' ? value.ogImageUrl : mode === 'entity_logo' ? entityLogoUrl : assetImageUrl;

  const keywords = (value.keywords ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return (
    <Card className={cn('rounded-2xl border border-border bg-card overflow-hidden', className)}>
      <CardHeader className="bg-muted/10 border-b py-5 px-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">SEO &amp; Social Sharing</CardTitle>
            <CardDescription className="text-[11px] font-medium text-muted-foreground mt-0.5">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Fallback toggle */}
        <div className="flex items-start justify-between p-4 rounded-2xl bg-muted/10 border border-border/30">
          <div className="space-y-1 pr-4">
            <Label className="text-sm font-bold leading-none">Use Page Default Details</Label>
            <p className="text-[10px] text-muted-foreground font-semibold leading-normal mt-1">
              Automatically use this page&apos;s title and description for SEO and sharing.
            </p>
          </div>
          <Switch
            checked={useFallback}
            onCheckedChange={(checked) => patch({ useContentFallback: checked })}
          />
        </div>

        {/* Title + Keywords */}
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              SEO Meta Title
              {useFallback && (
                <Badge variant="secondary" className="text-[8px] h-3 px-1 py-0 font-bold uppercase">
                  Fallback Active
                </Badge>
              )}
              <span className="ml-auto text-[10px] font-normal text-muted-foreground tabular-nums">
                {(value.title ?? '').length}/{TITLE_MAX}
              </span>
            </Label>
            <Input
              value={value.title ?? ''}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={contentTitle || 'Type a custom title…'}
              disabled={useFallback}
              className="h-11 rounded-xl bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">SEO Keywords</Label>
            <div className="relative flex items-center gap-2">
              <Input
                value={value.keywords ?? ''}
                onChange={(e) => patch({ keywords: e.target.value })}
                placeholder="e.g. feedback, technology, school"
                className="h-11 rounded-xl bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 flex-1"
              />
              {onGenerateKeywords && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={isGeneratingKeywords}
                  onClick={onGenerateKeywords}
                  className="h-11 w-11 rounded-xl border border-border/50 shrink-0 hover:bg-primary/5 hover:text-primary transition-all active:scale-95"
                  title="Generate keywords with AI"
                >
                  {isGeneratingKeywords ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-primary" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            SEO Meta Description
            {useFallback && (
              <Badge variant="secondary" className="text-[8px] h-3 px-1 py-0 font-bold uppercase">
                Fallback Active
              </Badge>
            )}
            <span className="ml-auto text-[10px] font-normal text-muted-foreground tabular-nums">
              {(value.description ?? '').length}/{DESC_MAX}
            </span>
          </Label>
          <Textarea
            value={value.description ?? ''}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder={contentDescription || 'Type a custom description…'}
            disabled={useFallback}
            className="min-h-[100px] rounded-xl bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 resize-none disabled:opacity-50"
          />
        </div>

        <Separator className="border-border/30" />

        {/* Social image mode */}
        <div className="space-y-4">
          <Label className="text-sm font-bold">Social Image (Open Graph)</Label>
          <RadioGroup
            value={mode}
            onValueChange={(next) => patch({ ogImageMode: next as OgImageMode })}
            className="grid grid-cols-1 gap-3"
          >
            {IMAGE_MODES.map(({ mode: m, label, hint }) => (
              <div
                key={m}
                onClick={() => patch({ ogImageMode: m })}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all duration-200',
                  mode === m ? 'border-primary bg-primary/[0.02] ring-1 ring-primary/20' : 'border-border/50 hover:bg-muted/10',
                )}
              >
                <RadioGroupItem value={m} id={`og-mode-${m}`} className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor={`og-mode-${m}`} className="text-xs font-bold cursor-pointer">
                    {m === 'asset' ? assetLabel : label}
                  </Label>
                  <p className="text-[9px] text-muted-foreground leading-snug">{hint(assetLabel)}</p>
                </div>
              </div>
            ))}
          </RadioGroup>

          {mode === 'custom' && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300 space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Custom Social Image
              </Label>
              {renderImagePicker ? (
                renderImagePicker(value.ogImageUrl ?? '', (url) => patch({ ogImageUrl: url }))
              ) : (
                <Input
                  value={value.ogImageUrl ?? ''}
                  onChange={(e) => patch({ ogImageUrl: e.target.value })}
                  placeholder="https://…/social-image.png"
                  className="h-11 rounded-xl bg-card border border-border/50"
                />
              )}
            </div>
          )}
        </div>

        <Separator className="border-border/30" />

        {/* Live previews */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Search Result Preview
            </Label>
          </div>
          <div className="rounded-2xl border border-border/40 bg-card p-4">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[8px] font-bold">
                {previewUrl.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{previewUrl}</span>
            </div>
            <p className="mt-1 text-[#1a0dab] dark:text-[#8ab4f8] text-lg leading-tight font-medium truncate">
              {truncate(displayTitle, TITLE_MAX)}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground leading-snug line-clamp-2">
              {truncate(displayDescription, DESC_MAX)}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Social Card Preview
            </Label>
          </div>
          <div className="rounded-2xl border border-border/40 overflow-hidden bg-card max-w-md">
            <div className="aspect-[1200/630] bg-muted/40 flex items-center justify-center overflow-hidden">
              {previewImage ? (
                // Plain <img> by design: OG URLs are arbitrary hosts not in
                // next/image's remotePatterns, and these tags ship as raw <meta>.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewImage}
                  alt="Social preview"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImageOff className="h-6 w-6" />
                  <span className="text-[10px] font-medium">No social image</span>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border/40 bg-muted/10">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{previewUrl}</p>
              <p className="text-sm font-semibold leading-tight truncate mt-0.5">{truncate(displayTitle, TITLE_MAX)}</p>
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                {truncate(displayDescription, DESC_MAX)}
              </p>
            </div>
          </div>

          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {keywords.slice(0, 12).map((k, i) => (
                <Badge key={`${k}-${i}`} variant="secondary" className="text-[10px] font-medium rounded-lg">
                  {k}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
