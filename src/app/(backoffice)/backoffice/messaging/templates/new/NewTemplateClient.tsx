'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TemplateEditor from '@/components/messaging/TemplateEditor';
import ReminderConfig from '@/components/messaging/ReminderConfig';
import { createGlobalTemplate } from '@/lib/template-actions';
import { getVariablesForContext } from '@/lib/template-variable-utils';
import { useBackoffice } from '../../../context/BackofficeProvider';
import type { TemplateCategory, VariableContext, ReminderConfig as ReminderConfigType } from '@/lib/types';

// ── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  name:            z.string().min(1, 'Name is required'),
  category:        z.enum(['forms', 'surveys', 'meetings', 'agreements', 'campaigns', 'reminders', 'tasks', 'automations', 'qr_codes', 'general']),
  templateType:    z.string().min(1, 'Template type is required'),
  recipientType:   z.enum(['respondent', 'internal_alert', 'assignee', 'entity', 'external_alert']).optional(),
  channel:         z.enum(['email', 'sms', 'in_app', 'push']),
  subject:         z.string().optional(),
  body:            z.string().min(1, 'Body is required'),
  variableContext: z.enum(['meeting', 'form', 'survey', 'agreement', 'entity', 'campaign', 'common']),
});

type FormData = z.infer<typeof schema>;

// ── Options ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'meetings',   label: 'Meetings' },
  { value: 'forms',      label: 'Forms' },
  { value: 'surveys',    label: 'Surveys' },
  { value: 'agreements', label: 'Agreements' },
  { value: 'campaigns',  label: 'Campaigns' },
  { value: 'reminders',  label: 'Reminders' },
  { value: 'tasks',      label: 'Tasks' },
  { value: 'automations',label: 'Automations' },
  { value: 'qr_codes',   label: 'QR Codes' },
  { value: 'general',    label: 'General' },
];

const RECIPIENT_TYPES: { value: string; label: string }[] = [
  { value: 'respondent', label: 'Respondent' },
  { value: 'internal_alert', label: 'Internal Alert' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'entity', label: 'Entity' },
  { value: 'external_alert', label: 'External Alert' },
];

const VARIABLE_CONTEXTS: { value: VariableContext; label: string }[] = [
  { value: 'common',    label: 'Common' },
  { value: 'meeting',   label: 'Meeting' },
  { value: 'form',      label: 'Form' },
  { value: 'survey',    label: 'Survey' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'entity',    label: 'Entity' },
  { value: 'campaign',  label: 'Campaign' },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function NewTemplateClient() {
  const router = useRouter();
  const { profile } = useBackoffice();
  const [reminderConfig, setReminderConfig] = React.useState<ReminderConfigType | undefined>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      category: 'general',
      templateType: '',
      recipientType: undefined,
      channel: 'email',
      subject: '',
      body: '',
      variableContext: 'common',
    },
  });

  const watchedCategory = watch('category');
  const watchedChannel = watch('channel');
  const watchedContext = watch('variableContext');

  const variables = React.useMemo(() => getVariablesForContext(watchedContext), [watchedContext]);

  async function onSubmit(data: FormData) {
    if (!profile) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const template = await createGlobalTemplate({
        name: data.name,
        category: data.category,
        templateType: data.templateType,
        recipientType: data.recipientType as any,
        channel: data.channel,
        subject: data.channel === 'email' ? data.subject : undefined,
        body: data.body,
        variableContext: data.variableContext,
        declaredVariables: [],
        reminderConfig: watchedCategory === 'reminders' ? reminderConfig : undefined,
        createdBy: profile.id,
      });
      router.push(`/backoffice/messaging/templates/${template.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to create template');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/backoffice/messaging/templates">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">New Template</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create a global message template.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="rounded-2xl border border-border bg-muted/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold text-foreground">Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Template Name</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="e.g. Meeting Invitation"
                    className="h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-emerald-500/50"
                  />
                )}
              />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>

            {/* Category + Channel */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10 bg-muted/50 border-border text-foreground rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-border">
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Channel</Label>
                <Controller
                  name="channel"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10 bg-muted/50 border-border text-foreground rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-border">
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="in_app">In-App</SelectItem>
                        <SelectItem value="push">Push</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Template Type + Recipient Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Template Type</Label>
                <Controller
                  name="templateType"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="e.g. meeting_invitation"
                      className="h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-emerald-500/50"
                    />
                  )}
                />
                {errors.templateType && <p className="text-xs text-red-400">{errors.templateType.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Recipient Type</Label>
                <Controller
                  name="recipientType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10 bg-muted/50 border-border text-foreground rounded-xl">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-border">
                        {RECIPIENT_TYPES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Variable Context */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Variable Context</Label>
              <Controller
                name="variableContext"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-10 bg-muted/50 border-border text-foreground rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border">
                      {VARIABLE_CONTEXTS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Subject (email only) */}
            {watchedChannel === 'email' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Subject Line</Label>
                <Controller
                  name="subject"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="e.g. You're invited to {{meeting_title}}"
                      className="h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-emerald-500/50"
                    />
                  )}
                />
              </div>
            )}

            {/* Body */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Body</Label>
              <Controller
                name="body"
                control={control}
                render={({ field }) => (
                  <TemplateEditor
                    value={field.value}
                    onChange={field.onChange}
                    channel={watchedChannel}
                    variables={variables}
                  />
                )}
              />
              {errors.body && <p className="text-xs text-red-400">{errors.body.message}</p>}
            </div>

            {/* Reminder config */}
            {watchedCategory === 'reminders' && (
              <ReminderConfig value={reminderConfig} onChange={setReminderConfig} />
            )}
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link href="/backoffice/messaging/templates">
            <Button type="button" variant="ghost" className="rounded-xl h-10 px-6 text-muted-foreground">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-8 gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Template
          </Button>
        </div>
      </form>
    </div>
  );
}
