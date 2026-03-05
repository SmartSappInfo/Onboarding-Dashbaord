'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Loader2, Building, MapPin, User, Plus, UserCheck, ShieldCheck } from 'lucide-react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { doc, updateDoc, collection, query, orderBy } from 'firebase/firestore';

import type { School, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser, useCollection } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleSelect } from '../../components/ModuleSelect';
import { ZoneSelect } from '../../components/ZoneSelect';
import { FocalPersonManager } from '../../components/FocalPersonManager';
import { logActivity } from '@/lib/activity-logger';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';

const schoolEditSchema = z.object({
  name: z.string().min(2, { message: 'School name must be at least 2 characters.' }),
  initials: z.string().optional(),
  slogan: z.string().optional(),
  status: z.enum(['Active', 'Inactive', 'Archived']),
  logoUrl: z.string().url().optional().or(z.literal('')),
  heroImageUrl: z.string().url().optional().or(z.literal('')),
  zone: z.object({
    id: z.string().min(1, 'Please select a zone.'),
    name: z.string(),
  }, { required_error: 'Please assign a geographic zone.' }),
  location: z.string().optional(),
  nominalRoll: z.coerce.number().optional(),
  focalPersons: z.array(z.object({
    name: z.string().min(2, 'Name required.'),
    email: z.string().email('Invalid email.'),
    phone: z.string().min(10, 'Invalid phone.'),
    type: z.enum(['Champion', 'Accountant', 'Administrator', 'Principal', 'School Owner']),
  })).min(1, 'At least one focal person is required.'),
  modules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    abbreviation: z.string(),
    color: z.string(),
  })).optional(),
  implementationDate: z.date().optional().nullable(),
  referee: z.string().optional(),
  includeDroneFootage: z.boolean().default(false),
  assignedToId: z.string().min(1, 'Please select an account manager.'),
});

type SchoolEditValues = z.infer<typeof schoolEditSchema>;

interface EditFormProps {
  schoolId: string;
}

function EditSchoolForm({ schoolId }: EditFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const { user } = useUser();

  const schoolDocRef = useMemoFirebase(() => {
    if (!firestore || !schoolId) return null;
    return doc(firestore, 'schools', schoolId);
  }, [firestore, schoolId]);

  const { data: school, isLoading: isSchoolLoading } = useDoc<School>(schoolDocRef);

  // Phase 2: Navigation Entity Resolution
  useSetBreadcrumb(school?.name, pathname.replace('/edit', ''));

  // Fetch all authorized users to ensure the selection list is comprehensive
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: users, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const methods = useForm<SchoolEditValues>({
    resolver: zodResolver(schoolEditSchema),
    defaultValues: {
      name: '', initials: '', slogan: '', status: 'Active',
      location: '', nominalRoll: 0, focalPersons: [], modules: [],
      referee: '', includeDroneFootage: false, assignedToId: '',
    }
  });

  React.useEffect(() => {
    if (school && !methods.formState.isDirty) {
      methods.reset({
        name: school.name || '',
        initials: school.initials || '',
        slogan: school.slogan || '',
        status: school.status || 'Active',
        logoUrl: school.logoUrl || '',
        heroImageUrl: school.heroImageUrl || '',
        zone: school.zone || undefined,
        location: school.location || '',
        nominalRoll: school.nominalRoll || 0,
        focalPersons: (school.focalPersons as any) || [],
        modules: school.modules || [],
        implementationDate: school.implementationDate ? new Date(school.implementationDate) : null,
        referee: school.referee || '',
        includeDroneFootage: school.includeDroneFootage || false,
        assignedToId: school.assignedTo?.userId || 'unassigned',
      });
    }
  }, [school, methods]);

  const handleFormSubmit = (data: SchoolEditValues) => {
    if (!firestore || !user || !users) return;

    const selectedManager = users.find(u => u.id === data.assignedToId);
    const assignedTo = selectedManager 
        ? { userId: selectedManager.id, name: selectedManager.name, email: selectedManager.email }
        : { userId: null, name: 'Unassigned', email: null };

    const { assignedToId, ...rest } = data;
    const updateData = { 
        ...rest, 
        assignedTo, 
        implementationDate: data.implementationDate?.toISOString() || null 
    };

    const docRef = doc(firestore, 'schools', schoolId);
    updateDoc(docRef, updateData).then(() => {
        toast({ title: 'Profile Updated', description: `Changes to ${data.name} saved successfully.` });
        logActivity({ 
            schoolId, 
            userId: user.uid, 
            type: 'school_updated', 
            source: 'user_action', 
            description: `updated school profile for "${data.name}"` 
        });
        router.push('/admin/schools');
    }).catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
            path: docRef.path, 
            operation: 'update', 
            requestResourceData: updateData 
        }));
    });
  };

  const isGlobalLoading = isSchoolLoading || isUsersLoading;

  if (isGlobalLoading) {
    return (
        <div className="space-y-8">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleFormSubmit)} className="space-y-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Identity Card */}
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Building className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Identity & Status</CardTitle>
                        <CardDescription className="text-xs font-medium">Core institutional metadata.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField 
                    control={methods.control} 
                    name="name" 
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Official School Name</FormLabel>
                            <FormControl>
                                <Input {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} 
                  />
                  <FormField 
                    control={methods.control} 
                    name="status" 
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                    <SelectItem value="Archived">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} 
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                    <FormField control={methods.control} name="initials" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Initials</FormLabel>
                            <FormControl>
                                <Input {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black text-center" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={methods.control} name="slogan" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Motto</FormLabel>
                            <FormControl>
                                <Input {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 italic font-medium" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
              </CardContent>
            </Card>
            
            {/* Account Assignment Card */}
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><UserCheck className="h-5 w-5 text-primary" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Account Assignment</CardTitle>
                            <CardDescription className="text-xs font-medium">Internal owner responsible for this account.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <FormField control={methods.control} name="assignedToId" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Assigned Account Manager</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                                        <SelectValue placeholder="Select manager..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {users?.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>

            {/* Contacts & Modules Section */}
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><User className="h-5 w-5 text-primary" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Staff focal persons</CardTitle>
                            <CardDescription className="text-xs font-medium">Primary directory of stakeholders.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <FocalPersonManager />
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><Plus className="h-5 w-5 text-primary" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Requested Modules</CardTitle>
                            <CardDescription className="text-xs font-medium">Select activated SmartSapp features.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <FormField control={methods.control} name="modules" render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <ModuleSelect {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>
          </div>

          {/* Right Sidebar: Operations */}
          <div className="space-y-8">
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><MapPin className="h-5 w-5 text-primary" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Regional Settings</CardTitle>
                            <CardDescription className="text-xs font-medium">Geographic classification.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <FormField control={methods.control} name="zone" render={({ field, fieldState }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Geographic Zone</FormLabel>
                            <FormControl>
                                <ZoneSelect value={field.value} onValueChange={field.onChange} error={!!fieldState.error} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} /> 
                    <FormField control={methods.control} name="location" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Physical Address</FormLabel>
                            <FormControl>
                                <Textarea {...field} className="min-h-[80px] rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-sm p-4" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} /> 
                    <FormField control={methods.control} name="nominalRoll" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Nominal Roll</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>

            <div className="pt-4 sticky top-24">
                <Button 
                    type="submit" 
                    className="w-full h-14 rounded-2xl font-black text-lg shadow-xl gap-3 transition-all active:scale-95" 
                    disabled={methods.formState.isSubmitting}
                >
                    {methods.formState.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldCheck className="h-6 w-6" />} 
                    Commit Changes
                </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

export default function EditSchoolPage() {
  const params = useParams();
  const schoolId = params.id as string;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
      <div className="max-w-5xl mx-auto space-y-8">
        <Button asChild variant="ghost" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground font-bold">
            <Link href="/admin/schools">
                <ArrowLeft className="mr-2 h-4 w-4" /> 
                Back to Directory
            </Link>
        </Button>
        <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">Update Profile</h1>
            <p className="text-muted-foreground font-medium uppercase text-xs tracking-tighter">Modify institutional classification and focal directory.</p>
        </div>
        {schoolId ? <EditSchoolForm schoolId={schoolId} /> : <p className="text-center py-20 text-muted-foreground font-medium">School context not found.</p>}
      </div>
    </div>
  );
}
