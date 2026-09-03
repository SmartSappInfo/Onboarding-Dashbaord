'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Settings2, Bell, CheckCircle2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUploader } from '@/components/shared/image-uploader';

const profileFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  phone: z.string().optional(),
  photoURL: z.string().url().optional().or(z.literal('')),
  defaultWorkspaceId: z.string().optional(),
  notificationPreferences: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(true),
    inApp: z.boolean().default(true),
    push: z.boolean().default(true),
  }).optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function ProfileClient() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const { accessibleWorkspaces, activeWorkspaceId } = useWorkspace();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { 
      name: '', 
      phone: '', 
      photoURL: '',
      defaultWorkspaceId: '',
      notificationPreferences: {
        email: true,
        sms: true,
        inApp: true,
        push: true,
      }
    },
  });

  React.useEffect(() => {
    if (user && firestore) {
      const userDoc = doc(firestore, 'users', user.uid);
      getDoc(userDoc).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          form.reset({
            name: data.name || user.displayName || '',
            phone: data.phone || '',
            photoURL: user.photoURL || data.photoURL || '',
            defaultWorkspaceId: data.defaultWorkspaceId || '',
            notificationPreferences: data.notificationPreferences || {
              email: true,
              sms: true,
              inApp: true,
              push: true,
            },
          });
        }
        setIsLoadingProfile(false);
      });
    } else if (!isUserLoading) {
      setIsLoadingProfile(false);
    }
  }, [user, firestore, form, isUserLoading]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user || !firestore || !auth.currentUser) return;
    
    try {
      await updateProfile(auth.currentUser, {
        displayName: data.name,
        photoURL: data.photoURL,
      });

      const docRef = doc(firestore, 'users', user.uid);
      await updateDoc(docRef, {
        name: data.name,
        phone: data.phone,
        photoURL: data.photoURL,
        defaultWorkspaceId: data.defaultWorkspaceId || '',
        notificationPreferences: data.notificationPreferences,
      });

      toast({ title: 'Profile Updated', description: 'Your changes have been saved.' });
      router.refresh();

    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update your profile.' });
    }
  };

  if (isUserLoading || isLoadingProfile) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-72 rounded-lg" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <Skeleton className="h-28 w-28 rounded-2xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 md:p-8 space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Account Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal identity, contact details, and communication preferences.
        </p>
      </div>

      <Card className="bg-card text-card-foreground border border-border shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="bg-card border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-muted text-foreground rounded-xl border border-border">
              <Settings2 className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">Identity Settings</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Core account details and workspace association.</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 md:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="photoURL"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel className="text-xs font-semibold text-foreground">Avatar Image</FormLabel>
                    <FormControl>
                      <ImageUploader
                        value={field.value || ''}
                        onChange={(url) => {
                          field.onChange(url);
                        }}
                        workspaceId={activeWorkspaceId}
                        category="Avatars"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs font-semibold text-foreground">Secure Email Identity</FormLabel>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="h-10 rounded-xl bg-muted/50 border border-border text-muted-foreground text-sm font-medium cursor-not-allowed"
                />
                <FormDescription className="text-xs text-muted-foreground">
                  Authentication email is tied to your login provider and cannot be changed here.
                </FormDescription>
              </FormItem>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground">Full Legal Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your full name"
                        {...field}
                        className="h-10 rounded-xl bg-background border border-border text-foreground text-sm font-medium focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground">Mobile Contact</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="Your phone number"
                        {...field}
                        value={field.value ?? ''}
                        className="h-10 rounded-xl bg-background border border-border text-foreground text-sm font-medium focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="defaultWorkspaceId"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground">Default / Primary Workspace</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-xl bg-background border border-border text-foreground text-sm font-medium px-3 focus:ring-1 focus:ring-ring">
                          <SelectValue placeholder="Select primary workspace" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl border border-border shadow-xl">
                        {accessibleWorkspaces.map((ws) => (
                          <SelectItem key={ws.id} value={ws.id} className="rounded-lg text-xs font-medium">
                            {ws.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs text-muted-foreground">
                      This workspace will load automatically when you log in or refresh your session.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notification Preferences */}
              <div className="pt-6 border-t border-border space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-muted text-foreground rounded-xl border border-border">
                    <Bell className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">Notification Preferences</h3>
                    <p className="text-xs text-muted-foreground">Configure how and where you receive automated platform alerts.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <FormField
                    control={form.control}
                    name="notificationPreferences.email"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-card hover:bg-muted/20 transition-colors shadow-2xs">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium text-foreground cursor-pointer">Email</FormLabel>
                          <FormDescription className="text-xs text-muted-foreground">Receive digest & security notices</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notificationPreferences.sms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-card hover:bg-muted/20 transition-colors shadow-2xs">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium text-foreground cursor-pointer">SMS</FormLabel>
                          <FormDescription className="text-xs text-muted-foreground">Urgent text message alerts</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notificationPreferences.inApp"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-card hover:bg-muted/20 transition-colors shadow-2xs">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium text-foreground cursor-pointer">In-App</FormLabel>
                          <FormDescription className="text-xs text-muted-foreground">Workspace bell notification feed</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notificationPreferences.push"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-card hover:bg-muted/20 transition-colors shadow-2xs">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium text-foreground cursor-pointer">Device Push</FormLabel>
                          <FormDescription className="text-xs text-muted-foreground">Direct desktop & mobile notifications</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-border">
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="h-10 px-6 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-xs active:scale-[0.97] transition-all"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
