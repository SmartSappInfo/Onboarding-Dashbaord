'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '@/firebase';

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
import { ThemeToggle } from '@/components/theme-toggle';
import { ArrowLeft, Mail, Phone, Loader2 } from 'lucide-react';
import LightRays from '@/components/LightRays';
import { publicResetPasswordViaPhoneAction } from '@/lib/user-invite-actions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const emailSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
});

const phoneSchema = z.object({
  phone: z.string().min(10, { message: 'Please enter a valid phone number.' }),
});

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [method, setMethod] = React.useState<'email' | 'phone'>('email');

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const onEmailSubmit = async (data: z.infer<typeof emailSchema>) => {
    if (!auth) return;
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, data.email);
      toast({
        title: 'Recovery Email Sent',
        description: 'Check your inbox for password reset instructions.',
      });
      router.push('/login');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPhoneSubmit = async (data: z.infer<typeof phoneSchema>) => {
    setIsSubmitting(true);
    try {
      const result = await publicResetPasswordViaPhoneAction(data.phone);
      if (result.success) {
        toast({
          title: 'Recovery Initiated',
          description: result.message,
        });
        router.push('/login');
      } else {
        throw new Error(result.message || 'Reset failed');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <main className="flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <Link href="/login" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>

          <div className="mb-8 text-left">
            <h1 className="text-4xl font-bold tracking-tight">Recover Access</h1>
            <p className="mt-2 text-muted-foreground">
              Choose your recovery method to regain access to your account.
            </p>
          </div>

          <Tabs defaultValue="email" className="w-full" onValueChange={(v) => setMethod(v as any)}>
            <TabsList className="grid w-full grid-cols-2 mb-8 h-12 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger value="email" className="rounded-lg font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Mail className="h-4 w-4 mr-2" /> Email
              </TabsTrigger>
              <TabsTrigger value="phone" className="rounded-lg font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Phone className="h-4 w-4 mr-2" /> Phone
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-6">
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registered Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="first.last@smartsapp.com"
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
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Send Reset Link
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="phone">
              <Form {...phoneForm}>
                <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-6">
                  <FormField
                    control={phoneForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registered Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="e.g. 0244123456"
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
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Get New Password
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
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
          <div className="relative rounded-full bg-primary/20 p-2 backdrop-blur-sm">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-fade"></div>
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-card border border-white/5 shadow-2xl">
              <SmartSappIcon className="h-20 w-20 text-primary" variant="primary" />
            </div>
          </div>
          <h2 className="mt-8 text-4xl font-bold">Security Center</h2>
          <p className="mt-2 max-w-sm text-lg text-white/80">
            Securely manage and regain access to your account with our advanced authentication tools.
          </p>
        </div>
        <div className="absolute bottom-6 right-6 z-20">
          <ThemeToggle />
        </div>
      </aside>
    </div>
  );
}
