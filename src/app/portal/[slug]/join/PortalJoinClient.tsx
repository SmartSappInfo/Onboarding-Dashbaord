'use client';

/**
 * {{Org_name}} Experience Platform — Invitation Join & Onboarding Shell
 *
 * Dedicated onboarding client route resolving cryptographic invitation tokens,
 * displaying provisioned roles and tiers, and onboarding the new member.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  verifyInvitationTokenAction,
  acceptInvitationAction,
} from '@/app/actions/membership-actions';
import type { Portal } from '@/lib/types/portal';
import type { PortalInvitation } from '@/lib/types/membership';
import {
  Sparkles,
  ShieldCheck,
  Check,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  User,
  Key,
} from 'lucide-react';

interface PortalJoinClientProps {
  slug: string;
}

export default function PortalJoinClient({ slug }: PortalJoinClientProps) {
  const firestore = useFirestore();
  const auth = useAuth();
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

  // 2. State
  const [invitation, setInvitation] = React.useState<PortalInvitation | null>(null);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(true);

  // Form State
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isExistingUser, setIsExistingUser] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Verify token
  React.useEffect(() => {
    if (!portal || !token) {
      if (!token) setVerifyError('No invitation token was provided in the link.');
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

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !portal || !invitation) return;

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

      // Accept Invitation
      const res = await acceptInvitationAction(portal.id, token, uid, {
        email: email.trim(),
        displayName: displayName.trim() || email.split('@')[0],
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to accept invitation.');
      }

      toast({ title: 'Welcome to the Portal! 🎉', description: 'Your membership is now active.' });
      router.push(`/portal/${slug}/dashboard`);
    } catch (err: any) {
      toast({ title: 'Registration Failed', description: err?.message || 'Could not complete registration.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingPortal || isVerifying) {
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

  if (!portal || verifyError || !invitation) {
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
          <Link href={`/portal/${slug}`}>
            <Button variant="outline" className="rounded-xl font-bold text-xs mt-2">
              Return to Portal Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const theme = portal.theme;
  const brandTitle = portal.branding?.brandName || portal.name;

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
              style={{ backgroundColor: theme.colors.primary }}
            >
              {brandTitle.charAt(0)}
            </div>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Join {brandTitle}
          </h1>
          <p className="text-xs text-muted-foreground">
            You have been officially invited to join as a{' '}
            <strong className="text-foreground capitalize">{invitation.role}</strong>.
          </p>
        </div>

        {/* Invitation Perks Card */}
        <Card className="rounded-3xl border-2 border-primary/20 bg-primary/5 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Provisioned Membership Perks
          </div>

          <ul className="space-y-2 text-xs text-foreground">
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Full portal access as a <strong className="capitalize">{invitation.role}</strong></span>
            </li>
            {invitation.note && (
              <li className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Cohort Note: {invitation.note}</span>
              </li>
            )}
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Personal progress tracking and certificate issuance</span>
            </li>
          </ul>
        </Card>

        {/* Registration Form */}
        <Card className="rounded-3xl border-2 border-border p-6 sm:p-8 space-y-4 shadow-xl">
          <CardHeader className="p-0 pb-3 border-b border-border">
            <CardTitle className="text-lg font-bold">
              {isExistingUser ? 'Sign In to Claim Invite' : 'Create Your Account'}
            </CardTitle>
            <CardDescription className="text-xs">
              {isExistingUser
                ? 'Enter your existing password to link this invitation to your account.'
                : 'Choose your password to finalize your member enrollment.'}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleJoin} className="space-y-4 pt-1">
            {!isExistingUser && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                  disabled={Boolean(invitation.email)}
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
              style={{ backgroundColor: theme.colors.primary }}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Accept Invitation & Enter <ArrowRight className="w-4 h-4" /></>
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
      </div>

      <footer className="text-center text-xs text-muted-foreground pt-12">
        <p>© {new Date().getFullYear()} {brandTitle}. Powered by Experience Platform.</p>
      </footer>
    </div>
  );
}
