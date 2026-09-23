'use client';

/**
 * Authentic Member Dashboard Preview Component
 *
 * Renders a pixel-accurate preview of `/portal/[slug]/dashboard` inside the
 * Studio visual preview canvas, matching `PortalMemberDashboardClient.tsx`
 * and `MemberOnboardingWidget.tsx`.
 *
 * Rules:
 * - Strictly typed (Zero any / any[] / unknown).
 * - Full parity with profile banner and verified onboarding step cards.
 * - Mobile ergonomics: >=44px touch targets.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  ListOrdered,
  FolderArchive,
  Award,
  PlayCircle,
  MessageSquare,
  Calendar,
  User,
} from 'lucide-react';
import { getPortalButtonInlineStyle } from '@/lib/utils/portal-theme';
import { usePortalTheme } from './PortalThemeProvider';
import type { PortalThemeConfig } from '@/lib/types/portal';

export interface PortalDashboardPreviewProps {
  theme: PortalThemeConfig;
  radiusCss: string;
  onNavigateRoute?: (route: '/' | '/learn' | '/community' | '/dashboard') => void;
}

export function PortalDashboardPreview({
  theme,
  radiusCss,
  onNavigateRoute,
}: PortalDashboardPreviewProps) {
  const [activeTab, setActiveTab] = React.useState('courses');
  const { activeColors } = usePortalTheme();

  const primaryBtnStyle = React.useMemo(
    () =>
      getPortalButtonInlineStyle(
        theme.ui?.buttonStyle,
        activeColors.primary,
        radiusCss
      ),
    [theme.ui?.buttonStyle, activeColors.primary, radiusCss]
  );

  return (
    <div className="max-w-6xl mx-auto w-full p-6 md:p-10 space-y-8">
      {/* ── Member Profile Hero Banner ─────────────────────────────────── */}
      <div
        className="p-6 md:p-8 rounded-3xl text-white relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl"
        style={{
          background: `linear-gradient(135deg, ${activeColors.primary} 0%, ${activeColors.secondary || activeColors.primary} 100%)`,
        }}
      >
        <div className="flex items-center gap-4 relative z-10">
          <Avatar className="w-16 h-16 border-2 border-white/40 shadow-md">
            <AvatarFallback className="bg-white/20 text-white font-black text-xl">
              AM
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">Ama Mensah</h1>
              <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] uppercase font-bold px-2 py-0.5">
                Head Bursar
              </Badge>
            </div>
            <p className="text-xs text-white/80">ama.mensah@ridge-academy.edu.gh</p>
            <p className="text-[11px] font-semibold text-white/90">
              Active Plan: <span className="underline">Academy Premium Member</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 relative z-10 self-start md:self-auto">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl font-bold text-xs bg-white/20 hover:bg-white/30 text-white border-white/30 gap-1.5 shadow-2xs min-h-[36px]"
          >
            <User className="w-3.5 h-3.5" /> Edit Profile
          </Button>
          <Button
            size="sm"
            onClick={() => onNavigateRoute?.('/learn')}
            className="rounded-xl font-bold text-xs bg-white text-foreground hover:bg-white/90 gap-1.5 shadow-sm min-h-[36px]"
          >
            Explore Catalog <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Automated Member Onboarding Checklist Widget ───────────────── */}
      <Card
        className="p-6 md:p-8 rounded-3xl border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] space-y-6 shadow-xs"
        style={{ borderRadius: radiusCss }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2
                className="text-lg font-bold tracking-tight text-[var(--portal-text)]"
                style={{ fontFamily: 'var(--portal-heading-font)' }}
              >
                Member Onboarding & Launch Checklist
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] font-bold uppercase text-emerald-600 border-emerald-500/40 bg-emerald-500/10"
              >
                Automated Verification
              </Badge>
            </div>
            <p className="text-xs text-[var(--portal-muted)]">
              Complete your orientation steps to unlock full bursary resources and earn 250 bonus points.
            </p>
          </div>

          <div className="text-right sm:shrink-0">
            <span className="font-extrabold text-sm text-[var(--portal-primary)]">
              3 of 5 Complete (60%)
            </span>
          </div>
        </div>

        <Progress value={60} className="h-2 rounded-full" />

        {/* Step Items List */}
        <div className="space-y-3">
          {/* Step 1: Watch Orientation Video */}
          <div className="p-4 rounded-2xl border border-[var(--portal-border)] bg-background/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-[var(--portal-text)]">
                  1. Watch Academy Orientation Video
                </h4>
                <p className="text-[11px] text-[var(--portal-muted)]">
                  10-minute briefing on automated bursary workflows (+50 pts)
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-xs font-bold px-2.5 py-1 shrink-0">
              Completed ✓
            </Badge>
          </div>

          {/* Step 2: Set Up Bursary Profile */}
          <div className="p-4 rounded-2xl border border-[var(--portal-border)] bg-background/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-[var(--portal-text)]">
                  2. Set Up Bursary Profile & School Details
                </h4>
                <p className="text-[11px] text-[var(--portal-muted)]">
                  Configured Ridge Royal Academy bursary records (+50 pts)
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-xs font-bold px-2.5 py-1 shrink-0">
              Completed ✓
            </Badge>
          </div>

          {/* Step 3: Start First Masterclass */}
          <div className="p-4 rounded-2xl border-2 border-[var(--portal-primary)] bg-[var(--portal-surface)] flex items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-xs shrink-0"
                style={{ backgroundColor: theme.colors.primary }}
              >
                <PlayCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-[var(--portal-text)]">
                  3. Start First Masterclass
                </h4>
                <p className="text-[11px] text-[var(--portal-muted)]">
                  Begin Module 1: Invoicing & USSD Recovery (+50 pts)
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => onNavigateRoute?.('/learn')}
              className="h-9 px-3.5 rounded-xl font-bold text-xs text-white shadow-xs shrink-0 active:scale-[0.98] transition-transform"
              style={primaryBtnStyle}
            >
              Start ➔
            </Button>
          </div>

          {/* Step 4: Community Introduction */}
          <div className="p-4 rounded-2xl border border-[var(--portal-border)] bg-background/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-[var(--portal-text)]">
                  4. Introduce Yourself in the Community
                </h4>
                <p className="text-[11px] text-[var(--portal-muted)]">
                  Post a message in the Bursars Lounge (+50 pts)
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onNavigateRoute?.('/community')}
              className="h-9 px-3.5 rounded-xl font-bold text-xs shrink-0 active:scale-[0.98] transition-transform"
            >
              Join Discussion ➔
            </Button>
          </div>

          {/* Step 5: Schedule Consultation */}
          <div className="p-4 rounded-2xl border border-[var(--portal-border)] bg-background/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-[var(--portal-text)]">
                  5. Schedule Bursar Strategy Consultation
                </h4>
                <p className="text-[11px] text-[var(--portal-muted)]">
                  1-on-1 operational audit with a SmartSapp Specialist (+50 pts)
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 px-3.5 rounded-xl font-bold text-xs shrink-0 active:scale-[0.98] transition-transform"
            >
              Book Call ➔
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Dashboard Navigation Tabs ─────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-11 p-1 bg-muted/60 rounded-2xl grid grid-cols-4">
          <TabsTrigger value="courses" className="rounded-xl text-xs font-bold gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" /> Curriculum (3)
          </TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-xl text-xs font-bold gap-1.5">
            <ListOrdered className="w-3.5 h-3.5" /> Tasks (2)
          </TabsTrigger>
          <TabsTrigger value="resources" className="rounded-xl text-xs font-bold gap-1.5">
            <FolderArchive className="w-3.5 h-3.5" /> Resources (12)
          </TabsTrigger>
          <TabsTrigger value="badges" className="rounded-xl text-xs font-bold gap-1.5">
            <Award className="w-3.5 h-3.5" /> Credentials (1)
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
