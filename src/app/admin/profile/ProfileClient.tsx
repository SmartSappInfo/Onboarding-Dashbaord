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
import { Loader2, User as UserIcon, Camera, Settings2 } from 'lucide-react';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const profileFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  phone: z.string().optional(),
  photoURL: z.string().url().optional().or(z.literal('')),
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

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: '', phone: '', photoURL: '' },
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
 <div className="">
 <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>Account Profile</CardTitle>
                    <CardDescription>Update your personal information.</CardDescription>
                </CardHeader>
 <CardContent className="space-y-8">
 <div className="flex justify-center">
 <Skeleton className="w-32 h-32 rounded-full" />
                    </div>
 <Skeleton className="h-10 w-full" />
 <Skeleton className="h-10 w-full" />
 <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
 <div className="h-full overflow-y-auto  bg-background">
 <div className="max-w-2xl mx-auto space-y-8">
 <Card className="border-none shadow-sm ring-1 ring-border rounded-[2rem] overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <Settings2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
 <CardTitle className="text-lg font-semibold tracking-tight">Identity Settings</CardTitle>
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
