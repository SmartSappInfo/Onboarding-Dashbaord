'use client';

import * as React from 'react';
import type { CallOutcomeAutomation } from '@/lib/types';
import type { ActionConfigDataSources } from '@/app/admin/messaging/call-centre/scripts/components/ActionConfigFields';
import { OutcomeAutomationsEditor } from '@/app/admin/messaging/call-centre/scripts/components/OutcomeAutomationsEditor';
import { TRIGGER_DEFINITIONS } from './ConfiguredAutomationsSummary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Zap, Plus, Trash2, Edit3, ChevronDown, ChevronRight 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface EventAutomationsAccordionProps {
  automationRules: Record<string, CallOutcomeAutomation[]>;
  onChange: (updatedRules: Record<string, CallOutcomeAutomation[]>) => void;
  activeTrigger: string;
  onSelectTrigger: (triggerKey: string) => void;
  assetType?: 'video' | 'audio' | 'image' | 'document' | 'link';
  actionData: ActionConfigDataSources;
  className?: string;
}

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * EventAutomationsAccordion Component
 * ------------------------------------
 * Provides an Accordion-based management interface for media event triggers.
 * 
 * 1. Accordion Accord:
 *    Renders configured trigger event rules in collapsible cards. Selecting an item
 *    expands its OutcomeAutomationsEditor while minimizing other rules.
 * 
 * 2. Strict Workspace Scoping:
 *    All data sources passed via `actionData` are pre-filtered by `activeWorkspaceId`.
 * 
 * 3. Mobile Touch Guidelines:
 *    Accordion toggle headers, add buttons, and clear actions enforce `min-h-[44px]`
 *    touch targets with active scaling (`active:scale-[0.97]`).
 */
export function EventAutomationsAccordion({
  automationRules,
  onChange,
  activeTrigger,
  onSelectTrigger,
  assetType = 'video',
  actionData,
  className,
}: EventAutomationsAccordionProps) {
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);

  // Filter triggers relevant to current asset type
  const availableTriggers = React.useMemo(() => {
    return TRIGGER_DEFINITIONS.filter((trig) => {
      if (trig.isVideoOnly && assetType !== 'video' && assetType !== 'audio') return false;
      return true;
    });
  }, [assetType]);

  // Compute list of triggers that have configured rules or are active
  const configuredTriggerKeys = React.useMemo(() => {
    const keys = new Set<string>();
    Object.entries(automationRules).forEach(([key, rules]) => {
      if (rules && rules.length > 0) keys.add(key);
    });
    if (activeTrigger) keys.add(activeTrigger);
    return Array.from(keys);
  }, [automationRules, activeTrigger]);

  // Compute total active rules across all event triggers
  const totalActiveRules = React.useMemo(() => {
    return Object.values(automationRules).reduce((sum, rules) => sum + (rules?.length || 0), 0);
  }, [automationRules]);

  // Handle rules update for a specific trigger
  const handleTriggerRulesChange = (triggerKey: string, newRules: CallOutcomeAutomation[]) => {
    const updated = { ...automationRules, [triggerKey]: newRules };
    onChange(updated);
  };

  // Clear all rules for a trigger
  const handleClearTrigger = (triggerKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...automationRules };
    delete updated[triggerKey];
    onChange(updated);
    if (activeTrigger === triggerKey) {
      const remaining = configuredTriggerKeys.filter(k => k !== triggerKey);
      onSelectTrigger(remaining[0] || 'on_view');
    }
  };

  // Add new automation trigger
  const handleSelectNewTrigger = (triggerKey: string) => {
    onSelectTrigger(triggerKey);
    if (!automationRules[triggerKey]) {
      onChange({ ...automationRules, [triggerKey]: [] });
    }
    setIsAddModalOpen(false);
  };

  return (
    <div className={cn("space-y-4 text-left", className)}>
      {/* Header Bar */}
      <Card className="p-4 rounded-2xl border border-slate-300 dark:border-slate-800 bg-muted/20 shadow-sm flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
              Active Event Automations Overview
            </h4>
            <p className="text-[10px] text-muted-foreground font-medium">
              {totalActiveRules === 0
                ? 'No automation rules currently configured.'
                : `${totalActiveRules} total action rule${totalActiveRules === 1 ? '' : 's'} configured across event triggers.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={totalActiveRules > 0 ? 'default' : 'outline'} className="text-[10px] font-extrabold rounded-lg px-2.5 py-1">
            {totalActiveRules} Active Rules
          </Badge>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 px-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-1.5 min-h-[44px] active:scale-[0.97] shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Rule
          </Button>
        </div>
      </Card>

      {/* Accordion Cards List */}
      <div className="space-y-3">
        {configuredTriggerKeys.length === 0 ? (
          <div className="p-8 text-center space-y-3 rounded-2xl border border-dashed border-border bg-card">
            <div className="p-3 bg-muted rounded-2xl w-fit mx-auto text-muted-foreground">
              <Zap className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-extrabold text-foreground">No Automations Configured</p>
              <p className="text-[10px] text-muted-foreground font-medium">Add rules to automatically update deals, send messages, or add tags when visitors view or interact with this media.</p>
            </div>
            <Button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="h-10 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-1.5 min-h-[44px] active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Add First Automation Rule
            </Button>
          </div>
        ) : (
          configuredTriggerKeys.map((triggerKey) => {
            const trigDef = availableTriggers.find((t) => t.key === triggerKey) || {
              key: triggerKey,
              label: triggerKey.replace(/_/g, ' ').toUpperCase(),
              description: '',
              icon: Zap,
            };

            const rules = automationRules[triggerKey] || [];
            const isExpanded = activeTrigger === triggerKey;
            const Icon = trigDef.icon;

            return (
              <div
                key={triggerKey}
                className={cn(
                  "rounded-2xl border transition-all overflow-hidden shadow-sm",
                  isExpanded 
                    ? "border-primary ring-2 ring-primary/20 bg-card" 
                    : "border-slate-300 dark:border-slate-800 bg-card hover:border-slate-400 dark:hover:border-slate-700"
                )}
              >
                {/* Accordion Header Row */}
                <div
                  onClick={() => onSelectTrigger(triggerKey)}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none min-h-[52px]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn(
                      "p-2.5 rounded-xl shrink-0 transition-colors",
                      isExpanded ? "bg-primary text-white" : "bg-primary/10 text-primary"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-xs font-extrabold text-foreground truncate">
                          {trigDef.label}
                        </span>
                        <Badge 
                          variant={rules.length > 0 ? "secondary" : "outline"} 
                          className="text-[9px] font-extrabold rounded-md px-1.5 py-0 shrink-0"
                        >
                          {rules.length} action{rules.length === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">
                        {rules.length === 0 
                          ? 'No actions configured yet' 
                          : rules.map((r) => r.type ? r.type.replace(/_/g, ' ').toUpperCase() : 'Action').join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTrigger(triggerKey);
                      }}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 gap-1 min-h-[36px]"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      {isExpanded ? 'Editing' : 'Edit'}
                    </Button>
                    
                    {rules.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleClearTrigger(triggerKey, e)}
                        title="Delete rules for this trigger"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[36px]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <div className="p-1 text-muted-foreground">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Accordion Body */}
                {isExpanded && (
                  <div className="p-4 md:p-5 border-t border-dashed border-border/60 bg-muted/10 space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-left">
                      <div>
                        <p className="text-xs font-black text-foreground uppercase tracking-wider">
                          Trigger Actions List ({triggerKey})
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {trigDef.description}
                        </p>
                      </div>
                    </div>

                    <OutcomeAutomationsEditor
                      automations={rules}
                      onChange={(newRules) => handleTriggerRulesChange(triggerKey, newRules)}
                      data={actionData}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Add Automation Button */}
      {configuredTriggerKeys.length > 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsAddModalOpen(true)}
          className="w-full h-11 rounded-2xl border-dashed border-slate-300 dark:border-slate-800 hover:border-primary hover:bg-primary/5 text-primary font-bold text-xs gap-2 min-h-[44px] active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          Add Another Automation Rule
        </Button>
      )}

      {/* Modal to Select New Event Trigger */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg font-black text-foreground">
              Select Event Trigger
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              Choose the visitor event that will automatically trigger your configured CRM actions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
            {availableTriggers.map((trig) => {
              const Icon = trig.icon;
              const hasRules = (automationRules[trig.key] || []).length > 0;

              return (
                <div
                  key={trig.key}
                  onClick={() => handleSelectNewTrigger(trig.key)}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary hover:bg-primary/5 cursor-pointer flex items-center justify-between gap-3 transition-colors min-h-[44px] active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-bold text-foreground truncate">{trig.label}</p>
                      <p className="text-[10px] text-muted-foreground font-medium truncate">{trig.description}</p>
                    </div>
                  </div>
                  {hasRules && (
                    <Badge variant="secondary" className="text-[9px] font-extrabold shrink-0">
                      Already Configured
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EventAutomationsAccordion;
