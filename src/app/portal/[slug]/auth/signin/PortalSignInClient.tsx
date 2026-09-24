'use client';

/**
 * {{Org_name}} Experience Platform — Dedicated Member Sign In Client
 *
 * High-conversion, branded sign-in form with safe relative redirect handling,
 * responsive mobile ergonomics (min 44px touch targets), tactile press animations,
 * and automatic portal membership provisioning via joinPortalDirectAction.
 *
 * Strict Compliance:
 * - Next-Best-Practices: Proper client boundary with search params synchronization.
 * - Emil-Kowalski-Animations: Tactile press feedback (active:scale-[0.97]) on all buttons.
 * - Zero any / any[].
 * - Security: Strictly validates redirect query parameter against Open Redirect vulnerabilities.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePortalTheme } from '../../components/PortalThemeProvider';
import {
  getPortalRadiusCss,
  getPortalButtonInlineStyle,
  validateRelativeRedirect,
} from '@/lib/utils/portal-theme';
import { getContrastRatio } from '@/lib/utils/portal-theme-generator';
import { joinPortalDirectAction } from '@/app/actions/membership-actions';
import { getErrorMessage } from '@/lib/errors/report-error';
import type { Portal } from '@/lib/types/portal';
import { Mail, Key, ArrowRight, Loader2, Lock } from 'lucide-react';

interface PortalSignInClientProps {
  portal: Portal;
  slug: string;
}

export default function PortalSignInClient({ portal, slug }: PortalSignInClientProps) {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeColors } = usePortalTheme();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const rawRedirect = searchParams.get('redirect');
  const safeRedirect = React.useMemo(() => {
    return validateRelativeRedirect(rawRedirect, `/portal/${slug}/dashboard`);
  }, [rawRedirect, slug]);

  const brandTitle = portal.branding?.brandName || portal.name;
  const radiusCss = getPortalRadiusCss(portal.theme?.ui?.borderRadius);

  const primaryBtnTextColor = React.useMemo(() => {
    return getContrastRatio(activeColors.primary, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#0F172A';
  }, [activeColors.primary]);

  const primaryBtnStyle = React.useMemo(() => {
    const base = getPortalButtonInlineStyle(
      portal.theme?.ui?.buttonStyle,
      activeColors.primary,
      radiusCss
    );
    return { ...base, color: primaryBtnTextColor };
  }, [portal.theme?.ui?.buttonStyle, activeColors.primary, radiusCss, primaryBtnTextColor]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);

      // Guarantee active membership record exists in portal
      await joinPortalDirectAction(portal.id, userCred.user.uid, {
        email: userCred.user.email || email.trim(),
        displayName: userCred.user.displayName || email.trim().split('@')[0],
        role: 'member',
        joinedVia: 'direct_join',
      });

      toast({
        title: 'Welcome Back!',
        description: `Successfully signed in to ${brandTitle}.`,
      });

      router.push(safeRedirect);
      router.refresh();
    } catch (err: unknown) {
      let friendlyMsg = 'Failed to sign in. Please verify your credentials.';
      const msg = getErrorMessage(err);
      if (
        msg.includes('auth/invalid-credential') ||
        msg.includes('auth/wrong-password') ||
        msg.includes('auth/user-not-found')
      ) {
        friendlyMsg = 'Invalid email address or password. Please try again.';
      } else if (msg.includes('auth/too-many-requests')) {
        friendlyMsg = 'Too many attempts. Please wait a few moments or reset your password.';
      } else if (msg.includes('auth/user-disabled')) {
        friendlyMsg = 'This account has been disabled. Please contact administrator support.';
      }
      setErrorMessage(friendlyMsg);
      toast({
        title: 'Authentication Failed',
        description: friendlyMsg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const registerHref = `/portal/${slug}/auth/register${
    rawRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : ''
  }`;
  const forgotHref = `/portal/${slug}/auth/forgot-password${
    rawRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : ''
  }`;

  return (
    <Card
      className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--portal-border)] bg-[var(--portal-surface)]/95 shadow-2xl backdrop-blur-xl space-y-6"
      style={{ borderRadius: radiusCss }}
    >
      <div className="space-y-1 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--portal-primary)]/10 text-[var(--portal-primary)] text-xs font-bold mb-2">
          <Lock className="w-3.5 h-3.5" />
          <span>Member Access</span>
        </div>
        <h1
          className="text-2xl font-black tracking-tight text-[var(--portal-text)]"
          style={{ fontFamily: 'var(--portal-heading-font)' }}
        >
          Sign In
        </h1>
        <p className="text-xs text-[var(--portal-muted)]">
          Enter your credentials to access your member dashboard and courses.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium leading-relaxed">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="signin-email" className="text-xs font-bold text-[var(--portal-text)]">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--portal-muted)]" />
            <Input
              id="signin-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="pl-10 min-h-[44px] text-xs bg-[var(--portal-bg)] border-[var(--portal-border)] text-[var(--portal-text)] placeholder:text-[var(--portal-muted)]"
              style={{ borderRadius: radiusCss }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="signin-password" className="text-xs font-bold text-[var(--portal-text)]">
              Password
            </Label>
            <Link
              href={forgotHref}
              className="text-[11px] font-semibold text-[var(--portal-primary)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--portal-muted)]" />
            <Input
              id="signin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10 min-h-[44px] text-xs bg-[var(--portal-bg)] border-[var(--portal-border)] text-[var(--portal-text)] placeholder:text-[var(--portal-muted)]"
              style={{ borderRadius: radiusCss }}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full min-h-[44px] rounded-xl font-bold text-xs sm:text-sm gap-2 active:scale-[0.97] transition-all shadow-md mt-2"
          style={primaryBtnStyle}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing In...</span>
            </>
          ) : (
            <>
              <span>Sign In to Member Portal</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      <div className="pt-2 border-t border-[var(--portal-border)] space-y-2 text-center text-xs text-[var(--portal-muted)]">
        <p>
          New member?{' '}
          <Link
            href={registerHref}
            className="font-bold text-[var(--portal-primary)] hover:underline"
          >
            Create an account →
          </Link>
        </p>
        <p className="text-[11px]">
          Have an invitation code?{' '}
          <Link
            href={`/portal/${slug}/join`}
            className="font-medium text-[var(--portal-text)] hover:underline"
          >
            Claim invite link
          </Link>
        </p>
      </div>
    </Card>
  );
}
