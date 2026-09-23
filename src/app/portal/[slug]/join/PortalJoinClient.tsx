'use client';

/**
 * {{Org_name}} Experience Platform — Invitation Join & Onboarding Shell
 *
 * Dedicated onboarding client route resolving cryptographic invitation tokens,
 * smart authenticated user detection (1-click onboarding), and fallback manual registration.
 *
 * Architecture Notes:
 * - Smart logged-in detection: Automatically detects existing SmartSapp admin / team member session.
 * - 1-Click join: Prompts user to proceed with existing data without re-entering password or email.
 * - Zero any / any[].
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, doc, query, where, limit } from 'firebase/firestore';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useAuth, useUser } from '@/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  verifyInvitationTokenAction,
  acceptInvitationAction,
  joinPortalDirectAction,
} from '@/app/actions/membership-actions';
import type { Portal } from '@/lib/types/portal';
import type { PortalInvitation, PortalMembership } from '@/lib/types/membership';
import type { UserProfile } from '@/lib/types';
import { getErrorMessage } from '@/lib/errors/report-error';
import {
  Sparkles,
  ShieldCheck,
  Check,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Mail,
  User as UserIcon,
  Key,
  LogOut,
  CheckCircle2,
} from 'lucide-react';

interface PortalJoinClientProps {
  slug: string;
}

export default function PortalJoinClient({ slug }: PortalJoinClientProps) {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const token = searchParams.get('token') || '';

  // 1. Query Portal
  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(collection(firestore, 'portals'), where('slug', '==', slug), limit(1))
        : null,
    [firestore, slug]
  );
  const { data: portals, isLoading: isLoadingPortal } = useCollection<Portal>(portalQuery);
  const portal = portals?.[0] ?? null;

  // 2. Query Logged-in User Profile
  const userDocRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user?.uid]
  );
  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userDocRef);

  // 3. Query Membership for Current Logged-in User in This Portal
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
  const { data: existingMemberships, isLoading: isLoadingMembership } =
    useCollection<PortalMembership>(membershipQuery);
  const existingMembership = existingMemberships?.[0] ?? null;

  // 4. Token Invitation State
  const [invitation, setInvitation] = React.useState<PortalInvitation | null>(null);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(true);

  // Manual Form State
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isExistingUser, setIsExistingUser] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Verify invitation token if provided
  React.useEffect(() => {
    if (!portal) return;

    if (!token) {
      setIsVerifying(false);
      return;
    }

    let isMounted = true;
    (async () => {
      setIsVerifying(true);
      const res = await verifyInvitationTokenAction(portal.id, token);
      if (isMounted) {
        if (res.success && res.data) {
          setInvitation(res.data);
          if (res.data.email) setEmail(res.data.email);
        } else {
          setVerifyError(res.error || 'Invitation is invalid or has expired.');
        }
        setIsVerifying(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [portal, token]);

  // Handle 1-Click Join for Already Authenticated User
  const handleJoinWithExistingAccount = async () => {
    if (!portal || !user || !user.email) return;

    setIsSubmitting(true);
    try {
      const resolvedDisplayName =
        userProfile?.displayName ||
        userProfile?.name ||
        user.displayName ||
        user.email.split('@')[0];

      if (token && invitation) {
        // Accept invitation with existing authenticated account
        const inviteRes = await acceptInvitationAction(portal.id, token, user.uid, {
          email: user.email,
          displayName: resolvedDisplayName,
          avatarUrl: user.photoURL || undefined,
        });

        if (!inviteRes.success) {
          throw new Error(inviteRes.error || 'Failed to accept invitation.');
        }
      } else {
        // Direct 1-Click Join
        const userIsAdmin = userProfile?.role === 'admin' || userProfile?.roles?.includes('admin');
        const defaultRole = portal.accessPolicy?.defaultMemberRole || 'member';
        const joinRes = await joinPortalDirectAction(portal.id, user.uid, {
          email: user.email,
          displayName: resolvedDisplayName,
          avatarUrl: user.photoURL || undefined,
          role: userIsAdmin ? 'admin' : defaultRole,
          joinedVia: 'smart_onboarding',
        });

        if (!joinRes.success) {
          throw new Error(joinRes.error || 'Failed to join portal.');
        }
      }

      toast({
        title: 'Welcome to the Portal! 🎉',
        description: `Your membership for ${portal.name} is now active.`,
      });
      router.push(`/portal/${slug}/dashboard`);
    } catch (err: unknown) {
      toast({
        title: 'Join Failed',
        description: getErrorMessage(err) || 'Could not complete 1-click registration.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Manual Form Registration / Sign-in
  const handleManualJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !portal) return;

    if (!email.trim() || !password) {
      toast({ title: 'Fields Required', description: 'Please complete all form fields.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let uid = '';
      if (isExistingUser) {
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        uid = userCred.user.uid;
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        uid = userCred.user.uid;
        if (displayName.trim()) {
          await updateProfile(userCred.user, { displayName: displayName.trim() });
        }
      }

      if (token && invitation) {
        // Accept Invitation
        const res = await acceptInvitationAction(portal.id, token, uid, {
          email: email.trim(),
          displayName: displayName.trim() || email.split('@')[0],
        });

        if (!res.success) {
          throw new Error(res.error || 'Failed to accept invitation.');
        }
      } else {
        // Direct Self-Registration Join
        const defaultRole = portal.accessPolicy?.defaultMemberRole || 'member';
        const res = await joinPortalDirectAction(portal.id, uid, {
          email: email.trim(),
          displayName: displayName.trim() || email.split('@')[0],
          role: defaultRole,
          joinedVia: 'direct_join',
        });

        if (!res.success) {
          throw new Error(res.error || 'Failed to join portal.');
        }
      }

      toast({ title: 'Welcome to the Portal! 🎉', description: 'Your membership is now active.' });
      router.push(`/portal/${slug}/dashboard`);
    } catch (err: unknown) {
      toast({
        title: 'Registration Failed',
        description: getErrorMessage(err) || 'Could not complete registration.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      toast({ title: 'Signed Out', description: 'You can now sign in with another account.' });
    }
  };

  // Loading state
  if (isLoadingPortal || isVerifying || isUserLoading || (user && (isLoadingProfile || isLoadingMembership))) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4">
          <Skeleton className="h-12 w-12 rounded-2xl mx-auto" />
          <Skeleton className="h-6 w-3/4 mx-auto" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      </div>
    );
  }

  // Not found or invalid invitation state
  if (!portal || (token && (verifyError || !invitation))) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full rounded-3xl border-2 border-border p-8 space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <CardTitle className="text-xl font-bold">Invitation Unavailable</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            {verifyError || 'This invitation link could not be validated. It may have expired or been revoked.'}
          </CardDescription>
          <Button asChild variant="outline" className="rounded-xl font-bold text-xs mt-2 active:scale-[0.97]">
            <Link href={`/portal/${slug}`}>
              Return to Portal Home
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const theme = portal.theme;
  const brandTitle = portal.branding?.brandName || portal.name;
  const primaryColor = theme.colors.primary || '#3B82F6';

  const resolvedUserName =
    userProfile?.displayName ||
    userProfile?.name ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Member';
  const firstName = resolvedUserName.split(' ')[0] || resolvedUserName;
  const userIsAdmin = userProfile?.role === 'admin' || userProfile?.roles?.includes('admin');

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-6 sm:p-12">
      <div className="max-w-lg mx-auto w-full space-y-6 pt-6">
        {/* Portal Branding */}
        <div className="text-center space-y-2">
          {portal.branding?.logoUrl ? (
            <img src={portal.branding.logoUrl} alt={brandTitle} className="h-10 mx-auto object-contain" />
          ) : (
            <div
              className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white font-bold text-lg shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {brandTitle.charAt(0)}
            </div>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Join {brandTitle}
          </h1>
          <p className="text-xs text-muted-foreground">
            {invitation ? (
              <>
                You have been officially invited to join as a{' '}
                <strong className="text-foreground capitalize">{invitation.role}</strong>.
              </>
            ) : (
              'Access courses, curated resources, and member spaces.'
            )}
          </p>
        </div>

        {/* ── CASE 1: Logged-in & Already an Active Member ─────────────── */}
        {user && existingMembership && existingMembership.status === 'active' ? (
          <Card className="rounded-3xl border-2 border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8 space-y-6 shadow-xl text-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <Avatar className="w-16 h-16 border-2 border-emerald-500/40 shadow-sm">
                  {user.photoURL && <AvatarImage src={user.photoURL} alt={resolvedUserName} />}
                  <AvatarFallback className="bg-emerald-500/10 text-emerald-600 font-bold text-lg">
                    {resolvedUserName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <Check className="w-3 h-3" />
                </div>
              </div>

              <div>
                <Badge className="bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider mb-1">
                  Active {existingMembership.role}
                </Badge>
                <h2 className="text-lg font-extrabold text-foreground">You are already a member!</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Signed in as <strong>{resolvedUserName}</strong> ({user.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Your account has full active access to {brandTitle}. You can immediately jump into your courses,
              discussions, and toolkits.
            </p>

            <div className="space-y-2 pt-2">
              <Button
                asChild
                className="w-full h-11 rounded-xl font-bold text-xs text-white shadow-sm transition-transform active:scale-[0.97] gap-2"
                style={{ backgroundColor: primaryColor }}
              >
                <Link href={`/portal/${slug}/dashboard`}>
                  Enter Member Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>

              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs text-muted-foreground hover:text-foreground pt-2 flex items-center justify-center gap-1 mx-auto transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign in with a different account
              </button>
            </div>
          </Card>
        ) : user && !existingMembership ? (
          /* ── CASE 2: Logged-in & NOT yet a Member (Smart 1-Click Onboarding) ── */
          <Card className="rounded-3xl border-2 border-primary/30 bg-card p-6 sm:p-8 space-y-6 shadow-xl">
            {/* Header: Detected Session */}
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center gap-3.5">
              <Avatar className="w-12 h-12 border border-primary/30 shrink-0">
                {user.photoURL && <AvatarImage src={user.photoURL} alt={resolvedUserName} />}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {resolvedUserName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground truncate">{resolvedUserName}</span>
                  <Badge variant="outline" className="text-[10px] font-bold border-primary/40 text-primary shrink-0">
                    {userIsAdmin ? 'SmartSapp Admin' : 'Signed In'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>

            {/* Prompt Description */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <Sparkles className="w-4 h-4" /> Existing Account Detected
              </div>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                Join {brandTitle} using your existing profile?
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We detected that you&apos;re already signed in to SmartSapp as{' '}
                <strong className="text-foreground">{resolvedUserName}</strong> ({user.email}).
                You can proceed and create your portal account instantly using your current credentials.
              </p>
            </div>

            {/* Benefits Checklist */}
            <ul className="space-y-2.5 p-4 rounded-2xl bg-muted/20 border border-border text-xs text-foreground">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Zero hassle:</strong> No new password or email verification needed.
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Unified identity:</strong> Connected directly to your SmartSapp profile.
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Full access:</strong> Courses, curriculum, certificates, and AI learning tutor.
                </span>
              </li>
            </ul>

            {/* 1-Click Action Buttons or Policy Restriction */}
            <div className="space-y-3 pt-1">
              {portal.accessPolicy?.allowInstantTeamJoin === false && !token ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs space-y-1.5 text-center">
                  <p className="font-bold flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Instant Enrollment Restricted
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Instant 1-click onboarding is restricted by the portal administrator. Please request an invitation link to join.
                  </p>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={handleJoinWithExistingAccount}
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-xl font-bold text-xs text-white shadow-sm transition-transform active:scale-[0.97] gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Yes, Continue as {firstName} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1 flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Want to use a different account? Switch here
              </button>
            </div>
          </Card>
        ) : (
          /* ── CASE 3: Anonymous User (Standard Registration / Sign-in Form) ── */
          <>
            {/* Membership Perks Card */}
            <Card className="rounded-3xl border-2 border-primary/20 bg-primary/5 p-6 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" /> {invitation ? 'Provisioned Membership Perks' : 'Member Benefits'}
              </div>

              <ul className="space-y-2 text-xs text-foreground">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>
                    {invitation ? (
                      <>
                        Full portal access as a <strong className="capitalize">{invitation.role}</strong>
                      </>
                    ) : (
                      'Full access to curriculum modules, knowledge guides, and downloads'
                    )}
                  </span>
                </li>
                {invitation?.note && (
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Cohort Note: {invitation.note}</span>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Personal progress tracking and verifiable achievement credentials</span>
                </li>
              </ul>
            </Card>

            {/* Registration Form */}
            <Card className="rounded-3xl border-2 border-border p-6 sm:p-8 space-y-4 shadow-xl">
              <CardHeader className="p-0 pb-3 border-b border-border">
                <CardTitle className="text-lg font-bold">
                  {isExistingUser
                    ? 'Sign In to Your Account'
                    : invitation
                    ? 'Claim Your Invitation'
                    : 'Create Your Account'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isExistingUser
                    ? 'Enter your credentials to access your member dashboard.'
                    : 'Complete the details below to finalize your portal enrollment.'}
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleManualJoin} className="space-y-4 pt-1">
                {!isExistingUser && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Full Name</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="e.g. John Doe"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="pl-9 h-11 rounded-xl text-xs"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={Boolean(invitation?.email)}
                      className="pl-9 h-11 rounded-xl text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Password</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pl-9 h-11 rounded-xl text-xs"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-xl font-bold text-xs text-white shadow-sm transition-transform active:scale-[0.97] gap-2 mt-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {isExistingUser
                        ? 'Sign In & Enter'
                        : invitation
                        ? 'Accept Invitation & Enter'
                        : 'Create Account & Enter'}{' '}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="pt-3 border-t border-border text-center text-xs text-muted-foreground">
                {isExistingUser ? (
                  <p>
                    Need to create a new account?{' '}
                    <button
                      type="button"
                      onClick={() => setIsExistingUser(false)}
                      className="font-bold text-primary hover:underline"
                    >
                      Sign Up
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setIsExistingUser(true)}
                      className="font-bold text-primary hover:underline"
                    >
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            </Card>
          </>
        )}
      </div>

      <footer className="text-center text-xs text-muted-foreground pt-12">
        <p>© {new Date().getFullYear()} {brandTitle}. Powered by Experience Platform.</p>
      </footer>
    </div>
  );
}
