'use client';

/**
 * {{Org_name}} Experience Platform — Portal Member Auth Modal
 *
 * Multi-mode authentication dialog (Sign In, Registration, Forgot Password)
 * styled dynamically with the portal's brand theme tokens.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { createMembershipAction } from '@/app/actions/membership-actions';
import type { Portal } from '@/lib/types/portal';
import { Lock, Mail, User, Key, Sparkles, Loader2, ArrowRight } from 'lucide-react';

interface PortalAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portal: Portal;
  initialMode?: 'signin' | 'signup' | 'forgot';
  onAuthenticated?: () => void;
}

export function PortalAuthModal({
  open,
  onOpenChange,
  portal,
  initialMode = 'signin',
  onAuthenticated,
}: PortalAuthModalProps) {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [mode, setMode] = React.useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    setMode(initialMode);
  }, [initialMode, open]);

  const brandName = portal.branding?.brandName || portal.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      toast({ title: 'Auth Unavailable', description: 'Authentication service is initializing.' });
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address.' });
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signin') {
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);

        // Ensure membership record exists
        await createMembershipAction({
          organizationId: portal.organizationId,
          portalId: portal.id,
          workspaceIds: portal.workspaceIds,
          userId: userCred.user.uid,
          email: userCred.user.email || email.trim(),
          displayName: userCred.user.displayName || displayName || email.split('@')[0],
          avatarUrl: userCred.user.photoURL || undefined,
        });

        toast({ title: `Welcome back! 👋`, description: `Signed in as ${userCred.user.displayName || email}.` });
        onAuthenticated?.();
        onOpenChange(false);
        router.refresh();
      } else if (mode === 'signup') {
        if (!password || password.length < 6) {
          toast({ title: 'Weak Password', description: 'Password must be at least 6 characters.' });
          setIsLoading(false);
          return;
        }

        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(userCred.user, { displayName: displayName.trim() });
        }

        // Provision initial membership
        await createMembershipAction({
          organizationId: portal.organizationId,
          portalId: portal.id,
          workspaceIds: portal.workspaceIds,
          userId: userCred.user.uid,
          email: email.trim(),
          displayName: displayName.trim() || email.split('@')[0],
        });

        toast({ title: 'Account Created! 🎉', description: `Welcome to ${brandName}.` });
        onAuthenticated?.();
        onOpenChange(false);
        router.refresh();
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email.trim());
        toast({ title: 'Reset Link Sent 📬', description: 'Check your email inbox for password reset instructions.' });
        setMode('signin');
      }
    } catch (err: any) {
      let msg = err?.message || 'Authentication failed.';
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
      } else if (err?.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please sign in.';
      }
      toast({ title: 'Authentication Error', description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 space-y-4 border-2 border-border shadow-2xl">
        <DialogHeader className="text-center space-y-2 pb-2">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: portal.theme.colors.primary }}
          >
            <Lock className="w-6 h-6" />
          </div>

          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {mode === 'signin' && `Sign in to ${brandName}`}
            {mode === 'signup' && `Join ${brandName}`}
            {mode === 'forgot' && 'Reset Your Password'}
          </DialogTitle>

          <DialogDescription className="text-xs text-muted-foreground">
            {mode === 'signin' && 'Access your enrolled courses, certifications, and learning materials.'}
            {mode === 'signup' && 'Create your member account to start your learning journey.'}
            {mode === 'forgot' && "Enter your email and we'll send you a password recovery link."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {mode === 'signup' && (
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
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-9 h-11 rounded-xl text-xs"
                required
                autoFocus
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">Password</Label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
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
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-xl font-bold text-xs text-white shadow-sm transition-transform active:scale-[0.97] gap-2 mt-2"
            style={{ backgroundColor: portal.theme.colors.primary }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'signin' ? (
              <>Sign In <ArrowRight className="w-4 h-4" /></>
            ) : mode === 'signup' ? (
              <>Create Member Account <Sparkles className="w-4 h-4" /></>
            ) : (
              'Send Password Reset Link'
            )}
          </Button>
        </form>

        {/* Switcher Footers */}
        <div className="pt-3 border-t border-border text-center text-xs text-muted-foreground space-y-1">
          {mode === 'signin' ? (
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
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
                onClick={() => setMode('signin')}
                className="font-bold text-primary hover:underline"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
