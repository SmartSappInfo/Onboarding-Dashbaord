'use client';

/**
 * Shared Portal Hero Section Component (Single Source of Truth)
 *
 * Renders the authoritative hero / banner section across both the live customer
 * runtime (`PortalRuntimeClient.tsx`) and the Studio visual preview canvas
 * (`PortalLivePreviewCanvas.tsx`).
 *
 * Rules:
 * - Strictly typed (Zero any / any[] / unknown).
 * - Dual CTAs: Primary action + secondary "Browse Curriculum" conditional on course enablement.
 * - Dynamic webfont and CSS variable adherence.
 * - Accessible touch targets: >=44px (min-h-[44px]), active:scale-[0.98] feedback.
 */

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { resolvePortalPath } from '@/lib/utils/portal-navigation';
import { getPortalButtonInlineStyle } from '@/lib/utils/portal-theme';
import type {
  PortalMode,
  PortalThemeConfig,
  PortalBranding,
  PortalNavigationConfig,
  PortalFeatureToggles,
} from '@/lib/types/portal';

export interface PortalHeroUser {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  uid?: string;
}

export interface PortalHeroSectionProps {
  slug: string;
  brandTitle: string;
  tagline: string;
  primaryMode: PortalMode;
  theme: PortalThemeConfig;
  branding: PortalBranding;
  features: PortalFeatureToggles;
  navigation: PortalNavigationConfig;
  radiusCss: string;
  user?: PortalHeroUser | null;
  isMember?: boolean;
  isPreview?: boolean;
  onNavigateRoute?: (route: '/' | '/learn' | '/community' | '/dashboard') => void;
}

export function PortalHeroSection({
  slug,
  brandTitle,
  tagline,
  primaryMode,
  theme,
  features,
  navigation,
  radiusCss,
  user,
  isMember = false,
  isPreview = false,
  onNavigateRoute,
}: PortalHeroSectionProps) {
  const primaryBtnStyle = React.useMemo(
    () =>
      getPortalButtonInlineStyle(
        theme.ui?.buttonStyle,
        theme.colors.primary,
        radiusCss
      ),
    [theme.ui?.buttonStyle, theme.colors.primary, radiusCss]
  );

  return (
    <section
      className="px-6 py-16 md:py-24 text-center border-b border-[var(--portal-border)] relative overflow-hidden transition-colors"
      style={{ backgroundColor: theme.colors.surface }}
    >
      {/* ── Subtle Ambient Radial Glow ─────────────────────────────────── */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: theme.colors.primary }}
      />

      <div className="max-w-3xl mx-auto space-y-4 relative z-10">
        {/* ── Portal Mode Badge ────────────────────────────────────────── */}
        <Badge
          variant="outline"
          className="text-xs font-bold uppercase tracking-wider px-3 py-1 border-2"
          style={{
            borderColor: theme.colors.primary,
            color: theme.colors.primary,
            backgroundColor: 'transparent',
            borderRadius: theme.ui?.borderRadius === 'none' ? '0px' : '9999px',
          }}
        >
          {primaryMode.replace('_', ' ')}
        </Badge>

        {/* ── Brand Heading & Tagline ─────────────────────────────────── */}
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground"
          style={{ fontFamily: 'var(--portal-heading-font)' }}
        >
          {brandTitle}
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-[var(--portal-muted)] max-w-2xl mx-auto leading-relaxed">
          {tagline}
        </p>

        {/* ── Dual Action CTAs ────────────────────────────────────────── */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            isMember ? (
              isPreview ? (
                <Button
                  size="lg"
                  onClick={() => onNavigateRoute?.('/dashboard')}
                  className="min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.98] gap-2"
                  style={primaryBtnStyle}
                >
                  Go to Your Dashboard <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Link href={`/portal/${slug}/dashboard`}>
                  <Button
                    size="lg"
                    className="min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.98] gap-2"
                    style={primaryBtnStyle}
                  >
                    Go to Your Dashboard <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )
            ) : isPreview ? (
              <Button
                size="lg"
                onClick={() => onNavigateRoute?.('/')}
                className="min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.98] gap-2"
                style={primaryBtnStyle}
              >
                Join Portal <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Link href={`/portal/${slug}/join`}>
                <Button
                  size="lg"
                  className="min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.98] gap-2"
                  style={primaryBtnStyle}
                >
                  Join Portal <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )
          ) : navigation.headerActions?.ctaButton?.label ? (
            isPreview ? (
              <Button
                size="lg"
                onClick={() => onNavigateRoute?.('/learn')}
                className="min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.98] gap-2"
                style={primaryBtnStyle}
              >
                {navigation.headerActions.ctaButton.label} <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Link href={resolvePortalPath(navigation.headerActions.ctaButton.path || '/join', slug)}>
                <Button
                  size="lg"
                  className="min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.98] gap-2"
                  style={primaryBtnStyle}
                >
                  {navigation.headerActions.ctaButton.label} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )
          ) : isPreview ? (
            <Button
              size="lg"
              onClick={() => onNavigateRoute?.('/learn')}
              className="min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.98] gap-2"
              style={primaryBtnStyle}
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Link href={`/portal/${slug}/join`}>
              <Button
                size="lg"
                className="min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.98] gap-2"
                style={primaryBtnStyle}
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          )}

          {/* Secondary CTA: Browse Curriculum if Courses Enabled */}
          {features.enableCourses && (
            isPreview ? (
              <Button
                variant="outline"
                size="lg"
                onClick={() => onNavigateRoute?.('/learn')}
                className="min-h-[44px] px-6 font-bold text-sm border-2 transition-transform active:scale-[0.98] gap-2"
                style={{ borderRadius: radiusCss }}
              >
                Browse Curriculum
              </Button>
            ) : (
              <Link href={`/portal/${slug}/learn`}>
                <Button
                  variant="outline"
                  size="lg"
                  className="min-h-[44px] px-6 font-bold text-sm border-2 transition-transform active:scale-[0.98] gap-2"
                  style={{ borderRadius: radiusCss }}
                >
                  Browse Curriculum
                </Button>
              </Link>
            )
          )}
        </div>
      </div>
    </section>
  );
}
