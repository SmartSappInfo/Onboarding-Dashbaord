'use client';

/**
 * Shared Portal Shell Footer Component (Single Source of Truth)
 *
 * Renders the authoritative 4-column directory footer across both the live
 * customer runtime (`PortalRuntimeClient.tsx`) and the Studio visual preview canvas
 * (`PortalLivePreviewCanvas.tsx`).
 *
 * Rules:
 * - Strictly typed (Zero any / any[] / unknown).
 * - Single Source of Truth preventing layout and text drift.
 * - Dynamic column directory rendering with brand column and copyright.
 */

import * as React from 'react';
import Link from 'next/link';
import { resolvePortalPath } from '@/lib/utils/portal-navigation';
import type {
  PortalBranding,
  PortalNavigationConfig,
} from '@/lib/types/portal';

export interface PortalShellFooterProps {
  slug: string;
  brandTitle: string;
  tagline: string;
  branding: PortalBranding;
  navigation: PortalNavigationConfig;
  isPreview?: boolean;
  onNavigateRoute?: (route: '/' | '/learn' | '/community' | '/dashboard') => void;
}

export function PortalShellFooter({
  slug,
  brandTitle,
  tagline,
  branding,
  navigation,
  isPreview = false,
  onNavigateRoute,
}: PortalShellFooterProps) {
  const currentYear = new Date().getFullYear();

  const handleRouteClick = (e: React.MouseEvent, path: string) => {
    if (isPreview) {
      e.preventDefault();
      if (path.includes('/learn')) onNavigateRoute?.('/learn');
      else if (path.includes('/community')) onNavigateRoute?.('/community');
      else if (path.includes('/dashboard')) onNavigateRoute?.('/dashboard');
      else onNavigateRoute?.('/');
    }
  };

  return (
    <footer className="border-t border-[var(--portal-border)] bg-[var(--portal-surface)] px-6 py-12 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* ── Column 1: Brand & Tagline ───────────────────────────────── */}
          <div className="space-y-3">
            <h4
              className="font-bold text-base text-foreground"
              style={{ fontFamily: 'var(--portal-heading-font)' }}
            >
              {brandTitle}
            </h4>
            <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
              {tagline || 'Experience Platform powered by SmartSapp.'}
            </p>
          </div>

          {/* ── Columns 2 - 4: Dynamic Navigation Columns ───────────────── */}
          {(navigation.footerColumns || []).map((col, idx) => (
            <div key={col.id || idx} className="space-y-3">
              <h5
                className="font-bold text-xs uppercase tracking-wider text-foreground"
                style={{ fontFamily: 'var(--portal-heading-font)' }}
              >
                {col.title}
              </h5>
              <ul className="space-y-2 text-xs text-[var(--portal-muted)]">
                {(col.items || []).map((item, itemIdx) => {
                  const resolvedPath = resolvePortalPath(item.path, slug);
                  if (isPreview) {
                    return (
                      <li key={item.id || itemIdx}>
                        <button
                          type="button"
                          onClick={e => handleRouteClick(e, resolvedPath)}
                          className="hover:text-[var(--portal-primary)] transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary rounded text-left"
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  }
                  return (
                    <li key={item.id || itemIdx}>
                      <Link
                        href={resolvedPath}
                        target={item.target || '_self'}
                        className="hover:text-[var(--portal-primary)] transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary rounded"
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Sub-Footer Divider & Attribution ────────────────────────── */}
        <div className="pt-6 border-t border-[var(--portal-border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--portal-muted)]">
          <p>{branding.copyrightText || `© ${currentYear} ${brandTitle}. All rights reserved.`}</p>
          <p className="text-[11px]">Powered by Experience Platform</p>
        </div>
      </div>
    </footer>
  );
}
