'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User as UserIcon, Camera, Settings2, Bell } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const { accessibleWorkspaces } = useWorkspace();

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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user) {
      return;
    }
    const file = event.target.files[0];
    setIsUploading(true);

    try {
      const storage = getStorage();
      const storageRef = ref(storage, `profile-pictures/${user.uid}`);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      form.setValue('photoURL', downloadURL, { shouldDirty: true });
      toast({ title: 'Profile picture updated!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Could not upload your profile picture.' });
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

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
      window.location.reload();

    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update your profile.' });
    }
  };
  
  const photoUrl = form.watch('photoURL');
  const name = form.watch('name');
  const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={24} />;

    if (isUserLoading || isLoadingProfile) {
        return (
            <div className="h-full overflow-y-auto">
                <div className="max-w-2xl mx-auto space-y-8 pb-32">
                    <div className="flex flex-col items-start pt-8">
                        <Skeleton className="h-10 w-64 mb-2" />
                        <Skeleton className="h-6 w-48" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto w-full">
            <div className="space-y-8 pb-32 w-full max-w-3xl">
                <div className="flex flex-col items-start pt-8">
                    <h1 className="text-3xl font-bold text-foreground">
                        Account Profile
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Manage your identity and communication preferences
                    </p>
                </div>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-[2rem] overflow-hidden bg-transparent">
                    <CardHeader className="bg-muted/30 border-b pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <Settings2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-semibold tracking-tight text-foreground">Identity Settings</CardTitle>
                                <CardDescription className="text-xs font-medium">Core account and contact information.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
 <CardContent className="p-8">
                <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <FormField
                    control={form.control}
                    name="photoURL"
                    render={({ field }) => (
 <FormItem className="flex flex-col items-center">
                        <FormControl>
 <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
 <Avatar className="w-32 h-32 text-4xl ring-4 ring-primary/5">
                                <AvatarImage src={photoUrl || ''} alt={name} />
 <AvatarFallback className="bg-muted">
 {isUploading ? <Loader2 className="animate-spin" /> : getInitials(name)}
                                </AvatarFallback>
                            </Avatar>
 <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
 <Camera className="w-8 h-8 text-white" />
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
 className="hidden"
                                accept="image/png, image/jpeg, image/gif"
                            />
                            </div>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground ml-1">Secure Email Identity</FormLabel>
 <Input value={user?.email || ''} disabled className="h-11 rounded-xl bg-muted/20 border-none font-bold" />
 <FormDescription className="text-[10px] font-bold tracking-tighter opacity-60">Authentication email cannot be changed.</FormDescription>
                    </FormItem>

                    <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground ml-1">Full Legal Name</FormLabel>
                        <FormControl>
 <Input placeholder="Your full name" {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground ml-1">Mobile Contact</FormLabel>
                        <FormControl>
 <Input type="tel" placeholder="Your phone number" {...field} value={field.value ?? ''} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    <FormField
                      control={form.control}
                      name="defaultWorkspaceId"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-[10px] font-semibold text-muted-foreground ml-1">Default/Primary Workspace</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-left">
                                <SelectValue placeholder="Select primary workspace" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl border border-border shadow-xl">
                              {accessibleWorkspaces.map((ws) => (
                                <SelectItem key={ws.id} value={ws.id} className="rounded-lg text-xs font-semibold">
                                  {ws.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-[10px] font-bold tracking-tighter opacity-60">
                            This workspace will load by default when you log in or refresh your screen.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Notification Preferences */}
                    <div className="pt-6 border-t border-border/50">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <Bell className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold tracking-tight text-foreground">Notification Preferences</h3>
                            <p className="text-xs text-muted-foreground">Choose how you want to receive alerts and messages.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="notificationPreferences.email"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-muted/10">
                              <div className="space-y-0.5">
                                <FormLabel className="text-sm font-semibold">Email</FormLabel>
                                <FormDescription className="text-[10px]">Receive emails</FormDescription>
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
                            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-muted/10">
                              <div className="space-y-0.5">
                                <FormLabel className="text-sm font-semibold">SMS</FormLabel>
                                <FormDescription className="text-[10px]">Receive text messages</FormDescription>
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
                            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-muted/10">
                              <div className="space-y-0.5">
                                <FormLabel className="text-sm font-semibold">In-App</FormLabel>
                                <FormDescription className="text-[10px]">Notifications in the app</FormDescription>
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
                            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-muted/10">
                              <div className="space-y-0.5">
                                <FormLabel className="text-sm font-semibold">Push</FormLabel>
                                <FormDescription className="text-[10px]">Device push notifications</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
 <div className="flex justify-end pt-4">
 <Button type="submit" disabled={form.formState.isSubmitting || isUploading} className="rounded-xl font-bold h-11 px-10 shadow-lg">
 {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                    </div>
                </form>
                </Form>
            </CardContent>
        </Card>
     </div>
    </div>
  )
}
