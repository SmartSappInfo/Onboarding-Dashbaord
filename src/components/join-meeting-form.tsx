'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { addDoc, collection } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useState, useEffect } from 'react';
import { Loader2, Plus, X, Users, Baby, UserCircle, Clock, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  name: z.string().min(3, { message: 'Please enter your full name.' }),
  childrenNames: z.array(z.object({
    value: z.string().min(2, { message: 'Child name required.' })
  })).default([{ value: '' }]),
});

interface JoinMeetingFormProps {
  meetingId: string;
  entityId: string;
  meetingLink: string;
  meetingTime: string;
}

export default function JoinMeetingForm({ meetingId, entityId, meetingLink, meetingTime }: JoinMeetingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMeetingTime, setIsMeetingTime] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        name: '', 
        childrenNames: [{ value: '' }] 
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "childrenNames"
  });

  useEffect(() => {
    setIsClient(true);
    const checkMeetingTime = () => {
      const now = new Date();
      const mt = new Date(meetingTime);
      // Logic: Allow access 5 minutes before or any time after start
      setIsMeetingTime(now.getTime() >= mt.getTime() - 5 * 60 * 1000);
    };
    checkMeetingTime();
    const interval = setInterval(checkMeetingTime, 1000);
    return () => clearInterval(interval);
  }, [meetingTime]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Database offline.' });
        setIsSubmitting(false);
        return;
    }
    
    try {
        const attendeesCollection = collection(firestore, `meetings/${meetingId}/attendees`);
        const children = data.childrenNames.map(c => c.value).filter(v => !!v);
        
        await addDoc(attendeesCollection, {
            meetingId,
            entityId,
            parentName: data.name,
            childrenNames: children,
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

  if (!isClient) return null;

  return (
    <div className="w-full max-w-md mx-auto md:mx-0">
        <AnimatePresence mode="wait">
            {!isMeetingTime ? (
                <motion.div 
                    key="waiting"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center space-y-6 shadow-2xl"
                >
                    <div className="mx-auto bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mb-2">
                        <Clock className="h-8 w-8 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-3">
                        <p className="text-2xl font-black text-white leading-tight">😃 You're In Too Early!</p>
                        <p className="text-base font-medium text-white/70 leading-relaxed px-4">
                            You'll be able to join from here, when the countdown is over
                        </p>
                    </div>
                </motion.div>
            ) : (
                <motion.form 
                    key="form"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onSubmit={form.handleSubmit(onSubmit)} 
                    className="p-8 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 shadow-2xl space-y-8"
                >
                    <div className="space-y-6">
                        {/* Parent Name */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 ml-1 flex items-center gap-2">
                                <UserCircle className="h-3 w-3 text-primary" /> Your Full Name
                            </Label>
                            <Input 
                                {...form.register('name')} 
                                placeholder="e.g. Ama Serwaa"
                                className="h-12 text-lg bg-white/90 text-black border-none rounded-xl px-4 shadow-inner"
                                disabled={isSubmitting}
                            />
                            {form.formState.errors.name && <p className="text-rose-400 text-[10px] font-black uppercase tracking-tighter px-1 mt-1">{form.formState.errors.name.message}</p>}
                        </div>

                        {/* Children Names */}
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 ml-1 flex items-center gap-2">
                                <Baby className="h-3 w-3 text-primary" /> Children at this school
                            </Label>
                            
                            <div className="space-y-2">
                                {fields.map((field, index) => (
                                    <motion.div 
                                        key={field.id}
                                        initial={{ x: -10, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        className="flex gap-2"
                                    >
                                        <Input 
                                            {...form.register(`childrenNames.${index}.value` as const)}
                                            placeholder={`Child ${index + 1} Name`}
                                            className="h-11 bg-white/80 text-black border-none rounded-xl px-4 shadow-sm"
                                            disabled={isSubmitting}
                                        />
                                        {index === fields.length - 1 ? (
                                            <Button 
                                                type="button" 
                                                variant="secondary"
                                                size="icon"
                                                className="h-11 w-11 rounded-xl shrink-0 bg-primary text-white hover:bg-primary/90"
                                                onClick={() => append({ value: '' })}
                                            >
                                                <Plus className="h-5 w-5" />
                                            </Button>
                                        ) : (
                                            <Button 
                                                type="button" 
                                                variant="ghost"
                                                size="icon"
                                                className="h-11 w-11 rounded-xl shrink-0 text-white/40 hover:text-rose-400 hover:bg-rose-500/10"
                                                onClick={() => remove(index)}
                                            >
                                                <X className="h-5 w-5" />
                                            </Button>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <Button 
                        type="submit" 
                        size="lg" 
                        className="w-full h-16 rounded-[1.5rem] font-black text-lg bg-primary text-white hover:bg-primary/90 shadow-2xl shadow-primary/30 transition-all active:scale-95 uppercase tracking-widest gap-3" 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <Loader2 className="animate-spin h-6 w-6" />
                        ) : (
                            <>
                                <Zap className="h-6 w-6" />
                                Enter Meeting Room
                            </>
                        )}
                    </Button>
                </motion.form>
            )}
        </AnimatePresence>
    </div>
  )
}
