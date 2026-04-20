'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
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
import { SmartSappIcon } from '@/components/icons';
import { Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import LightRays from '@/components/LightRays';

const schema = z.object({
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ForcePasswordResetPage() {
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    if (!auth?.currentUser || !firestore) {
      toast({ variant: 'destructive', title: 'Session Expired', description: 'Please log in again.' });
      router.push('/login');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update Firebase Auth Password
      await updatePassword(auth.currentUser, data.password);

      // 2. Update Firestore Flag
      const userRef = doc(firestore, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
          requiresPasswordReset: false,
          updatedAt: new Date().toISOString()
      });

      toast({ title: 'Security Updated', description: 'Your new password has been saved successfully.' });
      router.push('/admin');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <main className="flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-left">
            <h1 className="text-4xl font-bold tracking-tight">Set New Password</h1>
            <p className="mt-2 text-muted-foreground">
              For your security, you must set a permanent password before proceeding to the dashboard.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
                          disabled={isSubmitting}
                          className="h-12 rounded-xl"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                        disabled={isSubmitting}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Re-enter password"
                        disabled={isSubmitting}
                        className="h-12 rounded-xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Secure Account
              </Button>
            </form>
          </Form>
        </div>
      </main>

      <aside className="relative hidden bg-[#0A1427] lg:block">
        <LightRays
          raysOrigin="top-center"
          raysColor="#10b981"
          raysSpeed={1.5}
          lightSpread={0.6}
          rayLength={3}
          fadeDistance={1}
          pulsating
          className="!absolute inset-0 opacity-70"
        />
        <div className="relative z-10 flex h-full flex-col items-center justify-center p-8 text-center text-white">
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl backdrop-blur-xl shadow-2xl">
            <SmartSappIcon className="h-24 w-24 text-emerald-500" variant="primary" />
          </div>
          <h2 className="mt-8 text-4xl font-bold">Privacy First</h2>
          <p className="mt-2 max-w-sm text-lg text-white/80">
            We encrypt all credentials using industry-grade security protocols. Your safety is our priority.
          </p>
        </div>
      </aside>
    </div>
  );
}
