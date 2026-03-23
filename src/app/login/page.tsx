'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { GoogleIcon, SmartSappIcon } from '@/components/icons';
import { ThemeToggle } from '@/components/theme-toggle';
import { Eye, EyeOff } from 'lucide-react';
import LightRays from '@/components/LightRays';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
});

type FormData = z.infer<typeof formSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = React.useState(false);
  const [loginSuccess, setLoginSuccess] = React.useState(false);
  const [redirecting, setRedirecting] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  React.useEffect(() => {
    document.title = 'Login - Onboarding Workspace';
  }, []);

  // Handle redirect after successful login and auth state update
  React.useEffect(() => {
    if (loginSuccess && !redirecting) {
      // Wait a brief moment for auth state to propagate
      setRedirecting(true);
      const timer = setTimeout(() => {
        router.push('/admin');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loginSuccess, redirecting, router]);

  const onSubmit = async (data: FormData) => {
    if (!auth || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Firebase not available',
        description: 'Please check your connection and try again.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);

      const user = userCredential.user;
      const userDocRef = doc(firestore, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists() && docSnap.data().isAuthorized === true) {
        toast({ title: 'Login Successful', description: 'Welcome back!' });
        setLoginSuccess(true);
      } else {
        await auth.signOut();
        toast({
          variant: 'destructive',
          title: 'Authorization Required',
          description: 'Your account is not authorized. Please contact an administrator.',
          duration: 5000,
        });
      }
    } catch (error: any) {
      const errorCode = error?.code;
      let errorMessage = 'An unexpected error occurred. Please try again.';

      if (
        errorCode === 'auth/invalid-credential' ||
        errorCode === 'auth/user-not-found' ||
        errorCode === 'auth/wrong-password'
      ) {
        errorMessage = 'Invalid email or password. Please try again.';
      }

      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Firebase not available',
        description: 'Please check your connection and try again.',
      });
      return;
    }

    setIsGoogleSigningIn(true);

    try {
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const user = result.user;
      const userDocRef = doc(firestore, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        if (docSnap.data().isAuthorized) {
          toast({ title: 'Login Successful', description: 'Welcome back!' });
          setLoginSuccess(true);
        } else {
          await auth.signOut();
          toast({
            variant: 'destructive',
            title: 'Authorization Required',
            description: 'Your account is not authorized. Please contact an administrator.',
            duration: 5000,
          });
        }
      } else {
        const userProfile = {
          name: user.displayName,
          email: user.email,
          phone: user.phoneNumber || '',
          isAuthorized: false,
          createdAt: new Date().toISOString(),
        };

        await setDoc(userDocRef, userProfile);
        await auth.signOut();

        toast({
          title: 'Account Created',
          description: 'Your account has been created and is now awaiting authorization.',
          duration: 5000,
        });
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      toast({
        variant: 'destructive',
        title: 'Google Sign-In Failed',
        description: error?.message || 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const isBusy = isSubmitting || isGoogleSigningIn;

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {redirecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">Redirecting to dashboard...</p>
          </div>
        </div>
      )}
      <main className="flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-left">
            <h1 className="text-4xl font-bold">Sign In</h1>
            <p className="mt-2 text-muted-foreground">
              Enter your email and password to sign in!
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isBusy}
          >
            <GoogleIcon className="mr-2 h-5 w-5" />
            {isGoogleSigningIn ? 'Signing in with Google...' : 'Sign in with Google'}
          </Button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email*</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="first.last@smartsapp.com"
                        disabled={isBusy}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password*</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
                          disabled={isBusy}
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                        disabled={isBusy}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                        <span className="sr-only">
                          {showPassword ? 'Hide password' : 'Show password'}
                        </span>
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end">
                <Link href="#" className="text-sm font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={isBusy}>
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </Button>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                Not registered yet?{' '}
                <Link href="/signup" className="font-semibold text-primary hover:underline">
                  Create an Account
                </Link>
              </div>
            </form>
          </Form>
        </div>
      </main>

      <aside className="relative hidden bg-[#0A1427] lg:block">
        <LightRays
          raysOrigin="top-center"
          raysColor="#3B5FFF"
          raysSpeed={1}
          lightSpread={0.5}
          rayLength={3}
          followMouse={true}
          mouseInfluence={0.4}
          noiseAmount={0}
          distortion={0}
          pulsating
          fadeDistance={1}
          saturation={1}
          className="!absolute inset-0 opacity-70"
        />
        <div className="relative z-10 flex h-full flex-col items-center justify-center p-8 text-center text-white">
          <div className="relative rounded-full bg-white/20 p-2 backdrop-blur-sm">
            <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse-fade"></div>
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-white">
              <SmartSappIcon className="h-20 w-20 text-primary" variant="primary" />
            </div>
          </div>
          <h2 className="mt-8 text-4xl font-bold">SmartSapp Onboarding</h2>
          <p className="mt-2 max-w-sm text-lg text-white/80">
            Automating SmartSapp Onboarding Experience
          </p>
        </div>
        <div className="absolute bottom-6 right-6 z-20">
          <ThemeToggle />
        </div>
        <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 text-xs text-white/50">
          © {new Date().getFullYear()} SmartSapp. All Rights Reserved.
        </div>
      </aside>
    </div>
  );
}