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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GraduationCap,
  BookOpen,
  Users,
  Award,
  Search,
  Lock,
  Key,
  ShieldAlert,
  ArrowRight,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  FileCode,
  FolderArchive,
  Newspaper,
  Compass,
  CheckCircle2,
  Sparkles,
  Loader2,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { validatePortalPasswordAction } from '@/app/actions/portal-actions';
import {
  getPortalRadiusCss,
  getGoogleFontsUrl,
  getPortalButtonInlineStyle,
} from '@/lib/utils/portal-theme';
import { PortalSearchModal } from './components/PortalSearchModal';
import { PortalAuthModal } from './components/PortalAuthModal';
import type {
  Portal,
  PortalNavItem,
  PortalMode,
} from '@/lib/types/portal';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
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
          <Link href="/">
            <Button className="rounded-xl font-bold text-xs mt-2">Return Home</Button>
          </Link>
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

  const runtimeThemeStyles: React.CSSProperties = {
    ['--portal-primary' as string]: theme.colors.primary,
    ['--portal-secondary' as string]: theme.colors.secondary,
    ['--portal-accent' as string]: theme.colors.accent,
    ['--portal-bg' as string]: theme.colors.background,
    ['--portal-surface' as string]: theme.colors.surface,
    ['--portal-text' as string]: theme.colors.text,
    ['--portal-muted' as string]: theme.colors.mutedText,
    ['--portal-border' as string]: theme.colors.border,
    ['--portal-radius' as string]: radiusCss,
    ['--portal-heading-font' as string]: `${theme.typography?.headingFont || 'Plus Jakarta Sans'}, sans-serif`,
    ['--portal-body-font' as string]: `${theme.typography?.bodyFont || 'Inter'}, sans-serif`,
    fontFamily: `var(--portal-body-font)`,
  };

  const primaryBtnStyle = getPortalButtonInlineStyle(
    theme.ui?.buttonStyle,
    theme.colors.primary,
    radiusCss
  );

  const brandTitle = branding.brandName || portal.name;

  return (
    <div
      style={runtimeThemeStyles}
      className="min-h-screen flex flex-col justify-between bg-[var(--portal-bg)] text-[var(--portal-text)] transition-colors"
    >
      {/* ── Dynamic Google Fonts ────────────────────────────────────────── */}
      {googleFontsUrl && (
        <link rel="stylesheet" href={googleFontsUrl} />
      )}

      {/* ── Navigation Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--portal-border)] bg-[var(--portal-bg)]/90 backdrop-blur-md px-6 py-3.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo & Name */}
          <Link href={`/portal/${slug}`} className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={brandTitle}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div
                className="w-9 h-9 flex items-center justify-center text-white font-bold text-sm shadow-sm"
                style={{ backgroundColor: theme.colors.primary, borderRadius: radiusCss }}
              >
                {brandTitle.charAt(0)}
              </div>
            )}
            <span
              className="font-extrabold text-base tracking-tight"
              style={{ fontFamily: 'var(--portal-heading-font)' }}
            >
              {brandTitle}
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[var(--portal-muted)]">
            {(navigation.headerItems || []).map(item => (
              <Link
                key={item.id}
                href={item.path}
                target={item.target || '_self'}
                className="hover:text-[var(--portal-primary)] transition-colors flex items-center gap-1"
              >
                {item.label}
                {item.target === '_blank' && <ExternalLink className="w-3 h-3 opacity-60" />}
              </Link>
            ))}
          </nav>

          {/* Header Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {navigation.headerActions.showSearch && (
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(true)}
                className="relative w-48 text-left h-9 pl-8 pr-3 border border-[var(--portal-border)] bg-[var(--portal-surface)] text-xs text-[var(--portal-muted)] hover:text-foreground flex items-center justify-between transition-colors shadow-2xs"
                style={{ borderRadius: radiusCss }}
              >
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" />
                <span>Search portal...</span>
                <kbd className="text-[9px] bg-muted/60 px-1 py-0.5 rounded border border-border">⌘K</kbd>
              </button>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-2 p-1 rounded-xl hover:bg-muted/40 transition-colors">
                    <Avatar className="w-8 h-8 border border-border">
                      {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'Member'} />}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        {(user.displayName || user.email || 'M').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl w-56 p-2 space-y-1">
                  <div className="px-3 py-2 border-b border-border/60">
                    <p className="font-bold text-xs text-foreground truncate">{user.displayName || 'Member'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <Link href={`/portal/${slug}/dashboard`}>
                    <DropdownMenuItem className="text-xs font-semibold rounded-xl gap-2 cursor-pointer">
                      <LayoutDashboard className="w-3.5 h-3.5" /> My Learning Dashboard
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => auth && signOut(auth)}
                    className="text-xs font-semibold rounded-xl gap-2 text-rose-500 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : navigation.headerActions.showLoginButton ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAuthModalOpen(true)}
                className="h-9 px-3.5 rounded-xl font-bold text-xs"
              >
                Sign In
              </Button>
            ) : null}

            {navigation.headerActions.ctaButton?.label && (
              <Link href={navigation.headerActions.ctaButton.path || '#'}>
                <Button
                  size="sm"
                  className="h-9 px-4 font-bold text-xs text-white shadow-sm transition-transform active:scale-[0.97]"
                  style={primaryBtnStyle}
                >
                  {navigation.headerActions.ctaButton.label}
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--portal-muted)] hover:text-foreground"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden pt-4 pb-6 px-4 space-y-4 border-t border-[var(--portal-border)] mt-3 animate-in slide-in-from-top-4 duration-200">
            <nav className="flex flex-col space-y-2">
              {(navigation.headerItems || []).map(item => (
                <Link
                  key={item.id}
                  href={item.path}
                  target={item.target || '_self'}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="min-h-[44px] flex items-center px-3 rounded-xl font-semibold text-sm hover:bg-[var(--portal-surface)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="pt-2 border-t border-[var(--portal-border)] flex flex-col gap-2">
              {navigation.headerActions.showLoginButton && (
                <Link href="/login" className="w-full">
                  <Button variant="outline" className="w-full min-h-[44px] rounded-xl font-bold text-sm">
                    Sign In
                  </Button>
                </Link>
              )}
              {navigation.headerActions.ctaButton?.label && (
                <Link href={navigation.headerActions.ctaButton.path || '#'} className="w-full">
                  <Button
                    className="w-full min-h-[44px] font-bold text-sm text-white"
                    style={primaryBtnStyle}
                  >
                    {navigation.headerActions.ctaButton.label}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Main Content Space ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {/* Hero / Banner Section */}
        <section
          className="px-6 py-16 md:py-24 text-center border-b border-[var(--portal-border)] relative overflow-hidden transition-colors"
          style={{ backgroundColor: theme.colors.surface }}
        >
          {/* Subtle Ambient Radial Glow */}
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ backgroundColor: theme.colors.primary }}
          />

          <div className="max-w-3xl mx-auto space-y-4 relative z-10">
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
              {portal.primaryMode.replace('_', ' ')}
            </Badge>

            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground"
              style={{ fontFamily: 'var(--portal-heading-font)' }}
            >
              {brandTitle}
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-[var(--portal-muted)] max-w-2xl mx-auto leading-relaxed">
              {branding.tagline || portal.description || 'Welcome to your digital experience portal.'}
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              {navigation.headerActions.ctaButton?.label ? (
                <Link href={navigation.headerActions.ctaButton.path || '#'}>
                  <Button
                    size="lg"
                    className="min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.97] gap-2"
                    style={primaryBtnStyle}
                  >
                    {navigation.headerActions.ctaButton.label} <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  size="lg"
                  className="min-h-[44px] px-6 font-bold text-sm text-white shadow-md transition-transform active:scale-[0.97] gap-2"
                  style={primaryBtnStyle}
                >
                  Explore Modules <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Mode-Specific Content Spaces */}
        <section className="max-w-7xl mx-auto w-full p-6 md:p-12 space-y-12">
          {/* Active Feature Spaces Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--portal-border)] pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--portal-heading-font)' }}>
                  Active Learning Spaces
                </h2>
                <p className="text-xs text-[var(--portal-muted)] mt-0.5">
                  Explore modules and resources available inside this portal.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.enableCourses && (
                <Card
                  className="border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-3 hover:shadow-lg transition-all"
                  style={{ borderRadius: radiusCss }}
                >
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: theme.colors.primary, borderRadius: radiusCss }}
                  >
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base">Course Curriculum</h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Interactive step-by-step masterclasses, structured lessons, and knowledge checks.
                  </p>
                </Card>
              )}

              {features.enableDocs && (
                <Card
                  className="border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-3 hover:shadow-lg transition-all"
                  style={{ borderRadius: radiusCss }}
                >
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: theme.colors.accent, borderRadius: radiusCss }}
                  >
                    <FileCode className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base">Help Centre & Documentation</h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Comprehensive knowledge base, step-by-step documentation, and FAQs.
                  </p>
                </Card>
              )}

              {features.enableCommunity && (
                <Card
                  className="border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-3 hover:shadow-lg transition-all"
                  style={{ borderRadius: radiusCss }}
                >
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: theme.colors.primary, borderRadius: radiusCss }}
                  >
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base">Member Community</h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Engage with fellow learners, participate in discussion threads, and ask questions.
                  </p>
                </Card>
              )}

              {features.enableResources && (
                <Card
                  className="border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-3 hover:shadow-lg transition-all"
                  style={{ borderRadius: radiusCss }}
                >
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: theme.colors.secondary, borderRadius: radiusCss }}
                  >
                    <FolderArchive className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base">Resource Vault</h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Downloadable worksheets, PDF templates, checklists, and guides.
                  </p>
                </Card>
              )}

              {features.enableBlog && (
                <Card
                  className="border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-3 hover:shadow-lg transition-all"
                  style={{ borderRadius: radiusCss }}
                >
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: theme.colors.accent, borderRadius: radiusCss }}
                  >
                    <Newspaper className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base">Insights & Articles</h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Editorial publications, thought leadership, and operational strategies.
                  </p>
                </Card>
              )}

              {features.enableGamification && (
                <Card
                  className="border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-3 hover:shadow-lg transition-all"
                  style={{ borderRadius: radiusCss }}
                >
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: theme.colors.primary, borderRadius: radiusCss }}
                  >
                    <Award className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base">Certifications & Badges</h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Earn verifiable completion certificates and competency credentials.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--portal-border)] bg-[var(--portal-surface)] px-6 py-12 transition-colors">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <h4 className="font-bold text-base text-foreground" style={{ fontFamily: 'var(--portal-heading-font)' }}>
                {brandTitle}
              </h4>
              <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                {branding.tagline || 'Experience Platform powered by SmartSapp.'}
              </p>
            </div>

            {(navigation.footerColumns || []).map((col, idx) => (
              <div key={col.id || idx} className="space-y-3">
                <h5
                  className="font-bold text-xs uppercase tracking-wider text-foreground"
                  style={{ fontFamily: 'var(--portal-heading-font)' }}
                >
                  {col.title}
                </h5>
                <ul className="space-y-2 text-xs text-[var(--portal-muted)]">
                  {(col.items || []).map((item, itemIdx) => (
                    <li key={item.id || itemIdx}>
                      <Link
                        href={item.path}
                        target={item.target || '_self'}
                        className="hover:text-[var(--portal-primary)] transition-colors"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-[var(--portal-border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--portal-muted)]">
            <p>{branding.copyrightText || `© ${new Date().getFullYear()} ${brandTitle}. All rights reserved.`}</p>
            <p className="text-[11px]">Powered by Experience Platform</p>
          </div>
        </div>
      </footer>

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
    </div>
  );
}
