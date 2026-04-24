'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowLeft, Loader2, History, Eye, EyeOff, CheckCircle, XCircle,
  Trash2, Send, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import TemplateEditor from '@/components/messaging/TemplateEditor';
import ReminderConfig from '@/components/messaging/ReminderConfig';
import { updateGlobalTemplate, deleteGlobalTemplate, approveTemplate, rejectTemplate, listGlobalTemplates } from '@/lib/template-actions';
import { getVariablesForContext } from '@/lib/template-variable-utils';
import { renderTemplate } from '@/lib/template-utils';
import { useBackoffice } from '../../../context/BackofficeProvider';
import { useToast } from '@/hooks/use-toast';
import type { MessageTemplate, TemplateCategory, VariableContext, ReminderConfig as ReminderConfigType, TemplateVariable } from '@/lib/types';

// ── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  name:            z.string().min(1, 'Name is required'),
  category:        z.enum(['forms', 'surveys', 'meetings', 'agreements', 'campaigns', 'reminders', 'general']),
  templateType:    z.string().min(1, 'Template type is required'),
  channel:         z.enum(['email', 'sms']),
  subject:         z.string().optional(),
  body:            z.string().min(1, 'Body is required'),
  variableContext: z.enum(['meeting', 'form', 'survey', 'agreement', 'entity', 'campaign', 'common']),
});

type FormData = z.infer<typeof schema>;

// ── Status badge config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MessageTemplate['status'], { label: string; className: string }> = {
  approved:         { label: 'Approved',        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  draft:            { label: 'Draft',            className: 'bg-slate-500/15 text-muted-foreground border-slate-500/20' },
  pending_approval: { label: 'Pending Approval', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  rejected:         { label: 'Rejected',         className: 'bg-red-500/15 text-red-400 border-red-500/20' },
  archived:         { label: 'Archived',         className: 'bg-slate-500/15 text-muted-foreground border-slate-500/20' },
};

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'meetings',   label: 'Meetings' },
  { value: 'forms',      label: 'Forms' },
  { value: 'surveys',    label: 'Surveys' },
  { value: 'agreements', label: 'Agreements' },
  { value: 'campaigns',  label: 'Campaigns' },
  { value: 'reminders',  label: 'Reminders' },
  { value: 'general',    label: 'General' },
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

// ── Preview Panel ──────────────────────────────────────────────────────────

function PreviewPanel({ body, variables }: { body: string; variables: TemplateVariable[] }) {
  const sampleVars = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of variables) {
      map[v.name] = v.exampleValue || `[${v.label}]`;
    }
    return map;
  }, [variables]);

  const rendered = React.useMemo(() => renderTemplate(body, sampleVars), [body, sampleVars]);

  // Highlight any remaining unresolved {{...}} tokens in red
  const parts = rendered.split(/(\{\{[^}]+\}\})/g);

  return (
    <div className="rounded-xl border border-border bg-background p-4 min-h-[160px]">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Preview (sample data)</p>
      <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
        {parts.map((part, i) =>
          /^\{\{[^}]+\}\}$/.test(part) ? (
            <span key={i} className="bg-red-500/20 text-red-400 rounded px-0.5 border border-red-500/30 text-xs font-mono">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>
    </div>
  );
}

// ── Send Test Dialog ───────────────────────────────────────────────────────

interface SendTestDialogProps {
  open: boolean;
  onClose: () => void;
  channel: 'email' | 'sms';
  body: string;
  subject?: string;
  variables: TemplateVariable[];
}

function SendTestDialog({ open, onClose, channel, body, subject, variables }: SendTestDialogProps) {
  const { toast } = useToast();
  const [recipient, setRecipient] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);

  const sampleVars = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of variables) map[v.name] = v.exampleValue || `[${v.label}]`;
    return map;
  }, [variables]);

  async function handleSend() {
    if (!recipient.trim()) return;
    setIsSending(true);
    try {
      const renderedBody = renderTemplate(body, sampleVars);
      const renderedSubject = subject ? renderTemplate(subject, sampleVars) : undefined;
      // Call the send test server action
      const { sendTestMessage } = await import('@/lib/template-actions');
      await sendTestMessage({ channel, recipient: recipient.trim(), body: renderedBody, subject: renderedSubject });
      toast({ title: 'Test sent', description: `Message sent to ${recipient}` });
      onClose();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Send failed', description: e.message });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-muted border-border rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Send Test {channel === 'email' ? 'Email' : 'SMS'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {channel === 'email' ? 'Recipient Email' : 'Recipient Phone'}
            </Label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={channel === 'email' ? 'test@example.com' : '+1 555-000-0000'}
              className="h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Template will be rendered with sample variable values before sending.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl text-muted-foreground">Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !recipient.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl gap-2"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function EditTemplateClient({ templateId }: { templateId: string }) {
  const router = useRouter();
  const { profile, can } = useBackoffice();
  const { toast } = useToast();

  const [template, setTemplate] = React.useState<MessageTemplate | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [reminderConfig, setReminderConfig] = React.useState<ReminderConfigType | undefined>();
  const [showPreview, setShowPreview] = React.useState(false);
  const [showSendTest, setShowSendTest] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');
  const [showRejectDialog, setShowRejectDialog] = React.useState(false);

  const { control, handleSubmit, watch, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', category: 'general', templateType: '', channel: 'email', subject: '', body: '', variableContext: 'common' },
  });

  const watchedChannel = watch('channel');
  const watchedCategory = watch('category');
  const watchedContext = watch('variableContext');
  const watchedBody = watch('body');
  const watchedSubject = watch('subject');

  const variables = React.useMemo(() => getVariablesForContext(watchedContext), [watchedContext]);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await listGlobalTemplates();
      const found = all.find((t) => t.id === templateId);
      if (found) {
        setTemplate(found);
        setReminderConfig(found.reminderConfig);
        reset({
          name: found.name,
          category: found.category,
          templateType: found.templateType,
          channel: found.channel,
          subject: found.subject ?? '',
          body: found.body,
          variableContext: found.variableContext,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [templateId, reset]);

  React.useEffect(() => { load(); }, [load]);

  async function onSubmit(data: FormData) {
    if (!profile || !template) return;
    setIsSubmitting(true);
    try {
      await updateGlobalTemplate(template.id, {
        name: data.name,
        category: data.category,
        templateType: data.templateType,
        channel: data.channel,
        subject: data.channel === 'email' ? data.subject : undefined,
        body: data.body,
        variableContext: data.variableContext,
        reminderConfig: watchedCategory === 'reminders' ? reminderConfig : undefined,
      }, profile.id);
      toast({ title: 'Template saved' });
      load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApprove() {
    if (!profile || !template) return;
    try {
      await approveTemplate(template.id, profile.id);
      toast({ title: 'Template approved' });
      load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    }
  }

  async function handleReject() {
    if (!profile || !template || !rejectReason.trim()) return;
    try {
      await rejectTemplate(template.id, rejectReason, profile.id);
      toast({ title: 'Template rejected' });
      setShowRejectDialog(false);
      load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    }
  }

  async function handleDelete() {
    if (!template || !confirm(`Delete "${template.name}"? This cannot be undone.`)) return;
    try {
      await deleteGlobalTemplate(template.id);
      router.push('/backoffice/messaging/templates');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: e.message });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="h-8 w-48 bg-accent rounded-lg animate-pulse" />
        <div className="h-96 bg-muted/50 rounded-2xl border border-border animate-pulse" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-10 w-10 text-slate-700 mb-4" />
        <p className="text-sm text-muted-foreground">Template not found.</p>
        <Link href="/backoffice/messaging/templates">
          <Button variant="ghost" className="mt-4 text-emerald-400 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Templates
          </Button>
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[template.status] ?? STATUS_CONFIG.draft;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/backoffice/messaging/templates">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{template.name}</h1>
              <Badge variant="outline" className={`text-[9px] uppercase font-bold px-2 h-5 ${statusCfg.className}`}>
                {statusCfg.label}
              </Badge>
              <span className="text-xs font-mono text-muted-foreground bg-accent px-1.5 rounded">v{template.version}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {template.category} · {template.templateType} · {template.channel}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSendTest(true)}
            className="rounded-xl h-9 gap-2 border-border text-muted-foreground hover:text-foreground"
          >
            <Send className="h-3.5 w-3.5" /> Send Test
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-xl h-9 gap-2 border-border text-muted-foreground hover:text-foreground"
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? 'Hide Preview' : 'Preview'}
          </Button>
          {can('templates', 'edit') && template.status !== 'approved' && (
            <Button
              type="button"
              size="sm"
              onClick={handleApprove}
              className="rounded-xl h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-foreground"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Approve
            </Button>
          )}
          {can('templates', 'edit') && (template.status === 'draft' || template.status === 'pending_approval') && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowRejectDialog(true)}
              className="rounded-xl h-9 gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
          )}
          {can('templates', 'delete') && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              className="rounded-xl h-9 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
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
                      <Input {...field} className="h-10 bg-muted/50 border-border text-foreground rounded-xl focus:border-emerald-500/50" />
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
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {/* Template Type + Variable Context */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Template Type</Label>
                    <Controller
                      name="templateType"
                      control={control}
                      render={({ field }) => (
                        <Input {...field} className="h-10 bg-muted/50 border-border text-foreground rounded-xl focus:border-emerald-500/50" />
                      )}
                    />
                    {errors.templateType && <p className="text-xs text-red-400">{errors.templateType.message}</p>}
                  </div>
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
                </div>

                {/* Subject (email only) */}
                {watchedChannel === 'email' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Subject Line</Label>
                    <Controller
                      name="subject"
                      control={control}
                      render={({ field }) => (
                        <Input {...field} className="h-10 bg-muted/50 border-border text-foreground rounded-xl focus:border-emerald-500/50" />
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

            {/* Preview panel (inline) */}
            {showPreview && (
              <PreviewPanel body={watchedBody} variables={variables} />
            )}

            <div className="flex items-center justify-end gap-3">
              <Button
                type="submit"
                disabled={isSubmitting || !isDirty}
                className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-8 gap-2"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </div>

        {/* Right sidebar: version history */}
        <div className="lg:col-span-1">
          <Card className="rounded-2xl border border-border bg-muted/30 sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-400" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Current version */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-emerald-400">v{template.version}</span>
                  <Badge variant="outline" className="text-[9px] uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20 h-4">
                    Current
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Updated {new Date(template.updatedAt).toLocaleDateString()}
                </p>
                {template.updatedBy && (
                  <p className="text-[10px] text-muted-foreground">by {template.updatedBy}</p>
                )}
              </div>

              {/* Previous version reference */}
              {template.previousVersionId && (
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-muted-foreground">v{template.version - 1}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Previous version</p>
                  <p className="text-[10px] text-slate-600 font-mono truncate">{template.previousVersionId}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-2 border-t border-border space-y-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Created</span>
                  <p className="text-xs text-foreground/80">{new Date(template.createdAt).toLocaleDateString()}</p>
                </div>
                {template.createdBy && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Created By</span>
                    <p className="text-xs text-foreground/80 font-mono truncate">{template.createdBy}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send Test Dialog */}
      <SendTestDialog
        open={showSendTest}
        onClose={() => setShowSendTest(false)}
        channel={watchedChannel}
        body={watchedBody}
        subject={watchedSubject}
        variables={variables}
      />

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={(v) => !v && setShowRejectDialog(false)}>
        <DialogContent className="bg-muted border-border rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Reject Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs text-muted-foreground">Rejection Reason</Label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this template is being rejected..."
              className="h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowRejectDialog(false)} className="rounded-xl text-muted-foreground">Cancel</Button>
            <Button
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-foreground rounded-xl gap-2"
            >
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
