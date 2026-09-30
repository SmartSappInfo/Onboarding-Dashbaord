'use client';

/**
 * @fileOverview Public Invitation Acceptance Landing Screen (Workforce 2.0)
 *
 * Implements a high-aesthetic, mobile-first onboarding landing surface for invited
 * team members to review their invitation details, accept, or decline with confirmation.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Publicly accessible without requiring pre-existing authentication.
 * - Adheres strictly to `emilkowal-animations`: animations under 300ms, `active:scale-[0.97]`
 *   for all interactive controls, and hardware-accelerated transforms (`transform`, `opacity`).
 * - Mobile First: Touch targets >= 44px (`min-h-[44px]`), container uses `min-h-[100dvh]`
 *   to handle dynamic address bars and mobile keyboards gracefully.
 * - Mobile Login Integration: On acceptance, passes prefilled email query parameter
 *   directly to `/login?email=...&redirect=/dashboard` so mobile users never re-type credentials.
 * - Fast-path: When candidate profile is already completed, displays a smooth transition
 *   and automatically redirects to dashboard/login without redundant prompts.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in workforce acceptance integration suites.
 */

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Loader2,
  Mail,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import {
  validateEncryptedInvitationAction,
  acceptInvitationLandingAction,
  declineInvitationLandingAction,
  type InvitationVerificationState,
  type VerifiedInvitationData,
} from '@/app/actions/invitation-crypto-actions';

/**
 * Emilkowal animation transition settings (<300ms, natural spring / cubic-bezier)
 */
const SPRING_TRANSITION = {
  duration: 0.24,
  ease: [0.32, 0.72, 0, 1] as const,
};

/**
 * Format ISO expiration date into human-readable plain English string
 */
function formatExpiryDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export function AcceptInvitationClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();

  // Extract token supporting both modern encrypted tokens (`invite`) and legacy (`token`)
  const token = (searchParams.get('invite') || searchParams.get('token') || '').trim();

  // Lifecycle & verification state
  const [isValidating, setIsValidating] = React.useState<boolean>(true);
  const [invitationState, setInvitationState] = React.useState<InvitationVerificationState | null>(null);
  const [invitationData, setInvitationData] = React.useState<VerifiedInvitationData | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Interaction state
  const [isAccepting, setIsAccepting] = React.useState<boolean>(false);
  const [isAcceptedSuccess, setIsAcceptedSuccess] = React.useState<boolean>(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = React.useState<boolean>(false);
  const [declineReason, setDeclineReason] = React.useState<string>('');
  const [isDeclining, setIsDeclining] = React.useState<boolean>(false);

  // Validate token on mount
  React.useEffect(() => {
    let isCancelled = false;

    async function runValidation() {
      if (!token) {
        if (!isCancelled) {
          setInvitationState('invalid');
          setErrorMessage('No invitation token found in this link. Please check your invitation email.');
          setIsValidating(false);
        }
        return;
      }

      setIsValidating(true);
      try {
        const res = await validateEncryptedInvitationAction({ token });
        if (isCancelled) return;

        if (res.success && res.invitation) {
          setInvitationData(res.invitation);
          setInvitationState(res.state);
        } else {
          setInvitationState(res.state || 'invalid');
          setErrorMessage(res.error || 'This invitation is invalid or has expired.');
        }
      } catch (err: unknown) {
        if (isCancelled) return;
        const msg = err instanceof Error ? err.message : 'Could not verify invitation';
        setInvitationState('invalid');
        setErrorMessage(msg);
      } finally {
        if (!isCancelled) {
          setIsValidating(false);
        }
      }
    }

    runValidation();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  // Fast-path auto-redirect for already completed onboarding
  React.useEffect(() => {
    if (invitationState === 'already_completed') {
      const timer = setTimeout(() => {
        if (user && invitationData && user.email?.toLowerCase() === invitationData.email.toLowerCase()) {
          router.push('/admin');
        } else {
          const emailQuery = invitationData?.email
            ? `?email=${encodeURIComponent(invitationData.email)}&redirect=${encodeURIComponent('/admin')}`
            : `?redirect=${encodeURIComponent('/admin')}`;
          router.push(`/login${emailQuery}`);
        }
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [invitationState, invitationData, user, router]);

  // Handle invitation acceptance
  const handleAccept = async () => {
    if (!token || !invitationData) return;

    setIsAccepting(true);
    try {
      const res = await acceptInvitationLandingAction({ token });
      if (!res.success) {
        toast({
          title: 'Could not accept invitation',
          description: res.error || 'Please try again or contact your administrator.',
          variant: 'destructive',
        });
        setIsAccepting(false);
        return;
      }

      setIsAcceptedSuccess(true);

      // Save encrypted token in sessionStorage for bulletproof persistence across auth
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('active_invite_payload', token);
      }

      // If user is already authenticated with the invite email, go directly to profile setup
      if (user && user.email?.toLowerCase() === invitationData.email.toLowerCase()) {
        setTimeout(() => {
          router.push(`/profile-setup?invite=${encodeURIComponent(token)}`);
        }, 1000);
      } else {
        // Mobile login integration: route to login with credentials and forward to profile-setup
        const dest = `/profile-setup?invite=${encodeURIComponent(token)}`;
        const targetUrl = `/login?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(invitationData.email)}&redirect=${encodeURIComponent(dest)}`;

        setTimeout(() => {
          router.push(targetUrl);
        }, 1000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred while accepting.';
      toast({
        title: 'Action Failed',
        description: msg,
        variant: 'destructive',
      });
      setIsAccepting(false);
    }
  };

  // Handle inline confirmed decline
  const handleConfirmDecline = async () => {
    if (!token) return;

    setIsDeclining(true);
    try {
      const res = await declineInvitationLandingAction({
        token,
        reason: declineReason.trim() || undefined,
      });

      if (res.success) {
        setInvitationState('declined');
        setShowDeclineConfirm(false);
        toast({
          title: 'Invitation Declined',
          description: 'Your response has been shared with the organization.',
        });
      } else {
        toast({
          title: 'Could not decline',
          description: res.error || 'Failed to update invitation status.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record decline.';
      toast({
        title: 'Decline Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsDeclining(false);
    }
  };

  // --- RENDER STATE: VALIDATING / LOADING ---
  if (isValidating) {
    return (
      <main className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_TRANSITION}
          className="w-full max-w-md"
        >
          <Card className="p-8 text-center space-y-4 shadow-xl border border-border/80 rounded-2xl bg-card/95 backdrop-blur-sm">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-foreground">
                Checking your invitation...
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Just a moment while we verify your secure link
              </CardDescription>
            </div>
          </Card>
        </motion.div>
      </main>
    );
  }

  // --- RENDER STATE: FAST-PATH ALREADY COMPLETED ONBOARDING ---
  if (invitationState === 'already_completed') {
    return (
      <main className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_TRANSITION}
          className="w-full max-w-md"
        >
          <Card className="p-8 text-center space-y-5 shadow-2xl border border-border/80 rounded-2xl bg-card/95 backdrop-blur-sm">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-lg font-bold text-foreground">
                You&apos;re already set up!
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Your account is active for {invitationData?.organizationName || 'your organization'}. Redirecting you to your dashboard...
              </CardDescription>
            </div>

            <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="h-full bg-emerald-500 rounded-full w-1/2"
              />
            </div>

            <Button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-full min-h-[44px] h-11 text-xs font-semibold rounded-xl active:scale-[0.97] transition-transform"
            >
              Go to Dashboard Now <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Card>
        </motion.div>
      </main>
    );
  }

  // --- RENDER STATE: ALREADY ACCEPTED (PENDING PROFILE SETUP) ---
  if (invitationState === 'accepted_pending_profile') {
    return (
      <main className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_TRANSITION}
          className="w-full max-w-md"
        >
          <Card className="p-8 text-center space-y-5 shadow-2xl border border-border/80 rounded-2xl bg-card/95 backdrop-blur-sm">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-lg font-bold text-foreground">
                Invitation Already Accepted
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                You have already accepted the invitation to join {invitationData?.organizationName || 'the workspace'}. Let&apos;s get you signed in.
              </CardDescription>
            </div>

            <Button
              type="button"
              onClick={() =>
                router.push(
                  invitationData?.email
                    ? `/login?email=${encodeURIComponent(invitationData.email)}&redirect=${encodeURIComponent('/dashboard')}`
                    : '/login'
                )
              }
              className="w-full min-h-[44px] h-11 text-xs font-semibold rounded-xl active:scale-[0.97] transition-transform"
            >
              Sign In to Continue <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Card>
        </motion.div>
      </main>
    );
  }

  // --- RENDER STATE: DECLINED STATE ---
  if (invitationState === 'declined') {
    return (
      <main className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_TRANSITION}
          className="w-full max-w-md"
        >
          <Card className="p-8 text-center space-y-5 shadow-xl border border-border/80 rounded-2xl bg-card/95 backdrop-blur-sm">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center border border-border">
              <XCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-lg font-bold text-foreground">
                Invitation Declined
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                You have declined this invitation. If this was a mistake, please reach out to your organization administrator to request a new invite.
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/login')}
              className="w-full min-h-[44px] h-11 text-xs font-semibold rounded-xl active:scale-[0.97] transition-transform"
            >
              Return to Login
            </Button>
          </Card>
        </motion.div>
      </main>
    );
  }

  // --- RENDER STATE: EXPIRED LINK ---
  if (invitationState === 'expired') {
    return (
      <main className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_TRANSITION}
          className="w-full max-w-md"
        >
          <Card className="p-8 text-center space-y-5 shadow-xl border border-amber-500/30 rounded-2xl bg-card/95 backdrop-blur-sm">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Clock className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-lg font-bold text-foreground">
                This Invitation Has Expired
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                For security reasons, invitation links expire after 7 days. Please ask your administrator to send you a fresh invitation link.
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/login')}
              className="w-full min-h-[44px] h-11 text-xs font-semibold rounded-xl active:scale-[0.97] transition-transform"
            >
              Return to Login
            </Button>
          </Card>
        </motion.div>
      </main>
    );
  }

  // --- RENDER STATE: REVOKED OR INVALID LINK ---
  if (invitationState === 'revoked' || invitationState === 'invalid' || !invitationData) {
    const isRevoked = invitationState === 'revoked';
    return (
      <main className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_TRANSITION}
          className="w-full max-w-md"
        >
          <Card className="p-8 text-center space-y-5 shadow-xl border border-destructive/30 rounded-2xl bg-card/95 backdrop-blur-sm">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
              {isRevoked ? <ShieldAlert className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-lg font-bold text-foreground">
                {isRevoked ? 'Invitation Revoked' : 'Invalid Invitation Link'}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                {errorMessage ||
                  (isRevoked
                    ? 'This invitation was revoked by your organization administrator.'
                    : 'We could not verify this invitation. Please check the link from your email or contact support.')}
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/login')}
              className="w-full min-h-[44px] h-11 text-xs font-semibold rounded-xl active:scale-[0.97] transition-transform"
            >
              Return to Login
            </Button>
          </Card>
        </motion.div>
      </main>
    );
  }

  // --- RENDER STATE: ACCEPTANCE SUCCESS SCREEN ---
  if (isAcceptedSuccess) {
    return (
      <main className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_TRANSITION}
          className="w-full max-w-md"
        >
          <Card className="p-8 text-center space-y-5 shadow-2xl border border-emerald-500/30 rounded-2xl bg-card/95 backdrop-blur-sm">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-xl font-bold text-foreground">
                Welcome to {invitationData.organizationName}!
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Invitation accepted. We&apos;re taking you to sign in to your workspace...
              </CardDescription>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Redirecting...</span>
            </div>

            <Button
              type="button"
              onClick={() =>
                router.push(
                  `/login?email=${encodeURIComponent(invitationData.email)}&redirect=${encodeURIComponent('/dashboard')}`
                )
              }
              className="w-full min-h-[44px] h-11 text-xs font-semibold rounded-xl active:scale-[0.97] transition-transform"
            >
              Continue to Sign In <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Card>
        </motion.div>
      </main>
    );
  }

  // --- RENDER STATE: ACTIVE VALID INVITATION LANDING SCREEN ---
  const expiryFormatted = formatExpiryDate(invitationData.expiresAt);

  return (
    <main className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_TRANSITION}
        className="w-full max-w-lg"
      >
        <Card className="shadow-2xl border border-border/80 rounded-2xl overflow-hidden bg-card/95 backdrop-blur-sm">
          {/* Card Top Brand & Header */}
          <CardHeader className="p-6 sm:p-8 bg-muted/20 border-b border-border/60 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-inner">
              <Building2 className="w-6 h-6" />
            </div>

            {/* Badges Row: Organization, Department, Workspace */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Badge
                variant="secondary"
                className="px-3 py-1 font-semibold flex items-center gap-1.5 text-xs rounded-full border border-primary/20 bg-primary/10 text-primary"
              >
                <Building2 className="w-3.5 h-3.5" />
                {invitationData.organizationName || 'SmartSapp'}
              </Badge>

              {invitationData.departmentName && (
                <Badge
                  variant="outline"
                  className="px-3 py-1 font-medium flex items-center gap-1.5 text-xs rounded-full bg-background border-border text-foreground"
                >
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                  {invitationData.departmentName}
                </Badge>
              )}

              {invitationData.workspaceName && (
                <Badge
                  variant="outline"
                  className="px-3 py-1 font-medium flex items-center gap-1.5 text-xs rounded-full bg-background border-border text-muted-foreground"
                >
                  <Layers className="w-3.5 h-3.5" />
                  {invitationData.workspaceName}
                </Badge>
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                You&apos;re Invited to Join
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                Review your invitation details below and tap accept to join your team.
              </CardDescription>
            </div>
          </CardHeader>

          {/* Invitation Details Body */}
          <CardContent className="p-6 sm:p-8 space-y-5">
            {/* Invitee Identity Card */}
            <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-muted/30 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center border border-primary/20 shrink-0">
                  {invitationData.fullName
                    ? invitationData.fullName.charAt(0).toUpperCase()
                    : invitationData.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-semibold text-foreground truncate">
                    {invitationData.fullName || 'Team Member'}
                  </h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{invitationData.email}</span>
                  </p>
                </div>
              </div>

              {/* Roles Badge List */}
              {invitationData.roleNames && invitationData.roleNames.length > 0 && (
                <div className="pt-2 border-t border-border/40 flex items-center justify-between flex-wrap gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Assigned Roles:</span>
                  <div className="flex flex-wrap gap-1">
                    {invitationData.roleNames.map((roleName, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border/60"
                      >
                        {roleName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Security & Expiry footnote */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Encrypted single-use link
                </span>
                {expiryFormatted && <span>Valid until {expiryFormatted}</span>}
              </div>
            </div>

            {/* Inline Decline Accordion State */}
            <AnimatePresence>
              {showDeclineConfirm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={SPRING_TRANSITION}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">
                          Are you sure you want to decline?
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          If you decline, this invitation link will be deactivated. You can optionally share a brief reason with the team.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="decline-reason" className="text-[11px] font-medium text-foreground block">
                        Reason for declining (optional)
                      </label>
                      <Textarea
                        id="decline-reason"
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        placeholder="e.g. Received by mistake, changed roles, etc."
                        className="text-xs min-h-[70px] resize-none"
                        maxLength={500}
                        disabled={isDeclining}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleConfirmDecline}
                        disabled={isDeclining}
                        className="w-full sm:flex-1 min-h-[44px] h-11 text-xs font-semibold rounded-xl active:scale-[0.97] transition-transform"
                      >
                        {isDeclining ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Declining...
                          </>
                        ) : (
                          'Confirm & Decline'
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowDeclineConfirm(false)}
                        disabled={isDeclining}
                        className="w-full sm:w-auto min-h-[44px] h-11 text-xs font-medium rounded-xl active:scale-[0.97] transition-transform"
                      >
                        Keep Invitation
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>

          {/* Action CTAs Footer */}
          <CardFooter className="p-6 sm:p-8 border-t border-border/60 bg-muted/10 flex flex-col gap-3">
            {!showDeclineConfirm && (
              <div className="w-full flex flex-col sm:flex-row items-center gap-3">
                {/* Primary Accept Button */}
                <Button
                  type="button"
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className="w-full sm:flex-1 min-h-[44px] h-12 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Accepting Invitation...
                    </>
                  ) : (
                    <>
                      Accept Invitation
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>

                {/* Subtle Decline Outline Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeclineConfirm(true)}
                  disabled={isAccepting}
                  className="w-full sm:w-auto min-h-[44px] h-12 text-xs font-medium rounded-xl text-muted-foreground hover:text-foreground border-border hover:bg-muted/50 active:scale-[0.97] transition-transform"
                >
                  Decline
                </Button>
              </div>
            )}

            <p className="text-[11px] text-center text-muted-foreground">
              By accepting, you agree to access {invitationData.organizationName || 'the organization'}&apos;s workspace policies.
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </main>
  );
}

export default AcceptInvitationClient;
