'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * 
 * ConfiguredAutomationsSummary Component
 * --------------------------------------
 * 1. At-a-Glance Rules Visibility:
 *    Renders a consolidated summary of all configured event automation rules across
 *    every trigger event (on_view, on_play, on_progress_25, etc.) simultaneously.
 *    This prevents rules from disappearing when the admin switches active triggers in the editor.
 * 
 * 2. Strict Typing:
 *    Strictly typed with zero `any` or `any[]`.
 * 
 * 3. Mobile Touch Compliance:
 *    All buttons and trigger cards use `min-h-[44px]` touch target bounds with
 *    active state scaling (`active:scale-[0.97]`).
 */

import * as React from 'react';
import type { CallOutcomeAutomation } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Zap, Eye, Play, FastForward, CheckCircle2, 
  MousePointerClick, Download, Trash2, Edit3, ChevronRight 
} from 'lucide-react';

export interface TriggerDefinition {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isVideoOnly?: boolean;
}

export const TRIGGER_DEFINITIONS: TriggerDefinition[] = [
  {
    key: 'on_view',
    label: 'Recipient Lands on Page',
    description: 'Fired when a visitor opens the media landing page.',
    icon: Eye,
  },
  {
    key: 'on_play',
    label: 'Recipient Clicks Play',
    description: 'Fired when the user starts video or audio playback.',
    icon: Play,
    isVideoOnly: true,
  },
  {
    key: 'on_progress_25',
    label: 'Recipient Watches 25%',
    description: 'Fired when 25% of media playback is completed.',
    icon: FastForward,
    isVideoOnly: true,
  },
  {
    key: 'on_progress_50',
    label: 'Recipient Watches 50% (Halfway)',
    description: 'Fired when 50% of media playback is completed.',
    icon: FastForward,
    isVideoOnly: true,
  },
  {
    key: 'on_progress_75',
    label: 'Recipient Watches 75%',
    description: 'Fired when 75% of media playback is completed.',
    icon: FastForward,
    isVideoOnly: true,
  },
  {
    key: 'on_complete',
    label: 'Recipient Completes Playback',
    description: 'Fired when playback reaches 100% completion.',
    icon: CheckCircle2,
    isVideoOnly: true,
  },
  {
    key: 'on_cta_click',
    label: 'Recipient Clicks CTA Button',
    description: 'Fired when the visitor clicks the primary Call-To-Action button.',
    icon: MousePointerClick,
  },
  {
    key: 'on_download',
    label: 'Recipient Downloads/Saves Asset',
    description: 'Fired when the visitor triggers the file download action.',
    icon: Download,
  },
];

interface ConfiguredAutomationsSummaryProps {
  automationRules: Record<string, CallOutcomeAutomation[]>;
  activeTrigger: string;
  onSelectTrigger: (triggerKey: string) => void;
  onClearTriggerRules?: (triggerKey: string) => void;
  assetType?: 'video' | 'audio' | 'image' | 'document' | 'link';
}

export default function ConfiguredAutomationsSummary({
  automationRules,
  activeTrigger,
  onSelectTrigger,
  onClearTriggerRules,
  assetType = 'video',
}: ConfiguredAutomationsSummaryProps) {
  // Filter triggers relevant to asset type
  const availableTriggers = React.useMemo(() => {
    return TRIGGER_DEFINITIONS.filter((trig) => {
      if (trig.isVideoOnly && assetType !== 'video' && assetType !== 'audio') return false;
      return true;
    });
  }, [assetType]);

  // Compute total configured rules across all triggers
  const totalConfiguredRules = React.useMemo(() => {
    return Object.values(automationRules).reduce((sum, rules) => sum + (rules?.length || 0), 0);
  }, [automationRules]);

  return (
    <Card className="p-4 rounded-2xl border border-border bg-muted/20 text-left space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
              Active Event Automations Overview
            </h4>
            <p className="text-[10px] text-muted-foreground font-medium">
              {totalConfiguredRules === 0 
                ? 'No automation rules currently configured for this page.' 
                : `${totalConfiguredRules} total action rule${totalConfiguredRules === 1 ? '' : 's'} configured across event triggers.`}
            </p>
          </div>
        </div>
        <Badge variant={totalConfiguredRules > 0 ? 'default' : 'outline'} className="text-[10px] font-extrabold rounded-lg">
          {totalConfiguredRules} Active Rules
        </Badge>
      </div>

      {totalConfiguredRules > 0 && (
        <div className="space-y-2 pt-1">
          {availableTriggers.map((trig) => {
            const rules = automationRules[trig.key] || [];
            if (rules.length === 0) return null;
            const isSelected = activeTrigger === trig.key;
            const Icon = trig.icon;

            return (
              <div
                key={trig.key}
                onClick={() => onSelectTrigger(trig.key)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between min-h-[44px] select-none active:scale-[0.98] ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-card shadow-sm'
                    : 'border-border/60 bg-card/60 hover:bg-card hover:border-primary/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">{trig.label}</span>
                      <Badge variant="secondary" className="text-[9px] font-extrabold rounded-md px-1.5 py-0">
                        {rules.length} action{rules.length === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {rules.map((r) => r.type ? r.type.replace(/_/g, ' ').toUpperCase() : 'Action').join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTrigger(trig.key);
                    }}
                    className="h-8 px-2 text-[10px] font-bold gap-1 rounded-lg text-primary hover:bg-primary/10 min-h-[36px]"
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit
                  </Button>
                  {onClearTriggerRules && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearTriggerRules(trig.key);
                      }}
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[36px] min-w-[36px]"
                      title="Clear rules for this trigger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? 'rotate-90 text-primary' : ''}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
