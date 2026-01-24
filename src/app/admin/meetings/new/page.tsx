'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, addDoc } from 'firebase/firestore';

import type { School } from '@/lib/types';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  school: z.custom<School>(),
  meetingTime: z.date({
    required_error: "A meeting time is required.",
  }),
  meetingLink: z.string().url({ message: 'Please enter a valid Google Meet URL.' }),
  recordingUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function NewMeetingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();

  const schoolsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'schools');
  }, [firestore]);
  
  const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      meetingLink: '',
      recordingUrl: ''
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Firestore not available",
        description: "Please check your Firebase connection.",
      });
      return;
    }
    
    const meetingData = {
        schoolId: data.school.id,
        schoolName: data.school.name,
        schoolSlug: data.school.slug,
        meetingTime: data.meetingTime.toISOString(),
        meetingLink: data.meetingLink,
        recordingUrl: data.recordingUrl || ''
    };

    try {
      await addDoc(collection(firestore, 'meetings'), meetingData);

      toast({
        title: 'Meeting Created',
        description: `Meeting for ${data.school.name} has been scheduled.`,
      });
      router.push('/admin/meetings');
    } catch (error: any)
 {
      console.error('Error adding document: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: error.message || 'There was a problem saving the meeting.',
      });
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold tracking-tight mb-8">Add New Meeting</h1>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Meeting Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>School</FormLabel>
                       {isLoadingSchools ? <Skeleton className="h-10 w-full" /> : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value
                                  ? schools?.find(
                                      (school) => school.id === field.value.id
                                    )?.name
                                  : "Select school"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Search school..." />
                              <CommandEmpty>No school found.</CommandEmpty>
                              <CommandGroup>
                                {schools?.map((school) => (
                                  <CommandItem
                                    value={school.name}
                                    key={school.id}
                                    onSelect={() => {
                                      form.setValue("school", school)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value?.id === school.id
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {school.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                       )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="meetingTime"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Meeting Time</FormLabel>
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
                              {field.value ? format(field.value, "PPP p") : <span>Pick a date and time</span>}
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
                  name="meetingLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Link (Google Meet)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://meet.google.com/abc-xyz-pqr" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recordingUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recording URL (YouTube)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://youtu.be/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => router.push('/admin/meetings')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Creating...' : 'Create Meeting'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
