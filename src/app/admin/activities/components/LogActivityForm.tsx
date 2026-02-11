'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, orderBy } from 'firebase/firestore';

import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { logActivity } from '@/lib/activity-logger';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Loader2, PlusCircle } from 'lucide-react';
import type { School } from '@/lib/types';


const formSchema = z.object({
  school: z.custom<School>().refine(value => value !== undefined, { message: "School is required." }),
  description: z.string().min(5, { message: "Description must be at least 5 characters." }),
  timestamp: z.date({
    required_error: "A date and time for the activity is required.",
  }),
});

type FormData = z.infer<typeof formSchema>;

export default function LogActivityForm() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    const schoolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'schools'), orderBy('name', 'asc')) : null, [firestore]);
    const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsQuery);
    
    const defaultFormValues = React.useMemo(() => ({
        timestamp: new Date(),
        description: '',
        school: undefined,
    }), []);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultFormValues,
    });

    React.useEffect(() => {
        if (isDialogOpen) {
            form.reset(defaultFormValues);
        }
    }, [isDialogOpen, form, defaultFormValues]);


    const onSubmit = async (data: FormData) => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'You must be logged in to log an activity.' });
            return;
        }

        try {
            await logActivity({
                firestore,
                user,
                schoolId: data.school.id,
                schoolName: data.school.name,
                type: 'manual_log',
                description: data.description,
                timestamp: data.timestamp.toISOString(),
            });

            toast({ title: "Activity Logged", description: "The new activity has been added to the timeline." });
            setIsDialogOpen(false);

        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to log activity.' });
        }
    }
    
    return (
        <>
            <div className="relative bg-background p-4 rounded-lg border border-dashed flex items-center gap-4">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
                <button
                    onClick={() => setIsDialogOpen(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-1 text-left"
                >
                    Log an activity... (e.g., phone call, email sent)
                </button>
                 <Button onClick={() => setIsDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> Log Activity</Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Log a Manual Activity</DialogTitle>
                        <DialogDescription>
                            Record a phone call, email, site visit, or other interaction.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                            <FormField
                                control={form.control}
                                name="school"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>School</FormLabel>
                                    {isLoadingSchools ? <Skeleton className="h-10 w-full" /> : (
                                    <Select
                                        onValueChange={(schoolId: string) => {
                                        const school = schools?.find((s) => s.id === schoolId);
                                        field.onChange(school);
                                        }}
                                        value={field.value?.id}
                                        disabled={form.formState.isSubmitting || isLoadingSchools}
                                    >
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a school" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {schools?.map((school) => (
                                            <SelectItem key={school.id} value={school.id}>
                                            {school.name}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    )}
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            placeholder="e.g., Called to confirm data sheet." 
                                            {...field} 
                                            disabled={form.formState.isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="timestamp"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Activity Time</FormLabel>
                                        <FormControl>
                                            <DateTimePicker
                                                value={field.value}
                                                onChange={field.onChange}
                                                disabled={form.formState.isSubmitting}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter className="pt-4">
                                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={form.formState.isSubmitting}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {form.formState.isSubmitting ? 'Logging...' : 'Log Activity'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    );
}
