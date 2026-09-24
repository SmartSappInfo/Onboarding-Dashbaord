'use client';

/**
 * {{Org_name}} Experience Platform — Dedicated Forgot Password Client
 *
 * Branded password recovery client sending password reset emails via Firebase Auth,
 * displaying clear delivery confirmation cards, and supporting resend actions.
 *
 * Strict Compliance:
 * - Mobile Touch Ergonomics: >= 44px min-height on all touch targets.
 * - Emil-Kowalski-Animations: Tactile active:scale-[0.97] press feedback.
 * - Zero any / any[].
 */

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { sendPasswordResetEmail } from 'firebase/auth';
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
import { getErrorMessage } from '@/lib/errors/report-error';
import type { Portal } from '@/lib/types/portal';
import { Mail, ArrowLeft, Loader2, CheckCircle2, KeyRound } from 'lucide-react';

interface PortalForgotPasswordClientProps {
  portal: Portal;
  slug: string;
}

export default function PortalForgotPasswordClient({
  portal,
  slug,
}: PortalForgotPasswordClientProps) {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeColors } = usePortalTheme();

  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
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
      await sendPasswordResetEmail(auth, email.trim());
      setIsSubmitted(true);
      toast({
        title: 'Instructions Sent',
        description: `Check your inbox at ${email.trim()} for password reset instructions.`,
      });
    } catch (err: unknown) {
      const friendlyMsg =
        getErrorMessage(err) || 'Failed to send password reset email. Please try again.';
      setErrorMessage(friendlyMsg);
      toast({
        title: 'Error Sending Email',
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

  if (isSubmitted) {
    return (
      <Card
        className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--portal-border)] bg-[var(--portal-surface)]/95 shadow-2xl backdrop-blur-xl space-y-6 text-center"
        style={{ borderRadius: radiusCss }}
      >
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2
            className="text-2xl font-black tracking-tight text-[var(--portal-text)]"
            style={{ fontFamily: 'var(--portal-heading-font)' }}
          >
            Check Your Inbox
          </h2>
          <p className="text-xs text-[var(--portal-muted)] leading-relaxed max-w-sm mx-auto">
            We sent a password reset link to{' '}
            <strong className="text-[var(--portal-text)]">{email}</strong>. Please follow the instructions in the email to set your new password.
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <Button
            asChild
            className="w-full min-h-[44px] rounded-xl font-bold text-xs sm:text-sm gap-2 active:scale-[0.97] transition-all shadow-md"
            style={primaryBtnStyle}
          >
            <Link href={signinHref}>
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Sign In</span>
            </Link>
          </Button>

          <button
            type="button"
            onClick={() => setIsSubmitted(false)}
            className="text-xs font-semibold text-[var(--portal-muted)] hover:text-[var(--portal-text)] underline block mx-auto py-1"
          >
            Didn't receive the email? Try again
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--portal-border)] bg-[var(--portal-surface)]/95 shadow-2xl backdrop-blur-xl space-y-6"
      style={{ borderRadius: radiusCss }}
    >
      <div className="space-y-1 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--portal-primary)]/10 text-[var(--portal-primary)] text-xs font-bold mb-2">
          <KeyRound className="w-3.5 h-3.5" />
          <span>Account Recovery</span>
        </div>
        <h1
          className="text-2xl font-black tracking-tight text-[var(--portal-text)]"
          style={{ fontFamily: 'var(--portal-heading-font)' }}
        >
          Reset Your Password
        </h1>
        <p className="text-xs text-[var(--portal-muted)]">
          Enter your registered email address and we'll send you instructions to reset your password.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium leading-relaxed">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email" className="text-xs font-bold text-[var(--portal-text)]">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--portal-muted)]" />
            <Input
              id="forgot-email"
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

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full min-h-[44px] rounded-xl font-bold text-xs sm:text-sm gap-2 active:scale-[0.97] transition-all shadow-md mt-2"
          style={primaryBtnStyle}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending Instructions...</span>
            </>
          ) : (
            <span>Send Reset Instructions</span>
          )}
        </Button>
      </form>

      <div className="pt-2 border-t border-[var(--portal-border)] text-center text-xs text-[var(--portal-muted)]">
        <p>
          Remembered your password?{' '}
          <Link
            href={signinHref}
            className="font-bold text-[var(--portal-primary)] hover:underline"
          >
            Sign in here →
          </Link>
        </p>
      </div>
    </Card>
  );
}
