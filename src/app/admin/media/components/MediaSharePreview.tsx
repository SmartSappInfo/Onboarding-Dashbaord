'use client';

import * as React from 'react';
import { 
  Play, Pause, Music, Link2, Download, ExternalLink, 
  Sparkles, Lock, ArrowRight, Globe, Layers, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MediaAsset, OrgBranding } from '@/lib/types';
import { getEffectiveDescription } from './share-media-dialog';
import { cn } from '@/lib/utils';

export interface MediaSharePreviewProps {
  asset: MediaAsset;
  title: string;
  description: string;
  ctaText: string;
  ctaType: 'none' | 'survey' | 'form' | 'pdf' | 'page' | 'external';
  ctaTargetUrl: string;
  ctaPretext: string;
  ctaPopoverEnabled: boolean;
  ctaActivationGate?: 'immediate' | 'quarter' | 'half' | 'threequarters' | 'complete';
  autoPlay?: boolean;
  orgBranding: OrgBranding | null;
  className?: string;
}

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * MediaSharePreview provides a lightweight, real-time client preview of the public media share page (/m/[shareId]).
 * 
 * Performance & Memory Considerations:
 * 1. Uses memoized string resolution for descriptions rather than heavy iframe re-instantiations during typing.
 * 2. Visual elements mirror MediaShareClient to provide 100% visual fidelity for admin publishers.
 * 3. Handles all asset types (video, audio, document, image, link) and CTA gating states seamlessly.
 */
export function MediaSharePreview({
  asset,
  title,
  description,
  ctaText,
  ctaType,
  ctaTargetUrl,
  ctaPretext,
  ctaPopoverEnabled,
  ctaActivationGate = 'immediate',
  autoPlay = false,
  orgBranding,
  className,
}: MediaSharePreviewProps) {
  const effectiveDesc = React.useMemo(() => {
    return getEffectiveDescription(description, asset.type);
  }, [description, asset.type]);

  const displayTitle = title.trim() || asset.name;
  const orgName = orgBranding?.name || 'Workspace';
  const fallbackInitials = orgName.substring(0, 2).toUpperCase();
  
  // Resolve thumbnail for video preview
  const videoId = React.useMemo(() => {
    if (asset.type !== 'video' || !asset.url) return null;
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = asset.url.match(ytRegex);
    return match ? match[1] : null;
  }, [asset.type, asset.url]);

  const thumbUrl = asset.previewImageUrl || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null);

  return (
    <div className={cn("w-full max-w-lg mx-auto flex flex-col rounded-3xl border border-slate-300 dark:border-slate-800 bg-card shadow-2xl overflow-hidden text-card-foreground transition-all duration-200", className)}>
      {/* Mock Browser Header */}
      <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-background/80 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-muted-foreground font-mono truncate max-w-[200px]">
          <Globe className="h-3 w-3 text-primary shrink-0" />
          <span className="truncate">/m/preview</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
            Live Preview
          </span>
        </div>
      </div>

      {/* Preview Page Body */}
      <div className="p-5 md:p-6 space-y-5 text-center flex-1 overflow-y-auto max-h-[600px] bg-gradient-to-b from-background via-background to-muted/20">
        {/* Org Branding Banner */}
        <div className="flex items-center justify-center gap-3 pt-1">
          {orgBranding?.logoUrl ? (
            <img 
              src={orgBranding.logoUrl} 
              alt={orgName} 
              className="h-8 max-w-[140px] object-contain"
            />
          ) : (
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-black shadow-sm">
              {fallbackInitials}
            </div>
          )}
          <span className="text-xs font-black text-foreground tracking-tight">{orgName}</span>
        </div>

        {/* Media Viewing Box */}
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden shadow-lg group">
          {asset.type === 'video' && (
            <div className="relative w-full aspect-video flex items-center justify-center bg-slate-950">
              {thumbUrl ? (
                <img 
                  src={thumbUrl} 
                  alt={displayTitle} 
                  className="w-full h-full object-cover opacity-80"
                />
              ) : (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                  <Play className="h-10 w-10 text-slate-500" />
                </div>
              )}
              <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center">
                <div className="p-3.5 bg-primary text-white rounded-2xl shadow-xl shadow-primary/30 group-hover:scale-110 transition-transform">
                  <Play className="h-6 w-6 fill-current" />
                </div>
              </div>
              {autoPlay && (
                <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-emerald-500/90 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow">
                  <Sparkles className="h-2.5 w-2.5" /> Auto-Play Active
                </div>
              )}
            </div>
          )}

          {asset.type === 'audio' && (
            <div className="p-6 space-y-4 bg-slate-900 text-white text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30 shadow-md">
                <Music className="h-6 w-6" />
              </div>
              <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <div className="p-2 bg-primary text-white rounded-lg">
                  <Play className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1 text-left">
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-1/3" />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-slate-400">
                    <span>0:00</span>
                    <span>Audio Player</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {asset.type === 'image' && (
            <div className="relative w-full aspect-video bg-slate-950 flex items-center justify-center">
              <img 
                src={asset.url} 
                alt={displayTitle} 
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          {asset.type === 'document' && (
            <div className="p-8 bg-slate-900 text-white text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Download className="h-6 w-6" />
              </div>
              <p className="text-xs font-extrabold truncate px-2">{asset.name}</p>
            </div>
          )}

          {asset.type === 'link' && (
            <div className="p-8 bg-slate-900 text-white text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Link2 className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-slate-400 truncate">{asset.url}</p>
            </div>
          )}
        </div>

        {/* Title & Description Container */}
        <div className="space-y-2 text-center pt-1">
          <h4 className="text-base md:text-lg font-black tracking-tight text-foreground leading-snug">
            {displayTitle}
          </h4>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed whitespace-pre-line max-w-md mx-auto">
            {effectiveDesc}
          </p>
        </div>

        {/* CTA Pretext & Button Preview */}
        {ctaType !== 'none' && (
          <div className="space-y-3 pt-3 border-t border-dashed border-border/60 text-center animate-in fade-in duration-200">
            {ctaPretext.trim() && (
              <p className="text-xs font-semibold text-foreground/90 whitespace-pre-line leading-relaxed max-w-sm mx-auto">
                {ctaPretext}
              </p>
            )}
            
            <Button
              type="button"
              className="rounded-2xl font-extrabold h-11 px-6 bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg flex items-center gap-2 group text-xs tracking-wider uppercase mx-auto cursor-default pointer-events-none"
            >
              {ctaActivationGate !== 'immediate' && <Lock className="h-3.5 w-3.5 mr-0.5" />}
              {ctaText.trim() || 'Get Started'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>

            {ctaActivationGate !== 'immediate' && (
              <p className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                <Lock className="h-2.5 w-2.5" /> Unlocks {ctaActivationGate === 'quarter' ? 'at 25%' : ctaActivationGate === 'half' ? 'halfway' : ctaActivationGate === 'threequarters' ? 'at 75%' : 'on complete'}
              </p>
            )}

            {ctaPopoverEnabled && (
              <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400 flex items-center justify-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> Popover modal enabled on playback completion
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MediaSharePreview;
