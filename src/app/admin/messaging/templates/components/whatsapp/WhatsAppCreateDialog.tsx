'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, FilePlus2, Loader2 } from 'lucide-react';
import { createWhatsAppTemplate } from '@/lib/whatsapp-template-actions';
import { registerSkeletonWhatsAppAction } from '@/app/actions/register-skeleton-whatsapp-action';
import { extractParamCount } from '@/lib/whatsapp/whatsapp-domain';
import type { TemplateButtonInput } from '@/lib/whatsapp/whatsapp-domain';
import type { WhatsAppTemplate } from '@/lib/whatsapp/whatsapp-types';
import type { StorableTemplateCategory } from '@/lib/types';
import { APP_TEMPLATE_CATEGORIES } from '@/lib/types';
import {
  ButtonsEditor,
  CATEGORIES,
  LANGUAGES,
  buttonValid,
  renderPreview,
  uploadHeaderMedia,
  type CreateCategory,
  type HeaderMode,
  type TemplateDraft,
  type UploadedMedia,
} from './shared';

interface WhatsAppCreateDialogProps {
  organizationId: string;
  onClose: () => void;
  onCreated: (t: WhatsAppTemplate) => void;
  /** Optional AI/caller-supplied draft to pre-fill the builder. */
  initialDraft?: TemplateDraft;
  /** Available variable keys for mapping positional params (datalist hints). */
  variables?: ReadonlyArray<{ key: string }>;
}

export default function WhatsAppCreateDialog({
  organizationId,
  onClose,
  onCreated,
  initialDraft,
  variables = [],
}: WhatsAppCreateDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [name, setName] = React.useState(initialDraft?.name ?? '');
  const [skeletonId] = React.useState(initialDraft?.skeletonId ?? '');
  const [language, setLanguage] = React.useState('en_US');
  const [category, setCategory] = React.useState<CreateCategory>(initialDraft?.category ?? 'UTILITY');
  const [appCategory, setAppCategory] = React.useState<StorableTemplateCategory>(initialDraft?.appCategory ?? 'general');
  const [templateType, setTemplateType] = React.useState(initialDraft?.templateType ?? '');
  // Positional {{n}} → variable-key mapping, keyed by index (derived list below).
  const [paramVarsByIndex, setParamVarsByIndex] = React.useState<Record<number, string>>(() => initialDraft?.paramVars ?? {});
  const [headerMode, setHeaderMode] = React.useState<HeaderMode>(initialDraft?.headerText ? 'text' : 'none');
  const [headerText, setHeaderText] = React.useState(initialDraft?.headerText ?? '');
  const [media, setMedia] = React.useState<UploadedMedia | null>(null);
  const [uploadingMedia, setUploadingMedia] = React.useState(false);
  const [uploadPct, setUploadPct] = React.useState(0);
  const uploadAbortRef = React.useRef<AbortController | null>(null);
  // Abort an in-flight upload if the dialog unmounts mid-upload.
  React.useEffect(() => () => uploadAbortRef.current?.abort(), []);
  const [bodyText, setBodyText] = React.useState(initialDraft?.bodyText ?? '');
  const [footerText, setFooterText] = React.useState(initialDraft?.footerText ?? '');
  const [buttons, setButtons] = React.useState<TemplateButtonInput[]>([]);
  // Keyed by param index so we never run an effect to resize an array — the visible
  // inputs are derived from `paramCount` during render
  // (`rerender-derived-state-no-effect`). Stale keys above paramCount are never
  // read, and dropped on submit.
  const [examplesByIndex, setExamplesByIndex] = React.useState<Record<number, string>>(() => {
    const seed: Record<number, string> = {};
    (initialDraft?.bodyExamples ?? []).forEach((v, i) => {
      seed[i] = v;
    });
    return seed;
  });
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

  // Variable keys per positional param — derived from paramCount during render.
  const paramVars = React.useMemo(
    () => Array.from({ length: paramCount }, (_, i) => paramVarsByIndex[i] ?? ''),
    [paramCount, paramVarsByIndex],
  );
  const setParamVar = React.useCallback((i: number, v: string) => {
    setParamVarsByIndex((prev) => ({ ...prev, [i]: v.trim().replace(/\s+/g, '_') }));
  }, []);
  // A complete map (all params mapped) lets the template auto-enable on approval.
  const paramMap = paramVars.every((v) => v.trim().length > 0) ? paramVars.map((v) => v.trim()) : undefined;

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
    setUploadPct(0);
    setMedia(null);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const idToken = await user.getIdToken();
      const res = await uploadHeaderMedia(file, organizationId, idToken, setUploadPct, controller.signal);
      if (res.success && res.handle && res.format) {
        setMedia({ format: res.format, handle: res.handle, fileName: file.name });
      } else if (res.error !== 'Upload cancelled.') {
        toast({ variant: 'destructive', title: 'Upload failed', description: res.error });
      }
    } finally {
      setUploadingMedia(false);
      uploadAbortRef.current = null;
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
        appCategory,
        templateType: templateType.trim() || undefined,
        paramMap,
      });
      if (res.success) {
        if (skeletonId) {
          await registerSkeletonWhatsAppAction(idToken, organizationId, skeletonId, name.trim(), language, paramMap ?? []);
        }
        onCreated(res.data);
      } else {
        toast({ variant: 'destructive', title: 'Create failed', description: res.error });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e instanceof Error ? e.message : 'Unknown error' });
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground">Meta category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as CreateCategory)}>
                <SelectTrigger aria-label="Meta template category" className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground">Library category</Label>
              <Select value={appCategory} onValueChange={(v) => setAppCategory(v as StorableTemplateCategory)}>
                <SelectTrigger aria-label="Library category" className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_TEMPLATE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wa-tpl-type" className="text-[10px] font-semibold text-muted-foreground">Type (optional)</Label>
              <Input
                id="wa-tpl-type"
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                placeholder="e.g. status_update"
                className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4"
              />
            </div>
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
                  disabled={uploadingMedia}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleMediaFile(f);
                  }}
                  className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:font-bold file:text-white disabled:opacity-50"
                />
                <p className="text-[10px] text-muted-foreground">
                  JPEG/PNG (≤5MB), MP4/3GP (≤16MB), or PDF (≤30MB).
                </p>
                {uploadingMedia && (
                  <div className="space-y-1">
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading… {uploadPct}%
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-emerald-600 transition-all" style={{ width: `${uploadPct}%` }} />
                    </div>
                  </div>
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
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[10px] font-semibold text-muted-foreground">
                  Parameters — sample value &amp; variable
                </Label>
                <span className="text-[9px] font-medium text-muted-foreground/70">
                  Map all to auto-enable for campaigns
                </span>
              </div>
              <datalist id="wa-tpl-varkeys">
                {variables.map((v) => <option key={v.key} value={v.key} />)}
              </datalist>
              {examples.map((val, i) => (
                <div key={i} className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2">
                  <Label htmlFor={`wa-tpl-ex-${i}`} className="text-[10px] font-mono text-muted-foreground">
                    {`{{${i + 1}}}`}
                  </Label>
                  <Input
                    id={`wa-tpl-ex-${i}`}
                    value={val}
                    onChange={(e) => setExample(i, e.target.value)}
                    placeholder={i === 0 ? 'sample e.g. John' : 'sample e.g. #12345'}
                    className="h-9 rounded-lg bg-background border-none shadow-inner font-medium px-3"
                  />
                  <Input
                    id={`wa-tpl-var-${i}`}
                    list="wa-tpl-varkeys"
                    value={paramVars[i]}
                    onChange={(e) => setParamVar(i, e.target.value)}
                    placeholder="variable e.g. firstName"
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
