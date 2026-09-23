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
import { usePortalTheme } from './PortalThemeProvider';
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
    <section className="px-4 sm:px-6 py-12 sm:py-16 md:py-24 text-center border-b border-[var(--portal-border)] relative overflow-hidden transition-colors bg-[var(--portal-surface)] text-[var(--portal-text)]">
      {/* ── Subtle Ambient Radial Glow ─────────────────────────────────── */}
      <div
        className="absolute -top-20 sm:-top-24 left-1/2 -translate-x-1/2 w-72 sm:w-96 h-72 sm:h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: activeColors.primary }}
      />

      <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4 relative z-10">
        {/* ── Portal Mode Badge ────────────────────────────────────────── */}
        <Badge
          variant="outline"
          className="text-[11px] sm:text-xs font-bold uppercase tracking-wider px-2.5 sm:px-3 py-0.5 sm:py-1 border-2"
          style={{
            borderColor: activeColors.primary,
            color: activeColors.primary,
            backgroundColor: 'transparent',
            borderRadius: theme.ui?.borderRadius === 'none' ? '0px' : '9999px',
          }}
        >
          {primaryMode.replace('_', ' ')}
        </Badge>

        {/* ── Brand Heading & Tagline ─────────────────────────────────── */}
        <h1
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-[var(--portal-text)] break-words max-w-2xl mx-auto leading-tight"
          style={{ fontFamily: 'var(--portal-heading-font)' }}
        >
          {brandTitle}
        </h1>

        <p className="text-xs sm:text-sm md:text-base text-[var(--portal-muted)] max-w-xl mx-auto leading-relaxed px-2 sm:px-0">
          {tagline}
        </p>

        {/* ── Responsive Dual Action CTAs ─────────────────────────────── */}
        <div className="pt-3 sm:pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 w-full sm:w-auto max-w-xs sm:max-w-none mx-auto">
          {user ? (
            isMember ? (
              isPreview ? (
                <Button
                  size="lg"
                  onClick={() => onNavigateRoute?.('/dashboard')}
                  className="w-full sm:w-auto min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.97] gap-2 flex items-center justify-center"
                  style={primaryBtnStyle}
                >
                  Go to Your Dashboard <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Link href={`/portal/${slug}/dashboard`} className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.97] gap-2 flex items-center justify-center"
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
                className="w-full sm:w-auto min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.97] gap-2 flex items-center justify-center"
                style={primaryBtnStyle}
              >
                Join Portal <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Link href={`/portal/${slug}/join`} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.97] gap-2 flex items-center justify-center"
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
                className="w-full sm:w-auto min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.97] gap-2 flex items-center justify-center"
                style={primaryBtnStyle}
              >
                {navigation.headerActions.ctaButton.label} <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Link
                href={resolvePortalPath(navigation.headerActions.ctaButton.path || '/join', slug)}
                className="w-full sm:w-auto"
              >
                <Button
                  size="lg"
                  className="w-full sm:w-auto min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.97] gap-2 flex items-center justify-center"
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
              className="w-full sm:w-auto min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.97] gap-2 flex items-center justify-center"
              style={primaryBtnStyle}
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Link href={`/portal/${slug}/join`} className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.97] gap-2 flex items-center justify-center"
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
                className="w-full sm:w-auto min-h-[44px] px-6 font-bold text-sm border-2 border-[var(--portal-border)] bg-[var(--portal-bg)] text-[var(--portal-text)] hover:bg-[var(--portal-surface)] transition-all active:scale-[0.97] gap-2 flex items-center justify-center"
                style={{ borderRadius: radiusCss }}
              >
                Browse Curriculum
              </Button>
            ) : (
              <Link href={`/portal/${slug}/learn`} className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto min-h-[44px] px-6 font-bold text-sm border-2 border-[var(--portal-border)] bg-[var(--portal-bg)] text-[var(--portal-text)] hover:bg-[var(--portal-surface)] transition-all active:scale-[0.97] gap-2 flex items-center justify-center"
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
