'use client';

/**
 * @fileOverview Shared building blocks for the WhatsApp template dialogs
 * (create / send-test / adopt). Extracted from the former `WhatsAppTemplatePanel`
 * so the dialogs can be reused from the unified templates page and lazy-loaded
 * independently.
 */
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import { isLikelyHttpUrl, MAX_TEMPLATE_BUTTONS } from '@/lib/whatsapp/whatsapp-domain';
import type { TemplateButtonInput, MediaHeaderFormat } from '@/lib/whatsapp/whatsapp-domain';
import type { StorableTemplateCategory } from '@/lib/types';

export type HeaderMode = 'none' | 'text' | 'media';
export type UploadedMedia = { format: MediaHeaderFormat; handle: string; fileName: string };
export type UploadResult = { success: boolean; handle?: string; format?: MediaHeaderFormat; error?: string };

// AUTHENTICATION omitted: it needs a fixed OTP/button structure this text-body
// builder can't produce, so Meta would auto-reject it. The create action's schema
// enforces the same constraint server-side.
export type CreateCategory = 'MARKETING' | 'UTILITY';
export const CATEGORIES: CreateCategory[] = ['UTILITY', 'MARKETING'];
export const LANGUAGES = ['en_US', 'en_GB', 'en', 'fr', 'es', 'pt_BR', 'ar'];

/**
 * An AI- or caller-provided draft used to pre-fill the create dialog. All fields
 * optional so an empty `{}` (or omission) yields the normal blank builder.
 */
export interface TemplateDraft {
  name?: string;
  category?: CreateCategory;
  bodyText?: string;
  bodyExamples?: string[];
  headerText?: string;
  footerText?: string;
  /** App-level library category (general/campaigns/…) — classification. */
  appCategory?: StorableTemplateCategory;
  /** Sub-type label (e.g. status_update). */
  templateType?: string;
  skeletonId?: string;
  paramVars?: Record<number, string>;
}

/**
 * Upload header media to the route handler with real upload progress. Uses XHR
 * because `fetch` can't report `upload.onprogress`. Resolves (never throws) with
 * the server's `{ success, ... }` body.
 */
export function uploadHeaderMedia(
  file: File,
  organizationId: string,
  idToken: string,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/whatsapp/upload-media');
    xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText) as UploadResult);
      } catch {
        resolve({ success: false, error: 'Unexpected server response.' });
      }
    };
    xhr.onerror = () => resolve({ success: false, error: 'Network error during upload.' });
    xhr.onabort = () => resolve({ success: false, error: 'Upload cancelled.' });
    signal.addEventListener('abort', () => xhr.abort());
    const fd = new FormData();
    fd.append('organizationId', organizationId);
    fd.append('file', file);
    xhr.send(fd);
  });
}

export function newButton(type: TemplateButtonInput['type']): TemplateButtonInput {
  if (type === 'URL') return { type: 'URL', text: '', url: '' };
  if (type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: '', phoneNumber: '' };
  return { type: 'QUICK_REPLY', text: '' };
}

/** UI-side validity mirror of the server rules (server still re-validates). */
export function buttonValid(b: TemplateButtonInput): boolean {
  if (!b.text.trim()) return false;
  if (b.type === 'URL') {
    if (!isLikelyHttpUrl(b.url)) return false;
    return !/\{\{\s*1\s*\}\}/.test(b.url) || !!b.urlExample?.trim();
  }
  if (b.type === 'PHONE_NUMBER') return !!b.phoneNumber.trim();
  return true;
}

// Hoisted so it isn't recreated per render (`js-hoist-regexp`).
const PREVIEW_PARAM_RE = /\{\{\s*(\d+)\s*\}\}/g;

/** Substitute {{n}} with its sample value, keeping the {{n}} token when blank. */
export function renderPreview(body: string, examples: string[]): string {
  return body.replace(PREVIEW_PARAM_RE, (_m, n: string) => {
    const v = examples[Number(n) - 1];
    return v && v.trim() ? v : `{{${n}}}`;
  });
}

export function ButtonsEditor({
  buttons,
  onChange,
}: {
  buttons: TemplateButtonInput[];
  onChange: (b: TemplateButtonInput[]) => void;
}) {
  const add = (type: TemplateButtonInput['type']) => {
    if (buttons.length >= MAX_TEMPLATE_BUTTONS) return;
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
              disabled={buttons.length >= MAX_TEMPLATE_BUTTONS}
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
