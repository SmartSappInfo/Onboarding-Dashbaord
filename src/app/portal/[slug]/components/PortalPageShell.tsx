'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Universal Portal Page Shell (Single Source of Truth)
 * ---------------------------------------------------
 * This component serves as the authoritative, shared page wrapper across ALL
 * public experience portal routes (/portal/[slug], /learn, /content, /community,
 * /events, and /dashboard).
 *
 * Key Responsibilities:
 * 1. Scoped Theme Provider Isolation:
 *    Ensures <PortalThemeProvider> wraps the entire DOM tree, establishing scoped
 *    CSS variables (--portal-text, --portal-bg, --portal-surface, etc.) and
 *    enabling independent dark/light mode switching that survives page navigation.
 * 2. Persistent Navigation & Header Parity:
 *    Renders the unified <PortalShellHeader> ensuring the brand logo, navigation links,
 *    search button, theme toggler, and member avatar remain visible at all times.
 * 3. Global Full-Text Search Integration:
 *    Mounts <PortalSearchModal> with Cmd+K / Ctrl+K keyboard shortcut listener,
 *    allowing instant search from any page in the portal.
 * 4. Member Authentication & Status:
 *    Wires real-time Firebase Auth state and membership status checks into header
 *    dropdowns and <PortalAuthModal>.
 * 5. Layout & Mobile Ergonomics:
 *    Standardizes min-h-screen layout with flexible main content area and optional
 *    <PortalShellFooter>.
 *
 * Caution for Future Maintainers:
 * - Do NOT define page-specific ad-hoc headers in sub-routes. Always route navigation
 *   through this component to prevent component drift and broken user sessions.
 * - In immersive, full-height focus views (e.g. video player or exam proctoring),
 *   pass `showFooter={false}` to preserve the screen height contract.
 */

import * as React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useAuth, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { getGoogleFontsUrl, getPortalRadiusCss } from '@/lib/utils/portal-theme';
import { PortalThemeProvider } from './PortalThemeProvider';
import { PortalShellHeader } from './PortalShellHeader';
import { PortalShellFooter } from './PortalShellFooter';
import { PortalSearchModal } from './PortalSearchModal';
import { PortalAuthModal } from './PortalAuthModal';
import type { Portal } from '@/lib/types/portal';
import type { PortalMembership } from '@/lib/types/membership';

export interface PortalPageShellProps {
  portal: Portal;
  slug: string;
  children: React.ReactNode;
  showFooter?: boolean;
  className?: string;
  mainClassName?: string;
}

export function PortalPageShell({
  portal,
  slug,
  children,
  showFooter = true,
  className,
  mainClassName,
}: PortalPageShellProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();

  // Search & Auth Modal States
  const [isSearchModalOpen, setIsSearchModalOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  // Query Member Status
  const membershipQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && user?.uid
        ? query(
            collection(firestore, 'portal_memberships'),
            where('portalId', '==', portal.id),
            where('userId', '==', user.uid)
          )
        : null,
    [firestore, portal?.id, user?.uid]
  );
  const { data: memberships } = useCollection<PortalMembership>(membershipQuery);
  const isMember = (memberships && memberships.length > 0) || false;

  // Theme & Branding Tokens
  const theme = portal.theme;
  const branding = portal.branding;
  const navigation = portal.navigation;
  const radiusCss = getPortalRadiusCss(theme.ui?.borderRadius);
  const googleFontsUrl = getGoogleFontsUrl(
    theme.typography?.headingFont || 'Figtree',
    theme.typography?.bodyFont || 'Figtree'
  );
  const brandTitle = branding?.brandName || portal.name;

  return (
    <PortalThemeProvider
      portalId={portal.id}
      portalSlug={slug}
      theme={theme}
      className={cn('min-h-screen flex flex-col justify-between bg-[var(--portal-bg)] text-[var(--portal-text)] transition-colors', className)}
    >
      {/* ── Dynamic Google Fonts ────────────────────────────────────────── */}
      {googleFontsUrl && <link rel="stylesheet" href={googleFontsUrl} />}

      {/* ── Universal Navigation Header (Single Source of Truth) ──────── */}
      <PortalShellHeader
        slug={slug}
        brandTitle={brandTitle}
        theme={theme}
        branding={branding}
        navigation={navigation}
        radiusCss={radiusCss}
        user={user}
        isMember={isMember}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onSignOut={() => auth && signOut(auth)}
      />

      {/* ── Main Dynamic Content Area ─────────────────────────────────── */}
      <main className={cn('flex-1 flex flex-col min-w-0', mainClassName)}>
        {children}
      </main>

      {/* ── Standard Directory Footer ─────────────────────────────────── */}
      {showFooter && (
        <PortalShellFooter
          slug={slug}
          brandTitle={brandTitle}
          tagline={branding?.tagline || 'Experience Platform powered by SmartSapp.'}
          branding={branding}
          navigation={navigation}
        />
      )}

      {/* ── Global Full-Text Search Modal (Cmd+K / Ctrl+K) ───────────── */}
      <PortalSearchModal
        open={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
        portalId={portal.id}
        portalSlug={slug}
      />

      {/* ── Dynamic Brand-Themed Authentication Modal ─────────────────── */}
      <PortalAuthModal
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        portal={portal}
      />
    </PortalThemeProvider>
  );
}
export default PortalPageShell;
