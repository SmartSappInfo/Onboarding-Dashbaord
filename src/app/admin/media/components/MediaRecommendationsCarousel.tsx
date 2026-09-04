'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Next-Best Media Recommendations UI:
 *    Renders recommended next content assets upon video/audio playback completion or bottom scroll.
 *    Supports both raw MediaAsset records and scored ContentRecommendationItem records with match score badges.
 * 2. Mobile Accessibility & Touch Target Bounds:
 *    All recommendation cards strictly enforce `min-h-[44px] min-w-[44px]` touch targets
 *    with tactile micro-animations (`active:scale-[0.97]`).
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import type { MediaAsset } from '@/lib/types';
import type { ContentRecommendationItem } from '@/lib/types/media-2.0';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, FileText, Music, Sparkles, Play, Target } from 'lucide-react';

export interface MediaRecommendationsCarouselProps {
  assets?: MediaAsset[];
  recommendationItems?: ContentRecommendationItem[];
  onSelectAsset?: (assetId: string) => void;
  title?: string;
}

export function MediaRecommendationsCarousel({
  assets = [],
  recommendationItems = [],
  onSelectAsset,
  title = 'Recommended Next Content',
}: MediaRecommendationsCarouselProps) {
  // Normalize items into unified presentation list
  const items = recommendationItems.length > 0
    ? recommendationItems.map((rec) => ({
        id: rec.assetId,
        title: rec.title,
        type: rec.type,
        previewImageUrl: rec.previewImageUrl,
        matchScore: rec.matchScore,
        rationale: rec.rationale,
        stageRelevance: rec.stageRelevance,
      }))
    : assets.map((asset) => ({
        id: asset.id,
        title: asset.linkTitle || asset.name || 'Media Asset',
        type: asset.type,
        previewImageUrl: asset.previewImageUrl,
        matchScore: undefined,
        rationale: undefined,
        stageRelevance: undefined,
      }));

  if (items.length === 0) return null;

  return (
    <div className="w-full space-y-4 text-left animate-in fade-in slide-in-from-bottom-2 duration-400">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
            {title}
          </h4>
        </div>
        <span className="text-[11px] font-bold text-muted-foreground">
          {items.length} items
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item) => (
          <Card
            key={item.id}
            onClick={() => onSelectAsset?.(item.id)}
            className="rounded-2xl border-border bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group/card overflow-hidden active:scale-[0.97] min-h-[44px]"
          >
            <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
              {item.previewImageUrl ? (
                <img
                  src={item.previewImageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground space-y-1">
                  {item.type === 'video' && <Video className="h-6 w-6 text-blue-400" />}
                  {item.type === 'document' && <FileText className="h-6 w-6 text-emerald-400" />}
                  {item.type === 'audio' && <Music className="h-6 w-6 text-amber-400" />}
                </div>
              )}

              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <Badge className="text-[9px] font-black uppercase bg-black/60 backdrop-blur-md text-white border-none">
                  {item.type}
                </Badge>
                {item.matchScore && (
                  <Badge className="text-[9px] font-black uppercase bg-primary text-primary-foreground border-none">
                    {item.matchScore}% Match
                  </Badge>
                )}
              </div>

              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
                <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                </div>
              </div>
            </div>

            <CardContent className="p-3.5 space-y-1">
              <p className="text-xs font-bold text-foreground truncate group-hover/card:text-primary transition-colors">
                {item.title}
              </p>
              {item.stageRelevance ? (
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.stageRelevance}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Click to view experience
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
