'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Studio Inbound CRM Triggers Configuration Card
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Inbound CRM -> Survey event triggers configuration.
 * 2. Multi-channel auto-dispatch on Deal Won, Meeting Completed, Contact Created.
 * 3. Mobile ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import type {
  SurveyCrmConfig,
  SurveyCrmInboundTriggerRule,
  CrmInboundTriggerEvent,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Zap,
  Plus,
  Trash2,
  Clock,
  Send,
  Phone,
  Mail,
  MessageSquare,
  Sparkles,
  Handshake,
  Video,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SurveyCrmInboundTriggersCardProps {
  workspaceId: string;
}

export function SurveyCrmInboundTriggersCard({ workspaceId }: SurveyCrmInboundTriggersCardProps) {
  const { watch, setValue } = useFormContext();
  const { toast } = useToast();

  const crmConfig: SurveyCrmConfig = watch('crmConfig') || {
    enabled: false,
    autoUpsertContact: true,
    autoUpsertEntity: true,
    fieldMappings: [],
    taskRules: [],
    dealRules: [],
    timelineLoggingEnabled: true,
  };

  const inboundConfig = crmConfig.inboundTriggers || {
    enabled: false,
    rules: [],
  };

  const updateInboundConfig = (patch: Partial<typeof inboundConfig>) => {
    const updated = {
      ...inboundConfig,
      ...patch,
    };
    setValue('crmConfig', { ...crmConfig, inboundTriggers: updated }, { shouldDirty: true });
  };

  const handleAddRule = () => {
    const newRule: SurveyCrmInboundTriggerRule = {
      id: `inbound_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      enabled: true,
      event: 'deal_won',
      delayDays: 7,
      channel: 'whatsapp',
      customMessage: 'Thank you for your partnership! Please take 2 minutes to complete our CSAT survey.',
    };

    updateInboundConfig({
      enabled: true,
      rules: [...inboundConfig.rules, newRule],
    });

    toast({
      title: 'Inbound CRM Trigger Added',
      description: 'Configured auto-dispatch rule for CRM lifecycle events.',
    });
  };

  const handleUpdateRule = (ruleId: string, patch: Partial<SurveyCrmInboundTriggerRule>) => {
    const updatedRules = inboundConfig.rules.map((r) =>
      r.id === ruleId ? { ...r, ...patch } : r
    );
    updateInboundConfig({ rules: updatedRules });
  };

  const handleDeleteRule = (ruleId: string) => {
    const updatedRules = inboundConfig.rules.filter((r) => r.id !== ruleId);
    updateInboundConfig({ rules: updatedRules });
    toast({
      title: 'Rule Removed',
      description: 'Inbound CRM trigger rule deleted.',
    });
  };

  const getEventIcon = (event: CrmInboundTriggerEvent) => {
    switch (event) {
      case 'deal_won':
      case 'deal_stage_changed':
        return <Handshake className="h-4 w-4 text-emerald-500" />;
      case 'meeting_completed':
        return <Video className="h-4 w-4 text-blue-500" />;
      case 'contact_created':
      case 'lead_status_changed':
        return <UserCheck className="h-4 w-4 text-purple-500" />;
      default:
        return <Zap className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="py-4 px-5 sm:px-6 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                Inbound CRM Trigger Automations (CRM &rarr; Survey)
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono text-blue-600 border-blue-300">
                Phase 6
              </Badge>
              <CardInfoTooltip text="Automatically dispatch this survey to entity contacts when CRM lifecycle events occur." />
            </div>
          </div>

          <div className="flex items-center gap-2 pl-3 sm:border-l border-border shrink-0">
            <Label htmlFor="inbound-triggers-master-toggle" className="text-xs font-semibold cursor-pointer">
              {inboundConfig.enabled ? 'Active' : 'Disabled'}
            </Label>
            <Switch
              id="inbound-triggers-master-toggle"
              checked={inboundConfig.enabled}
              onCheckedChange={(checked) => updateInboundConfig({ enabled: checked })}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {inboundConfig.rules.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-2xl p-6 bg-muted/10 space-y-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
              <Zap className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">No Inbound CRM Triggers</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Trigger this survey automatically whenever a deal is won, a meeting concludes, or a new contact is enrolled.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAddRule}
              className="h-9 px-4 gap-1.5 text-xs font-semibold active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Add Trigger Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Configured Inbound Lifecycle Triggers ({inboundConfig.rules.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRule}
                className="h-8 px-3 gap-1.5 text-xs font-semibold active:scale-[0.97]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Trigger
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {inboundConfig.rules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    'p-4 rounded-xl border transition-all space-y-3',
                    rule.enabled
                      ? 'border-border bg-card shadow-sm'
                      : 'border-border/50 bg-muted/20 opacity-60'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="p-1.5 rounded-lg bg-muted border border-border/50">
                        {getEventIcon(rule.event)}
                      </div>
                      <Select
                        value={rule.event}
                        onValueChange={(val) =>
                          handleUpdateRule(rule.id, { event: val as CrmInboundTriggerEvent })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs font-bold w-48 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deal_won" className="text-xs font-semibold text-emerald-600">Deal Closed Won</SelectItem>
                          <SelectItem value="deal_stage_changed" className="text-xs font-semibold">Deal Stage Changed</SelectItem>
                          <SelectItem value="meeting_completed" className="text-xs font-semibold text-blue-600">Meeting Completed</SelectItem>
                          <SelectItem value="contact_created" className="text-xs font-semibold text-purple-600">New Contact Created</SelectItem>
                          <SelectItem value="lead_status_changed" className="text-xs font-semibold">Lead Status Changed</SelectItem>
                        </SelectContent>
                      </Select>

                      <Badge variant="outline" className="text-[10px] font-mono capitalize">
                        {rule.channel}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => handleUpdateRule(rule.id, { enabled: checked })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="h-8 w-8 text-rose-500 hover:text-rose-700 active:scale-[0.97]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Delivery Delay */}
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Delay Before Dispatch
                      </Label>
                      <Select
                        value={String(rule.delayDays ?? 0)}
                        onValueChange={(val) => handleUpdateRule(rule.id, { delayDays: Number(val) })}
                      >
                        <SelectTrigger className="h-8 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0" className="text-xs">Immediate (0 days)</SelectItem>
                          <SelectItem value="1" className="text-xs">After 1 Day</SelectItem>
                          <SelectItem value="3" className="text-xs">After 3 Days</SelectItem>
                          <SelectItem value="7" className="text-xs">After 7 Days (Recommended for CSAT)</SelectItem>
                          <SelectItem value="14" className="text-xs">After 14 Days</SelectItem>
                          <SelectItem value="30" className="text-xs">After 30 Days (Onboarding Review)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Delivery Channel */}
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Send className="h-3 w-3" /> Notification Channel
                      </Label>
                      <Select
                        value={rule.channel}
                        onValueChange={(val) =>
                          handleUpdateRule(rule.id, { channel: val as 'email' | 'sms' | 'whatsapp' })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp" className="text-xs font-semibold text-emerald-600">WhatsApp</SelectItem>
                          <SelectItem value="email" className="text-xs font-semibold text-blue-600">Email</SelectItem>
                          <SelectItem value="sms" className="text-xs font-semibold text-purple-600">SMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Message */}
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Custom Invitation Message (Survey link will be appended)
                      </Label>
                      <Input
                        value={rule.customMessage || ''}
                        onChange={(e) => handleUpdateRule(rule.id, { customMessage: e.target.value })}
                        placeholder="Thank you for your partnership! Please take 2 minutes to complete our survey."
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
