'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CallActionType, ScriptNode } from '@/lib/types';
import { CALL_ACTION_TYPES, getActionMeta } from '@/lib/call-action-types';
import { ActionConfigFields, type ActionConfigDataSources } from './ActionConfigFields';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActionNodeConfigPanelProps {
  actionType: CallActionType | undefined;
  actionConfig: ScriptNode['data']['actionConfig'];
  onUpdate: (patch: Partial<ScriptNode['data']>) => void;
  /** Org-scoped lists fed to the per-action fields. */
  data: ActionConfigDataSources;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ActionNodeConfigPanel = React.memo(function ActionNodeConfigPanel({
  actionType,
  actionConfig,
  onUpdate,
  data,
}: ActionNodeConfigPanelProps) {
  const config = actionConfig ?? {};
  const activeType = actionType || 'SEND_SMS';
  const meta = getActionMeta(activeType);

  React.useEffect(() => {
    if (!actionType) {
      onUpdate({ actionType: 'SEND_SMS' });
    }
  }, [actionType, onUpdate]);

  const handleParamsChange = React.useCallback(
    (patch: Partial<NonNullable<ScriptNode['data']['actionConfig']>>) => {
      onUpdate({ actionConfig: { ...config, ...patch } });
    },
    [config, onUpdate]
  );

  const handleActionTypeChange = React.useCallback(
    (val: string) => {
      const typedVal = val as CallActionType;
      const newMeta = getActionMeta(typedVal);
      const prevChannel = actionType ? getActionMeta(actionType).channel : undefined;
      // Drop the template binding when switching to a different messaging channel
      // so a stale cross-channel templateId doesn't linger as "Unresolved".
      const clearTemplate = newMeta.channel !== prevChannel && !!config.templateId;
      onUpdate({
        actionType: typedVal,
        label: `Action: ${newMeta.label}`,
        ...(clearTemplate ? { actionConfig: { ...config, templateId: undefined } } : {}),
      });
    },
    [onUpdate, actionType, config]
  );

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
        Action Configuration
      </span>

      {/* ── Action Type Selector ──────────────────────────────────────────── */}
      <div className="space-y-1">
        <Label className="text-[8px] font-bold text-muted-foreground uppercase">
          Automation Trigger Type
        </Label>
        <Select value={activeType} onValueChange={handleActionTypeChange}>
          <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            {CALL_ACTION_TYPES.map((type) => {
              const m = getActionMeta(type);
              const Icon = m.icon;
              return (
                <SelectItem key={type} value={type}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-3 w-3 shrink-0 opacity-70" />
                    {m.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* ── Action Type Badge ─────────────────────────────────────────────── */}
      <Badge
        className={cn(
          'text-[8px] font-bold px-2 py-0.5 text-white border-0',
          meta.colorClass
        )}
      >
        <meta.icon className="h-2.5 w-2.5 mr-1" />
        {meta.label}
      </Badge>

      {/* ── Per-action fields (shared with outcome automations) ───────────── */}
      <ActionConfigFields
        type={activeType}
        params={config}
        onChange={handleParamsChange}
        data={data}
      />
    </div>
  );
});

ActionNodeConfigPanel.displayName = 'ActionNodeConfigPanel';

export { ActionNodeConfigPanel };
export type { ActionNodeConfigPanelProps };
export type { ActionConfigDataSources };
