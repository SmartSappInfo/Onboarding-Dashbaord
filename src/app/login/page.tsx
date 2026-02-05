'use client';

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
  browserSessionPersistence
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
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { SmartSappLogo, GoogleIcon } from '@/components/icons';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  rememberMe: z.boolean().default(false),
});

type FormData = z.infer<typeof formSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = (data: FormData) => {
    form.control.disabled = true;
    const persistence = data.rememberMe ? browserLocalPersistence : browserSessionPersistence;
    
    setPersistence(auth, persistence)
      .then(() => {
        return signInWithEmailAndPassword(auth, data.email, data.password);
      })
      .then(async (userCredential) => {
        const user = userCredential.user;
        const userDocRef = doc(firestore, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists() && docSnap.data().isAuthorized === true) {
          toast({ title: 'Login Successful', description: 'Welcome back!' });
          router.push('/admin');
        } else {
          await auth.signOut();
          toast({
            variant: 'destructive',
            title: 'Authorization Required',
            description: 'Your account is not authorized. Please contact an administrator.',
            duration: 5000,
          });
        }
      })
      .catch((error) => {
        const errorCode = error.code;
        let errorMessage = "An unexpected error occurred. Please try again.";

        if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
            errorMessage = 'Invalid email or password. Please try again.';
        }

        toast({
          variant: 'destructive',
          title: 'Login Failed',
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
    
    const rememberMe = form.getValues('rememberMe');
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;

    setPersistence(auth, persistence)
      .then(() => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
      })
      .then(async (result) => {
        const user = result.user;
        const userDocRef = doc(firestore, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          if (docSnap.data().isAuthorized) {
            toast({ title: 'Login Successful', description: 'Welcome back!' });
            router.push('/admin');
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
          // New user signing up via Google
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
      })
      .catch((error) => {
        console.error("Google Sign-In Error:", error);
        toast({
          variant: 'destructive',
          title: 'Google Sign-In Failed',
          description: error.message || 'An unexpected error occurred. Please try again.',
        });
      });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <SmartSappLogo className="h-12" />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@smartsapp.com" {...field} />
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 pt-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Remember me
                    </FormLabel>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </Form>

           <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            <GoogleIcon className="mr-2 h-4 w-4" />
            Continue with Google
          </Button>

          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
