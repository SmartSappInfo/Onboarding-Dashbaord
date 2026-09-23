'use client';

/**
 * @fileoverview Experience Platform — Real-time Responsive Preview Canvas (SSOT)
 *
 * Renders an authoritative, pixel-accurate simulation of the live portal with
 * live CSS variable token injection, device viewport switching (Desktop,
 * Tablet, Mobile), true proportional scaling, and mode-aware layouts.
 *
 * ARCHITECTURAL RATIONALE:
 * - Single Source of Truth (SSOT): Shares the exact presentation components
 *   (`PortalShellHeader`, `PortalHeroSection`, `PortalSpacesGrid`, `PortalShellFooter`)
 *   with the public runtime (`PortalRuntimeClient.tsx`), completely eliminating layout drift.
 * - Resolves viewport squishing via ResizeObserver + CSS transform: scale() with
 *   top-center origin, ensuring authentic 1200px desktop, 768px tablet, and 390px mobile viewports.
 * - Sub-route simulation: Authentic preview for `/`, `/learn`, `/community`, and `/dashboard`.
 * - Vercel React Best Practices: Uses `useDeferredValue` for smooth 60fps typing in the Studio.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Minimum touch target >= 44px on toolbar buttons.
 * - Strictly zero `any`, `any[]`, or `unknown`.
 * - Keep `transformOrigin: top center` to prevent coordinate drift.
 */

import * as React from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  RotateCcw,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
import {
  getPortalRadiusCss,
  getGoogleFontsUrl,
} from '@/lib/utils/portal-theme';
import type {
  Portal,
  PortalMode,
  PortalThemeConfig,
  PortalBranding,
  PortalNavigationConfig,
  PortalFeatureToggles,
} from '@/lib/types/portal';
import { PortalShellHeader } from '@/app/portal/[slug]/components/PortalShellHeader';
import { PortalHeroSection } from '@/app/portal/[slug]/components/PortalHeroSection';
import { PortalSpacesGrid } from '@/app/portal/[slug]/components/PortalSpacesGrid';
import { PortalShellFooter } from '@/app/portal/[slug]/components/PortalShellFooter';
import { PortalCurriculumPreview } from '@/app/portal/[slug]/components/PortalCurriculumPreview';
import { PortalCommunityPreview } from '@/app/portal/[slug]/components/PortalCommunityPreview';
import { PortalDashboardPreview } from '@/app/portal/[slug]/components/PortalDashboardPreview';
import { PortalVaultPreview } from '@/app/portal/[slug]/components/PortalVaultPreview';
import { PortalThemeProvider } from '@/app/portal/[slug]/components/PortalThemeProvider';

export interface PortalLivePreviewCanvasProps {
  portal: Partial<Portal>;
  theme: PortalThemeConfig;
  branding: PortalBranding;
  navigation: PortalNavigationConfig;
  features: PortalFeatureToggles;
  primaryMode: PortalMode;
  portalName: string;
  slug: string;
}

export type DeviceMode = 'desktop' | 'tablet' | 'mobile';
export type PreviewRoute = '/' | '/learn' | '/community' | '/dashboard' | '/content';
export type ZoomLevel = 'fit' | '100' | '75' | '50';

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
  const { activeOrganization } = useTenant();
  const [device, setDevice] = React.useState<DeviceMode>('desktop');
  const [previewRoute, setPreviewRoute] = React.useState<PreviewRoute>('/');
  const [zoomLevel, setZoomLevel] = React.useState<ZoomLevel>('fit');
  const [keyRefresh, setKeyRefresh] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [parentWidth, setParentWidth] = React.useState(800);

  // Defer draft props for smooth 60fps typing in Studio forms (rerender-use-deferred-value)
  const deferredTheme = React.useDeferredValue(theme);
  const deferredBranding = React.useDeferredValue(branding);
  const deferredNavigation = React.useDeferredValue(navigation);
  const deferredFeatures = React.useDeferredValue(features);

  // Monitor canvas width for automatic proportional desktop scaling
  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setParentWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const [canvasThemeMode, setCanvasThemeMode] = React.useState<'light' | 'dark'>(() => {
    return deferredTheme.colorMode === 'dark' ? 'dark' : 'light';
  });

  // Automatically adapt canvas mode if owner selects strict light or dark policy in the studio
  React.useEffect(() => {
    if (deferredTheme.colorMode === 'dark') {
      setCanvasThemeMode('dark');
    } else if (deferredTheme.colorMode === 'light') {
      setCanvasThemeMode('light');
    }
  }, [deferredTheme.colorMode]);

  const radiusCss = getPortalRadiusCss(deferredTheme.ui?.borderRadius);
  const googleFontsUrl = getGoogleFontsUrl(
    deferredTheme.typography?.headingFont,
    deferredTheme.typography?.bodyFont
  );

  const brandDisplayName =
    deferredBranding.brandName ||
    portalName ||
    activeOrganization?.name ||
    'Experience Platform';
  const tagline =
    deferredBranding.tagline ||
    portal.description ||
    'Your intelligent digital learning & engagement hub.';

  // Target canvas widths for authentic viewport simulation
  const targetWidth = device === 'mobile' ? 390 : device === 'tablet' ? 768 : 1200;

  // Proportional scale calculation
  let scale = 1;
  if (zoomLevel === 'fit') {
    const availableWidth = Math.max(300, parentWidth - 48);
    scale = Math.min(1, availableWidth / targetWidth);
  } else if (zoomLevel === '75') {
    scale = 0.75;
  } else if (zoomLevel === '50') {
    scale = 0.5;
  } else {
    scale = 1;
  }

  // Sample verified persona for authentic dashboard preview
  const sampleUser = React.useMemo(
    () => ({
      displayName: 'Ama Mensah',
      email: 'ama.mensah@ridge-academy.edu.gh',
      photoURL: null,
      uid: 'sample-bursar-1',
    }),
    []
  );

  return (
    <div className="flex flex-col h-full rounded-3xl border-2 border-border bg-muted/40 overflow-hidden shadow-xs">
      {/* ── Dynamic Google Webfonts Injection ───────────────────────── */}
      {googleFontsUrl && <link rel="stylesheet" href={googleFontsUrl} />}

      {/* ── Canvas Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Device Mode Switcher */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDevice('desktop')}
              className={cn(
                'h-8 min-h-[32px] px-3 rounded-xl text-xs font-bold gap-1.5 transition-all active:scale-[0.97]',
                device === 'desktop' ? 'bg-background shadow-xs text-primary' : 'text-muted-foreground hover:text-foreground'
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
                'h-8 min-h-[32px] px-3 rounded-xl text-xs font-bold gap-1.5 transition-all active:scale-[0.97]',
                device === 'tablet' ? 'bg-background shadow-xs text-primary' : 'text-muted-foreground hover:text-foreground'
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
                'h-8 min-h-[32px] px-3 rounded-xl text-xs font-bold gap-1.5 transition-all active:scale-[0.97]',
                device === 'mobile' ? 'bg-background shadow-xs text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile
            </Button>
          </div>

          {/* Theme Mode Preview Switcher (Independent of Admin Theme) */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCanvasThemeMode('light')}
              title="Preview Portal in Light Mode"
              className={cn(
                'h-8 min-h-[32px] px-2.5 rounded-xl text-xs font-bold gap-1.5 transition-all active:scale-[0.97]',
                canvasThemeMode === 'light'
                  ? 'bg-background shadow-xs text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sun className="w-3.5 h-3.5" /> Light
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCanvasThemeMode('dark')}
              title="Preview Portal in Dark Mode"
              className={cn(
                'h-8 min-h-[32px] px-2.5 rounded-xl text-xs font-bold gap-1.5 transition-all active:scale-[0.97]',
                canvasThemeMode === 'dark'
                  ? 'bg-background shadow-xs text-indigo-500 dark:text-indigo-400'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Moon className="w-3.5 h-3.5" /> Dark
            </Button>
          </div>
        </div>

        {/* Route Navigator & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/50 rounded-xl border border-border px-2 py-1 gap-1">
            <span className="text-[11px] font-mono text-muted-foreground">/portal/{slug || 'preview'}</span>
            <select
              value={previewRoute}
              onChange={e => setPreviewRoute(e.target.value as PreviewRoute)}
              aria-label="Preview Route"
              className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer"
            >
              <option value="/">Home</option>
              <option value="/learn">Courses</option>
              <option value="/community">Community</option>
              <option value="/content">Vault</option>
              <option value="/dashboard">Dashboard</option>
            </select>
          </div>

          <div className="hidden sm:flex items-center bg-muted/50 rounded-xl border border-border px-2 py-1 gap-1">
            <span className="text-[11px] text-muted-foreground font-medium">Zoom:</span>
            <select
              value={zoomLevel}
              onChange={e => setZoomLevel(e.target.value as ZoomLevel)}
              aria-label="Canvas Zoom"
              className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer"
            >
              <option value="fit">Auto Fit</option>
              <option value="100">100%</option>
              <option value="75">75%</option>
              <option value="50">50%</option>
            </select>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setKeyRefresh(k => k + 1)}
            title="Refresh preview canvas"
            className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-xl text-muted-foreground hover:text-foreground active:scale-[0.95]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <a
            href={`/portal/${slug}${previewRoute === '/' ? '' : previewRoute}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline px-2.5 py-1.5 rounded-xl hover:bg-primary/5 transition-colors"
          >
            Open Live <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* ── Virtual Canvas Sandbox ────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 sm:p-6 flex items-start justify-center bg-radial from-muted/30 to-muted/80 relative"
      >
        <div
          key={keyRefresh}
          style={{
            width: `${targetWidth}px`,
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            marginBottom: scale < 1 ? `-${Math.round((1 - scale) * 700)}px` : undefined,
          }}
          className={cn(
            'shrink-0 transition-all shadow-2xl overflow-hidden',
            device === 'mobile'
              ? 'rounded-[40px] border-[8px] border-slate-900 bg-slate-900'
              : device === 'tablet'
              ? 'rounded-[28px] border-[8px] border-slate-800 bg-slate-800'
              : 'rounded-2xl border border-border/80'
          )}
        >
          {/* Simulated Mobile Speaker Notch */}
          {device === 'mobile' && (
            <div className="h-5 bg-slate-900 flex items-center justify-center">
              <div className="w-16 h-3 bg-black rounded-full" />
            </div>
          )}

          {/* Actual Simulated Portal Canvas with SSOT Components & Isolated Theme */}
          <PortalThemeProvider
            forcedMode={canvasThemeMode}
            theme={deferredTheme}
            portalId={portal.id}
            className="min-h-[640px] flex flex-col justify-between"
          >
            {/* ── Shared Header (SSOT) ────────────────── */}
            <PortalShellHeader
              slug={slug}
              brandTitle={brandDisplayName}
              theme={deferredTheme}
              branding={deferredBranding}
              navigation={deferredNavigation}
              radiusCss={radiusCss}
              user={previewRoute === '/dashboard' ? sampleUser : null}
              isMember={previewRoute === '/dashboard'}
              isPreview={true}
              previewRoute={previewRoute}
              onNavigateRoute={setPreviewRoute}
            />

            {/* ── Main Route View (SSOT) ──────────────── */}
            <main className="flex-1 flex flex-col">
              {previewRoute === '/' && (
                <>
                  <PortalHeroSection
                    slug={slug}
                    brandTitle={brandDisplayName}
                    tagline={tagline}
                    primaryMode={primaryMode}
                    theme={deferredTheme}
                    branding={deferredBranding}
                    features={deferredFeatures}
                    navigation={deferredNavigation}
                    radiusCss={radiusCss}
                    user={null}
                    isMember={false}
                    isPreview={true}
                    onNavigateRoute={setPreviewRoute}
                  />
                  <PortalSpacesGrid
                    slug={slug}
                    theme={deferredTheme}
                    features={deferredFeatures}
                    radiusCss={radiusCss}
                    isPreview={true}
                    onNavigateRoute={setPreviewRoute}
                  />
                </>
              )}

              {previewRoute === '/learn' && (
                <PortalCurriculumPreview
                  theme={deferredTheme}
                  radiusCss={radiusCss}
                  onNavigateRoute={setPreviewRoute}
                />
              )}

              {previewRoute === '/community' && (
                <PortalCommunityPreview
                  theme={deferredTheme}
                  radiusCss={radiusCss}
                  onNavigateRoute={setPreviewRoute}
                />
              )}

              {previewRoute === '/content' && (
                <PortalVaultPreview
                  theme={deferredTheme}
                  radiusCss={radiusCss}
                  onNavigateRoute={setPreviewRoute}
                />
              )}

              {previewRoute === '/dashboard' && (
                <PortalDashboardPreview
                  theme={deferredTheme}
                  radiusCss={radiusCss}
                  onNavigateRoute={setPreviewRoute}
                />
              )}
            </main>

            {/* ── Shared Footer (SSOT) ────────────────── */}
            <PortalShellFooter
              slug={slug}
              brandTitle={brandDisplayName}
              tagline={tagline}
              branding={deferredBranding}
              navigation={deferredNavigation}
              isPreview={true}
              onNavigateRoute={setPreviewRoute}
            />
          </PortalThemeProvider>
        </div>
      </div>
    </div>
  );
}
