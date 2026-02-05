'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
import Image from 'next/image';

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  confirmPassword: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

export default function SignupPage() {
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  React.useEffect(() => {
    document.title = 'Sign Up - Onboarding Workspace';
  }, []);

  const onSubmit = (data: FormData) => {
    form.control.disabled = true;
    createUserWithEmailAndPassword(auth, data.email, data.password)
      .then(async (userCredential) => {
        const user = userCredential.user;
        
        const userProfile = {
          name: data.name,
          email: data.email,
          phone: '',
          isAuthorized: false,
          createdAt: new Date().toISOString(),
        };

        const userDocRef = doc(firestore, 'users', user.uid);
        
        await setDoc(userDocRef, userProfile);
        await auth.signOut();

        toast({
          title: 'Account Created',
          description: 'Your account has been created and is now awaiting authorization.',
          duration: 5000,
        });
        router.push('/login');

      })
      .catch((error) => {
        const errorCode = error.code;
        let errorMessage = "An unexpected error occurred during sign up.";

        if (errorCode === 'auth/email-already-in-use') {
            errorMessage = 'This email address is already in use.';
        } else if (errorCode === 'auth/weak-password') {
            errorMessage = 'The password is too weak.';
        }

        toast({
          variant: 'destructive',
          title: 'Sign-up Failed',
          description: errorMessage,
        });
      }).finally(() => {
         form.control.disabled = false;
      });
  };

  const handleGoogleSignIn = () => {
    if (!auth || !firestore) {
      toast({
        variant: "destructive",
        title: "Firebase not available",
        description: "Please check your connection and try again.",
      });
      return;
    }

    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then(async (result) => {
        const user = result.user;
        const userDocRef = doc(firestore, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          await auth.signOut();
          toast({
            title: 'Account Exists',
            description: 'An account with this Google profile already exists. Please log in.',
          });
          router.push('/login');
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
          router.push('/login');
        }
      })
      .catch((error) => {
        console.error("Google Sign-Up Error:", error);
        toast({
          variant: 'destructive',
          title: 'Google Sign-Up Failed',
          description: error.message || 'An unexpected error occurred. Please try again.',
        });
      });
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <main className="flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
           <div className="mb-10 text-left">
            <h1 className="text-4xl font-bold">Create Account</h1>
            <p className="mt-2 text-muted-foreground">
              Enter your details to create an account
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            <GoogleIcon className="mr-2 h-5 w-5" />
            Sign up with Google
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email*</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@example.com" {...field} />
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
                    <FormControl>
                      <Input type="password" placeholder="Min. 8 characters" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password*</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Min. 8 characters" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
              </Button>
               <div className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Log In
                </Link>
              </div>
            </form>
          </Form>
        </div>
      </main>
      <aside className="relative hidden bg-primary lg:block rounded-bl-2xl">
         <Image
            src="https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1280&q=80"
            alt="Abstract background gradient"
            fill
            className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/70 via-primary to-blue-700/80 opacity-90" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center text-primary-foreground p-8">
            <div className="relative bg-white/20 rounded-full p-2 backdrop-blur-sm">
                <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse-fade"></div>
                <div className="relative bg-white rounded-full h-32 w-32 flex items-center justify-center">
                    <SmartSappIcon className="h-20 w-20 text-primary" />
                </div>
            </div>
            <h2 className="mt-8 text-4xl font-bold">SmartSapp Onboarding</h2>
            <p className="mt-2 max-w-sm text-lg text-primary-foreground/80">
              Automating SmartSapp Onboarding Experience
            </p>
        </div>
        <div className="absolute bottom-6 right-6 z-20">
          <ThemeToggle />
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 text-xs text-primary-foreground/50">
            © {new Date().getFullYear()} SmartSapp. All Rights Reserved.
        </div>
      </aside>
    </div>
  );
}
