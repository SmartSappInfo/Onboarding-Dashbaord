'use client';

/**
 * {{Org_name}} Experience Platform — Branded Portal Auth Layout Shell
 *
 * Scoped theme boundary providing dark/light theme switching, brand logo banner,
 * responsive centering container, and back navigation for all /portal/[slug]/auth/* subroutes.
 *
 * Strict Compliance:
 * - Emil-Kowalski-Animations: Tactile press (active:scale-[0.97]) on all interactive elements.
 * - Mobile Touch Ergonomics: >= 44px min-height on buttons.
 * - Zero any / any[].
 */

import * as React from 'react';
import Link from 'next/link';
import { PortalThemeProvider } from '../components/PortalThemeProvider';
import { PortalThemeToggle } from '../components/PortalThemeToggle';
import type { Portal } from '@/lib/types/portal';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PortalAuthLayoutClientProps {
  portal: Portal;
  slug: string;
  children: React.ReactNode;
}

export default function PortalAuthLayoutClient({
  portal,
  slug,
  children,
}: PortalAuthLayoutClientProps) {
  const brandTitle = portal.branding?.brandName || portal.name;

  return (
    <PortalThemeProvider
      portalId={portal.id}
      portalSlug={slug}
      theme={portal.theme}
      className="min-h-screen flex flex-col justify-between bg-[var(--portal-bg)] text-[var(--portal-text)] transition-colors relative selection:bg-[var(--portal-primary)] selection:text-white"
    >
      {/* Subtle Ambient Radial Lighting Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full blur-[140px] opacity-15 pointer-events-none"
        style={{ backgroundColor: 'var(--portal-primary, #3B82F6)' }}
        aria-hidden="true"
      />

      {/* Auth Navigation Header */}
      <header className="w-full max-w-5xl mx-auto p-4 sm:p-6 flex items-center justify-between z-10">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-h-[44px] gap-2 rounded-xl text-xs font-semibold text-[var(--portal-muted)] hover:text-[var(--portal-text)] hover:bg-[var(--portal-surface)] active:scale-[0.97] transition-all"
        >
          <Link href={`/portal/${slug}`}>
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {brandTitle}</span>
          </Link>
        </Button>

        <PortalThemeToggle variant="icon" />
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 w-full max-w-md mx-auto">
        <div className="w-full space-y-6">
          {/* Logo / Brand Header */}
          <div className="text-center space-y-2">
            <Link href={`/portal/${slug}`} className="inline-block group">
              {portal.branding?.logoUrl ? (
                <img
                  src={portal.branding.logoUrl}
                  alt={brandTitle}
                  className="h-10 sm:h-12 w-auto mx-auto object-contain transition-transform group-hover:scale-105 duration-200"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg mx-auto shadow-md transition-transform group-hover:scale-105 duration-200"
                  style={{ backgroundColor: 'var(--portal-primary, #3B82F6)' }}
                >
                  {brandTitle.charAt(0)}
                </div>
              )}
            </Link>
          </div>

          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full p-6 text-center text-xs text-[var(--portal-muted)] border-t border-[var(--portal-border)]/50 z-10">
        <p>
          {portal.branding?.copyrightText ||
            `© ${new Date().getFullYear()} ${brandTitle}. All rights reserved.`}
        </p>
      </footer>
    </PortalThemeProvider>
  );
}
