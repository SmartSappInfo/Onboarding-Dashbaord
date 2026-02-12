
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { addDoc, collection } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const formSchema = z.object({
  name: z.string().min(3, { message: 'Please enter your full name.' }),
});

interface JoinMeetingFormProps {
  meetingId: string;
  schoolId: string;
  meetingLink: string;
  meetingTime: string;
}

export default function JoinMeetingForm({ meetingId, schoolId, meetingLink, meetingTime }: JoinMeetingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMeetingTime, setIsMeetingTime] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    setIsClient(true);
    const checkMeetingTime = () => {
      const now = new Date();
      const mt = new Date(meetingTime);
      setIsMeetingTime(now.getTime() >= mt.getTime() - 5 * 60 * 1000);
    };
    checkMeetingTime();
    const interval = setInterval(checkMeetingTime, 1000);
    return () => clearInterval(interval);
  }, [meetingTime]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Could not connect to database.' });
        setIsSubmitting(false);
        return;
    }
    
    try {
        const attendeesCollection = collection(firestore, `meetings/${meetingId}/attendees`);
        await addDoc(attendeesCollection, {
            meetingId,
            schoolId,
            name: data.name,
            joinedAt: new Date().toISOString(),
        });
        
        window.open(meetingLink, '_blank');

    } catch (error) {
        console.error("Failed to log attendance:", error);
        window.open(meetingLink, '_blank');
    } finally {
        setIsSubmitting(false);
        form.reset();
    }
  };

  if (!isClient) {
    // Render a disabled state for SSR to prevent hydration issues
    return (
        <div className="w-full max-w-md mx-auto md:mx-0 p-6 bg-white/10 backdrop-blur-md rounded-lg border border-white/20">
            <p className="text-lg font-semibold text-center md:text-left mb-4 text-white">Enter your name to join</p>
            <div className="flex flex-col sm:flex-row gap-2">
                <Input placeholder="Your full name" className="h-12 text-lg bg-white/80 text-black placeholder:text-gray-500" disabled />
                <Button size="lg" className="h-12 text-lg" disabled>Join Meeting</Button>
            </div>
        </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-md mx-auto md:mx-0 p-6 bg-white/10 backdrop-blur-md rounded-lg border border-white/20">
        <p className="text-lg font-semibold text-center md:text-left mb-4 text-white">Enter your name to join</p>
        <div className="flex flex-col sm:flex-row gap-2">
            <Input 
                {...form.register('name')} 
                placeholder="Your full name"
                className="h-12 text-lg bg-white/80 text-black placeholder:text-gray-500"
                disabled={isSubmitting}
            />
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="w-full sm:w-auto">
                            <Button type="submit" size="lg" className="h-12 text-lg bg-white text-primary hover:bg-gray-200 w-full" disabled={isSubmitting || !isMeetingTime}>
                                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Join Meeting'}
                            </Button>
                        </div>
                    </TooltipTrigger>
                    {!isMeetingTime && (
                        <TooltipContent>
                            <p>You can join 5 minutes before the start time.</p>
                        </TooltipContent>
                    )}
                </Tooltip>
            </TooltipProvider>
        </div>
        {form.formState.errors.name && <p className="text-red-300 text-sm mt-2">{form.formState.errors.name.message}</p>}
    </form>
  )
}

    