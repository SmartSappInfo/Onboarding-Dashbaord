'use client';

/**
 * Property panel generated from a block's declared `fields`. Replaces the
 * hand-written per-type switch in the old `BlockEditor` — adding a block no
 * longer means editing the panel. Each `BlockField.kind` maps to a control.
 */
import React, { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, X, Settings2, Upload, Loader2, FolderHeart } from 'lucide-react';
import { getBlock } from '@/lib/page-builder/registry';
import type { BlockField } from '@/lib/page-builder/fields';
import { genId } from '@/lib/page-builder/tree-operations';
import { uploadPageImage } from '@/lib/page-builder/upload';
import type { BuilderResources, PageBlock } from '@/lib/types';
import TipTapEditor from '@/app/admin/pages/[id]/builder/components/TipTapEditor';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';

const INPUT_CLASS =
  'h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50';
const TEXTAREA_CLASS =
  'w-full min-h-[80px] rounded-xl bg-slate-800 border border-slate-700 p-3 text-xs font-semibold text-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ImageField({ label, value, workspaceId, onChange }: {
  label: string;
  value: string;
  workspaceId?: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const handleFile = async (file: File) => {
    if (!workspaceId) return;
    setUploading(true);
    try {
      onChange(await uploadPageImage(file, workspaceId));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <Input aria-label={label} value={value} placeholder="https://..." onChange={(e) => onChange(e.target.value)} className={`${INPUT_CLASS} flex-1`} />
        {value ? (
          <div className="h-10 w-10 rounded-lg border border-slate-700 overflow-hidden bg-slate-800 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="preview" className="w-full h-full object-cover" />
          </div>
        ) : null}
      </div>
      <div className="flex gap-2 flex-wrap">
        {workspaceId ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()} className="h-8 text-[10px] font-bold bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-400">
              {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
              {uploading ? 'Uploading…' : 'Upload image'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setLibraryOpen(true)} className="h-8 text-[10px] font-bold bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-400">
              <FolderHeart className="w-3 h-3 mr-1" />
              Select from Gallery
            </Button>
            <MediaSelectorDialog
              open={libraryOpen}
              onOpenChange={setLibraryOpen}
              onSelectAsset={(asset) => {
                onChange(asset.url);
                setLibraryOpen(false);
              }}
              filterType="image"
              workspaceId={workspaceId}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function UrlField({ label, value, placeholder, workspaceId, onChange }: {
  label: string;
  value: string;
  placeholder?: string;
  workspaceId?: string;
  onChange: (value: string) => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Input aria-label={label} value={value} placeholder={placeholder || "https://..."} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} />
      {workspaceId ? (
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => setLibraryOpen(true)} className="h-8 text-[10px] font-bold bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-400">
            <FolderHeart className="w-3 h-3 mr-1" />
            Select from Gallery
          </Button>
          <MediaSelectorDialog
            open={libraryOpen}
            onOpenChange={setLibraryOpen}
            onSelectAsset={(asset) => {
              onChange(asset.url);
              setLibraryOpen(false);
            }}
            workspaceId={workspaceId}
          />
        </>
      ) : null}
    </div>
  );
}

interface FieldControlProps {
  field: BlockField;
  value: unknown;
  resources: BuilderResources;
  workspaceId?: string;
  onChange: (value: unknown) => void;
}

export function FieldControl({ field, value, resources, workspaceId, onChange }: FieldControlProps) {
  switch (field.kind) {
    case 'text':
      return (
        <Input aria-label={field.label} value={asString(value)} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} />
      );
    case 'url':
      return (
        <UrlField label={field.label} value={asString(value)} placeholder={field.placeholder} workspaceId={workspaceId} onChange={(v) => onChange(v)} />
      );
    case 'textarea':
      return (
        <textarea aria-label={field.label} value={asString(value)} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className={TEXTAREA_CLASS} />
      );
    case 'richtext':
      return <TipTapEditor content={asString(value)} onChange={(html) => onChange(html)} />;
    case 'image':
      return <ImageField label={field.label} value={asString(value)} workspaceId={workspaceId} onChange={(v) => onChange(v)} />;
    case 'number':
      return (
        <Input aria-label={field.label} type="number" min={field.min} max={field.max} step={field.step} value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(Number(e.target.value))} className={INPUT_CLASS} />
      );
    case 'slider':
      return (
        <input aria-label={field.label} type="range" min={field.min} max={field.max} step={field.step} value={typeof value === 'number' ? value : field.min} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-emerald-500" />
      );
    case 'color':
      return (
        <div className="flex items-center gap-3">
          <input aria-label={`${field.label} swatch`} type="color" value={asString(value) || '#000000'} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded-lg border border-slate-700 cursor-pointer bg-transparent" />
          <Input aria-label={field.label} value={asString(value)} placeholder="#000000" onChange={(e) => onChange(e.target.value)} className={`${INPUT_CLASS} flex-1 font-mono`} />
        </div>
      );
    case 'boolean':
      return <Switch aria-label={field.label} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />;
    case 'select':
      return (
        <Select value={asString(value)} onValueChange={(val) => onChange(val)}>
          <SelectTrigger aria-label={field.label} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'resource': {
      let list: ReadonlyArray<{ id: string; label: string }> = [];
      if (field.resource === 'form') {
        list = (resources.forms || []).map((f) => ({ id: f.id, label: f.internalName ?? f.title }));
      } else if (field.resource === 'survey') {
        list = (resources.surveys || []).map((s) => ({ id: s.id, label: s.title }));
      } else if (field.resource === 'agreement') {
        list = (resources.agreements || []).map((a) => ({ id: a.id, label: a.title }));
      } else if (field.resource === 'meeting') {
        list = (resources.meetings || [])
          .filter((m) => m.status !== 'ended' && m.status !== 'cancelled')
          .map((m) => ({ id: m.id, label: m.title }));
      } else if (field.resource === 'qr') {
        list = (resources.qrCodes || []).map((q) => ({ id: q.id, label: q.title }));
      }
      return (
        <Select value={asString(value)} onValueChange={(val) => onChange(val)}>
          <SelectTrigger aria-label={field.label} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200">
            <SelectValue placeholder={`Choose a ${field.resource}...`} />
          </SelectTrigger>
          <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
            {list.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-xs">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case 'list':
      return <ListField field={field} value={Array.isArray(value) ? value : []} resources={resources} workspaceId={workspaceId} onChange={(next) => onChange(next)} />;
    case 'animation':
      return (
        <Select value={asString(value)} onValueChange={(val) => onChange(val)}>
          <SelectTrigger aria-label={field.label} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200"><SelectValue placeholder="No animation" /></SelectTrigger>
          <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
            <SelectItem value="none" className="text-xs">None</SelectItem>
            <SelectItem value="fade-in" className="text-xs">Fade In</SelectItem>
            <SelectItem value="slide-up" className="text-xs">Slide Up</SelectItem>
            <SelectItem value="slide-down" className="text-xs">Slide Down</SelectItem>
            <SelectItem value="slide-left" className="text-xs">Slide Left</SelectItem>
            <SelectItem value="slide-right" className="text-xs">Slide Right</SelectItem>
            <SelectItem value="zoom-in" className="text-xs">Zoom In</SelectItem>
          </SelectContent>
        </Select>
      );
    case 'font-family':
      return (
        <Select value={asString(value)} onValueChange={(val) => onChange(val)}>
          <SelectTrigger aria-label={field.label} className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200"><SelectValue placeholder="Default Font" /></SelectTrigger>
          <SelectContent className="rounded-xl bg-slate-800 border-slate-700">
            <SelectItem value="heading" className="text-xs">Heading Font</SelectItem>
            <SelectItem value="body" className="text-xs">Body Font</SelectItem>
            <SelectItem value="sans" className="text-xs">Sans-Serif</SelectItem>
            <SelectItem value="serif" className="text-xs">Serif</SelectItem>
            <SelectItem value="mono" className="text-xs">Monospace</SelectItem>
          </SelectContent>
        </Select>
      );
    case 'gradient':
      return (
        <div className="flex gap-2">
          <Input aria-label={`${field.label} Start`} value={asString(value)} placeholder="from" onChange={(e) => onChange(e.target.value)} className={`${INPUT_CLASS} flex-1`} />
        </div>
      );
  }
}

interface ListFieldProps {
  field: Extract<BlockField, { kind: 'list' }>;
  value: unknown[];
  resources: BuilderResources;
  workspaceId?: string;
  onChange: (value: unknown[]) => void;
}

function ListField({ field, value, resources, workspaceId, onChange }: ListFieldProps) {
  const items = value.map((it) => (isRecord(it) ? it : {}));

  const addItem = () => {
    const item: Record<string, unknown> = { id: genId('item') };
    for (const f of field.itemFields) item[f.key] = '';
    onChange([...items, item]);
  };
  const updateItem = (idx: number, patch: Record<string, unknown>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-bold text-slate-400 uppercase">{field.label}</Label>
        <Button variant="ghost" size="sm" onClick={addItem} className="h-7 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10">
          <PlusCircle className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={asString(item.id) || idx} className="p-3 bg-slate-800 rounded-xl border border-slate-700 relative space-y-2">
            <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="absolute top-1 right-1 h-5 w-5 p-0 text-slate-500 hover:text-red-400">
              <X className="w-3 h-3" />
            </Button>
            {field.itemFields.map((itf) => (
              <div key={itf.key} className="space-y-1">
                <Label className="text-[9px] font-bold text-slate-500 uppercase">{itf.label}</Label>
                <FieldControl field={itf} value={item[itf.key]} resources={resources} workspaceId={workspaceId} onChange={(v) => updateItem(idx, { [itf.key]: v })} />
              </div>
            ))}
          </div>
        ))}
        {items.length === 0 ? <p className="text-[10px] text-slate-500 text-center py-3 italic">No items yet</p> : null}
      </div>
    </div>
  );
}

interface AutoBlockEditorProps {
  block: PageBlock | null;
  resources: BuilderResources;
  workspaceId?: string;
  onUpdateProps: (blockId: string, patch: Record<string, unknown>) => void;
}

export function AutoBlockEditor({ block, resources, workspaceId, onUpdateProps }: AutoBlockEditorProps) {
  if (!block) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60 py-20">
        <Settings2 className="w-8 h-8 text-slate-500" />
        <div>
          <p className="text-sm font-semibold text-slate-300">No block selected</p>
          <p className="text-[10px] text-slate-500 mt-1">Select a block on the canvas to edit its properties.</p>
        </div>
      </div>
    );
  }

  const def = getBlock(block.type);
  if (!def) {
    return <p className="text-xs text-slate-500 text-center py-8">No editor for “{block.type}”.</p>;
  }

  const parsed = def.schema.safeParse({ ...def.defaults, ...block.props });
  const props: Record<string, unknown> = parsed.success ? parsed.data : def.defaults;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">{def.label} Block</h4>
        <Badge variant="outline" className="text-[9px] uppercase bg-slate-800 border-slate-700 text-slate-400">{block.type}</Badge>
      </div>

      {def.fields.length === 0 ? (
        <p className="text-[10px] text-slate-500 italic">This block has no editable properties.</p>
      ) : (
        <div className="space-y-4">
          {def.fields.map((field) => {
            // Conditional field visibility for CTA Block actions
            if (block.type === 'cta') {
              if (field.key === 'url' && props.actionType !== 'url') return null;
              if (field.key === 'formId' && props.actionType !== 'form') return null;
              if (field.key === 'surveyId' && props.actionType !== 'survey') return null;
              if (field.key === 'meetingId' && props.actionType !== 'meeting') return null;
              if (field.key === 'qrId' && props.actionType !== 'qr') return null;
            }

            return (
              <div key={field.key} className="space-y-2">
                {field.kind !== 'list' ? (
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">{field.label}</Label>
                ) : null}
                <FieldControl field={field} value={props[field.key]} resources={resources} workspaceId={workspaceId} onChange={(v) => onUpdateProps(block.id, { [field.key]: v })} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
