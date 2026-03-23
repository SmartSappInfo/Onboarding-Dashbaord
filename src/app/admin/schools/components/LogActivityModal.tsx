'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser } from '@/firebase';
import { logActivity } from '@/lib/activity-logger';
import type { School, Activity } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface LogActivityModalProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MANUAL_ACTIVITY_TYPES = ['note', 'call', 'visit', 'email'] as const;

const formSchema = z.object({
  type: z.enum(MANUAL_ACTIVITY_TYPES, {
    required_error: 'Please select an activity type.',
  }),
  content: z.string().min(10, {
    message: 'Description must be at least 10 characters long.',
  }),
});

type FormData = z.infer<typeof formSchema>;

export default function LogActivityModal({ school, open, onOpenChange }: LogActivityModalProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'note',
      content: '',
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
    }
    onOpenChange(isOpen);
  };

  const onSubmit = async (data: FormData) => {
    if (!school || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in and have a school selected.',
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
        await logActivity({
            schoolId: school.id,
            schoolName: school.name,
            schoolSlug: school.slug,
            workspaceId: school.workspaceIds[0] || 'onboarding',
            userId: user.uid,
            type: data.type,
            source: 'manual',
            description: `added a ${data.type}`,
            metadata: { content: data.content }
        });
        
        toast({
            title: 'Activity Logged',
            description: `A ${data.type} has been logged for ${school.name}.`,
        });
        handleOpenChange(false);

    } catch (error) {
        console.error('Failed to log activity:', error);
        toast({
            variant: 'destructive',
            title: 'Logging Failed',
            description: 'Could not save the activity. Please try again.',
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (!school) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Log Activity for {school.name}</DialogTitle>
          <DialogDescription>
            Record an interaction or add a note. This will be added to the school's chronological timeline.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Event Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 transition-all font-bold">
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl">
                      {MANUAL_ACTIVITY_TYPES.map((type) => (
                        <SelectItem key={type} value={type} className="capitalize">
                          {type.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Notes / Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Spoke with the headmaster about the upcoming kickoff meeting. They requested more info on billing."
                      className="min-h-[150px] rounded-2xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 p-4 leading-relaxed"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSubmitting} className="font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl px-8 font-black shadow-lg">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Log
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
