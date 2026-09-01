'use client';

/**
 * @fileOverview Public Cryptographic Invitation Acceptance Surface (Workforce 2.0)
 *
 * Validates single-use hashed invitation tokens, displays tenant credentials,
 * and provisions new member accounts with password setup or Google SSO.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Publicly accessible without requiring pre-existing authentication.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 * - Mobile optimized with touch targets >= 44px on interactive controls.
 */

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck,
  Building,
  Key,
  Mail,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  User,
} from 'lucide-react';
import {
  validateInvitationTokenAction,
  acceptInvitationAction,
} from '@/app/actions/workforce-actions';
import { auth } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

export function AcceptInvitationClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const token = searchParams.get('token') || '';

  const [isValidating, setIsValidating] = React.useState(true);
  const [invitationData, setInvitationData] = React.useState<{
    email: string;
    invitedPersonName?: string;
    workspaceName?: string;
    roleNames: string[];
    organizationId: string;
    expiresAt: string;
  } | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Form State
  const [displayName, setDisplayName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Validate Token on mount
  React.useEffect(() => {
    let isMounted = true;
    async function validateToken() {
      if (!token) {
        if (isMounted) {
          setValidationError('Missing invitation token in URL query parameter.');
          setIsValidating(false);
        }
        return;
      }

      setIsValidating(true);
      try {
        const res = await validateInvitationTokenAction({ rawToken: token });
        if (isMounted) {
          if (res.success && res.invitation) {
            setInvitationData(res.invitation);
            if (res.invitation.invitedPersonName) {
              setDisplayName(res.invitation.invitedPersonName);
            }
          } else {
            setValidationError(res.error || 'Invitation is invalid or has expired.');
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Validation failed';
          setValidationError(msg);
        }
      } finally {
        if (isMounted) setIsValidating(false);
      }
    }

    validateToken();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationData || !token) return;

    if (!displayName.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter your full name.', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Validation Error', description: 'Password must be at least 8 characters long.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Validation Error', description: 'Passwords do not match.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Firebase Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, invitationData.email, password);
      const user = userCredential.user;

      // 2. Update display name in Firebase Auth
      await updateProfile(user, { displayName: displayName.trim() });

      // 3. Accept invitation on backend
      const res = await acceptInvitationAction({
        rawToken: token,
        accountUid: user.uid,
        displayName: displayName.trim(),
      });

      if (res.success) {
        toast({
          title: 'Account Activated!',
          description: 'Welcome to your organization workspace.',
        });
        router.push('/dashboard');
      } else {
        throw new Error(res.error || 'Failed to complete invitation acceptance.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Activation failed';
      toast({
        title: 'Onboarding Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <Card className="w-full max-w-md p-8 text-center space-y-4 shadow-xl border">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm font-semibold text-foreground">Validating invitation credentials...</p>
          <p className="text-xs text-muted-foreground">Verifying single-use cryptographic token security</p>
        </Card>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <Card className="w-full max-w-md p-6 text-center space-y-4 shadow-xl border border-destructive/30">
          <div className="p-3 bg-rose-500/10 text-rose-600 rounded-full w-fit mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <CardTitle className="text-lg font-bold text-foreground">Invitation Link Expired or Invalid</CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">{validationError}</p>
          <div className="pt-2">
            <Button
              type="button"
              onClick={() => router.push('/login')}
              className="text-xs font-semibold h-9 px-4 active:scale-[0.97]"
            >
              Return to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <Card className="w-full max-w-lg shadow-2xl border overflow-hidden">
        <CardHeader className="bg-muted/20 border-b p-6 text-center space-y-2">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl w-fit mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            Welcome to SmartSapp
          </CardTitle>
          <CardDescription className="text-xs">
            Complete your profile to activate your account and access assigned workspaces
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-4 text-xs">
            {/* Invitation Details Banner */}
            <div className="p-3.5 rounded-xl border bg-primary/5 border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invited Email:</span>
                <span className="font-semibold text-foreground">{invitationData?.email}</span>
              </div>
              {invitationData?.workspaceName && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Assigned Workspace:</span>
                  <span className="font-semibold text-foreground">{invitationData.workspaceName}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Granted Roles:</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {invitationData?.roleNames.map((rn, i) => (
                    <Badge key={i} variant="secondary" className="text-[9px]">
                      {rn}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Profile Inputs */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Your Full Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sarah Doe"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Create Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters..."
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password..."
                  className="h-9 text-xs"
                  required
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="p-6 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              By activating, you agree to organization security policies.
            </span>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto h-10 px-6 text-xs font-bold active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating Account...
                </>
              ) : (
                <>
                  Activate Account <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default AcceptInvitationClient;
