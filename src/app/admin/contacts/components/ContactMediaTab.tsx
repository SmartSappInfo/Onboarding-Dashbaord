'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Contact Media Tab UI:
 *    Displays media engagement metrics, watch percentage heatmaps, content format preferences,
 *    and activity histories for individual contacts in CRM drawers and profile pages.
 * 2. TagSelector & Link Action Integration:
 *    Uses standardized `<TagSelector>` in draft/client mode for applying workspace contact tags.
 * 3. Mobile Accessibility & Micro-animations:
 *    Enforces `min-h-[44px] min-w-[44px]` touch target bounds with Emil Kowalski micro-animations (`active:scale-[0.97]`).
 * 4. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState, useEffect } from 'react';
import { useFirestore } from '@/lib/firestore-context';
import type { ContactMediaProfile } from '@/lib/types/media-2.0';
import { getContactMediaProfileAction } from '@/lib/media/crm-media-service';
import { TagSelector } from '@/components/tags/TagSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Eye, Clock, MousePointerClick, Download, 
  Flame, Video, FileText, Music, Sparkles, ExternalLink, Bot 
} from 'lucide-react';
import { MediaCopilotDrawer } from '@/app/admin/media/components/MediaCopilotDrawer';

export interface ContactMediaTabProps {
  contactId: string;
  workspaceId: string;
  contactTagIds?: string[];
  onTagsChange?: (newTagIds: string[]) => void;
}

export function ContactMediaTab({
  contactId,
  workspaceId,
  contactTagIds = [],
  onTagsChange,
}: ContactMediaTabProps) {
  const firestore = useFirestore();
  const [profile, setProfile] = useState<ContactMediaProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      if (!firestore || !contactId) return;
      setIsLoading(true);
      const data = await getContactMediaProfileAction(firestore, workspaceId, contactId);
      if (isMounted) {
        setProfile(data);
        setIsLoading(false);
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [firestore, workspaceId, contactId]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground space-y-2">
        <Sparkles className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p className="text-xs font-bold">Compiling Media Engagement Profile...</p>
      </div>
    );
  }

  if (!profile || profile.metrics.totalViews === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground space-y-3 border border-dashed rounded-3xl bg-muted/10">
        <Eye className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="text-xs font-extrabold text-foreground">No Media Activity Captured</p>
        <p className="text-[11px] max-w-sm mx-auto">
          This contact has not yet viewed or interacted with any shared media pages or experiences.
        </p>
      </div>
    );
  }

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Engagement Score & KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Engagement Score</p>
              <p className="text-2xl font-black text-primary">{profile.metrics.overallScore} / 100</p>
            </div>
            <Flame className="h-6 w-6 text-amber-500" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Total Views</p>
              <p className="text-2xl font-black text-foreground">{profile.metrics.totalViews}</p>
            </div>
            <Eye className="h-6 w-6 text-blue-500" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Avg Watch %</p>
              <p className="text-2xl font-black text-emerald-500">{profile.metrics.avgCompletionPercent}%</p>
            </div>
            <Clock className="h-6 w-6 text-emerald-500" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">CTA Clicks</p>
              <p className="text-2xl font-black text-purple-500">{profile.metrics.totalCtaClicks}</p>
            </div>
            <MousePointerClick className="h-6 w-6 text-purple-500" />
          </CardContent>
        </Card>
      </div>

      {/* Content Format & Intent Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/20 border border-border rounded-2xl">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-black uppercase bg-primary/10 text-primary border-primary/20">
            Preferred Format: {profile.preferredFormat}
          </Badge>
          {profile.highIntentSignalsCount > 0 && (
            <Badge className="text-[10px] font-black uppercase bg-amber-500 text-white border-none gap-1">
              <Sparkles className="h-3 w-3" /> {profile.highIntentSignalsCount} High-Intent Signals
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCopilotOpen(true)}
            className="rounded-xl text-xs font-bold h-9 px-3 min-h-[44px] gap-1.5 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary active:scale-[0.97]"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Draft Outreach with AI</span>
          </Button>
          <p className="text-[11px] font-bold text-muted-foreground">
            Total Watch: {formatSeconds(profile.metrics.totalTimeSeconds)}
          </p>
        </div>
      </div>

      {/* Tag Selector Integration */}
      <div className="p-4 border border-border rounded-2xl bg-card space-y-2">
        <p className="text-xs font-extrabold text-foreground">Contact Engagement Tags</p>
        <TagSelector
          currentTagIds={contactTagIds}
          onTagsChange={onTagsChange || (() => {})}
          className="min-h-[44px]"
        />
      </div>

      {/* Activity Timeline List */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider">
          Media Activity History ({profile.activities.length})
        </h4>

        <div className="space-y-2">
          {profile.activities.map((act) => (
            <div
              key={act.shareId}
              className="p-4 border border-border rounded-2xl bg-card hover:bg-muted/10 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {act.mediaType === 'video' && <Video className="h-4 w-4 text-blue-500 shrink-0" />}
                  {act.mediaType === 'document' && <FileText className="h-4 w-4 text-emerald-500 shrink-0" />}
                  {act.mediaType === 'audio' && <Music className="h-4 w-4 text-amber-500 shrink-0" />}
                  <span className="text-xs font-bold text-foreground truncate">{act.assetTitle}</span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium">
                  <span>{act.viewCount} views</span>
                  <span>•</span>
                  <span>{act.ctaClickedCount} CTA clicks</span>
                  <span>•</span>
                  <span>{act.downloadCount} downloads</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                    <span>Watch Progress</span>
                    <span>{act.maxCompletionPercent}%</span>
                  </div>
                  <Progress value={act.maxCompletionPercent} className="h-1.5" />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`/m/${act.shareId}`, '_blank')}
                  className="rounded-xl text-xs font-bold h-9 px-3 min-h-[44px] gap-1.5 active:scale-[0.97]"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View Page
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <MediaCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        initialPersona="REPURPOSER"
        contextType="contact"
        contextId={contactId}
        contextPayload={{
          contactId,
          overallScore: profile.metrics.overallScore,
          totalViews: profile.metrics.totalViews,
          preferredFormat: profile.preferredFormat,
          topActivities: profile.activities.map(a => a.assetTitle).slice(0, 3).join(', '),
          avgCompletionPercent: profile.metrics.avgCompletionPercent,
        }}
      />
    </div>
  );
}
