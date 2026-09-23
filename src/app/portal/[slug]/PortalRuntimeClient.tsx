'use client';

/**
 * {{Org_name}} Experience Platform — Runtime Portal Shell & Client Renderer
 *
 * Renders the live customer, student, and member experience for any Experience Mode.
 * Dynamically injects theme CSS variables, enforces password/auth access policies,
 * renders responsive navigation, mode-aware content spaces, and footers.
 *
 * Rules:
 * - Strictly typed (Zero any / any[]).
 * - Zero raw HTML/CSS leakages.
 * - Mobile & A11y first: min-h-[44px] touch targets, responsive drawer, accessible focus rings.
 * - Conforms to next-best-practices, vercel-react-best-practices, and emilkowal-animations.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Lock,
  Key,
  ShieldAlert,
  Compass,
  Loader2,
} from 'lucide-react';
import { validatePortalPasswordAction } from '@/app/actions/portal-actions';
import {
  getPortalRadiusCss,
  getGoogleFontsUrl,
} from '@/lib/utils/portal-theme';
import { PortalSearchModal } from './components/PortalSearchModal';
import { PortalAuthModal } from './components/PortalAuthModal';
import { PortalShellHeader } from './components/PortalShellHeader';
import { PortalHeroSection } from './components/PortalHeroSection';
import { PortalSpacesGrid } from './components/PortalSpacesGrid';
import { PortalShellFooter } from './components/PortalShellFooter';
import { PortalThemeProvider } from './components/PortalThemeProvider';
import type {
  Portal,
} from '@/lib/types/portal';
import type { PortalMembership } from '@/lib/types/membership';

interface PortalRuntimeClientProps {
  slug: string;
}

export default function PortalRuntimeClient({ slug }: PortalRuntimeClientProps) {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const [passwordInput, setPasswordInput] = React.useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = React.useState(false);
  const [isPasswordUnlocked, setIsPasswordUnlocked] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [_searchQuery, _setSearchQuery] = React.useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  // ── Query Portal by Slug ──────────────────────────────────────────────────

  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(
            collection(firestore, 'portals'),
            where('slug', '==', slug),
            limit(1)
          )
        : null,
    [firestore, slug]
  );

  const { data: portalList, isLoading } = useCollection<Portal>(portalQuery);
  const portal = portalList?.[0] ?? null;

  // ── Query Current User's Membership in This Portal (for adaptive CTAs) ────
  const membershipQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && user?.uid
        ? query(
            collection(firestore, 'portal_memberships'),
            where('portalId', '==', portal.id),
            where('userId', '==', user.uid),
            limit(1)
          )
        : null,
    [firestore, portal?.id, user?.uid]
  );
  const { data: memberDocs } = useCollection<PortalMembership>(membershipQuery);
  const currentMembership = memberDocs?.[0] ?? null;
  const isMember = Boolean(currentMembership && currentMembership.status === 'active');

  // Check stored session unlock for password protected portals
  React.useEffect(() => {
    if (portal && portal.accessPolicy.passwordProtected) {
      const isUnlocked = sessionStorage.getItem(`portal_unlocked_${portal.id}`);
      if (isUnlocked === 'true') {
        setIsPasswordUnlocked(true);
      }
    }
  }, [portal]);

  // Handle password unlock form submission
  const handleUnlockPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal || !passwordInput.trim()) return;

    setIsVerifyingPassword(true);
    setPasswordError(null);

    try {
      const res = await validatePortalPasswordAction(portal.id, passwordInput.trim());
      if (res.success && res.data?.allowed) {
        setIsPasswordUnlocked(true);
        sessionStorage.setItem(`portal_unlocked_${portal.id}`, 'true');
        toast({ title: 'Access Granted', description: `Welcome to ${portal.name}!` });
      } else {
        setPasswordError(res.data?.message || 'Incorrect passcode. Please try again.');
      }
    } catch {
      setPasswordError('An error occurred during verification.');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  // ── Loading Skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <header className="h-16 border-b border-border px-6 flex items-center justify-between">
          <Skeleton className="h-8 w-36 rounded-xl" />
          <div className="hidden md:flex items-center gap-4">
            <Skeleton className="h-6 w-20 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-lg" />
          </div>
          <Skeleton className="h-9 w-28 rounded-xl" />
        </header>
        <main className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-8 py-16">
          <Skeleton className="h-16 w-3/4 mx-auto rounded-2xl" />
          <Skeleton className="h-6 w-1/2 mx-auto rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </main>
        <footer className="h-16 border-t border-border" />
      </div>
    );
  }

  // ── Not Found / 404 ───────────────────────────────────────────────────────

  if (!portal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Compass className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Portal Not Found</h1>
          <p className="text-sm text-muted-foreground">
            The experience portal you are looking for does not exist or may have been moved.
          </p>
          <Button asChild className="rounded-xl font-bold text-xs mt-2 active:scale-[0.97]">
            <Link href="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Suspended State ───────────────────────────────────────────────────────

  if (portal.status === 'suspended') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4 p-8 rounded-3xl border-2 border-amber-500/20 bg-amber-500/5 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{portal.name}</h2>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Maintenance Mode
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {portal.accessPolicy.suspendedReason || 'This portal is undergoing scheduled maintenance and will be back shortly.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Password Protection Gate ──────────────────────────────────────────────

  if (
    portal.accessPolicy.passwordProtected &&
    portal.accessPolicy.passwordHash &&
    !isPasswordUnlocked
  ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full rounded-3xl border-2 border-border shadow-2xl overflow-hidden">
          <div
            className="p-6 text-center border-b border-border"
            style={{ backgroundColor: portal.theme.colors.surface || '#F8FAFC' }}
          >
            <div
              className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white shadow-sm mb-3"
              style={{ backgroundColor: portal.theme.colors.primary || '#3B82F6' }}
            >
              <Key className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{portal.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              This experience portal is password protected.
            </p>
          </div>

          <CardContent className="p-6 space-y-4">
            <form onSubmit={handleUnlockPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Input
                  type="password"
                  placeholder="Enter access passcode..."
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  className="h-11 rounded-xl font-mono text-sm"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-xs text-rose-500 font-semibold">{passwordError}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isVerifyingPassword || !passwordInput.trim()}
                className="w-full h-11 rounded-xl font-bold text-xs text-white shadow-sm"
                style={{ backgroundColor: portal.theme.colors.primary || '#3B82F6' }}
              >
                {isVerifyingPassword ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Unlock Access
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Dynamic CSS Variables ─────────────────────────────────────────────────

  const theme = portal.theme;
  const branding = portal.branding;
  const navigation = portal.navigation;
  const features = portal.features;

  const radiusCss = getPortalRadiusCss(theme.ui?.borderRadius);
  const googleFontsUrl = getGoogleFontsUrl(
    theme.typography?.headingFont,
    theme.typography?.bodyFont
  );


  const brandTitle = branding.brandName || portal.name;

  return (
    <PortalThemeProvider
      portalId={portal.id}
      theme={theme}
      className="min-h-screen flex flex-col justify-between"
    >
      {/* ── Dynamic Google Fonts ────────────────────────────────────────── */}
      {googleFontsUrl && (
        <link rel="stylesheet" href={googleFontsUrl} />
      )}

      {/* ── Navigation Header (SSOT Shared Component) ────────────────── */}
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

      {/* ── Main Content Space ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {/* Hero / Banner Section (SSOT Shared Component) */}
        <PortalHeroSection
          slug={slug}
          brandTitle={brandTitle}
          tagline={branding.tagline || portal.description || 'Welcome to your digital experience portal.'}
          primaryMode={portal.primaryMode}
          theme={theme}
          branding={branding}
          features={features}
          navigation={navigation}
          radiusCss={radiusCss}
          user={user}
          isMember={isMember}
        />

        {/* Mode-Specific Content Spaces (SSOT Shared Component) */}
        <PortalSpacesGrid
          slug={slug}
          theme={theme}
          features={features}
          radiusCss={radiusCss}
        />
      </main>

      {/* ── Footer (SSOT Shared Component) ────────────────────────────── */}
      <PortalShellFooter
        slug={slug}
        brandTitle={brandTitle}
        tagline={branding.tagline || 'Experience Platform powered by SmartSapp.'}
        branding={branding}
        navigation={navigation}
      />

      {/* ── Instant Content Search Modal ───────────────────────────────── */}
      <PortalSearchModal
        open={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
        portalId={portal.id}
        portalSlug={slug}
      />

      {/* ── Member Auth Dialog ────────────────────────────────────────── */}
      <PortalAuthModal
        portal={portal}
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
      />
    </PortalThemeProvider>
  );
}
