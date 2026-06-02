'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import type { Meeting, MeetingRegistrationField } from '@/lib/types';

interface MeetingRegistrationFormProps {
  meeting: Meeting;
  entityId: string;
  onRegistered: (token: string) => void;
}

/**
 * Public-facing registration form that renders dynamic fields
 * from meeting.registrationFields.
 */
export default function MeetingRegistrationForm({ meeting, entityId, onRegistered }: MeetingRegistrationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const fields = (meeting.registrationFields || []).sort((a, b) => a.order - b.order);

  // Build Zod schema dynamically from registration fields
  const schemaShape: Record<string, z.ZodTypeAny> = {};
  fields.forEach(field => {
    let fieldSchema: z.ZodTypeAny;
    switch (field.type) {
      case 'email':
        fieldSchema = z.string().email('Please enter a valid email address.');
        break;
      case 'checkbox':
        fieldSchema = z.boolean();
        break;
      case 'multiselect':
        fieldSchema = z.array(z.string());
        break;
      default:
        fieldSchema = z.string();
    }
    if (field.required && field.type !== 'checkbox') {
      fieldSchema = (fieldSchema as z.ZodString).min(1, `${field.label} is required.`);
    }
    schemaShape[field.key] = field.required ? fieldSchema : fieldSchema.optional();
  });
  const dynamicSchema = z.object(schemaShape);

  const form = useForm({
    resolver: zodResolver(dynamicSchema),
    defaultValues: fields.reduce((acc, field) => {
      if (field.type === 'checkbox') acc[field.key] = false;
      else if (field.type === 'multiselect') acc[field.key] = [];
      else acc[field.key] = '';
      return acc;
    }, {} as Record<string, any>),
  });

  const onSubmit = async (data: Record<string, any>) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/meetings/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id, formData: data }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Capacity full
          toast({
            variant: 'destructive',
            title: 'Registration Full',
            description: 'This session has reached its capacity limit.',
          });
          return;
        }
        throw new Error(json?.error || 'Registration failed');
      }

      const { token, status, personalizedMeetingUrl, alreadyRegistered } = json;

      setIsComplete(true);

      if (alreadyRegistered) {
        toast({
          title: 'Welcome Back!',
          description: 'You are already registered. Redirecting you to the waiting room...',
        });
        onRegistered(token);
        router.push(`${pathname}/join?token=${token}`);
        return;
      }

      if (status === 'waitlisted') {
        toast({
          title: 'Added to Waitlist',
          description: "You've been added to the waitlist. We'll notify you if a spot opens up.",
        });
        onRegistered(token);
      } else {
        toast({
          title: 'Registration Complete!',
          description: 'Redirecting you to the waiting room...',
        });
        router.push(`${pathname}/join?token=${token}`);
      }
    } catch (error) {
      console.error('Registration failed:', error);
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const renderField = (field: MeetingRegistrationField) => {
    const error = form.formState.errors[field.key];

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.key} className="space-y-1 md:space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1 flex items-center gap-2">
              {field.label} {field.required && <span className="text-rose-400">*</span>}
            </Label>
            <Textarea
              {...form.register(field.key)}
              placeholder={field.placeholder || ''}
              rows={2}
              className="bg-background text-foreground border border-border rounded-xl px-4 shadow-sm resize-none text-xs md:text-sm"
              disabled={isSubmitting}
            />
            {error && <p className="text-rose-400 text-[10px] font-black uppercase tracking-tighter px-1">{error.message as string}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.key} className="space-y-1 md:space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
              {field.label} {field.required && <span className="text-rose-400">*</span>}
            </Label>
            <Select
              onValueChange={v => form.setValue(field.key, v)}
              value={form.watch(field.key) || ''}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-10 md:h-12 bg-background text-foreground border border-border rounded-xl shadow-sm text-xs md:text-sm">
                <SelectValue placeholder={field.placeholder || 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {(field.options || []).map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-rose-400 text-[10px] font-black uppercase tracking-tighter px-1">{error.message as string}</p>}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.key} className="flex items-center gap-3 py-1.5 md:py-2">
            <Checkbox
              id={field.key}
              checked={form.watch(field.key) || false}
              onCheckedChange={checked => form.setValue(field.key, checked)}
              disabled={isSubmitting}
              className="border-foreground/40 data-[state=checked]:bg-primary"
            />
            <Label htmlFor={field.key} className="text-xs md:text-sm font-medium text-foreground/80 cursor-pointer">
              {field.label} {field.required && <span className="text-rose-400">*</span>}
            </Label>
          </div>
        );

      default:
        return (
          <div key={field.key} className="space-y-1 md:space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1 flex items-center gap-2">
              {field.label} {field.required && <span className="text-rose-400">*</span>}
            </Label>
            <Input
              {...form.register(field.key)}
              type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
              placeholder={field.placeholder || ''}
              className="h-10 md:h-12 text-xs md:text-sm bg-background text-foreground border border-border rounded-xl px-4 shadow-sm"
              disabled={isSubmitting}
            />
            {error && <p className="text-rose-400 text-[10px] font-black uppercase tracking-tighter px-1">{error.message as string}</p>}
          </div>
        );
    }
  };

  if (isComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full md:max-w-md mx-auto md:mx-0 p-5 sm:p-7 md:p-10 bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-[2rem] md:rounded-[2.5rem] border border-black/10 dark:border-white/10 text-center space-y-3 md:space-y-4 shadow-2xl"
      >
        <div className="mx-auto bg-emerald-500/20 w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 md:h-8 md:w-8 text-emerald-400" />
        </div>
        <p className="text-lg md:text-xl font-black text-foreground tracking-tight">Registration Complete!</p>
        <p className="text-xs md:text-sm text-muted-foreground font-medium">Please wait while we prepare your session...</p>
      </motion.div>
    );
  }

  return (
    <div className="w-full md:max-w-md mx-auto md:mx-0">
      <motion.form
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onSubmit={form.handleSubmit(onSubmit)}
        className="p-4 sm:p-6 md:p-8 bg-black/5 dark:bg-white/10 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] border border-black/10 dark:border-white/20 shadow-2xl space-y-4 md:space-y-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">Register for this Session</p>
        </div>

        <div className="space-y-3 md:space-y-4">
          {fields.map(renderField)}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full h-12 md:h-16 rounded-[1.25rem] md:rounded-[1.5rem] font-black text-sm md:text-lg bg-primary text-white hover:bg-primary/90 shadow-2xl shadow-primary/30 transition-all active:scale-95 uppercase tracking-widest gap-2 md:gap-3"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin h-5 w-5 md:h-6 md:w-6" />
          ) : (
            <>
              <Sparkles className="h-4 w-4 md:h-6 md:w-6" />
              {meeting.heroCtaLabel || 'Register Now'}
            </>
          )}
        </Button>
      </motion.form>
    </div>
  );
}
