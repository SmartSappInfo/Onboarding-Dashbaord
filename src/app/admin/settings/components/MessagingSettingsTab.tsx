'use client';

/**
 * @fileOverview Backoffice Codeless Management Tab for the Messaging Hub.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 7: Tactile buttons (active:scale-[0.97]), min-h-[44px] touch targets.
 * - Rule 4: Strict zero-any TypeScript typing.
 * - Rule 8: Safe relative navigation.
 * - Rule 18: TOCTOU concurrency protection passing version to update action.
 * - theme.md Section 4 & 8: Institutional card styling, CardInfoTooltip, sr-only descriptions.
 */

import * as React from 'react';
import {
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Save,
  Loader2,
  CheckCircle2,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import {
  getWorkspaceMessagingSettingsAction,
  updateWorkspaceMessagingSettingsAction,
} from '@/app/actions/messaging-settings-actions';
import {
  DEFAULT_MESSAGING_SETTINGS,
  type WorkspaceMessagingSettings,
} from '@/lib/types/messaging-settings';
import { STARTER_TEMPLATES } from '@/app/admin/messaging/components/dashboard/QuickTemplatesCard';
import { cn } from '@/lib/utils';

export interface MessagingSettingsTabProps {
  workspaceId: string;
  className?: string;
}

export function MessagingSettingsTab({ workspaceId, className }: MessagingSettingsTabProps) {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<WorkspaceMessagingSettings>(DEFAULT_MESSAGING_SETTINGS);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [newPrompt, setNewPrompt] = React.useState('');

  const loadSettings = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getWorkspaceMessagingSettingsAction(workspaceId);
      if (res.success) {
        setSettings(res.data);
      }
    } catch {
      toast({
        title: 'Error Loading Settings',
        description: 'Unable to retrieve workspace messaging settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateWorkspaceMessagingSettingsAction(
        workspaceId,
        settings,
        settings.version // Rule 18: TOCTOU concurrency guard
      );
      if (res.success) {
        setSettings(res.data);
        toast({
          title: 'Configuration Saved',
          description: 'Messaging governance parameters updated successfully.',
          actionConfig: {
            path: '/admin/messaging',
            label: 'Open Messaging Hub',
          },
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Failed to persist settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTemplate = (templateId: string) => {
    setSettings((prev) => {
      const exists = prev.quickTemplateIds.includes(templateId);
      if (exists) {
        if (prev.quickTemplateIds.length <= 1) {
          toast({
            title: 'Minimum Template Required',
            description: 'You must maintain at least one quick template.',
            variant: 'destructive',
          });
          return prev;
        }
        return {
          ...prev,
          quickTemplateIds: prev.quickTemplateIds.filter((id) => id !== templateId),
        };
      }
      return {
        ...prev,
        quickTemplateIds: [...prev.quickTemplateIds, templateId],
      };
    });
  };

  const handleAddPromptStarter = () => {
    if (!newPrompt.trim()) return;
    if (settings.aiPromptStarters.length >= 6) {
      toast({
        title: 'Maximum Reached',
        description: 'You can define up to 6 custom AI prompt starters.',
        variant: 'destructive',
      });
      return;
    }
    setSettings((prev) => ({
      ...prev,
      aiPromptStarters: [...prev.aiPromptStarters, newPrompt.trim()],
    }));
    setNewPrompt('');
  };

  const handleRemovePromptStarter = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      aiPromptStarters: prev.aiPromptStarters.filter((_, i) => i !== index),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6 text-left', className)}>
      {/* 1. Low-Balance Alert Threshold */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">
                SMS Low-Balance Alert Threshold
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Display warning badges and top-up advisories when credit drops below this level.
              </CardDescription>
            </div>
            <CardInfoTooltip text="Governs the warning threshold displayed on the Top KPI Metrics Grid and Quick Message Composer." />
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="max-w-xs space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Minimum Reserve Units</label>
            <Input
              type="number"
              min={0}
              value={settings.lowBalanceThreshold}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  lowBalanceThreshold: Math.max(0, parseInt(e.target.value, 10) || 0),
                }))
              }
              className="min-h-[44px] rounded-xl text-sm tabular-nums"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Quick Templates Shortlist Selector */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">
                Dashboard Quick Templates Shortlist
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Choose which curated starter templates appear in the right-hand dashboard sidebar.
              </CardDescription>
            </div>
            <CardInfoTooltip text="Templates selected here will be instantly available in the Quick Templates card on the main Messaging Hub." />
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STARTER_TEMPLATES.map((tpl) => {
              const isSelected = settings.quickTemplateIds.includes(tpl.id);
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleToggleTemplate(tpl.id)}
                  className={cn(
                    'p-3 rounded-xl border text-left flex items-start justify-between gap-3 transition-all active:scale-[0.98]',
                    isSelected
                      ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                      : 'border-border/60 bg-muted/10 hover:border-border text-muted-foreground'
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{tpl.name}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{tpl.snippet}</p>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors',
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border/80 bg-background'
                    )}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 3. AI Assistant Prompt Starters */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">
                Messaging Hub Configuration
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Customize prompt suggestions displayed in the Hero Greeting banner pill.
              </CardDescription>
            </div>
            <CardInfoTooltip text="Staff can click these suggested prompts in the Hero Greeting card to quickly compose relevant announcements." />
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="space-y-2">
            {settings.aiPromptStarters.map((prompt, index) => (
              <div
                key={index}
                className="p-2.5 rounded-xl border border-border/60 bg-muted/10 flex items-center justify-between gap-2"
              >
                <span className="text-xs text-foreground font-medium">{prompt}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePromptStarter(index)}
                  className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg active:scale-[0.97]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Add seasonal starter (e.g. Announce mid-term exam schedule)..."
              className="min-h-[44px] rounded-xl text-xs sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddPromptStarter();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddPromptStarter}
              className="min-h-[44px] rounded-xl text-xs font-semibold px-4 active:scale-[0.97]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. Channel Maintenance Kill-Switches */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">
                Channel Maintenance & Kill-Switches
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Temporarily pause specific delivery channels during provider downtime or maintenance.
              </CardDescription>
            </div>
            <CardInfoTooltip text="When paused, agents cannot initiate dispatches on the disabled channel from the composer or quick actions." />
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="divide-y divide-border/60">
            {(['sms', 'whatsapp', 'email'] as const).map((channel) => (
              <div key={channel} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase">{channel} Outbound Dispatch</p>
                  <p className="text-[11px] text-muted-foreground">
                    {settings.channelKillSwitches[channel]
                      ? 'Channel is currently PAUSED for maintenance.'
                      : 'Channel is operational and accepting dispatches.'}
                  </p>
                </div>
                <Switch
                  checked={settings.channelKillSwitches[channel]}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      channelKillSwitches: {
                        ...prev.channelKillSwitches,
                        [channel]: checked,
                      },
                    }))
                  }
                  className="data-[state=checked]:bg-rose-600"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="min-h-[44px] rounded-xl px-6 font-semibold active:scale-[0.97] transition-all flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
