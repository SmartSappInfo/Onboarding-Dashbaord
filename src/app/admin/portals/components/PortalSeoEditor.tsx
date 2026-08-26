'use client';

/**
 * {{Org_name}} Experience Platform — Portal SEO & Social Graph Editor
 *
 * Configures search engine metadata, OpenGraph cards, Twitter previews,
 * and indexing policies with live snippet previews.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Globe, Search, Share2, Eye, ShieldAlert } from 'lucide-react';
import type { PortalSeoConfig, PortalBranding } from '@/lib/types/portal';

interface PortalSeoEditorProps {
  seo: PortalSeoConfig;
  branding: PortalBranding;
  portalName: string;
  slug: string;
  onChangeSeo: (seo: PortalSeoConfig) => void;
}

export function PortalSeoEditor({
  seo,
  branding,
  portalName,
  slug,
  onChangeSeo,
}: PortalSeoEditorProps) {
  const [keywordInput, setKeywordInput] = React.useState('');

  const displayTitle = seo.metaTitle || seo.ogTitle || `${portalName} — ${branding.brandName || 'Portal'}`;
  const displayDescription =
    seo.metaDescription ||
    seo.ogDescription ||
    branding.tagline ||
    'Interactive digital experience portal.';

  const handleAddKeyword = () => {
    if (!keywordInput.trim()) return;
    const clean = keywordInput.trim().toLowerCase();
    const current = seo.keywords || [];
    if (!current.includes(clean)) {
      onChangeSeo({ ...seo, keywords: [...current, clean] });
    }
    setKeywordInput('');
  };

  const handleRemoveKeyword = (keyword: string) => {
    const current = seo.keywords || [];
    onChangeSeo({ ...seo, keywords: current.filter(k => k !== keyword) });
  };

  return (
    <div className="space-y-6">
      {/* ── Metadata Configuration ────────────────────────────────────── */}
      <Card className="rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Globe className="w-4 h-4" /> Search Engine Optimization (SEO)
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="meta-title" className="text-xs font-bold">
                Meta Title
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {(seo.metaTitle || '').length}/60 chars
              </span>
            </div>
            <Input
              id="meta-title"
              placeholder="e.g. SmartSapp Academy — Fee Collection Masterclass"
              value={seo.metaTitle || ''}
              onChange={e => onChangeSeo({ ...seo, metaTitle: e.target.value })}
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="meta-desc" className="text-xs font-bold">
                Meta Description
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {(seo.metaDescription || '').length}/160 chars
              </span>
            </div>
            <Textarea
              id="meta-desc"
              placeholder="e.g. Join the official academy to master fee collection strategies for your school..."
              value={seo.metaDescription || ''}
              onChange={e => onChangeSeo({ ...seo, metaDescription: e.target.value })}
              className="rounded-xl text-xs min-h-[72px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Keywords / Tags</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Type keyword and press Enter..."
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                className="h-10 rounded-xl text-xs"
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                className="h-10 px-4 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 transition-all"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(seo.keywords || []).map(kw => (
                <Badge
                  key={kw}
                  variant="secondary"
                  className="gap-1.5 px-2.5 py-0.5 text-xs rounded-lg"
                >
                  #{kw}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(kw)}
                    className="text-muted-foreground hover:text-rose-500 font-bold"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <Label htmlFor="og-image" className="text-xs font-bold">
              Social Sharing Image URL (OpenGraph / Twitter)
            </Label>
            <Input
              id="og-image"
              placeholder="https://.../og-banner.png (Recommended 1200x630)"
              value={seo.ogImage || ''}
              onChange={e => onChangeSeo({ ...seo, ogImage: e.target.value })}
              className="h-10 rounded-xl text-xs font-mono"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border mt-2">
            <div>
              <p className="text-xs font-bold text-foreground">Block Search Engine Indexing (noindex)</p>
              <p className="text-[11px] text-muted-foreground">
                Prevents search engines from crawling and indexing this portal.
              </p>
            </div>
            <Switch
              checked={seo.noIndex || false}
              onCheckedChange={checked => onChangeSeo({ ...seo, noIndex: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Social Card Preview ───────────────────────────────────────── */}
      <Card className="rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Share2 className="w-4 h-4" /> Live Social Share Preview (WhatsApp / Twitter / LinkedIn)
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-w-lg mx-auto rounded-2xl border border-border bg-card overflow-hidden shadow-md">
            {/* Social Card Image */}
            <div className="h-44 w-full bg-muted flex items-center justify-center overflow-hidden relative">
              {seo.ogImage || branding.coverImageUrl ? (
                <img
                  src={seo.ogImage || branding.coverImageUrl}
                  alt="OG Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <Globe className="w-8 h-8 mx-auto text-muted-foreground/40 mb-1" />
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    No custom share image configured
                  </span>
                </div>
              )}
            </div>

            {/* Social Card Content */}
            <div className="p-4 space-y-1 bg-card">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                portal.smartsapp.com/portal/{slug || 'academy'}
              </span>
              <h4 className="font-bold text-sm text-foreground line-clamp-1">{displayTitle}</h4>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {displayDescription}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
