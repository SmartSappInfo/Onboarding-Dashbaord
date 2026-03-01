
'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ArrowLeft, Loader2, Building, MapPin, ImageIcon, User, Plus, ShieldCheck } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { doc, updateDoc } from 'firebase/firestore';

import type { School } from '@/lib/types';
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
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { MediaSelect } from '../../components/media-select';
import { ModuleSelect } from '../../components/ModuleSelect';
import { ZoneSelect } from '../../components/ZoneSelect';
import { FocalPersonManager } from '../../components/FocalPersonManager';
import { logActivity } from '@/lib/activity-logger';

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
    type: z.enum(['Champion', 'Accountant', 'Administrator', 'Principal']),
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
});

type FormData = z.infer<typeof formSchema>;

function EditSchoolForm({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();

  const schoolDocRef = useMemoFirebase(() => {
    if (!firestore || !schoolId) return null;
    return doc(firestore, 'schools', schoolId);
  }, [firestore, schoolId]);

  const { data: school, isLoading } = useDoc<School>(schoolDocRef);

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '', initials: '', slogan: '', status: 'Active',
      location: '', nominalRoll: 0, focalPersons: [], modules: [],
      referee: '', includeDroneFootage: false,
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
        focalPersons: school.focalPersons || [],
        modules: school.modules || [],
        implementationDate: school.implementationDate ? new Date(school.implementationDate) : null,
        referee: school.referee || '',
        includeDroneFootage: school.includeDroneFootage || false,
      });
    }
  }, [school, methods]);

  const onSubmit = (data: FormData) => {
    if (!firestore || !user) return;
    const schoolData = { ...data, implementationDate: data.implementationDate?.toISOString() || null };
    const docRef = doc(firestore, 'schools', schoolId);
    updateDoc(docRef, schoolData).then(() => {
        toast({ title: 'Profile Updated', description: `Changes to ${data.name} saved.` });
        logActivity({ schoolId, userId: user.uid, type: 'school_updated', source: 'user_action', description: `updated school profile for "${data.name}"` });
        router.push('/admin/schools');
    }).catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: schoolData }));
    });
  };

  if (isLoading) return <div className="space-y-8"><Skeleton className="h-64 w-full rounded-2xl"/><Skeleton className="h-96 w-full rounded-2xl"/></div>;

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><Building className="h-5 w-5 text-primary" /></div><CardTitle className="text-lg font-black uppercase tracking-tight">Identity & Status</CardTitle></div></CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField control={methods.control} name="name" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Official School Name</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={methods.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Inactive">Inactive</SelectItem>
                                <SelectItem value="Archived">Archived</SelectItem>
                            </SelectContent>
                        </Select>
                    <FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                    <FormField control={methods.control} name="initials" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Initials</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black text-center" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={methods.control} name="slogan" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Motto</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 italic font-medium" /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden"><CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><User className="h-5 w-5 text-primary" /></div><CardTitle className="text-lg font-black uppercase tracking-tight">Staff focal persons</CardTitle></div></CardHeader><CardContent className="p-6"><FocalPersonManager /></CardContent></Card>
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden"><CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><Plus className="h-5 w-5 text-primary" /></div><CardTitle className="text-lg font-black uppercase tracking-tight">Requested Modules</CardTitle></div></CardHeader><CardContent className="p-6"><FormField control={methods.control} name="modules" render={({ field }) => (<FormItem><FormControl><ModuleSelect {...field} /></FormControl><FormMessage /></FormItem>)} /></CardContent></Card>
          </div>
          <div className="space-y-8">
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden"><CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><MapPin className="h-5 w-5 text-primary" /></div><CardTitle className="text-lg font-black uppercase tracking-tight">Location & Operations</CardTitle></div></CardHeader><CardContent className="p-6 space-y-6"><FormField control={methods.control} name="zone" render={({ field, fieldState }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Geographic Zone</FormLabel><FormControl><ZoneSelect value={field.value} onValueChange={field.onChange} error={!!fieldState.error} /></FormControl><FormMessage /></FormItem>)} /> <FormField control={methods.control} name="location" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Physical Address</FormLabel><FormControl><Textarea {...field} className="min-h-[80px] rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-sm p-4" /></FormControl><FormMessage /></FormItem>)} /> <FormField control={methods.control} name="nominalRoll" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Nominal Roll</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" /></FormControl><FormMessage /></FormItem>)} /></CardContent></Card>
            <div className="pt-4"><Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl gap-3 transition-all active:scale-95" disabled={methods.formState.isSubmitting}>{methods.formState.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Building className="h-6 w-6" />} Save School Profile</Button></div>
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
        <Button asChild variant="ghost" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground font-bold"><Link href="/admin/schools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Schools</Link></Button>
        <div className="flex flex-col gap-1"><h1 className="text-4xl font-black tracking-tight text-foreground uppercase">Update Profile</h1><p className="text-muted-foreground font-medium uppercase text-xs tracking-tighter">Modify geographic assignment and staff focal directory.</p></div>
        {schoolId ? <EditSchoolForm schoolId={schoolId} /> : <p>School record not identified.</p>}
      </div>
    </div>
  )
}
