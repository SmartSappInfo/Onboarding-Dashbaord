

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, addDoc } from 'firebase/firestore';

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
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import { MediaSelect } from '../components/media-select';
import { ModuleSelect } from '../components/ModuleSelect';
import { Textarea } from '@/components/ui/textarea';

const formSchema = z.object({
  name: z.string().min(2, { message: 'School name must be at least 2 characters.' }),
  initials: z.string().optional(),
  slogan: z.string().optional(),
  logoUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  heroImageUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  
  contactPerson: z.string().optional(),
  email: z.string().email({ message: 'Please enter a valid email.' }).optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  
  nominalRoll: z.coerce.number().optional(),
  modules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    abbreviation: z.string(),
    color: z.string(),
  })).optional(),
  implementationDate: z.date().optional(),
  referee: z.string().optional(),
  includeDroneFootage: z.boolean().default(false),
});

type FormData = z.infer<typeof formSchema>;

export default function NewSchoolPage() {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      initials: '',
      slogan: '',
      logoUrl: '',
      heroImageUrl: '',
      contactPerson: '',
      email: '',
      phone: '',
      location: '',
      modules: [],
      referee: '',
      includeDroneFootage: false,
    },
  });

  const watchName = form.watch("name");

  React.useEffect(() => {
    if (watchName) {
        const initials = watchName
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase();
        form.setValue('initials', initials, { shouldValidate: true });
    }
  }, [watchName, form]);

  const onSubmit = (data: FormData) => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Firestore not available",
        description: "Please check your Firebase connection.",
      });
      return;
    }
    
    const slug = data.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const schoolData = {
      ...data,
      slug,
      implementationDate: data.implementationDate?.toISOString(),
      stage: { id: 'welcome', name: 'Welcome', order: 1, color: '#8E44AD' },
      assignedTo: { userId: null, name: null, email: null },
      createdAt: new Date().toISOString(),
    };

    const schoolsCollection = collection(firestore, 'schools');
    form.control.disabled = true;

    addDoc(schoolsCollection, schoolData)
      .then((docRef) => {
        toast({
          title: 'School Created',
          description: `${data.name} has been added successfully.`,
        });
        router.push('/admin/schools');
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
            path: schoolsCollection.path,
            operation: 'create',
            requestResourceData: schoolData,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Uh oh! Something went wrong.',
          description: 'There was a problem saving the school.',
        });
      }).finally(() => {
        form.control.disabled = false;
      });
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
      <Button asChild variant="ghost" className="mb-4 -ml-4">
        <Link href="/admin/schools">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Schools
        </Link>
      </Button>
      <h1 className="text-4xl font-bold tracking-tight mb-8">Add New School</h1>
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>School Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>School Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Ghana International School" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="initials"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initials</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., GIS" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                 </div>
                <FormField
                  control={form.control}
                  name="slogan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slogan</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Understanding of each other" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <MediaSelect {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heroImageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hero Image URL</FormLabel>
                      <FormControl>
                        <MediaSelect {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder="Yaw Mensah" {...field} />
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
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="yaw.mensah@school.edu.gh" {...field} />
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
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+233 24 123 4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Accra, Ghana" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nominalRoll"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nominal Roll (Number of Students)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="referee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referee</FormLabel>
                      <FormControl>
                        <Input placeholder="Ama Serwaa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="implementationDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Implementation Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="includeDroneFootage"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Include Drone Footage</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

               <FormField
                  control={form.control}
                  name="modules"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modules</FormLabel>
                      <FormControl>
                         <ModuleSelect {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => router.push('/admin/schools')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Creating...' : 'Create School'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

    

    