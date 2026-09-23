'use client';

/**
 * Shared Portal Shell Header Component (Single Source of Truth)
 *
 * Serves as the authoritative, shared navigation header for BOTH the public
 * runtime (`PortalRuntimeClient.tsx`) and the Studio visual preview canvas
 * (`PortalLivePreviewCanvas.tsx`).
 *
 * Rules:
 * - Strictly typed (Zero any / any[] / unknown).
 * - Mobile ergonomics: >=44px touch targets (min-h-[44px]), active:scale-[0.97] feedback.
 * - Single Source of Truth: eliminates visual and component drift between preview and live view.
 * - Conforms to next-best-practices, vercel-react-best-practices, and emilkowal-animations.
 *
 * Caution for Maintainers:
 * - In `isPreview` mode, navigation links and buttons must not navigate away from the Studio.
 *   Use `onNavigateRoute` callback to simulate in-canvas navigation safely.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Menu,
  X,
  ExternalLink,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { resolvePortalPath } from '@/lib/utils/portal-navigation';
import { PortalThemeToggle } from './PortalThemeToggle';
import { usePortalTheme } from './PortalThemeProvider';
import { getPortalButtonInlineStyle } from '@/lib/utils/portal-theme';
import type {
  PortalThemeConfig,
  PortalBranding,
  PortalNavigationConfig,
} from '@/lib/types/portal';

export interface PortalHeaderUser {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  uid?: string;
}

export interface PortalShellHeaderProps {
  slug: string;
  brandTitle: string;
  theme: PortalThemeConfig;
  branding: PortalBranding;
  navigation: PortalNavigationConfig;
  radiusCss: string;
  user?: PortalHeaderUser | null;
  isMember?: boolean;
  isPreview?: boolean;
  previewRoute?: string;
  onNavigateRoute?: (route: '/' | '/learn' | '/community' | '/dashboard') => void;
  onOpenSearch?: () => void;
  onOpenAuth?: () => void;
  onSignOut?: () => void;
}

export function PortalShellHeader({
  slug,
  brandTitle,
  theme,
  branding,
  navigation,
  radiusCss,
  user,
  isMember = false,
  isPreview = false,
  previewRoute = '/',
  onNavigateRoute,
  onOpenSearch,
  onOpenAuth,
  onSignOut,
}: PortalShellHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { activeColors } = usePortalTheme();
  const pathname = usePathname();

  const isItemActive = React.useCallback(
    (resolvedPath: string) => {
      if (isPreview) {
        if (previewRoute) {
          const normPreview = previewRoute.replace(/\/+$/, '') || '/';
          const rootPath = `/portal/${slug}`;
          if (normPreview === '/' && (resolvedPath === rootPath || resolvedPath === `${rootPath}/`)) return true;
          if (normPreview !== '/') {
            const expectedPath = `${rootPath}${normPreview.startsWith('/') ? '' : '/'}${normPreview}`;
            return (
              resolvedPath === expectedPath ||
              resolvedPath === `${expectedPath}/` ||
              resolvedPath.startsWith(`${expectedPath}/`)
            );
          }
        }
        return false;
      }
      if (!pathname) return false;
      const rootPath = `/portal/${slug}`;
      const isRootItem = resolvedPath === rootPath || resolvedPath === `${rootPath}/`;
      if (isRootItem) {
        return pathname === rootPath || pathname === `${rootPath}/`;
      }
      return (
        pathname === resolvedPath ||
        pathname.startsWith(`${resolvedPath}/`) ||
        (pathname.startsWith(resolvedPath) && resolvedPath !== rootPath)
      );
    },
    [isPreview, previewRoute, slug, pathname]
  );

  const primaryBtnStyle = React.useMemo(
    () =>
      getPortalButtonInlineStyle(
        theme.ui?.buttonStyle,
        activeColors.primary,
        radiusCss
      ),
    [theme.ui?.buttonStyle, activeColors.primary, radiusCss]
  );

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
    <header className="sticky top-0 z-40 border-b border-[var(--portal-border)] bg-[var(--portal-bg)]/90 backdrop-blur-md px-6 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* ── Brand Logo & Title ────────────────────────────────────────── */}
        {isPreview ? (
          <div
            onClick={e => handleRouteClick(e, '/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={brandTitle}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div
                className="w-9 h-9 flex items-center justify-center text-white font-bold text-sm shadow-sm transition-transform group-hover:scale-105"
                style={{ backgroundColor: activeColors.primary, borderRadius: radiusCss }}
              >
                {brandTitle.charAt(0)}
              </div>
            )}
            <span
              className="font-extrabold text-base tracking-tight text-[var(--portal-text)]"
              style={{ fontFamily: 'var(--portal-heading-font)' }}
            >
              {brandTitle}
            </span>
          </div>
        ) : (
          <Link href={`/portal/${slug}`} className="flex items-center gap-3 group">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={brandTitle}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div
                className="w-9 h-9 flex items-center justify-center text-white font-bold text-sm shadow-sm transition-transform group-hover:scale-105"
                style={{ backgroundColor: activeColors.primary, borderRadius: radiusCss }}
              >
                {brandTitle.charAt(0)}
              </div>
            )}
            <span
              className="font-extrabold text-base tracking-tight text-[var(--portal-text)]"
              style={{ fontFamily: 'var(--portal-heading-font)' }}
            >
              {brandTitle}
            </span>
          </Link>
        )}

        {/* ── Desktop Navigation Links ──────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-[var(--portal-muted)]">
          {(navigation.headerItems || []).map(item => {
            const resolvedPath = resolvePortalPath(item.path, slug);
            const active = isItemActive(resolvedPath);

            const activeClass = active
              ? 'text-[var(--portal-text)] font-bold bg-[var(--portal-surface)] shadow-2xs'
              : 'text-[var(--portal-muted)] hover:text-[var(--portal-text)] hover:bg-[var(--portal-surface)]/60 font-medium';

            if (isPreview) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={e => handleRouteClick(e, resolvedPath)}
                  className={cn(
                    'transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97]',
                    activeClass
                  )}
                >
                  {item.label}
                  {item.target === '_blank' && <ExternalLink className="w-3 h-3 opacity-60" />}
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                href={resolvedPath}
                target={item.target || '_self'}
                className={cn(
                  'transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97]',
                  activeClass
                )}
              >
                {item.label}
                {item.target === '_blank' && <ExternalLink className="w-3 h-3 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* ── Desktop Header Actions ────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-3">
          {navigation.headerActions.showSearch && (
            <button
              type="button"
              onClick={() => onOpenSearch?.()}
              className="relative w-48 text-left h-9 pl-8 pr-3 border border-[var(--portal-border)] bg-[var(--portal-surface)] text-xs text-[var(--portal-muted)] hover:text-[var(--portal-text)] hover:border-[var(--portal-primary)]/60 flex items-center justify-between transition-all shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              style={{ borderRadius: radiusCss }}
            >
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" />
              <span>Search portal...</span>
              <kbd className="text-[9px] bg-[var(--portal-bg)] text-[var(--portal-muted)] px-1.5 py-0.5 rounded border border-[var(--portal-border)] font-mono">⌘K</kbd>
            </button>
          )}

          {/* Theme Toggle (Client Independent Scoped Theme) */}
          <PortalThemeToggle variant="icon" />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 p-1 rounded-xl hover:bg-muted/40 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                >
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
                {isPreview ? (
                  <DropdownMenuItem
                    onClick={() => onNavigateRoute?.('/dashboard')}
                    className="text-xs font-semibold rounded-xl gap-2 cursor-pointer"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" /> My Learning Dashboard
                  </DropdownMenuItem>
                ) : (
                  <Link href={`/portal/${slug}/dashboard`}>
                    <DropdownMenuItem className="text-xs font-semibold rounded-xl gap-2 cursor-pointer">
                      <LayoutDashboard className="w-3.5 h-3.5" /> My Learning Dashboard
                    </DropdownMenuItem>
                  </Link>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onSignOut?.()}
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
              onClick={() => onOpenAuth?.()}
              className="h-9 px-3.5 rounded-xl font-bold text-xs active:scale-[0.97] transition-transform"
            >
              Sign In
            </Button>
          ) : null}

          {/* Primary Action Button */}
          {user ? (
            isMember ? (
              isPreview ? (
                <Button
                  size="sm"
                  onClick={() => onNavigateRoute?.('/dashboard')}
                  className="h-9 px-4 font-bold text-xs text-white shadow-sm transition-transform active:scale-[0.97]"
                  style={primaryBtnStyle}
                >
                  Dashboard
                </Button>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="h-9 px-4 font-bold text-xs text-white shadow-sm transition-transform active:scale-[0.97]"
                  style={primaryBtnStyle}
                >
                  <Link href={`/portal/${slug}/dashboard`}>
                    Dashboard
                  </Link>
                </Button>
              )
            ) : isPreview ? (
              <Button
                size="sm"
                className="h-9 px-4 font-bold text-xs text-white shadow-sm transition-transform active:scale-[0.97]"
                style={primaryBtnStyle}
              >
                Join Portal
              </Button>
            ) : (
              <Button
                asChild
                size="sm"
                className="h-9 px-4 font-bold text-xs text-white shadow-sm transition-transform active:scale-[0.97]"
                style={primaryBtnStyle}
              >
                <Link href={`/portal/${slug}/join`}>
                  Join Portal
                </Link>
              </Button>
            )
          ) : navigation.headerActions.ctaButton?.label ? (
            isPreview ? (
              <Button
                size="sm"
                className="h-9 px-4 font-bold text-xs text-white shadow-sm transition-transform active:scale-[0.97]"
                style={primaryBtnStyle}
              >
                {navigation.headerActions.ctaButton.label}
              </Button>
            ) : (
              <Button
                asChild
                size="sm"
                className="h-9 px-4 font-bold text-xs text-white shadow-sm transition-transform active:scale-[0.97]"
                style={primaryBtnStyle}
              >
                <Link href={resolvePortalPath(navigation.headerActions.ctaButton.path || '/join', slug)}>
                  {navigation.headerActions.ctaButton.label}
                </Link>
              </Button>
            )
          ) : null}
        </div>

        {/* ── Mobile Action Triggers ────────────────────────────────────── */}
        <div className="md:hidden flex items-center gap-1">
          {navigation.headerActions.showSearch && (
            <button
              type="button"
              onClick={() => onOpenSearch?.()}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--portal-muted)] hover:text-foreground active:scale-[0.97] transition-all"
              aria-label="Search portal"
            >
              <Search className="w-5 h-5" />
            </button>
          )}

          <PortalThemeToggle variant="icon" />

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--portal-muted)] hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97]"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* ── Mobile Navigation Drawer ────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div className="md:hidden pt-4 pb-6 px-4 space-y-4 border-t border-[var(--portal-border)] mt-3 animate-in slide-in-from-top-4 duration-200">
          <nav className="flex flex-col space-y-1">
            {(navigation.headerItems || []).map(item => {
              const resolvedPath = resolvePortalPath(item.path, slug);
              const active = isItemActive(resolvedPath);
              const activeDrawerClass = active
                ? 'bg-primary/10 text-primary font-bold shadow-2xs'
                : 'text-[var(--portal-text)] hover:bg-[var(--portal-surface)] font-medium';

              if (isPreview) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={e => {
                      setIsMobileMenuOpen(false);
                      handleRouteClick(e, resolvedPath);
                    }}
                    className={cn(
                      'min-h-[44px] flex items-center px-3.5 rounded-xl text-sm active:scale-[0.97] transition-all text-left w-full',
                      activeDrawerClass
                    )}
                  >
                    {item.label}
                  </button>
                );
              }
              return (
                <Link
                  key={item.id}
                  href={resolvedPath}
                  target={item.target || '_self'}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'min-h-[44px] flex items-center px-3.5 rounded-xl text-sm active:scale-[0.97] transition-all',
                    activeDrawerClass
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-2 border-t border-[var(--portal-border)] flex flex-col gap-2">
            {/* Theme Toggle (Mobile Drawer) */}
            <PortalThemeToggle variant="drawer" />

            {!user && navigation.headerActions.showLoginButton && (
              <Button
                variant="outline"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenAuth?.();
                }}
                className="w-full min-h-[44px] rounded-xl font-bold text-sm active:scale-[0.97] transition-transform"
              >
                Sign In
              </Button>
            )}
            {user ? (
              isMember ? (
                isPreview ? (
                  <Button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onNavigateRoute?.('/dashboard');
                    }}
                    className="w-full min-h-[44px] font-bold text-sm text-white active:scale-[0.97] transition-transform"
                    style={primaryBtnStyle}
                  >
                    Go to Dashboard
                  </Button>
                ) : (
                  <Link
                    href={`/portal/${slug}/dashboard`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full"
                  >
                    <Button
                      className="w-full min-h-[44px] font-bold text-sm text-white active:scale-[0.97] transition-transform"
                      style={primaryBtnStyle}
                    >
                      Go to Dashboard
                    </Button>
                  </Link>
                )
              ) : isPreview ? (
                <Button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full min-h-[44px] font-bold text-sm text-white active:scale-[0.97] transition-transform"
                  style={primaryBtnStyle}
                >
                  Join Portal
                </Button>
              ) : (
                <Link
                  href={`/portal/${slug}/join`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full"
                >
                  <Button
                    className="w-full min-h-[44px] font-bold text-sm text-white active:scale-[0.97] transition-transform"
                    style={primaryBtnStyle}
                  >
                    Join Portal
                  </Button>
                </Link>
              )
            ) : navigation.headerActions.ctaButton?.label ? (
              isPreview ? (
                <Button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full min-h-[44px] font-bold text-sm text-white active:scale-[0.97] transition-transform"
                  style={primaryBtnStyle}
                >
                  {navigation.headerActions.ctaButton.label}
                </Button>
              ) : (
                <Link
                  href={resolvePortalPath(navigation.headerActions.ctaButton.path || '/join', slug)}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full"
                >
                  <Button
                    className="w-full min-h-[44px] font-bold text-sm text-white active:scale-[0.97] transition-transform"
                    style={primaryBtnStyle}
                  >
                    {navigation.headerActions.ctaButton.label}
                  </Button>
                </Link>
              )
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
}
