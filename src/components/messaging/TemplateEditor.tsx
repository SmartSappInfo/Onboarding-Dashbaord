'use client';

import * as React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Variable } from 'lucide-react';
import type { TemplateVariable, MessageChannel } from '@/lib/types';

// ── SMS segment calculation ────────────────────────────────────────────────

const SMS_SEGMENT_SIZE = 160;

function getSmsSegments(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / SMS_SEGMENT_SIZE);
}

// ── Variable token highlighting ────────────────────────────────────────────

function HighlightedBody({ body }: { body: string }) {
  const parts = body.split(/(\{\{[^}]+\}\})/g);
  return (
    <div className="font-mono text-xs text-foreground/80 whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        /^\{\{[^}]+\}\}$/.test(part) ? (
          <span key={i} className="bg-blue-500/20 text-blue-400 rounded px-0.5 border border-blue-500/30">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
}

// ── Basic variable picker ──────────────────────────────────────────────────

interface VariablePickerProps {
  variables: TemplateVariable[];
  onInsert: (varName: string) => void;
}

function BasicVariablePicker({ variables, onInsert }: VariablePickerProps) {
  const [open, setOpen] = React.useState(false);

  const groupedVariables = React.useMemo(() => {
    const groups: Record<string, TemplateVariable[]> = {};
    variables.forEach(v => {
      const ctx = v.context || 'common';
      if (!groups[ctx]) groups[ctx] = [];
      groups[ctx].push(v);
    });
    return Object.entries(groups)
      .filter(([_, vars]) => vars.length > 0)
      .sort(([a], [b]) => {
        if (a === 'common') return -1;
        if (b === 'common') return 1;
        return a.localeCompare(b);
      });
  }, [variables]);

  const getContextLabel = (context: string) => {
    const defaultLabels: Record<string, string> = {
      common: 'Common',
      meeting: 'Meeting',
      form: 'Form',
      survey: 'Survey',
      agreement: 'Agreement',
      entity: 'Entity',
      campaign: 'Campaign',
    };
    return defaultLabels[context] || context;
  };

  if (!variables.length) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 border-border bg-muted/50 text-muted-foreground hover:text-foreground"
        >
          <Variable className="h-3 w-3" />
          Insert Variable
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-muted border-border" align="start">
        <div className="max-h-64 overflow-y-auto space-y-3">
          {groupedVariables.map(([context, vars]) => (
            <div key={context}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 pb-1">
                {getContextLabel(context)}
              </p>
              <div className="space-y-0.5">
                {vars.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { onInsert(v.name); setOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors group flex items-center justify-between"
                  >
                    <span className="text-xs font-mono text-blue-400 truncate max-w-[120px]">{`{{${v.name}}}`}</span>
                    <span className="text-[9px] text-muted-foreground group-hover:text-foreground/70 truncate text-right flex-1 ml-2">{v.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  channel: MessageChannel;
  variables?: TemplateVariable[];
  placeholder?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TemplateEditor({
  value,
  onChange,
  channel,
  variables = [],
  placeholder,
}: TemplateEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [showHighlight, setShowHighlight] = React.useState(false);

  function insertVariable(varName: string) {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + `{{${varName}}}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const token = `{{${varName}}}`;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    // Restore cursor after token
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const charCount = value.length;
  const segments = getSmsSegments(value);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <BasicVariablePicker variables={variables} onInsert={insertVariable} />
        <div className="flex items-center gap-2">
          {channel === 'sms' && (
            <span className="text-[10px] text-muted-foreground">
              {charCount} chars · {segments} segment{segments !== 1 ? 's' : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowHighlight((v) => !v)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            {showHighlight ? 'Edit' : 'Preview tokens'}
          </button>
        </div>
      </div>

      {/* Editor / Highlight toggle */}
      {showHighlight ? (
        <div
          className="min-h-[160px] rounded-xl border border-border bg-muted/30 p-3 cursor-text"
          onClick={() => setShowHighlight(false)}
        >
          <HighlightedBody body={value} />
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? (channel === 'sms' ? 'Write your SMS message...' : 'Write your email body...')}
          className="min-h-[160px] font-mono text-sm bg-muted/30 border-border text-foreground placeholder:text-slate-600 rounded-xl resize-y focus:border-emerald-500/50 focus:ring-emerald-500/20"
        />
      )}

      {/* SMS character warning */}
      {channel === 'sms' && charCount > SMS_SEGMENT_SIZE && (
        <p className="text-[10px] text-amber-400">
          Message exceeds 160 characters — will be sent as {segments} SMS segments.
        </p>
      )}
    </div>
  );
}
