'use client';

/**
 * Authentic Community Hub Preview Component
 *
 * Renders a pixel-accurate preview of `/portal/[slug]/community` inside the
 * Studio visual preview canvas, matching `PortalCommunityClient.tsx`.
 *
 * Rules:
 * - Strictly typed (Zero any / any[] / unknown).
 * - Live reactive theming and responsive social layout.
 * - Mobile ergonomics: >=44px touch targets.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Pin,
  Heart,
  Flame,
  ThumbsUp,
  MessageCircle,
  Plus,
} from 'lucide-react';
import { getPortalButtonInlineStyle } from '@/lib/utils/portal-theme';
import type { PortalThemeConfig } from '@/lib/types/portal';

export interface PortalCommunityPreviewProps {
  theme: PortalThemeConfig;
  radiusCss: string;
  onNavigateRoute?: (route: '/' | '/learn' | '/community' | '/dashboard') => void;
}

export function PortalCommunityPreview({
  theme,
  radiusCss,
}: PortalCommunityPreviewProps) {
  const [selectedSpace, setSelectedSpace] = React.useState('all');
  const [likesCount, setLikesCount] = React.useState(14);
  const [hasLiked, setHasLiked] = React.useState(false);

  const primaryBtnStyle = React.useMemo(
    () =>
      getPortalButtonInlineStyle(
        theme.ui?.buttonStyle,
        theme.colors.primary,
        radiusCss
      ),
    [theme.ui?.buttonStyle, theme.colors.primary, radiusCss]
  );

  const spaces = [
    { id: 'all', name: 'All Discussions' },
    { id: 'announcements', name: 'Announcements' },
    { id: 'bursars', name: 'Bursars Lounge' },
    { id: 'tuition', name: 'Fee Collection Frameworks' },
  ];

  const handleLike = () => {
    if (hasLiked) {
      setLikesCount(c => c - 1);
      setHasLiked(false);
    } else {
      setLikesCount(c => c + 1);
      setHasLiked(true);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-6 md:p-10 space-y-8">
      {/* ── Community Header & Actions ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--portal-border)] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1
              className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--portal-text)]"
              style={{ fontFamily: 'var(--portal-heading-font)' }}
            >
              Member Community Hub
            </h1>
            <Badge
              variant="outline"
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ borderColor: theme.colors.primary, color: theme.colors.primary }}
            >
              Active Network
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-[var(--portal-muted)]">
            Collaborate, share templates, and exchange operational best practices with peer bursars.
          </p>
        </div>

        <Button
          type="button"
          className="h-10 px-4 rounded-xl font-bold text-xs text-white shadow-xs gap-1.5 self-start sm:self-auto active:scale-[0.97] transition-transform"
          style={primaryBtnStyle}
        >
          <Plus className="w-4 h-4" /> Start Discussion
        </Button>
      </div>

      {/* ── Space Tabs & Filter Bar ───────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {spaces.map(space => (
          <Button
            key={space.id}
            size="sm"
            variant={selectedSpace === space.id ? 'default' : 'outline'}
            onClick={() => setSelectedSpace(space.id)}
            className="rounded-xl text-xs font-bold shrink-0 min-h-[36px]"
            style={selectedSpace === space.id ? { backgroundColor: theme.colors.primary } : undefined}
          >
            {space.name}
          </Button>
        ))}
      </div>

      {/* ── Discussion Feed ───────────────────────────────────────────── */}
      <div className="space-y-5">
        {/* Post 1: Pinned Masterclass Template */}
        <Card
          className="border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 shadow-xs"
          style={{ borderRadius: radiusCss }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border border-border">
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                  AM
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-[var(--portal-text)]">Ama Mensah</h4>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px] font-bold px-1.5 py-0.5">
                    Verified Bursar
                  </Badge>
                </div>
                <p className="text-[11px] text-[var(--portal-muted)]">
                  Ridge Royal Academy • 2 hours ago
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-xl">
              <Pin className="w-3.5 h-3.5" /> Pinned Thread
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-base text-[var(--portal-text)] leading-snug">
              Term 3 Tuition Reconciliation & Automated Parent SMS Workflows
            </h3>
            <p className="text-xs sm:text-sm text-[var(--portal-text)]/90 leading-relaxed">
              Has anyone implemented automated SMS reminders for term 3 tuition reconciliation yet? Sharing our workflow template here for all bursars across the network. It helped us recover 94% of outstanding bills before exam week!
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                #FeeCollection
              </span>
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                #BursaryOps
              </span>
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                #Automation
              </span>
            </div>
          </div>

          {/* Reaction Bar */}
          <div className="pt-3 border-t border-[var(--portal-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLike}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--portal-border)] text-xs font-semibold hover:bg-muted/40 transition-colors active:scale-[0.97]"
                style={hasLiked ? { color: '#E11D48', borderColor: '#E11D48' } : undefined}
              >
                <Heart className="w-3.5 h-3.5" fill={hasLiked ? '#E11D48' : 'none'} /> {likesCount}
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--portal-border)] text-xs font-semibold hover:bg-muted/40 transition-colors active:scale-[0.97]"
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" /> 8
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--portal-border)] text-xs font-semibold hover:bg-muted/40 transition-colors active:scale-[0.97]"
              >
                <ThumbsUp className="w-3.5 h-3.5 text-blue-500" /> 22
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--portal-muted)]">
              <MessageCircle className="w-4 h-4" /> 6 Replies
            </div>
          </div>
        </Card>

        {/* Post 2: Community Case Study */}
        <Card
          className="border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 shadow-xs"
          style={{ borderRadius: radiusCss }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border border-border">
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                  KO
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-[var(--portal-text)]">Kofi Owusu</h4>
                  <Badge className="bg-blue-500/10 text-blue-600 border-0 text-[10px] font-bold px-1.5 py-0.5">
                    Administrator
                  </Badge>
                </div>
                <p className="text-[11px] text-[var(--portal-muted)]">
                  St. Augustine College • 5 hours ago
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-base text-[var(--portal-text)] leading-snug">
              Best practices for USSD payment gateway reconciliation
            </h3>
            <p className="text-xs sm:text-sm text-[var(--portal-text)]/90 leading-relaxed">
              We completed Module 2 on USSD recovery frameworks and deployed the payment link sequence to our 450 parents last Friday. Within 48 hours, over 65% of overdue accounts were settled via Mobile Money!
            </p>
          </div>

          <div className="pt-3 border-t border-[var(--portal-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--portal-border)] text-xs font-semibold hover:bg-muted/40 transition-colors"
              >
                <Heart className="w-3.5 h-3.5 text-rose-500" /> 29
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--portal-border)] text-xs font-semibold hover:bg-muted/40 transition-colors"
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" /> 18
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--portal-muted)]">
              <MessageCircle className="w-4 h-4" /> 11 Replies
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
