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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

interface MappableInputFieldProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  isTextArea?: boolean;
  appFields?: any[];
}

function getFlatKeys(obj: any, prefix = ''): { key: string; val: any }[] {
  if (!obj || typeof obj !== 'object') return [];
  const res: { key: string; val: any }[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      res.push(...getFlatKeys(value, path));
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
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const firestore = useFirestore();
  const params = useParams();
  const automationId = params.id as string;
  const [capturedPayload, setCapturedPayload] = React.useState<any>(null);
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
          setCapturedPayload(autoData.latestCapturedWebhook);
        } else {
          const webhookTrigger = autoData?.triggers?.find((t: any) => t.type === 'WEBHOOK_RECEIVED');
          if (webhookTrigger?.config?.capturedPayload) {
            setCapturedPayload(webhookTrigger.config.capturedPayload);
          } else {
            setCapturedPayload(null);
          }
        }
      }
    });
    return () => unsub();
  }, [firestore, automationId]);

  // Derive variables lists
  const webhookVariables = React.useMemo(() => {
    if (!capturedPayload) return [];
    
    const bodyKeys = getFlatKeys(capturedPayload.body || {}).map(item => ({
      key: `1.body.${item.key}`,
      label: `body.${item.key}`,
      val: item.val
    }));
    
    const headerKeys = Object.entries(capturedPayload.headers || {}).map(([k, v]) => ({
      key: `1.headers.${k}`,
      label: `headers.${k}`,
      val: v
    }));
    
    const queryKeys = Object.entries(capturedPayload.query || {}).map(([k, v]) => ({
      key: `1.query.${k}`,
      label: `query.${k}`,
      val: v
    }));
    
    const fileKeys = (capturedPayload.files || []).flatMap((file: any, idx: number) => [
      { key: `1.files[${idx}].name`, label: `files[${idx}].name`, val: file.name },
      { key: `1.files[${idx}].size`, label: `files[${idx}].size`, val: `${(file.size / 1024).toFixed(1)} KB` },
      { key: `1.files[${idx}].type`, label: `files[${idx}].type`, val: file.type }
    ]);

    return [...bodyKeys, ...headerKeys, ...queryKeys, ...fileKeys];
  }, [capturedPayload]);

  const entityVariables = React.useMemo(() => {
    const native = [
      { key: 'entity.displayName', label: 'Display Name', val: 'e.g. Acme Corp' },
      { key: 'entity.primaryEmail', label: 'Primary Email', val: 'e.g. info@acme.com' },
      { key: 'entity.primaryPhone', label: 'Primary Phone', val: 'e.g. +1234567890' },
      { key: 'entity.assignedTo', label: 'Account Manager ID', val: 'e.g. usr_789' },
    ];
    const custom = (appFields || []).map((f: any) => ({
      key: `entity.${f.id || f.name}`,
      label: f.label || f.name,
      val: `Value of custom field: ${f.label || f.name}`,
    }));
    return [...native, ...custom];
  }, [appFields]);

  const workspaceVariables = React.useMemo(() => [
    { key: 'workspace.id', label: 'Workspace ID', val: 'e.g. ws_555' },
  ], []);

  const allVariables = React.useMemo(() => {
    const list: { key: string; label: string; val: any; group: string }[] = [];
    webhookVariables.forEach(x => list.push({ ...x, group: 'webhook' }));
    entityVariables.forEach(x => list.push({ ...x, group: 'entity' }));
    workspaceVariables.forEach(x => list.push({ ...x, group: 'workspace' }));
    return list;
  }, [webhookVariables, entityVariables, workspaceVariables]);

  const filteredVariables = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allVariables;
    return allVariables.filter(v => 
      v.key.toLowerCase().includes(q) || 
      v.label.toLowerCase().includes(q) || 
      String(v.val).toLowerCase().includes(q)
    );
  }, [allVariables, searchQuery]);

  const insertVariable = (varName: string) => {
    const el = inputRef.current;
    const insertion = `{{${varName}}}`;
    if (!el) {
      onChange(value + insertion);
      setOpen(false);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const nextVal = value.substring(0, start) + insertion + value.substring(end);
    onChange(nextVal);
    setOpen(false);

    setTimeout(() => {
      el.focus();
      const nextPos = start + insertion.length;
      el.setSelectionRange(nextPos, nextPos);
    }, 50);
  };

  const groupItems = (groupName: string) => {
    return filteredVariables.filter(v => v.group === groupName);
  };

  const webhookGroup = groupItems('webhook');
  const entityGroup = groupItems('entity');
  const workspaceGroup = groupItems('workspace');

  // Check if we should render the inline pills display view
  const showPillsView = !isFocused && !open && typeof value === 'string' && value.includes('{{');

  let inputElement = null;
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
            const variableInfo = allVariables.find(v => v.key === variableKey);
            const group = variableInfo?.group || (
              variableKey.startsWith('1.') ? 'webhook' :
              variableKey.startsWith('entity.') ? 'entity' :
              variableKey.startsWith('workspace.') ? 'workspace' :
              'unknown'
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
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={cn('pr-10 rounded-xl bg-card border font-semibold text-xs min-h-[80px] shadow-sm leading-relaxed', inputClassName)}
      />
    ) : (
      <Input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={cn('pr-10 rounded-xl bg-card border font-semibold text-xs h-10 shadow-sm', inputClassName)}
      />
    );
  }

  return (
    <div className={cn('relative flex items-center w-full', className)}>
      {inputElement}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'absolute right-1.5 h-7 w-7 rounded-lg hover:bg-muted/80 text-muted-foreground/60 hover:text-primary transition-colors',
              isTextArea ? 'top-1.5' : 'top-1/2 -translate-y-1/2'
            )}
            title="Map dynamic variable"
          >
            <Brackets className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 border border-border shadow-2xl rounded-2xl bg-card/95 backdrop-blur-md z-[100]" align="end">
          <div className="flex flex-col">
            {/* Search Input */}
            <div className="border-b p-3 bg-muted/20">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
                <Input
                  placeholder="Search variables & values..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 h-9 rounded-lg bg-background text-xs"
                  autoFocus
                />
              </div>
            </div>

            {/* Accordion List */}
            <ScrollArea className="h-72">
              <div className="p-3">
                {filteredVariables.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground/60 flex flex-col items-center justify-center gap-1">
                    <HelpCircle className="h-6 w-6 text-muted-foreground/30" />
                    <span>No mapping variables found</span>
                  </div>
                ) : (
                  <Accordion type="multiple" defaultValue={['webhook_item', 'entity_item']} className="w-full space-y-1.5">
                    {webhookGroup.length > 0 && (
                      <AccordionItem value="webhook_item" className="border rounded-xl bg-muted/5 px-3">
                        <AccordionTrigger className="hover:no-underline py-2.5 text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5" />
                          <span>1. Webhook Ingress ({webhookGroup.length})</span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-1 pb-3 space-y-1">
                          {webhookGroup.map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => insertVariable(v.key)}
                              className="w-full flex flex-col text-left px-2 py-1.5 hover:bg-blue-500/5 hover:text-blue-500 rounded-lg transition-colors border border-transparent hover:border-blue-500/10 font-mono text-[9px] group"
                            >
                              <span className="font-bold text-foreground group-hover:text-blue-500">{`{{${v.key}}}`}</span>
                              <span className="text-muted-foreground/60 truncate mt-0.5" title={String(v.val)}>Value: {String(v.val)}</span>
                            </button>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {entityGroup.length > 0 && (
                      <AccordionItem value="entity_item" className="border rounded-xl bg-muted/5 px-3">
                        <AccordionTrigger className="hover:no-underline py-2.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Database className="h-3.5 w-3.5" />
                          <span>Active Entity ({entityGroup.length})</span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-1 pb-3 space-y-1">
                          {entityGroup.map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => insertVariable(v.key)}
                              className="w-full flex flex-col text-left px-2 py-1.5 hover:bg-emerald-500/5 hover:text-emerald-500 rounded-lg transition-colors border border-transparent hover:border-emerald-500/10 font-mono text-[9px] group"
                            >
                              <span className="font-bold text-foreground group-hover:text-emerald-600">{`{{${v.key}}}`}</span>
                              <span className="text-muted-foreground/60 truncate mt-0.5">{v.val}</span>
                            </button>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {workspaceGroup.length > 0 && (
                      <AccordionItem value="workspace_item" className="border rounded-xl bg-muted/5 px-3">
                        <AccordionTrigger className="hover:no-underline py-2.5 text-[10px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5" />
                          <span>Workspace Info ({workspaceGroup.length})</span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-1 pb-3 space-y-1">
                          {workspaceGroup.map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => insertVariable(v.key)}
                              className="w-full flex flex-col text-left px-2 py-1.5 hover:bg-indigo-500/5 hover:text-indigo-500 rounded-lg transition-colors border border-transparent hover:border-indigo-500/10 font-mono text-[9px] group"
                            >
                              <span className="font-bold text-foreground group-hover:text-indigo-500">{`{{${v.key}}}`}</span>
                              <span className="text-muted-foreground/60 truncate mt-0.5">{v.val}</span>
                            </button>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                )}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      <FallbackEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        variableKey={editingVarKey}
        currentFallback={editingVarCurrentFallback}
        onSave={handleSaveFallback}
      />
    </div>
  );
}
