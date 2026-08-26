'use client';

/**
 * @fileoverview Upcoming Sessions & Webinars Card (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Highlights upcoming high-capacity sessions, orientations, and webinars.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Users, Share2, Sparkles, ExternalLink, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function UpcomingSessionsCard() {
  const { toast } = useToast();

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/book/masterclass`);
    toast({
      title: 'Registration Link Copied! 🔗',
      description: 'Public webinar registration link copied to clipboard.',
    });
  };

  return (
    <Card className="rounded-3xl border border-border/80 shadow-xs bg-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Video className="w-4 h-4 text-purple-600" />
            Upcoming Sessions & Webinars
          </CardTitle>
          <p className="text-xs text-muted-foreground">Broadcast sessions, workshops, and large group meetings</p>
        </div>
        <Link href="/admin/meetings/event-types">
          <Button variant="ghost" size="sm" className="rounded-xl text-xs font-semibold text-primary hover:underline h-7 px-2">
            View All <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        <div className="p-5 rounded-2xl border border-purple-200/60 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-600 text-white font-bold text-[10px] uppercase tracking-wider">
                  Live Masterclass
                </Badge>
                <span className="text-xs font-bold text-muted-foreground">Thursday, Aug 28 • 7:00 PM UTC</span>
              </div>
              <h4 className="text-base font-bold text-foreground">
                Executive Masterclass: SmartSapp Architecture & Automation
              </h4>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card/80 border px-3 py-1.5 rounded-xl shrink-0">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <strong className="text-foreground font-bold">128</strong> Registered
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            Live interactive broadcast with backstage presenter staging, audience Q&A, and hand raises for enterprise prospects and leaders.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-purple-200/40 dark:border-purple-900/30">
            <Link href="/admin/meetings/event-types">
              <Button size="sm" className="rounded-xl h-8 text-xs font-bold gap-1.5 px-4 active:scale-[0.97]">
                <Video className="w-3.5 h-3.5" /> Manage Session
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="rounded-xl h-8 text-xs font-semibold gap-1.5 px-3 border-purple-200/60 text-purple-700 dark:text-purple-300 hover:bg-purple-50 active:scale-[0.97]"
            >
              <Share2 className="w-3.5 h-3.5" /> Share Registration
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
