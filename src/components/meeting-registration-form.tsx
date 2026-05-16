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
          <div key={field.key} className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 ml-1 flex items-center gap-2">
              {field.label} {field.required && <span className="text-rose-400">*</span>}
            </Label>
            <Textarea
              {...form.register(field.key)}
              placeholder={field.placeholder || ''}
              rows={3}
              className="bg-white/90 text-black border-none rounded-xl px-4 shadow-inner resize-none"
              disabled={isSubmitting}
            />
            {error && <p className="text-rose-400 text-[10px] font-black uppercase tracking-tighter px-1">{error.message as string}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 ml-1">
              {field.label} {field.required && <span className="text-rose-400">*</span>}
            </Label>
            <Select
              onValueChange={v => form.setValue(field.key, v)}
              value={form.watch(field.key) || ''}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-12 bg-white/90 text-black border-none rounded-xl shadow-inner">
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
          <div key={field.key} className="flex items-center gap-3 py-2">
            <Checkbox
              id={field.key}
              checked={form.watch(field.key) || false}
              onCheckedChange={checked => form.setValue(field.key, checked)}
              disabled={isSubmitting}
              className="border-white/40 data-[state=checked]:bg-primary"
            />
            <Label htmlFor={field.key} className="text-sm font-medium text-white/80 cursor-pointer">
              {field.label} {field.required && <span className="text-rose-400">*</span>}
            </Label>
          </div>
        );

      default:
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 ml-1 flex items-center gap-2">
              {field.label} {field.required && <span className="text-rose-400">*</span>}
            </Label>
            <Input
              {...form.register(field.key)}
              type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
              placeholder={field.placeholder || ''}
              className="h-12 text-lg bg-white/90 text-black border-none rounded-xl px-4 shadow-inner"
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
        className="w-full max-w-md mx-auto md:mx-0 p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center space-y-4 shadow-2xl"
      >
        <div className="mx-auto bg-emerald-500/20 w-16 h-16 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <p className="text-xl font-black text-white uppercase tracking-tight">Registration Complete!</p>
        <p className="text-sm text-white/60 font-medium">Please wait while we prepare your session...</p>
      </motion.div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto md:mx-0">
      <motion.form
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onSubmit={form.handleSubmit(onSubmit)}
        className="p-8 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 shadow-2xl space-y-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Register for this Session</p>
        </div>

        <div className="space-y-4">
          {fields.map(renderField)}
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
              <Sparkles className="h-6 w-6" />
              {meeting.heroCtaLabel || 'Register Now'}
            </>
          )}
        </Button>
      </motion.form>
    </div>
  );
}
