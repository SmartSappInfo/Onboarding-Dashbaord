'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageCircle, Loader2, RefreshCw, CheckCircle2, Clock, XCircle, Plus, FilePlus2, Send, Trash2 } from 'lucide-react';
import {
  listWhatsAppTemplates,
  syncWhatsAppTemplates,
  adoptWhatsAppTemplate,
  createWhatsAppTemplate,
  sendWhatsAppTestMessage,
  uploadWhatsAppHeaderMedia,
} from '@/lib/whatsapp-template-actions';
import { getBodyText, extractParamCount } from '@/lib/whatsapp/whatsapp-domain';
import type { TemplateButtonInput, MediaHeaderFormat } from '@/lib/whatsapp/whatsapp-domain';
import type {
  WhatsAppTemplate,
  WhatsAppTemplateStatus,
  WhatsAppTemplateCategory,
} from '@/lib/whatsapp/whatsapp-types';

type HeaderMode = 'none' | 'text' | 'media';
type UploadedMedia = { format: MediaHeaderFormat; handle: string; fileName: string };

/** Read a File as raw base64 (no data: prefix) — safe for large files. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

function newButton(type: TemplateButtonInput['type']): TemplateButtonInput {
  if (type === 'URL') return { type: 'URL', text: '', url: '' };
  if (type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: '', phoneNumber: '' };
  return { type: 'QUICK_REPLY', text: '' };
}

/** UI-side validity mirror of the server rules (server still re-validates). */
function buttonValid(b: TemplateButtonInput): boolean {
  if (!b.text.trim()) return false;
  if (b.type === 'URL') return !!b.url.trim() && (!/\{\{\s*1\s*\}\}/.test(b.url) || !!b.urlExample?.trim());
  if (b.type === 'PHONE_NUMBER') return !!b.phoneNumber.trim();
  return true;
}

const LANGUAGES = ['en_US', 'en_GB', 'en', 'fr', 'es', 'pt_BR', 'ar'];
// AUTHENTICATION omitted: it needs a fixed OTP/button structure this text-body
// builder can't produce, so Meta would auto-reject it.
const CATEGORIES: WhatsAppTemplateCategory[] = ['UTILITY', 'MARKETING'];

// Hoisted so it isn't recreated per render (`js-hoist-regexp`).
const PREVIEW_PARAM_RE = /\{\{\s*(\d+)\s*\}\}/g;

/** Substitute {{n}} with its sample value, keeping the {{n}} token when blank. */
function renderPreview(body: string, examples: string[]): string {
  return body.replace(PREVIEW_PARAM_RE, (_m, n: string) => {
    const v = examples[Number(n) - 1];
    return v && v.trim() ? v : `{{${n}}}`;
  });
}

interface Props {
  organizationId: string;
}

const STATUS_META: Record<
  WhatsAppTemplateStatus,
  { label: string; cls: string; icon: React.ElementType }
> = {
  APPROVED: { label: 'Approved', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
  PENDING: { label: 'Pending', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Clock },
  REJECTED: { label: 'Rejected', cls: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
  PAUSED: { label: 'Paused', cls: 'bg-muted text-muted-foreground border-border', icon: Clock },
  DISABLED: { label: 'Disabled', cls: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

const GROUP_ORDER: WhatsAppTemplateStatus[] = ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED'];

export default function WhatsAppTemplatePanel({ organizationId }: Props) {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [templates, setTemplates] = React.useState<WhatsAppTemplate[]>([]);
  const [adopting, setAdopting] = React.useState<WhatsAppTemplate | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [testing, setTesting] = React.useState<WhatsAppTemplate | null>(null);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await listWhatsAppTemplates(idToken, organizationId);
      if (res.success) setTemplates(res.data);
    } finally {
      setLoading(false);
    }
  }, [user, organizationId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const idToken = await user.getIdToken();
      const res = await syncWhatsAppTemplates(idToken, organizationId);
      if (res.success) {
        setTemplates(res.data.templates);
        toast({ title: 'Synced', description: `${res.data.count} template(s) pulled from Meta.` });
      } else {
        toast({ variant: 'destructive', title: 'Sync failed', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSyncing(false);
    }
  };

  // Group during render (no effect) — derived state.
  const grouped = React.useMemo(() => {
    const map = new Map<WhatsAppTemplateStatus, WhatsAppTemplate[]>();
    for (const t of templates) {
      const arr = map.get(t.status) ?? [];
      arr.push(t);
      map.set(t.status, arr);
    }
    return map;
  }, [templates]);

  return (
    <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
      <CardHeader className="p-6 border-b">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              WhatsApp Templates
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
              Meta-registered templates. Approval status updates automatically (or hit Sync). Only
              approved templates can be used to send.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => setCreating(true)} className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700">
              <FilePlus2 className="h-4 w-4 mr-2" /> Create template
            </Button>
            <Button onClick={handleSync} disabled={syncing} variant="outline" className="rounded-xl font-bold">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} /> Sync from Meta
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
          </div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No templates yet. Configure WhatsApp in Settings, then “Sync from Meta”.
          </div>
        ) : (
          GROUP_ORDER.filter((s) => grouped.has(s)).map((status) => {
            const meta = STATUS_META[status];
            const Icon = meta.icon;
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {meta.label} ({grouped.get(status)!.length})
                  </span>
                </div>
                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-3"
                  style={{ contentVisibility: 'auto' }}
                >
                  {grouped.get(status)!.map((t) => (
                    <div key={t.id} className="rounded-2xl border border-border/80 bg-muted/10 p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm">{t.name}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {t.language} · {t.category} · {t.paramCount} param(s)
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] font-bold ${meta.cls}`}>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{getBodyText(t.components)}</p>
                      {t.status === 'REJECTED' && t.rejectedReason && (
                        <p className="text-[10px] font-semibold text-red-600">Reason: {t.rejectedReason}</p>
                      )}
                      {t.status === 'APPROVED' && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAdopting(t)}
                            className="rounded-lg font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/5 h-8"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Adopt as template
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setTesting(t)}
                            className="rounded-lg font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 h-8"
                          >
                            <Send className="h-3.5 w-3.5 mr-1" /> Send test
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {adopting && (
        <AdoptDialog
          template={adopting}
          organizationId={organizationId}
          onClose={() => setAdopting(null)}
          onAdopted={() => {
            setAdopting(null);
            toast({ title: 'Adopted', description: 'Template is now selectable on the WhatsApp channel.' });
          }}
        />
      )}

      {creating && (
        <CreateTemplateDialog
          organizationId={organizationId}
          onClose={() => setCreating(false)}
          onCreated={(t) => {
            setCreating(false);
            setTemplates((prev) => [t, ...prev.filter((x) => x.id !== t.id)]);
            toast({
              title: 'Submitted to Meta',
              description: 'Template sent for approval (usually minutes). It can send once APPROVED.',
            });
          }}
        />
      )}

      {testing && (
        <SendTestDialog
          template={testing}
          organizationId={organizationId}
          onClose={() => setTesting(null)}
          onSent={(wamid) => {
            setTesting(null);
            toast({
              title: 'Test sent',
              description: wamid ? `Message queued (${wamid}).` : 'Message queued.',
            });
          }}
        />
      )}
    </Card>
  );
}

function SendTestDialog({
  template,
  organizationId,
  onClose,
  onSent,
}: {
  template: WhatsAppTemplate;
  organizationId: string;
  onClose: () => void;
  onSent: (wamid: string | null) => void;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const [to, setTo] = React.useState('');
  const [valuesByIndex, setValuesByIndex] = React.useState<Record<number, string>>({});
  const [sending, setSending] = React.useState(false);

  // Derived during render — no effect.
  const values = React.useMemo(
    () => Array.from({ length: template.paramCount }, (_, i) => valuesByIndex[i] ?? ''),
    [template.paramCount, valuesByIndex],
  );
  const body = getBodyText(template.components);
  const canSend = to.trim().length >= 5 && values.every((v) => v.trim().length > 0);

  const handleSend = async () => {
    if (!user) return;
    setSending(true);
    try {
      const idToken = await user.getIdToken();
      const res = await sendWhatsAppTestMessage(idToken, {
        organizationId,
        templateId: template.id,
        to: to.trim(),
        params: values.map((v) => v.trim()),
      });
      if (res.success) onSent(res.data.metaMessageId);
      else toast({ variant: 'destructive', title: 'Send failed', description: res.error });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send test — “{template.name}”</DialogTitle>
          <DialogDescription className="text-xs">
            Sends this approved template to one number. Use international format (e.g.
            <code> +233201234567</code>).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="wa-test-to" className="text-[10px] font-semibold text-muted-foreground">Recipient number</Label>
            <Input
              id="wa-test-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+233201234567"
              inputMode="tel"
              className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4"
            />
          </div>

          {template.paramCount > 0 &&
            values.map((val, i) => (
              <div key={i} className="flex items-center gap-2">
                <Label htmlFor={`wa-test-p-${i}`} className="text-[10px] font-mono text-muted-foreground w-10">
                  {`{{${i + 1}}}`}
                </Label>
                <Input
                  id={`wa-test-p-${i}`}
                  value={val}
                  onChange={(e) => setValuesByIndex((prev) => ({ ...prev, [i]: e.target.value }))}
                  placeholder="value"
                  className="h-9 rounded-lg bg-muted/20 border-none shadow-inner font-medium px-3"
                />
              </div>
            ))}

          {body.trim() && (
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground">Preview</Label>
              <div className="rounded-2xl rounded-tl-sm bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3 text-sm">
                <p className="whitespace-pre-wrap">{renderPreview(body, values)}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !canSend}
            className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTemplateDialog({
  organizationId,
  onClose,
  onCreated,
}: {
  organizationId: string;
  onClose: () => void;
  onCreated: (t: WhatsAppTemplate) => void;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [language, setLanguage] = React.useState('en_US');
  const [category, setCategory] = React.useState<WhatsAppTemplateCategory>('UTILITY');
  const [headerMode, setHeaderMode] = React.useState<HeaderMode>('none');
  const [headerText, setHeaderText] = React.useState('');
  const [media, setMedia] = React.useState<UploadedMedia | null>(null);
  const [uploadingMedia, setUploadingMedia] = React.useState(false);
  const [bodyText, setBodyText] = React.useState('');
  const [footerText, setFooterText] = React.useState('');
  const [buttons, setButtons] = React.useState<TemplateButtonInput[]>([]);
  // Keyed by param index so we never run an effect to resize an array — the
  // visible inputs are derived from `paramCount` during render
  // (`rerender-derived-state-no-effect`). Stale keys above paramCount are simply
  // never read, and dropped on submit.
  const [examplesByIndex, setExamplesByIndex] = React.useState<Record<number, string>>({});
  const [saving, setSaving] = React.useState(false);

  // Derived during render — no effect, no second source of truth.
  const paramCount = React.useMemo(() => extractParamCount(bodyText), [bodyText]);
  const examples = React.useMemo(
    () => Array.from({ length: paramCount }, (_, i) => examplesByIndex[i] ?? ''),
    [paramCount, examplesByIndex],
  );

  const setExample = React.useCallback((i: number, v: string) => {
    setExamplesByIndex((prev) => ({ ...prev, [i]: v }));
  }, []);

  const nameValid = /^[a-z0-9_]*$/.test(name);
  const headerReady = headerMode !== 'media' || !!media;
  const canSubmit =
    !!name.trim() &&
    nameValid &&
    !!bodyText.trim() &&
    examples.every((e) => e.trim().length > 0) &&
    headerReady &&
    buttons.every(buttonValid) &&
    !uploadingMedia;

  const handleMediaFile = async (file: File) => {
    if (!user) return;
    setUploadingMedia(true);
    setMedia(null);
    try {
      const dataBase64 = await fileToBase64(file);
      const idToken = await user.getIdToken();
      const res = await uploadWhatsAppHeaderMedia(idToken, {
        organizationId,
        fileName: file.name,
        fileType: file.type,
        dataBase64,
      });
      if (res.success) setMedia({ format: res.data.format, handle: res.data.handle, fileName: file.name });
      else toast({ variant: 'destructive', title: 'Upload failed', description: res.error });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      const res = await createWhatsAppTemplate(idToken, {
        organizationId,
        name: name.trim(),
        language,
        category,
        bodyText: bodyText.trim(),
        bodyExample: examples.map((e) => e.trim()),
        headerText: headerMode === 'text' ? headerText.trim() || undefined : undefined,
        mediaHeader: headerMode === 'media' && media ? { format: media.format, handle: media.handle } : undefined,
        footerText: footerText.trim() || undefined,
        buttons: buttons.length ? buttons : undefined,
      });
      if (res.success) onCreated(res.data);
      else toast({ variant: 'destructive', title: 'Create failed', description: res.error });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create WhatsApp template</DialogTitle>
          <DialogDescription className="text-xs">
            Submitted to Meta for approval. Use <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code> … in the
            body for variables; give each a sample value so Meta can review it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="wa-tpl-name" className="text-[10px] font-semibold text-muted-foreground">Name</Label>
              <Input
                id="wa-tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="order_update"
                aria-invalid={!nameValid}
                aria-describedby={!nameValid ? 'wa-tpl-name-err' : undefined}
                className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4"
              />
              {!nameValid && (
                <p id="wa-tpl-name-err" role="alert" className="text-[10px] text-red-600 font-semibold">
                  Only lowercase letters, numbers, and underscores.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger aria-label="Template language" className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as WhatsAppTemplateCategory)}>
              <SelectTrigger aria-label="Template category" className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground">Header (optional)</Label>
            <div className="flex gap-1">
              {(['none', 'text', 'media'] as HeaderMode[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={headerMode === m ? 'default' : 'outline'}
                  onClick={() => setHeaderMode(m)}
                  className="rounded-lg h-8 px-3 text-xs font-bold capitalize"
                >
                  {m}
                </Button>
              ))}
            </div>
            {headerMode === 'text' && (
              <Input
                id="wa-tpl-header"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="e.g. Order update"
                maxLength={60}
                className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4"
              />
            )}
            {headerMode === 'media' && (
              <div className="rounded-xl bg-muted/10 p-3 space-y-2">
                <input
                  id="wa-tpl-media"
                  type="file"
                  accept="image/jpeg,image/png,video/mp4,video/3gpp,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleMediaFile(f);
                  }}
                  className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:font-bold file:text-white"
                />
                <p className="text-[10px] text-muted-foreground">
                  JPEG/PNG (≤5MB), MP4/3GP (≤16MB), or PDF (≤100MB).
                </p>
                {uploadingMedia && (
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                  </p>
                )}
                {media && !uploadingMedia && (
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> {media.format} · {media.fileName}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="wa-tpl-body" className="text-[10px] font-semibold text-muted-foreground">Body</Label>
            <Textarea
              id="wa-tpl-body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Hi {{1}}, your order {{2}} is on the way."
              rows={4}
              className="rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 py-3"
            />
          </div>

          {paramCount > 0 && (
            <div className="space-y-2 rounded-xl bg-muted/10 p-3">
              <Label className="text-[10px] font-semibold text-muted-foreground">
                Sample values (for Meta review)
              </Label>
              {examples.map((val, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Label htmlFor={`wa-tpl-ex-${i}`} className="text-[10px] font-mono text-muted-foreground w-10">
                    {`{{${i + 1}}}`}
                  </Label>
                  <Input
                    id={`wa-tpl-ex-${i}`}
                    value={val}
                    onChange={(e) => setExample(i, e.target.value)}
                    placeholder={i === 0 ? 'e.g. John' : 'e.g. #12345'}
                    className="h-9 rounded-lg bg-background border-none shadow-inner font-medium px-3"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Live WhatsApp-bubble preview — derived during render. */}
          {bodyText.trim() && (
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground">Preview</Label>
              <div className="rounded-2xl rounded-tl-sm bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3 text-sm space-y-1">
                {headerMode === 'text' && headerText.trim() && <p className="font-bold">{headerText.trim()}</p>}
                {headerMode === 'media' && media && (
                  <p className="text-[10px] font-semibold text-muted-foreground">📎 {media.format.toLowerCase()} header</p>
                )}
                <p className="whitespace-pre-wrap">{renderPreview(bodyText, examples)}</p>
                {footerText.trim() && <p className="text-[10px] text-muted-foreground">{footerText.trim()}</p>}
                {buttons.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {buttons.map((b, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-background px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-500/20"
                      >
                        {b.text.trim() || b.type.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="wa-tpl-footer" className="text-[10px] font-semibold text-muted-foreground">Footer (optional)</Label>
            <Input
              id="wa-tpl-footer"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="e.g. MineX360"
              maxLength={60}
              className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4"
            />
          </div>

          <ButtonsEditor buttons={buttons} onChange={setButtons} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !canSubmit}
            className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FilePlus2 className="h-4 w-4 mr-2" />}
            Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdoptDialog({
  template,
  organizationId,
  onClose,
  onAdopted,
}: {
  template: WhatsAppTemplate;
  organizationId: string;
  onClose: () => void;
  onAdopted: () => void;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const [params, setParams] = React.useState<string[]>(() => Array(template.paramCount).fill(''));
  const [saving, setSaving] = React.useState(false);

  const setParam = (i: number, v: string) =>
    setParams((prev) => prev.map((p, idx) => (idx === i ? v : p)));

  const canAdopt = params.every((p) => p.trim().length > 0);

  const handleAdopt = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      const res = await adoptWhatsAppTemplate(idToken, {
        organizationId,
        templateId: template.id,
        paramMap: params.map((p) => p.trim()),
        name: template.name,
      });
      if (res.success) onAdopted();
      else toast({ variant: 'destructive', title: 'Adopt failed', description: res.error });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adopt “{template.name}”</DialogTitle>
          <DialogDescription className="text-xs">
            Map each positional parameter to a variable key (e.g. <code>firstName</code>). These resolve
            from the same variables as email/SMS at send time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {template.paramCount === 0 ? (
            <p className="text-sm text-muted-foreground">This template has no parameters.</p>
          ) : (
            params.map((val, i) => (
              <div key={i} className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground">{`Parameter {{${i + 1}}}`}</Label>
                <Input
                  value={val}
                  onChange={(e) => setParam(i, e.target.value)}
                  placeholder="variable key, e.g. firstName"
                  className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4"
                />
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button
            onClick={handleAdopt}
            disabled={saving || (template.paramCount > 0 && !canAdopt)}
            className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Adopt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ButtonsEditor({
  buttons,
  onChange,
}: {
  buttons: TemplateButtonInput[];
  onChange: (b: TemplateButtonInput[]) => void;
}) {
  const add = (type: TemplateButtonInput['type']) => {
    if (buttons.length >= 10) return;
    onChange([...buttons, newButton(type)]);
  };
  const update = (
    i: number,
    patch: Partial<{ text: string; url: string; urlExample: string; phoneNumber: string }>,
  ) => onChange(buttons.map((b, idx) => (idx === i ? ({ ...b, ...patch } as TemplateButtonInput) : b)));
  const remove = (i: number) => onChange(buttons.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-[10px] font-semibold text-muted-foreground">Buttons (optional)</Label>
        <div className="flex gap-1">
          {(['QUICK_REPLY', 'URL', 'PHONE_NUMBER'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => add(t)}
              disabled={buttons.length >= 10}
              className="h-7 rounded-lg text-[10px] font-bold"
            >
              + {t === 'PHONE_NUMBER' ? 'Phone' : t === 'QUICK_REPLY' ? 'Quick reply' : 'URL'}
            </Button>
          ))}
        </div>
      </div>

      {buttons.map((b, i) => (
        <div key={i} className="rounded-xl bg-muted/10 p-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
              {b.type.replace('_', ' ')}
            </span>
            <Input
              value={b.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder="Button label"
              maxLength={25}
              className="h-8 rounded-lg bg-background border-none shadow-inner text-sm px-3"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => remove(i)}
              aria-label="Remove button"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {b.type === 'URL' && (
            <div className="space-y-1">
              <Input
                value={b.url}
                onChange={(e) => update(i, { url: e.target.value })}
                placeholder="https://example.com/{{1}}"
                className="h-8 rounded-lg bg-background border-none shadow-inner text-sm px-3"
              />
              {/\{\{\s*1\s*\}\}/.test(b.url) && (
                <Input
                  value={b.urlExample ?? ''}
                  onChange={(e) => update(i, { urlExample: e.target.value })}
                  placeholder="Sample full URL (for {{1}})"
                  className="h-8 rounded-lg bg-background border-none shadow-inner text-sm px-3"
                />
              )}
            </div>
          )}
          {b.type === 'PHONE_NUMBER' && (
            <Input
              value={b.phoneNumber}
              onChange={(e) => update(i, { phoneNumber: e.target.value })}
              placeholder="+233201234567"
              className="h-8 rounded-lg bg-background border-none shadow-inner text-sm px-3"
            />
          )}
        </div>
      ))}
    </div>
  );
}
