
'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, Building, MapPin, CheckCircle2, User, UserCheck, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, addDoc, query, where } from 'firebase/firestore';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, errorEmitter, FirestorePermissionError, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { ModuleSelect } from '../components/ModuleSelect';
import { ZoneSelect } from '../components/ZoneSelect';
import { FocalPersonManager } from '../components/FocalPersonManager';
import { logActivity } from '@/lib/activity-logger';
import { type UserProfile } from '@/lib/types';

const formSchema = z.object({
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
  implementationDate: z.date().optional(),
  referee: z.string().optional(),
  includeDroneFootage: z.boolean().default(false),
  assignedToId: z.string().min(1, 'Please select an account manager.'),
});

type FormData = z.infer<typeof formSchema>;

export default function NewSchoolPage() {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('isAuthorized', '==', true));
  }, [firestore]);
  const { data: users, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      initials: '',
      slogan: '',
      status: 'Active',
      location: '',
      nominalRoll: 0,
      focalPersons: [{ name: '', email: '', phone: '', type: 'Administrator' }],
      modules: [],
      referee: '',
      includeDroneFootage: false,
      assignedToId: user?.uid || '',
    },
  });

  const watchName = methods.watch("name");

  React.useEffect(() => {
    if (watchName) {
        const initials = watchName.split(' ').map(word => word[0]).join('').toUpperCase();
        methods.setValue('initials', initials, { shouldValidate: true });
    }
  }, [watchName, methods]);

  React.useEffect(() => {
      if (user && !methods.getValues('assignedToId')) {
          methods.setValue('assignedToId', user.uid);
      }
  }, [user, methods]);

  const onSubmit = async (data: FormData) => {
    if (!firestore || !user || !users) return;

    const selectedManager = users.find(u => u.id === data.assignedToId);
    const assignedTo = selectedManager 
        ? { userId: selectedManager.id, name: selectedManager.name, email: selectedManager.email }
        : { userId: null, name: 'Unassigned', email: null };

    const slug = data.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const { assignedToId, ...rest } = data;
    const schoolData = {
      ...rest,
      slug,
      assignedTo,
      implementationDate: data.implementationDate?.toISOString() || null,
      stage: { id: 'welcome', name: 'Welcome', order: 1, color: '#f72585' },
      createdAt: new Date().toISOString(),
    };

    const schoolsCol = collection(firestore, 'schools');
    try {
      const docRef = await addDoc(schoolsCol, schoolData);
      toast({ title: 'School Initialized', description: `${data.name} is now active in the pipeline.` });
      await logActivity({
          schoolId: docRef.id, schoolName: data.name, schoolSlug: slug, userId: user.uid,
          type: 'school_created', source: 'user_action',
          description: `registered new school "${data.name}" in ${data.zone.name}`,
      });
      router.push('/admin/schools');
    } catch (error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: schoolsCol.path, operation: 'create', requestResourceData: schoolData }));
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
      <div className="max-w-5xl mx-auto space-y-8">
        <Button asChild variant="ghost" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground font-bold"><Link href="/admin/schools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Schools</Link></Button>
        <div className="flex flex-col gap-1"><h1 className="text-4xl font-black tracking-tight text-foreground uppercase">Campus Registration</h1><p className="text-muted-foreground font-medium uppercase tracking-tighter text-xs">Establish identity and geographic assignment for a new institution.</p></div>

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8 pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><Building className="h-5 w-5 text-primary" /></div><CardTitle className="text-lg font-black uppercase tracking-tight">General Identity</CardTitle></div></CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField control={methods.control} name="name" render={({ field }) => (
                        <FormItem className="md:col-span-2"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Official Name</FormLabel><FormControl><Input placeholder="School name..." {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={methods.control} name="initials" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Initials</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black text-center" /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={methods.control} name="status" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Operational Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="Inactive">Inactive</SelectItem>
                                        <SelectItem value="Archived">Archived</SelectItem>
                                    </SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={methods.control} name="slogan" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Motto</FormLabel><FormControl><Input placeholder="e.g. Forward Ever" {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 italic font-medium" /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl"><UserCheck className="h-5 w-5 text-primary" /></div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Account Assignment</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <FormField control={methods.control} name="assignedToId" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Assign Account Manager</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                                            <SelectValue placeholder="Select manager..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {isUsersLoading ? (
                                            <div className="p-4 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                        ) : users?.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden"><CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><User className="h-5 w-5 text-primary" /></div><CardTitle className="text-lg font-black uppercase tracking-tight">Contact Directory</CardTitle></div></CardHeader><CardContent className="p-6"><FocalPersonManager /></CardContent></Card>
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden"><CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><CheckCircle2 className="h-5 w-5 text-primary" /></div><CardTitle className="text-lg font-black uppercase tracking-tight">Functional Selection</CardTitle></div></CardHeader><CardContent className="p-6"><FormField control={methods.control} name="modules" render={({ field }) => (<FormItem><FormControl><ModuleSelect {...field} /></FormControl><FormMessage /></FormItem>)} /></CardContent></Card>
              </div>
              <div className="space-y-8">
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden"><CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><MapPin className="h-5 w-5 text-primary" /></div><CardTitle className="text-lg font-black uppercase tracking-tight">Geographic Assignment</CardTitle></div></CardHeader><CardContent className="p-6 space-y-6"><FormField control={methods.control} name="zone" render={({ field, fieldState }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Assigned Zone</FormLabel><FormControl><ZoneSelect value={field.value} onValueChange={field.onChange} error={!!fieldState.error} /></FormControl><FormMessage /></FormItem>)} /> <FormField control={methods.control} name="location" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Address</FormLabel><FormControl><Textarea {...field} className="min-h-[80px] rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-sm p-4" /></FormControl><FormMessage /></FormItem>)} /> <FormField control={methods.control} name="nominalRoll" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Total Roll</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" /></FormControl><FormMessage /></FormItem>)} /></CardContent></Card>
                <div className="pt-4"><Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl gap-3 transition-all active:scale-95" disabled={methods.formState.isSubmitting}>{methods.formState.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Building className="h-6 w-6" />} Initialize School</Button></div>
              </div>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
