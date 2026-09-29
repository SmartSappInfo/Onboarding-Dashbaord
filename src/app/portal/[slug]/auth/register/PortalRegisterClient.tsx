'use client';

/**
 * {{Org_name}} Experience Platform — Dedicated Member Registration Client
 *
 * Branded registration form with password confirmation, auto-provisioning
 * of PortalMembership via joinPortalDirectAction, tactile Emil Kowalski animations,
 * and safe relative redirect enforcement.
 *
 * Strict Compliance:
 * - Next-Best-Practices: Proper client boundary with search params synchronization.
 * - Mobile Ergonomics: >= 44px min-height on all touch targets.
 * - Zero any / any[].
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
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
import { Mail, Key, User, ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface PortalRegisterClientProps {
  portal: Portal;
  slug: string;
}

export default function PortalRegisterClient({ portal, slug }: PortalRegisterClientProps) {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeColors } = usePortalTheme();

  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
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

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // Update Firebase Auth profile
      await updateProfile(userCred.user, {
        displayName: displayName.trim(),
      });

      // Provision portal membership record (identity + email are taken from the verified token)
      await joinPortalDirectAction(await userCred.user.getIdToken(), portal.id, {
        displayName: displayName.trim(),
        role: 'member',
        joinedVia: 'direct_join',
      });

      toast({
        title: 'Account Created!',
        description: `Welcome to ${brandTitle}. Your membership is now active.`,
      });

      router.push(safeRedirect);
      router.refresh();
    } catch (err: unknown) {
      let friendlyMsg = 'Failed to create account. Please try again.';
      const msg = getErrorMessage(err);
      if (msg.includes('auth/email-already-in-use')) {
        friendlyMsg = 'An account with this email address already exists. Please sign in instead.';
      } else if (msg.includes('auth/weak-password')) {
        friendlyMsg = 'Password is too weak. Please choose at least 6 characters.';
      } else if (msg.includes('auth/invalid-email')) {
        friendlyMsg = 'Please enter a valid email address.';
      }
      setErrorMessage(friendlyMsg);
      toast({
        title: 'Registration Error',
        description: friendlyMsg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signinHref = `/portal/${slug}/auth/signin${
    rawRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : ''
  }`;

  return (
    <Card
      className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--portal-border)] bg-[var(--portal-surface)]/95 shadow-2xl backdrop-blur-xl space-y-6"
      style={{ borderRadius: radiusCss }}
    >
      <div className="space-y-1 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--portal-primary)]/10 text-[var(--portal-primary)] text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Join Community</span>
        </div>
        <h1
          className="text-2xl font-black tracking-tight text-[var(--portal-text)]"
          style={{ fontFamily: 'var(--portal-heading-font)' }}
        >
          Create Member Account
        </h1>
        <p className="text-xs text-[var(--portal-muted)]">
          Join {brandTitle} to access exclusive materials, courses, and toolkits.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium leading-relaxed">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reg-name" className="text-xs font-bold text-[var(--portal-text)]">
            Full Name
          </Label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--portal-muted)]" />
            <Input
              id="reg-name"
              type="text"
              required
              autoFocus
              autoComplete="name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className="pl-10 min-h-[44px] text-xs bg-[var(--portal-bg)] border-[var(--portal-border)] text-[var(--portal-text)] placeholder:text-[var(--portal-muted)]"
              style={{ borderRadius: radiusCss }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-email" className="text-xs font-bold text-[var(--portal-text)]">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--portal-muted)]" />
            <Input
              id="reg-email"
              type="email"
              required
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
          <Label htmlFor="reg-pass" className="text-xs font-bold text-[var(--portal-text)]">
            Password (min. 6 characters)
          </Label>
          <div className="relative">
            <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--portal-muted)]" />
            <Input
              id="reg-pass"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10 min-h-[44px] text-xs bg-[var(--portal-bg)] border-[var(--portal-border)] text-[var(--portal-text)] placeholder:text-[var(--portal-muted)]"
              style={{ borderRadius: radiusCss }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-confirm" className="text-xs font-bold text-[var(--portal-text)]">
            Confirm Password
          </Label>
          <div className="relative">
            <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--portal-muted)]" />
            <Input
              id="reg-confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
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
              <span>Creating Account...</span>
            </>
          ) : (
            <>
              <span>Join as Member</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      <div className="pt-2 border-t border-[var(--portal-border)] space-y-2 text-center text-xs text-[var(--portal-muted)]">
        <p>
          Already have an account?{' '}
          <Link
            href={signinHref}
            className="font-bold text-[var(--portal-primary)] hover:underline"
          >
            Sign in here →
          </Link>
        </p>
        <p className="text-[11px]">
          Have an invitation link?{' '}
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
