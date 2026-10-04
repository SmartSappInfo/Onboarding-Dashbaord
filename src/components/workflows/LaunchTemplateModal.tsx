'use client';

/**
 * @fileOverview Launch Workflow Template Modal (Phase 7 Milestone 5 Task 5)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with min-h-[52px] sm:min-h-[56px]
 * - Zero Raw Descriptions: routed exclusively through `<CardInfoTooltip text="..." />` alongside title
 * - Accessible Screen Reader: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]`
 *
 * Implements:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 7: Mobile touch targets min-h-[44px].
 * - Rule 60: Rule 60 emergency pause error messaging.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  GitBranch,
  Play,
  Layers,
  AlertTriangle,
  Loader2,
  FileText,
  UserCheck,
  TrendingUp,
} from 'lucide-react';
import type { WorkflowTemplateDefinition } from '@/platform/workflows/templates/workflow-template-types';

export interface LaunchTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: WorkflowTemplateDefinition[];
  onLaunch: (input: {
    templateId: string;
    title?: string;
    inputs: Record<string, unknown>;
    dryRun?: boolean;
  }) => Promise<void>;
  isLaunching?: boolean;
}

export function LaunchTemplateModal({
  open,
  onOpenChange,
  templates,
  onLaunch,
  isLaunching = false,
}: LaunchTemplateModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>(
    templates[0]?.id || ''
  );
  const [title, setTitle] = React.useState('');
  const [formInputs, setFormInputs] = React.useState<Record<string, string>>({});
  const [dryRun, setDryRun] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const activeTemplate = React.useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || templates[0] || null;
  }, [templates, selectedTemplateId]);

  // Reset inputs when switching templates
  React.useEffect(() => {
    if (activeTemplate) {
      const initial: Record<string, string> = {};
      if (activeTemplate.parameters && Array.isArray(activeTemplate.parameters)) {
        activeTemplate.parameters.forEach((param) => {
          initial[param.name] = param.defaultValue !== undefined ? String(param.defaultValue) : '';
        });
      }
      setFormInputs(initial);
      setTitle(`${activeTemplate.name} Instance`);
      setError(null);
    }
  }, [activeTemplate]);

  const handleInputChange = (key: string, val: string) => {
    setFormInputs((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate) return;

    setError(null);

    // Convert string inputs to proper types if needed
    const parsedInputs: Record<string, unknown> = {};
    for (const [key, rawVal] of Object.entries(formInputs)) {
      if (rawVal.trim() === '') continue;
      // If it looks like a number, parse it
      if (!isNaN(Number(rawVal)) && rawVal.trim() !== '') {
        parsedInputs[key] = Number(rawVal);
      } else if (rawVal.toLowerCase() === 'true' || rawVal.toLowerCase() === 'false') {
        parsedInputs[key] = rawVal.toLowerCase() === 'true';
      } else {
        parsedInputs[key] = rawVal;
      }
    }

    try {
      await onLaunch({
        templateId: activeTemplate.id,
        title: title.trim() || undefined,
        inputs: parsedInputs,
        dryRun,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch workflow');
    }
  };

  const getTemplateIcon = (id: string) => {
    if (id.includes('onboarding') || id.includes('lead')) {
      return <UserCheck className="h-4 w-4 text-blue-500" />;
    }
    if (id.includes('deal') || id.includes('review')) {
      return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    }
    return <FileText className="h-4 w-4 text-amber-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        {/* Demarcated Header */}
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <GitBranch className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold tracking-tight">
              Launch Workflow Template
            </DialogTitle>
            <CardInfoTooltip text="Instantiate a pre-approved, deterministic enterprise workflow template with DAG validation and idempotency guarantees." />
          </div>
          <DialogDescription className="sr-only">
            Select and configure an approved business workflow template to launch as a live tracked instance.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto max-h-[75vh]">
          <div className="p-6 space-y-5">
            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            {/* Template Selector Pills */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Select Template
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {templates.map((tpl) => {
                  const isSelected = tpl.id === selectedTemplateId;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary'
                          : 'border-border/80 bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {getTemplateIcon(tpl.id)}
                        <span className="font-semibold text-xs truncate text-foreground">
                          {tpl.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Layers className="h-3 w-3" />
                        <span>{tpl.steps.length} steps</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Instance Title */}
            <div className="space-y-1.5">
              <Label htmlFor="workflow-title" className="text-xs font-medium">
                Workflow Instance Title
              </Label>
              <Input
                id="workflow-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lead Onboarding for Acme Corp"
                className="h-10 rounded-xl bg-card border-border/80 text-sm"
                required
              />
            </div>

            {/* Dynamic Template Inputs */}
            {activeTemplate && activeTemplate.parameters && activeTemplate.parameters.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Template Parameters
                  </Label>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {activeTemplate.id}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeTemplate.parameters.map((param) => {
                    const isRequired = Boolean(param.required);
                    const desc = param.description || '';

                    return (
                      <div key={param.name} className="space-y-1">
                        <Label htmlFor={`input-${param.name}`} className="text-xs font-medium flex items-center gap-1">
                          <span>{param.name}</span>
                          {isRequired && <span className="text-destructive">*</span>}
                        </Label>
                        <Input
                          id={`input-${param.name}`}
                          value={formInputs[param.name] || ''}
                          onChange={(e) => handleInputChange(param.name, e.target.value)}
                          placeholder={desc || `Enter ${param.name}`}
                          className="h-9 rounded-xl bg-card border-border/80 text-xs"
                          required={isRequired}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dry Run Simulation Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <div className="space-y-0.5">
                <Label htmlFor="dry-run-toggle" className="text-xs font-medium cursor-pointer">
                  Simulation (Dry Run)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Validates template parameters and DAG execution without enqueuing background tasks.
                </p>
              </div>
              <Switch
                id="dry-run-toggle"
                checked={dryRun}
                onCheckedChange={setDryRun}
              />
            </div>
          </div>

          {/* Demarcated Footer */}
          <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLaunching}
              className="rounded-xl border-border/80 active:scale-[0.97] h-10 px-4 min-h-[44px] sm:min-h-[40px] text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLaunching || !activeTemplate}
              className="rounded-xl active:scale-[0.97] h-10 px-5 min-h-[44px] sm:min-h-[40px] text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Instantiating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {dryRun ? 'Simulate Template' : 'Launch Workflow'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
