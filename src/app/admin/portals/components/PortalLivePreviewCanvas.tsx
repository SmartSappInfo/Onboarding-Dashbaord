'use client';

/**
 * {{Org_name}} Experience Platform — Real-time Responsive Preview Canvas
 *
 * Renders an isolated interactive simulation of the live portal with
 * live CSS variable token injection, device viewport switching (Desktop,
 * Tablet, Mobile), and mode-aware layouts.
 */

import * as React from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  GraduationCap,
  BookOpen,
  Search,
  Users,
  Award,
  ArrowRight,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  Portal,
  PortalMode,
  PortalThemeConfig,
  PortalBranding,
  PortalNavigationConfig,
  PortalFeatureToggles,
} from '@/lib/types/portal';

interface PortalLivePreviewCanvasProps {
  portal: Partial<Portal>;
  theme: PortalThemeConfig;
  branding: PortalBranding;
  navigation: PortalNavigationConfig;
  features: PortalFeatureToggles;
  primaryMode: PortalMode;
  portalName: string;
  slug: string;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export function PortalLivePreviewCanvas({
  portal,
  theme,
  branding,
  navigation,
  features,
  primaryMode,
  portalName,
  slug,
}: PortalLivePreviewCanvasProps) {
  const [device, setDevice] = React.useState<DeviceMode>('desktop');

  const containerWidthClass =
    device === 'mobile'
      ? 'w-[380px]'
      : device === 'tablet'
      ? 'w-[768px]'
      : 'w-full';

  // Dynamic CSS variables mapped to the live customizer state
  const previewStyles: React.CSSProperties = {
    ['--portal-primary' as string]: theme.colors.primary,
    ['--portal-secondary' as string]: theme.colors.secondary,
    ['--portal-accent' as string]: theme.colors.accent,
    ['--portal-bg' as string]: theme.colors.background,
    ['--portal-surface' as string]: theme.colors.surface,
    ['--portal-text' as string]: theme.colors.text,
    ['--portal-muted' as string]: theme.colors.mutedText,
    ['--portal-border' as string]: theme.colors.border,
    fontFamily: `${theme.typography.bodyFont}, sans-serif`,
  };

  const brandDisplayName = branding.brandName || portalName || 'Experience Portal';
  const tagline = branding.tagline || 'Your intelligent digital learning & engagement hub.';

  return (
    <div className="flex flex-col h-full rounded-2xl border-2 border-border bg-muted/40 overflow-hidden shadow-inner">
      {/* ── Preview Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDevice('desktop')}
            className={cn(
              'h-7 px-2.5 rounded-lg text-xs font-bold gap-1.5',
              device === 'desktop' ? 'bg-background shadow-xs text-primary' : 'text-muted-foreground'
            )}
          >
            <Monitor className="w-3.5 h-3.5" /> Desktop
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDevice('tablet')}
            className={cn(
              'h-7 px-2.5 rounded-lg text-xs font-bold gap-1.5',
              device === 'tablet' ? 'bg-background shadow-xs text-primary' : 'text-muted-foreground'
            )}
          >
            <Tablet className="w-3.5 h-3.5" /> Tablet
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDevice('mobile')}
            className={cn(
              'h-7 px-2.5 rounded-lg text-xs font-bold gap-1.5',
              device === 'mobile' ? 'bg-background shadow-xs text-primary' : 'text-muted-foreground'
            )}
          >
            <Smartphone className="w-3.5 h-3.5" /> Mobile
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-lg border border-border">
            /portal/{slug || 'preview'}
          </span>
          <a
            href={`/portal/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            Open Live <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ── Canvas Viewport ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 flex items-start justify-center">
        <div
          style={previewStyles}
          className={cn(
            'transition-all duration-300 rounded-2xl shadow-xl overflow-hidden border border-border bg-[var(--portal-bg)] text-[var(--portal-text)]',
            containerWidthClass,
            'min-h-[580px] flex flex-col justify-between'
          )}
        >
          {/* ── Simulated Portal Header ─────────────────────────────────── */}
          <header className="sticky top-0 z-20 px-5 py-3.5 border-b border-[var(--portal-border)] bg-[var(--portal-bg)]/90 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-7 w-auto object-contain" />
              ) : (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-xs"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  {brandDisplayName.charAt(0)}
                </div>
              )}
              <span className="font-bold text-sm tracking-tight">{brandDisplayName}</span>
            </div>

            {/* Nav links (hidden on mobile) */}
            {device !== 'mobile' && (
              <nav className="flex items-center gap-4 text-xs font-medium text-[var(--portal-muted)]">
                {(navigation.headerItems || []).map(item => (
                  <span
                    key={item.id}
                    className="hover:text-[var(--portal-primary)] cursor-pointer transition-colors"
                  >
                    {item.label}
                  </span>
                ))}
              </nav>
            )}

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {navigation.headerActions.showSearch && (
                <div className="w-7 h-7 rounded-lg border border-[var(--portal-border)] flex items-center justify-center text-[var(--portal-muted)]">
                  <Search className="w-3.5 h-3.5" />
                </div>
              )}
              {navigation.headerActions.ctaButton?.label && (
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg font-bold text-white shadow-xs transition-opacity hover:opacity-90"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  {navigation.headerActions.ctaButton.label}
                </button>
              )}
            </div>
          </header>

          {/* ── Simulated Hero / Banner ─────────────────────────────────── */}
          <main className="flex-1 flex flex-col">
            <section
              className="px-6 py-12 text-center border-b border-[var(--portal-border)] relative overflow-hidden"
              style={{ backgroundColor: theme.colors.surface }}
            >
              <div
                className="absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ backgroundColor: theme.colors.primary }}
              />
              <div className="max-w-xl mx-auto space-y-3 relative z-10">
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                  style={{
                    borderColor: theme.colors.primary,
                    color: theme.colors.primary,
                  }}
                >
                  {primaryMode.replace('_', ' ')}
                </Badge>
                <h1
                  className="text-2xl sm:text-3xl font-extrabold tracking-tight"
                  style={{ fontFamily: `${theme.typography.headingFont}, sans-serif` }}
                >
                  {brandDisplayName}
                </h1>
                <p className="text-xs sm:text-sm text-[var(--portal-muted)] leading-relaxed">
                  {tagline}
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-bold px-4 py-2 rounded-xl text-white shadow-sm flex items-center gap-1.5"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    Start Exploring <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </section>

            {/* ── Simulated Content Module Grid ─────────────────────────── */}
            <section className="p-6 space-y-4 max-w-4xl mx-auto w-full">
              <div className="flex items-center justify-between border-b border-[var(--portal-border)] pb-2">
                <h3 className="font-bold text-sm">Featured Modules</h3>
                <span className="text-[11px] text-[var(--portal-muted)]">Active Spaces</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {features.enableCourses && (
                  <div className="p-3.5 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] space-y-1.5">
                    <GraduationCap className="w-5 h-5 text-[var(--portal-primary)]" />
                    <h4 className="font-bold text-xs">Curriculum Modules</h4>
                    <p className="text-[10px] text-[var(--portal-muted)]">
                      Step-by-step interactive lessons with video & assessments.
                    </p>
                  </div>
                )}

                {features.enableDocs && (
                  <div className="p-3.5 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] space-y-1.5">
                    <BookOpen className="w-5 h-5 text-[var(--portal-accent)]" />
                    <h4 className="font-bold text-xs">Knowledge Base</h4>
                    <p className="text-[10px] text-[var(--portal-muted)]">
                      Searchable documentation, manuals, and troubleshooting guides.
                    </p>
                  </div>
                )}

                {features.enableCommunity && (
                  <div className="p-3.5 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] space-y-1.5">
                    <Users className="w-5 h-5 text-[var(--portal-primary)]" />
                    <h4 className="font-bold text-xs">Community Feed</h4>
                    <p className="text-[10px] text-[var(--portal-muted)]">
                      Member discussions, Q&A threads, and leaderboard achievements.
                    </p>
                  </div>
                )}

                {features.enableGamification && (
                  <div className="p-3.5 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] space-y-1.5">
                    <Award className="w-5 h-5 text-[var(--portal-accent)]" />
                    <h4 className="font-bold text-xs">Certificates & Badges</h4>
                    <p className="text-[10px] text-[var(--portal-muted)]">
                      Verifiable credentials awarded upon milestone completion.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </main>

          {/* ── Simulated Portal Footer ─────────────────────────────────── */}
          <footer className="px-6 py-6 border-t border-[var(--portal-border)] bg-[var(--portal-surface)] text-center text-[11px] text-[var(--portal-muted)]">
            <p>{branding.copyrightText || `© ${new Date().getFullYear()} ${brandDisplayName}. All rights reserved.`}</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
