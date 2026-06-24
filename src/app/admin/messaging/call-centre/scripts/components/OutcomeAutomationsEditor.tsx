'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CallActionType, CallOutcomeAutomation, CallActionParams } from '@/lib/types';
import { CALL_ACTION_TYPES, getActionMeta } from '@/lib/call-action-types';
import { ActionConfigFields, type ActionConfigDataSources } from './ActionConfigFields';

// Strong ease-out for UI interactions (emilkowal-animations: ease-custom-curves).
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const DEFAULT_TYPE: CallActionType = 'SEND_SMS';

interface OutcomeAutomationsEditorProps {
  automations: CallOutcomeAutomation[];
  onChange: (next: CallOutcomeAutomation[]) => void;
  data: ActionConfigDataSources;
}

interface AutomationRowProps {
  index: number;
  automation: CallOutcomeAutomation;
  onTypeChange: (index: number, type: CallActionType) => void;
  onParamsChange: (index: number, patch: Partial<CallActionParams>) => void;
  onRemove: (index: number) => void;
  data: ActionConfigDataSources;
  reduced: boolean;
}

// Top-level memoized row (vercel-react: rerender-no-inline-components / rerender-memo).
const AutomationRow = React.memo(function AutomationRow({
  index,
  automation,
  onTypeChange,
  onParamsChange,
  onRemove,
  data,
  reduced,
}: AutomationRowProps) {
  const meta = getActionMeta(automation.type);
  return (
    <motion.div
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: EASE_OUT, delay: reduced ? 0 : index * 0.03 }}
      className="rounded-xl border border-border bg-card/40 p-2.5 space-y-2"
    >
      <div className="flex items-center gap-2">
        <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" aria-hidden />
        <Badge className={cn('text-[8px] font-bold px-2 py-0.5 text-white border-0', meta.colorClass)}>
          <meta.icon className="h-2.5 w-2.5 mr-1" />
          {meta.label}
        </Badge>
        <Select value={automation.type} onValueChange={(v) => onTypeChange(index, v as CallActionType)}>
          <SelectTrigger className="h-7 ml-auto w-[150px] bg-background border-border rounded-lg text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALL_ACTION_TYPES.map((t) => {
              const m = getActionMeta(t);
              const Icon = m.icon;
              return (
                <SelectItem key={t} value={t}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-3 w-3 opacity-70" />
                    {m.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive active:scale-[0.97] transition-transform"
          onClick={() => onRemove(index)}
          aria-label="Remove automation"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ActionConfigFields
        type={automation.type}
        params={automation.params}
        onChange={(patch) => onParamsChange(index, patch)}
        data={data}
      />
    </motion.div>
  );
});

AutomationRow.displayName = 'AutomationRow';

const OutcomeAutomationsEditor = React.memo(function OutcomeAutomationsEditor({
  automations,
  onChange,
  data,
}: OutcomeAutomationsEditorProps) {
  const reduced = useReducedMotion() ?? false;

  const addAutomation = React.useCallback(() => {
    onChange([...automations, { type: DEFAULT_TYPE, params: { ...getActionMeta(DEFAULT_TYPE).defaultParams() } }]);
  }, [automations, onChange]);

  const removeAutomation = React.useCallback(
    (index: number) => {
      onChange(automations.filter((_, idx) => idx !== index));
    },
    [automations, onChange]
  );

  const changeType = React.useCallback(
    (index: number, type: CallActionType) => {
      onChange(
        automations.map((a, idx) =>
          idx === index ? { type, params: { ...getActionMeta(type).defaultParams() } } : a
        )
      );
    },
    [automations, onChange]
  );

  const changeParams = React.useCallback(
    (index: number, patch: Partial<CallActionParams>) => {
      onChange(
        automations.map((a, idx) => (idx === index ? { ...a, params: { ...a.params, ...patch } } : a))
      );
    },
    [automations, onChange]
  );

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
          Post-Call Automations
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-[10px] active:scale-[0.97] transition-transform"
          onClick={addAutomation}
        >
          <Plus className="h-3 w-3" /> Add Action
        </Button>
      </div>

      {automations.length === 0 ? (
        <p className="text-[10px] text-muted-foreground/60 italic py-2 leading-relaxed">
          No automations yet. Add SMS, email, tasks, stage changes and more to run automatically
          when a call resolves to this outcome.
        </p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {automations.map((automation, i) => (
              <AutomationRow
                key={`${automation.type}-${i}`}
                index={i}
                automation={automation}
                data={data}
                reduced={reduced}
                onTypeChange={changeType}
                onParamsChange={changeParams}
                onRemove={removeAutomation}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
});

OutcomeAutomationsEditor.displayName = 'OutcomeAutomationsEditor';

export { OutcomeAutomationsEditor };
export type { OutcomeAutomationsEditorProps };
