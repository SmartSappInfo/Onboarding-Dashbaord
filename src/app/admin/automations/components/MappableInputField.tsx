'use client';

import * as React from 'react';
import { 
  Brackets, 
  Search, 
  Database, 
  Activity, 
  HelpCircle,
  Globe,
  X,
  Settings
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from '@/components/ui/popover';
import { FallbackEditorModal } from '@/components/shared/FallbackEditorModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Accordion, 
  AccordionItem, 
  AccordionTrigger, 
  AccordionContent 
} from '@/components/ui/accordion';
import { useFirestore } from '@/firebase';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface AppFieldItem {
  id?: string;
  name?: string;
  label?: string;
}

interface MappableInputFieldProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  isTextArea?: boolean;
  appFields?: AppFieldItem[];
}

interface FlatKeyItem {
  key: string;
  val: unknown;
}

interface CapturedWebhookPayload {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  files?: Array<{ name?: string; size?: number; type?: string }>;
}

interface VariableItem {
  key: string;
  fullKey?: string;
  label: string;
  val: string;
  rawVal?: unknown;
  group: 'webhook' | 'entity' | 'workspace';
}

function formatValuePreview(val: unknown): string {
  if (val === null || val === undefined) return 'none';
  if (typeof val === 'string') return val.trim() || '""';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return '[] (empty)';
    if (typeof val[0] === 'object' && val[0] !== null) {
      return `${val.length} item${val.length > 1 ? 's' : ''}`;
    }
    return val.slice(0, 3).map(String).join(', ') + (val.length > 3 ? '...' : '');
  }
  if (typeof val === 'object') {
    return '{...}';
  }
  return String(val);
}

function getFlatKeys(obj: Record<string, unknown> | unknown, prefix = ''): FlatKeyItem[] {
  if (!obj || typeof obj !== 'object') return [];
  const res: FlatKeyItem[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      res.push(...getFlatKeys(value as Record<string, unknown>, path));
    } else if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        // Flatten first array item for convenient mapping (e.g. entityContacts[0].name)
        res.push(...getFlatKeys(value[0] as Record<string, unknown>, `${path}[0]`));
        res.push({ key: path, val: value });
      } else {
        res.push({ key: path, val: value });
      }
    } else {
      res.push({ key: path, val: value });
    }
  }
  return res;
}

function parseVariables(text: string) {
  if (typeof text !== 'string') return [];
  const regex = /\{\{(.*?)\}\}/g;
  const parts: { type: 'text' | 'variable'; value: string; fallback?: string; raw: string }[] = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        value: text.substring(lastIndex, match.index),
        raw: text.substring(lastIndex, match.index)
      });
    }
    const tokenVal = match[1].trim();
    const tokenParts = tokenVal.split(/\|\||\|/);
    const key = tokenParts[0].trim();
    const fallback = tokenParts.length > 1 ? tokenParts.slice(1).join('|').trim() : undefined;
    parts.push({
      type: 'variable',
      value: key,
      fallback,
      raw: match[0]
    });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      value: text.substring(lastIndex),
      raw: text.substring(lastIndex)
    });
  }
  return parts;
}

/**
 * ARCHITECTURAL NOTE: Rule 10 Maintainer Protocol
 * Checks whether typing '/' at the specified cursor position should trigger the
 * variables and values palette.
 * 
 * Triggers when '/' is:
 * - At the beginning of the text (pos === 1)
 * - Preceded by whitespace (space, tab, newline)
 * - Preceded by opening punctuation/delimiters (e.g. '(', '[', '{', ':', ',', '=', '>')
 * 
 * Does NOT trigger when '/' is:
 * - Embedded inside a word (e.g. 'and/or', 'w/o')
 * - Part of a URL or double-slash (e.g. 'http://', '//')
 * - Preceded by digits (e.g. '1/2', '2024/09')
 */
export function isSlashTriggerMatch(text: string, cursorPos: number): boolean {
  if (cursorPos <= 0 || cursorPos > text.length) return false;
  if (text[cursorPos - 1] !== '/') return false;

  if (cursorPos === 1) return true;

  const charBefore = text[cursorPos - 2];

  // If preceded by another slash, do not trigger (e.g. '//')
  if (charBefore === '/') return false;

  // If preceded by whitespace (newline, space, tab), trigger
  if (/\s/.test(charBefore)) return true;

  // If preceded by opening brackets '(', '[', '{', trigger
  if (/[\(\[\{]/.test(charBefore)) return true;

  // Otherwise, do not trigger for letters, digits, colons, or punctuation
  return false;
}

/**
 * ARCHITECTURAL NOTE: Rule 10 Maintainer Protocol
 * Resolves the next text value and cursor position when inserting a variable token `{{varName}}`.
 * If the insertion was triggered by a slash command or there is a '/' immediately before
 * the insertion point, the triggering '/' is replaced cleanly by the token.
 */
export function resolveSlashInsertion(
  value: string,
  cursorStart: number,
  cursorEnd: number,
  varName: string,
  isSlashTrigger: boolean,
  slashIndex: number | null
): { nextValue: string; nextCursorPos: number } {
  const insertion = `{{${varName}}}`;
  const start = Math.max(0, Math.min(cursorStart, value.length));
  const end = Math.max(start, Math.min(cursorEnd, value.length));

  let replaceStart = start;
  let replaceEnd = end;

  if (isSlashTrigger && slashIndex !== null && slashIndex >= 0 && slashIndex < value.length && value[slashIndex] === '/') {
    replaceStart = slashIndex;
    replaceEnd = Math.max(end, slashIndex + 1);
  } else if (isSlashTrigger || (start > 0 && value[start - 1] === '/')) {
    if (start > 0 && value[start - 1] === '/') {
      replaceStart = start - 1;
    }
  }

  const nextValue = value.substring(0, replaceStart) + insertion + value.substring(replaceEnd);
  const nextCursorPos = replaceStart + insertion.length;

  return { nextValue, nextCursorPos };
}

export function MappableInputField({
  value = '',
  onChange,
  placeholder,
  className,
  inputClassName,
  isTextArea = false,
  appFields = [],
}: MappableInputFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [anchorWidth, setAnchorWidth] = React.useState<number | null>(null);

  const slashTriggerActiveRef = React.useRef(false);
  const slashTriggerIndexRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  React.useEffect(() => {
    if (!open) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0) {
          setAnchorWidth(rect.width);
        }
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [open]);

  const firestore = useFirestore();
  const params = useParams();
  const automationId = params.id as string;
  const [capturedPayload, setCapturedPayload] = React.useState<CapturedWebhookPayload | null>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingVarKey, setEditingVarKey] = React.useState('');
  const [editingVarCurrentFallback, setEditingVarCurrentFallback] = React.useState('');
  const [editingVarPartIndex, setEditingVarPartIndex] = React.useState<number | null>(null);

  const handleSaveFallback = (fallbackVal: string) => {
    if (editingVarPartIndex === null) return;
    const parts = parseVariables(value);
    const nextVal = parts
      .map((p, idx) => {
        if (idx === editingVarPartIndex) {
          const cleanFallback = fallbackVal.trim();
          return cleanFallback ? `{{${p.value} | ${cleanFallback}}}` : `{{${p.value}}}`;
        }
        return p.type === 'variable'
          ? (p.fallback ? `{{${p.value} | ${p.fallback}}}` : `{{${p.value}}}`)
          : p.raw;
      })
      .join('');
    onChange(nextVal);
    setModalOpen(false);
    setEditingVarPartIndex(null);
  };

  React.useEffect(() => {
    if (!firestore || !automationId || automationId === 'new') return;
    const unsub = onSnapshot(doc(firestore, 'automations', automationId), (snapshot) => {
      if (snapshot.exists()) {
        const autoData = snapshot.data();
        if (autoData?.latestCapturedWebhook) {
          setCapturedPayload(autoData.latestCapturedWebhook as CapturedWebhookPayload);
        } else {
          const webhookTrigger = autoData?.triggers?.find((t: { type?: string }) => t.type === 'WEBHOOK_RECEIVED');
          if (webhookTrigger?.config?.capturedPayload) {
            setCapturedPayload(webhookTrigger.config.capturedPayload as CapturedWebhookPayload);
          } else {
            setCapturedPayload(null);
          }
        }
      }
    });
    return () => unsub();
  }, [firestore, automationId]);

  // Derive variables lists with core variable names and clean values
  const webhookVariables = React.useMemo<VariableItem[]>(() => {
    if (!capturedPayload) return [];
    
    // 1. Core Webhook Body Properties (clean variable names without 1.body. prefix)
    const bodyKeys: VariableItem[] = getFlatKeys(capturedPayload.body || {}).map(item => ({
      key: item.key, // Core variable name: e.g. "arrearsBalance", "phone", "email"
      fullKey: `1.body.${item.key}`,
      label: item.key,
      val: formatValuePreview(item.val),
      rawVal: item.val,
      group: 'webhook',
    }));
    
    // 2. Webhook Headers (optional)
    const headerKeys: VariableItem[] = Object.entries(capturedPayload.headers || {}).map(([k, v]) => ({
      key: `headers.${k}`,
      fullKey: `1.headers.${k}`,
      label: `header: ${k}`,
      val: formatValuePreview(v),
      rawVal: v,
      group: 'webhook',
    }));
    
    // 3. Webhook Query Parameters (optional)
    const queryKeys: VariableItem[] = Object.entries(capturedPayload.query || {}).map(([k, v]) => ({
      key: `query.${k}`,
      fullKey: `1.query.${k}`,
      label: `query: ${k}`,
      val: formatValuePreview(v),
      rawVal: v,
      group: 'webhook',
    }));
    
    // 4. Webhook Files (optional)
    const fileKeys: VariableItem[] = (capturedPayload.files || []).flatMap((file: { name?: string; size?: number; type?: string }, idx: number) => [
      { key: `files[${idx}].name`, fullKey: `1.files[${idx}].name`, label: `files[${idx}].name`, val: file.name || 'none', rawVal: file.name, group: 'webhook' as const },
      { key: `files[${idx}].size`, fullKey: `1.files[${idx}].size`, label: `files[${idx}].size`, val: file.size ? `${(file.size / 1024).toFixed(1)} KB` : '0 KB', rawVal: file.size, group: 'webhook' as const },
      { key: `files[${idx}].type`, fullKey: `1.files[${idx}].type`, label: `files[${idx}].type`, val: file.type || 'none', rawVal: file.type, group: 'webhook' as const }
    ]);

    return [...bodyKeys, ...headerKeys, ...queryKeys, ...fileKeys];
  }, [capturedPayload]);

  const entityVariables = React.useMemo<VariableItem[]>(() => {
    const native: VariableItem[] = [
      { key: 'entity.displayName', label: 'Display Name', val: 'e.g. Acme Corp', group: 'entity' },
      { key: 'entity.primaryEmail', label: 'Primary Email', val: 'e.g. info@acme.com', group: 'entity' },
      { key: 'entity.primaryPhone', label: 'Primary Phone', val: 'e.g. +1234567890', group: 'entity' },
      { key: 'entity.assignedTo', label: 'Account Manager ID', val: 'e.g. usr_789', group: 'entity' },
    ];
    const custom: VariableItem[] = (appFields || []).map((f) => ({
      key: `entity.${f.id || f.name}`,
      label: f.label || f.name || 'Custom Field',
      val: `Custom: ${f.label || f.name}`,
      group: 'entity',
    }));
    return [...native, ...custom];
  }, [appFields]);

  const workspaceVariables = React.useMemo<VariableItem[]>(() => [
    { key: 'workspace.id', label: 'Workspace ID', val: 'e.g. ws_555', group: 'workspace' },
  ], []);

  const allVariables = React.useMemo<VariableItem[]>(() => {
    return [...webhookVariables, ...entityVariables, ...workspaceVariables];
  }, [webhookVariables, entityVariables, workspaceVariables]);

  const filteredVariables = React.useMemo<VariableItem[]>(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allVariables;
    return allVariables.filter(v => 
      v.key.toLowerCase().includes(q) || 
      v.label.toLowerCase().includes(q) || 
      v.val.toLowerCase().includes(q) ||
      (v.fullKey && v.fullKey.toLowerCase().includes(q))
    );
  }, [allVariables, searchQuery]);

  const insertVariable = (varName: string) => {
    const el = inputRef.current;
    const isTrigger = slashTriggerActiveRef.current;
    const slashIdx = slashTriggerIndexRef.current;

    if (!el) {
      const cleanVal = (isTrigger && value.endsWith('/')) ? value.slice(0, -1) : value;
      onChange(cleanVal + `{{${varName}}}`);
      setOpen(false);
      slashTriggerActiveRef.current = false;
      slashTriggerIndexRef.current = null;
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;

    const { nextValue, nextCursorPos } = resolveSlashInsertion(
      value,
      start,
      end,
      varName,
      isTrigger,
      slashIdx
    );

    onChange(nextValue);
    setOpen(false);
    slashTriggerActiveRef.current = false;
    slashTriggerIndexRef.current = null;

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(nextCursorPos, nextCursorPos);
    }, 50);
  };

  const groupItems = (groupName: 'webhook' | 'entity' | 'workspace') => {
    return filteredVariables.filter(v => v.group === groupName);
  };

  const webhookGroup = groupItems('webhook');
  const entityGroup = groupItems('entity');
  const workspaceGroup = groupItems('workspace');

  // Check if we should render the inline pills display view
  const showPillsView = !isFocused && !open && typeof value === 'string' && value.includes('{{');

  let inputElement = null;
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === '/') {
      const target = e.currentTarget;
      const start = target.selectionStart ?? target.value.length;
      const textBefore = target.value.substring(0, start);
      const charBefore = textBefore.length > 0 ? textBefore[textBefore.length - 1] : '';

      const isValidSlashTrigger =
        textBefore.length === 0 ||
        /\s/.test(charBefore) ||
        /[\(\[\{:,=>]/.test(charBefore);

      if (isValidSlashTrigger) {
        slashTriggerActiveRef.current = true;
        slashTriggerIndexRef.current = start;
        setSearchQuery('');
        setOpen(true);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    const target = e.target;
    const cursorPos = target.selectionStart ?? newVal.length;

    // Detect slash typed via virtual keyboard, copy-paste single character, or fast IME input
    if (cursorPos > 0 && newVal[cursorPos - 1] === '/') {
      const textBeforeSlash = newVal.substring(0, cursorPos - 1);
      const charBefore = textBeforeSlash.length > 0 ? textBeforeSlash[textBeforeSlash.length - 1] : '';
      const isValidSlashTrigger =
        textBeforeSlash.length === 0 ||
        /\s/.test(charBefore) ||
        /[\(\[\{:,=>]/.test(charBefore);

      if (isValidSlashTrigger && !open) {
        slashTriggerActiveRef.current = true;
        slashTriggerIndexRef.current = cursorPos - 1;
        setSearchQuery('');
        setOpen(true);
      }
    }

    onChange(newVal);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      slashTriggerActiveRef.current = false;
      slashTriggerIndexRef.current = null;
    }
  };

  if (showPillsView) {
    const parts = parseVariables(value);
    inputElement = (
      <div 
        className={cn(
          'w-full rounded-xl bg-card border font-semibold text-xs min-h-[40px] shadow-sm flex flex-wrap items-center px-3 py-1.5 gap-1.5 border-input cursor-text select-none',
          isTextArea && 'min-h-[80px] items-start align-top',
          inputClassName
        )}
        onClick={() => {
          setIsFocused(true);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 50);
        }}
      >
        {parts.map((part, idx) => {
          if (part.type === 'variable') {
            const variableKey = part.value;
            const variableInfo = allVariables.find(v => v.key === variableKey || v.fullKey === variableKey);
            const group = variableInfo?.group || (
              variableKey.startsWith('entity.') ? 'entity' :
              variableKey.startsWith('workspace.') ? 'workspace' :
              'webhook'
            );
            const rawLabel = variableInfo?.label || variableKey;
            // Strip group prefixes to make label friendly and short
            const friendlyLabel = rawLabel.replace(/^(1\.)?body\./, '')
                                          .replace(/^(1\.)?headers\./, 'header:')
                                          .replace(/^(1\.)?query\./, 'query:')
                                          .replace(/^entity\./, '')
                                          .replace(/^workspace\./, 'workspace:');

            // Group-based styling
            let groupColors = 'bg-muted text-muted-foreground border-border/50';
            let GroupIcon = Brackets;
            if (group === 'webhook') {
              groupColors = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
              GroupIcon = Globe;
            } else if (group === 'entity') {
              groupColors = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
              GroupIcon = Database;
            } else if (group === 'workspace') {
              groupColors = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
              GroupIcon = Activity;
            }

            return (
              <span 
                key={idx}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono border shadow-sm transition-all hover:bg-opacity-85 cursor-pointer',
                  groupColors
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
              >
                <GroupIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate max-w-[150px]">
                  {friendlyLabel}
                  {part.fallback && (
                    <span className="text-slate-400 font-normal ml-1">({part.fallback})</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingVarKey(variableKey);
                    setEditingVarCurrentFallback(part.fallback || '');
                    setEditingVarPartIndex(idx);
                    setModalOpen(true);
                  }}
                  className="hover:bg-foreground/15 p-0.5 rounded transition-colors inline-flex items-center justify-center ml-0.5 hover:text-emerald-500 active:scale-[0.95]"
                  title="Configure fallback"
                >
                  <Settings className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextVal = parts.filter((_, i) => i !== idx).map(p => p.raw).join('');
                    onChange(nextVal);
                  }}
                  className="hover:bg-foreground/15 p-0.5 rounded transition-colors inline-flex items-center justify-center ml-0.5"
                  title="Remove variable"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          } else {
            return (
              <span key={idx} className="whitespace-pre-wrap text-foreground font-medium py-0.5">
                {part.value}
              </span>
            );
          }
        })}
      </div>
    );
  } else {
    inputElement = isTextArea ? (
      <Textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={cn('pr-10 rounded-xl bg-card border font-semibold text-xs min-h-[80px] shadow-sm leading-relaxed', inputClassName)}
      />
    ) : (
      <Input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={cn('pr-10 rounded-xl bg-card border font-semibold text-xs h-10 shadow-sm', inputClassName)}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <div 
          ref={containerRef}
          className={cn('relative flex items-center w-full', className)}
        >
          {inputElement}
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'absolute right-1.5 h-7 w-7 rounded-lg hover:bg-muted/80 text-muted-foreground/60 hover:text-primary transition-colors z-10 active:scale-[0.97]',
                isTextArea ? 'top-1.5' : 'top-1/2 -translate-y-1/2'
              )}
              title="Map dynamic variable (or type /)"
            >
              <Brackets className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent 
        className="p-0 border border-border shadow-2xl rounded-2xl bg-card/95 backdrop-blur-md z-[100] overflow-hidden w-[var(--radix-popper-anchor-width,var(--radix-popover-trigger-width))] max-w-[var(--radix-popover-content-available-width,calc(100vw-2rem))] min-w-[min(100%,320px)]" 
        align="start"
        sideOffset={6}
        style={{
          width: anchorWidth ? `${anchorWidth}px` : 'var(--radix-popper-anchor-width, var(--radix-popover-trigger-width))',
        }}
      >
        <div className="flex flex-col w-full overflow-hidden">
          {/* Search Input with Keyboard Controls */}
          <div className="border-b p-3 bg-muted/20 w-full overflow-hidden">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              <Input
                ref={searchInputRef}
                placeholder="Search variables & values..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev + 1 < filteredVariables.length ? prev + 1 : prev));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredVariables.length > 0) {
                      const selectedItem = filteredVariables[selectedIndex] || filteredVariables[0];
                      insertVariable(selectedItem.key);
                    }
                  } else if (e.key === 'Backspace' && searchQuery === '') {
                    // Backspace on empty search closes popover, removes triggering slash, and focuses back
                    if (slashTriggerActiveRef.current) {
                      e.preventDefault();
                      setOpen(false);
                      const el = inputRef.current;
                      if (el) {
                        const start = el.selectionStart ?? value.length;
                        const end = el.selectionEnd ?? value.length;
                        let delStart = start > 0 ? start - 1 : 0;
                        if (slashTriggerIndexRef.current !== null && value[slashTriggerIndexRef.current] === '/') {
                          delStart = slashTriggerIndexRef.current;
                        }
                        if (delStart < value.length && value[delStart] === '/') {
                          const nextVal = value.substring(0, delStart) + value.substring(delStart + 1);
                          onChange(nextVal);
                          setTimeout(() => {
                            el.focus();
                            el.setSelectionRange(delStart, delStart);
                          }, 50);
                        } else {
                          setTimeout(() => el.focus(), 50);
                        }
                      }
                      slashTriggerActiveRef.current = false;
                      slashTriggerIndexRef.current = null;
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setOpen(false);
                    slashTriggerActiveRef.current = false;
                    slashTriggerIndexRef.current = null;
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }
                }}
                className="pl-9 pr-8 h-9 rounded-lg bg-background text-xs w-full"
                autoFocus
              />
            </div>
          </div>

          {/* Accordion List */}
          <ScrollArea hideHorizontal className="h-72 w-full overflow-x-hidden [&>div>div]:!block [&>div>div]:!w-full">
            <div className="p-3 w-full overflow-hidden space-y-1.5">
              {filteredVariables.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground/60 flex flex-col items-center justify-center gap-1">
                  <HelpCircle className="h-6 w-6 text-muted-foreground/30" />
                  <span>No mapping variables found</span>
                </div>
              ) : (
                <Accordion type="multiple" defaultValue={['webhook_item', 'entity_item', 'workspace_item']} className="w-full space-y-1.5 overflow-hidden">
                  {webhookGroup.length > 0 && (
                    <AccordionItem value="webhook_item" className="border rounded-xl bg-card px-3 shadow-none overflow-hidden w-full">
                      <AccordionTrigger className="hover:no-underline py-2.5 w-full">
                        <div className="flex items-center gap-2 text-left">
                          <div className="h-5 w-5 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <Globe className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-bold text-foreground">Webhook Data</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {webhookGroup.length}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-3 space-y-1 w-full overflow-hidden">
                        {webhookGroup.map((v) => {
                          const isSelected = filteredVariables[selectedIndex]?.key === v.key;
                          return (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => insertVariable(v.key)}
                              onMouseEnter={() => {
                                const idx = filteredVariables.findIndex((item) => item.key === v.key);
                                if (idx >= 0) setSelectedIndex(idx);
                              }}
                              className={cn(
                                'w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all border group text-left min-w-0 overflow-hidden active:scale-[0.97]',
                                isSelected
                                  ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/30 shadow-xs'
                                  : 'border-border/40 hover:bg-blue-500/5 hover:border-blue-500/20'
                              )}
                            >
                              <div className="flex flex-col min-w-0 pr-2 overflow-hidden flex-1">
                                <span className={cn(
                                  "font-semibold text-xs transition-colors truncate block",
                                  isSelected ? "text-blue-600 dark:text-blue-400" : "text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400"
                                )}>
                                  {v.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground/70 truncate mt-0.5 font-mono block">
                                  {`{{${v.key}}}`}
                                </span>
                              </div>
                              <div className="shrink-0 flex items-center gap-1.5 ml-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground max-w-[130px] truncate block text-right" title={String(v.val)}>
                                  {v.val}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {entityGroup.length > 0 && (
                    <AccordionItem value="entity_item" className="border rounded-xl bg-card px-3 shadow-none overflow-hidden w-full">
                      <AccordionTrigger className="hover:no-underline py-2.5 w-full">
                        <div className="flex items-center gap-2 text-left">
                          <div className="h-5 w-5 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Database className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-bold text-foreground">Active Entity</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {entityGroup.length}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-3 space-y-1 w-full overflow-hidden">
                        {entityGroup.map((v) => {
                          const isSelected = filteredVariables[selectedIndex]?.key === v.key;
                          return (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => insertVariable(v.key)}
                              onMouseEnter={() => {
                                const idx = filteredVariables.findIndex((item) => item.key === v.key);
                                if (idx >= 0) setSelectedIndex(idx);
                              }}
                              className={cn(
                                'w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all border group text-left min-w-0 overflow-hidden active:scale-[0.97]',
                                isSelected
                                  ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/30 shadow-xs'
                                  : 'border-border/40 hover:bg-emerald-500/5 hover:border-emerald-500/20'
                              )}
                            >
                              <div className="flex flex-col min-w-0 pr-2 overflow-hidden flex-1">
                                <span className={cn(
                                  "font-semibold text-xs transition-colors truncate block",
                                  isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                                )}>
                                  {v.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground/70 truncate mt-0.5 font-mono block">
                                  {`{{${v.key}}}`}
                                </span>
                              </div>
                              <div className="shrink-0 flex items-center gap-1.5 ml-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground max-w-[130px] truncate block text-right" title={String(v.val)}>
                                  {v.val}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {workspaceGroup.length > 0 && (
                    <AccordionItem value="workspace_item" className="border rounded-xl bg-card px-3 shadow-none overflow-hidden w-full">
                      <AccordionTrigger className="hover:no-underline py-2.5 w-full">
                        <div className="flex items-center gap-2 text-left">
                          <div className="h-5 w-5 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Activity className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-bold text-foreground">Workspace Info</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            {workspaceGroup.length}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-3 space-y-1 w-full overflow-hidden">
                        {workspaceGroup.map((v) => {
                          const isSelected = filteredVariables[selectedIndex]?.key === v.key;
                          return (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => insertVariable(v.key)}
                              onMouseEnter={() => {
                                const idx = filteredVariables.findIndex((item) => item.key === v.key);
                                if (idx >= 0) setSelectedIndex(idx);
                              }}
                              className={cn(
                                'w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all border group text-left min-w-0 overflow-hidden active:scale-[0.97]',
                                isSelected
                                  ? 'bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/30 shadow-xs'
                                  : 'border-border/40 hover:bg-indigo-500/5 hover:border-indigo-500/20'
                              )}
                            >
                              <div className="flex flex-col min-w-0 pr-2 overflow-hidden flex-1">
                                <span className={cn(
                                  "font-semibold text-xs transition-colors truncate block",
                                  isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                                )}>
                                  {v.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground/70 truncate mt-0.5 font-mono block">
                                  {`{{${v.key}}}`}
                                </span>
                              </div>
                              <div className="shrink-0 flex items-center gap-1.5 ml-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground max-w-[130px] truncate block text-right" title={String(v.val)}>
                                  {v.val}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              )}
            </div>
          </ScrollArea>

          {/* Keyboard shortcut footer */}
          <div className="border-t px-3 py-2 bg-muted/30 flex items-center justify-between text-[10px] text-muted-foreground select-none">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono text-[9px] shadow-2xs">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono text-[9px] shadow-2xs">↓</kbd>
                <span>navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono text-[9px] shadow-2xs">↵</kbd>
                <span>select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono text-[9px] shadow-2xs">esc</kbd>
                <span>dismiss</span>
              </span>
            </div>
            <span className="text-[10px] opacity-75 font-mono">
              {filteredVariables.length} variable{filteredVariables.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </PopoverContent>

      <FallbackEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        variableKey={editingVarKey}
        currentFallback={editingVarCurrentFallback}
        onSave={handleSaveFallback}
      />
    </Popover>
  );
}
