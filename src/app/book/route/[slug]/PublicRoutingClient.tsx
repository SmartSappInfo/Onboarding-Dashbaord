'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, ArrowRight, Loader2, CheckCircle2, GitFork } from 'lucide-react';
import { submitRoutingFormAction } from '@/app/actions/routing-form-actions';
import type { RoutingForm, RoutingEvaluationResult } from '@/lib/meetings/types/routing';

interface PublicRoutingClientProps {
  form: RoutingForm;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export default function PublicRoutingClient({ form }: PublicRoutingClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [answers, setAnswers] = React.useState<Record<string, string | number | boolean | string[]>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submissionResult, setSubmissionResult] = React.useState<RoutingEvaluationResult | null>(null);

  const handleFieldChange = (fieldId: string, value: string | number | boolean | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    for (const field of form.fields || []) {
      if (field.required && !answers[field.id]) {
        toast({
          variant: 'destructive',
          title: 'Field required',
          description: `Please answer "${field.label}" to proceed.`,
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await submitRoutingFormAction(form.slug, answers);
      if (res.success && res.result) {
        setSubmissionResult(res.result);

        if (res.redirectUrl) {
          // If internal URL, use router; if external, use window.location
          if (res.redirectUrl.startsWith('http')) {
            window.location.href = res.redirectUrl;
          } else {
            router.push(res.redirectUrl);
          }
        }
      } else {
        throw new Error(res.error || 'Failed to evaluate routing');
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Submission failed',
        description: getErrorMessage(err),
      });
      setIsSubmitting(false);
    }
  };

  // If destination was a static message and no redirect occurred
  if (submissionResult && submissionResult.destination.type === 'message') {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4 sm:p-6">
        <Card className="max-w-lg w-full rounded-3xl border shadow-lg p-6 sm:p-8 text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            {submissionResult.destination.messageTitle || 'Thank You!'}
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed text-muted-foreground">
            {submissionResult.destination.messageBody ||
              'Your details have been received. A member of our team will review your responses and reach out shortly.'}
          </CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col justify-between py-8 px-4 sm:px-6">
      <div className="max-w-xl w-full mx-auto space-y-6">
        {/* Form Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <GitFork className="h-3.5 w-3.5" />
            Smart Match
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {form.headline || form.name}
          </h1>
          {form.subheadline && (
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {form.subheadline}
            </p>
          )}
        </div>

        {/* Form Container */}
        <Card className="rounded-3xl border shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {(form.fields || []).map((field, idx) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id} className="text-sm font-semibold text-foreground flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-rose-500">*</span>}
                  </Label>

                  {field.type === 'dropdown' ? (
                    <Select
                      value={String(answers[field.id] || '')}
                      onValueChange={val => handleFieldChange(field.id, val)}
                    >
                      <SelectTrigger id={field.id} className="rounded-xl min-h-[44px] text-sm">
                        <SelectValue placeholder="Select an option..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options || []).map(opt => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === 'radio' ? (
                    <RadioGroup
                      value={String(answers[field.id] || '')}
                      onValueChange={val => handleFieldChange(field.id, val)}
                      className="space-y-2 pt-1"
                    >
                      {(field.options || []).map(opt => (
                        <div
                          key={opt}
                          className="flex items-center space-x-3 p-3 rounded-xl border bg-muted/10 hover:bg-muted/30 cursor-pointer transition-all"
                        >
                          <RadioGroupItem value={opt} id={`${field.id}_${opt}`} />
                          <Label htmlFor={`${field.id}_${opt}`} className="text-sm cursor-pointer flex-1 font-normal">
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : field.type === 'textarea' ? (
                    <Textarea
                      id={field.id}
                      value={String(answers[field.id] || '')}
                      onChange={e => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.placeholder || 'Type your answer here...'}
                      rows={3}
                      className="rounded-xl text-sm"
                    />
                  ) : (
                    <Input
                      id={field.id}
                      type="text"
                      value={String(answers[field.id] || '')}
                      onChange={e => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.placeholder || 'Your answer'}
                      className="rounded-xl min-h-[44px] text-sm"
                    />
                  )}
                </div>
              ))}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl min-h-[48px] font-semibold text-base gap-2 shadow-md active:scale-[0.98] transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Finding best match...
                  </>
                ) : (
                  <>
                    Continue to Booking
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Powered by footer */}
      <footer className="text-center pt-8 text-xs text-muted-foreground">
        Powered by <strong className="text-foreground">SmartSapp</strong>
      </footer>
    </div>
  );
}
