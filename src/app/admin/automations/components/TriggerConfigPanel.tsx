import * as React from 'react';
import { 
  Globe, 
  Copy, 
  Check, 
  Tag, 
  X, 
  Database, 
  Play, 
  Target, 
  ArrowRightLeft, 
  Settings2, 
  Clock, 
  Activity 
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { Tag as TagType, Pipeline, OnboardingStage, AutomationTrigger } from '@/lib/types';

interface TriggerConfigPanelProps {
  trigger: AutomationTrigger;
  config: Record<string, any>;
  onUpdateConfig: (updates: Record<string, any>) => void;
  allTags: TagType[];
  forms: { id: string; name?: string; title?: string }[];
  surveys: { id: string; internalName?: string; title?: string }[];
  pipelines: Pipeline[];
  stages: OnboardingStage[];
  webhookUrl: string;
}

export const TriggerConfigPanel = React.memo(function TriggerConfigPanel({
  trigger,
  config,
  onUpdateConfig,
  allTags,
  forms,
  surveys,
  pipelines,
  stages,
  webhookUrl,
}: TriggerConfigPanelProps) {
  const { toast } = useToast();
  const [hasCopied, setHasCopied] = React.useState(false);

  const copyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setHasCopied(true);
    toast({ title: 'Webhook Endpoint Copied' });
    setTimeout(() => setHasCopied(false), 2000);
  };

  const updateConfig = (updates: Record<string, any>) => {
    onUpdateConfig(updates);
  };

  return (
    <div className="w-full pt-1">
      {trigger === 'WEBHOOK_RECEIVED' ? (
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-500 bg-blue-500/5 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <Label className="text-[10px] font-semibold text-blue-500 flex items-center gap-2">
                <Globe className="h-3 w-3" /> Ingress Endpoint
              </Label>
              <Badge className="bg-blue-500 text-white border-none text-[8px] h-4">POST</Badge>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 p-3 rounded-xl bg-slate-950/50 border border-white/5 shadow-inner overflow-hidden">
                <p className="text-[10px] font-mono text-blue-500 break-all select-all">{webhookUrl}</p>
              </div>
              <Button size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-xl bg-card shadow-lg" onClick={copyWebhookUrl}>
                {hasCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {trigger === 'TAG_ADDED' || trigger === 'TAG_REMOVED' ? (
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                <Tag className="h-3 w-3" /> Filter by Tags
              </Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(config.tagIds || []).map((id: string) => {
                  const tag = allTags?.find((t: TagType) => t.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 rounded-lg bg-emerald-500/10 text-emerald-600 border-none group animate-in zoom-in-95 duration-150">
                      <span className="text-[10px] font-bold tracking-tight">{tag?.name || id}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-4 w-4 rounded-md hover:bg-emerald-500/20"
                        onClick={() => updateConfig({ tagIds: config.tagIds.filter((t: string) => t !== id) })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
              <Select 
                value="" 
                onValueChange={(v) => {
                  const current = config.tagIds || [];
                  if (!current.includes(v)) {
                    updateConfig({ tagIds: [...current, v] });
                  }
                }}
              >
                <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                  <SelectValue placeholder="Add tags to watch..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                  {(allTags || []).map((tag: TagType) => (
                    <SelectItem key={tag.id} value={tag.id} className="rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="font-bold text-xs">{tag.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : null}

      {trigger === 'FORM_SUBMITTED' ? (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-blue-500/5 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner">
          <Label className="text-[10px] font-semibold text-blue-600 flex items-center gap-2">
            <Database className="h-3 w-3" /> Filter by Form
          </Label>
          <Select
            value={config.formId || 'all_forms'}
            onValueChange={(v) => updateConfig({ formId: v === 'all_forms' ? null : v })}
          >
            <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
              <SelectValue placeholder="All forms" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
              <SelectItem value="all_forms" className="rounded-lg p-2 font-semibold">All Forms</SelectItem>
              {(forms || []).map((f) => (
                <SelectItem key={f.id} value={f.id} className="rounded-lg p-2 font-semibold">
                  {f.name || f.title || f.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {trigger === 'SURVEY_SUBMITTED' ? (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-blue-500/5 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner">
          <Label className="text-[10px] font-semibold text-blue-600 flex items-center gap-2">
            <Database className="h-3 w-3" /> Filter by Survey
          </Label>
          <Select
            value={config.surveyId || 'all_surveys'}
            onValueChange={(v) => updateConfig({ surveyId: v === 'all_surveys' ? null : v })}
          >
            <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
              <SelectValue placeholder="All surveys" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
              <SelectItem value="all_surveys" className="rounded-lg p-2 font-semibold">All Surveys</SelectItem>
              {(surveys || []).map((s) => (
                <SelectItem key={s.id} value={s.id} className="rounded-lg p-2 font-semibold">
                  {s.internalName || s.title || s.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {trigger === 'MEETING_CREATED' ||
      trigger === 'MEETING_REGISTRANT_ADDED' ||
      trigger === 'MEETING_REGISTRANT_ATTENDED' ||
      trigger === 'MEETING_REGISTRANT_NO_SHOW' ? (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-indigo-500/5 p-6 rounded-[2rem] border border-indigo-500/20 shadow-inner">
          <Label className="text-[10px] font-semibold text-indigo-600 flex items-center gap-2">
            <Play className="h-3 w-3" /> Meeting Type ID
          </Label>
          <Input
            value={config.meetingTypeId || ''}
            onChange={(e) => updateConfig({ meetingTypeId: e.target.value || null })}
            placeholder="Leave empty for all meeting types"
            className="h-10 rounded-xl bg-background border-none font-mono text-xs shadow-inner"
          />
        </div>
      ) : null}

      {trigger === 'ENTITY_STAGE_CHANGED' || trigger === 'DEAL_STAGE_CHANGED' ? (
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-500 bg-primary/5 p-6 rounded-[2rem] border border-primary/20 shadow-inner">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-primary flex items-center gap-2">
                <Target className="h-3.5 w-3.5" /> Scoped Pipeline
              </Label>
              <Select 
                value={config.pipelineId || 'all_pipelines'} 
                onValueChange={(v) => updateConfig({ pipelineId: v === 'all_pipelines' ? null : v, stageId: null })}
              >
                <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                  <SelectValue placeholder="All Pipelines" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                  <SelectItem value="all_pipelines" className="rounded-lg p-2 font-semibold">All Pipelines</SelectItem>
                  {(pipelines || []).map((p: Pipeline) => (
                    <SelectItem key={p.id} value={p.id} className="rounded-lg p-2 font-semibold">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-primary flex items-center gap-2">
                <ArrowRightLeft className="h-3.5 w-3.5" /> Targeted Stage
              </Label>
              <Select 
                value={config.stageId || 'all_stages'} 
                onValueChange={(v) => updateConfig({ stageId: v === 'all_stages' ? null : v })}
                disabled={!config.pipelineId}
              >
                <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                  <SelectValue placeholder={config.pipelineId ? "All Stages" : "Choose pipeline first"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                  <SelectItem value="all_stages" className="rounded-lg p-2 font-semibold">All Stages</SelectItem>
                  {(stages || [])
                    .filter((s: OnboardingStage) => s.pipelineId === config.pipelineId)
                    .map((s: OnboardingStage) => (
                      <SelectItem key={s.id} value={s.id} className="rounded-lg p-2 font-semibold">{s.name}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : null}

      {trigger === 'ENTITY_FIELD_CHANGED' ? (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
          <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
            <Settings2 className="h-3 w-3" /> Field to Watch
          </Label>
          <Input
            value={config.fieldPath || ''}
            onChange={(e) => updateConfig({ fieldPath: e.target.value })}
            placeholder="e.g. status, industry, or customFields.key"
            className="h-10 rounded-xl bg-background border-none font-mono text-xs shadow-inner"
          />
          <p className="text-[9px] text-muted-foreground font-medium pl-1 leading-relaxed">
            Specifies the entity or custom field pathway to monitor for mutations.
          </p>
        </div>
      ) : null}

      {trigger === 'DATE_REACHED' ? (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
              <Clock className="h-3 w-3" /> Date Field
            </Label>
            <Input
              value={config.dateField || ''}
              onChange={(e) => updateConfig({ dateField: e.target.value })}
              placeholder="e.g. createdAt, trialEnd, customFields.renewalDate"
              className="h-10 rounded-xl bg-background border-none font-mono text-xs shadow-inner"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
              Offset Days
            </Label>
            <Input
              type="number"
              value={config.offsetDays ?? 0}
              onChange={(e) => updateConfig({ offsetDays: parseInt(e.target.value, 10) || 0 })}
              placeholder="0"
              className="h-10 rounded-xl bg-background border-none text-xs shadow-inner"
            />
            <p className="text-[8px] text-muted-foreground font-bold pl-1 uppercase">
              Use negative values for days before, positive for days after.
            </p>
          </div>
        </div>
      ) : null}

      {trigger === 'SCORE_CHANGED' ? (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
              <Activity className="h-3 w-3" /> Target Score Type
            </Label>
            <Select
              value={config.scoreType || 'overallScore'}
              onValueChange={(v) => updateConfig({ scoreType: v })}
            >
              <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                <SelectValue placeholder="overallScore" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl p-2">
                <SelectItem value="overallScore" className="rounded-lg p-2 font-semibold">Overall Health Score</SelectItem>
                <SelectItem value="usageScore" className="rounded-lg p-2 font-semibold">Usage Score</SelectItem>
                <SelectItem value="supportScore" className="rounded-lg p-2 font-semibold">Support Score</SelectItem>
                <SelectItem value="engagementScore" className="rounded-lg p-2 font-semibold">Engagement Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
              Operator
            </Label>
            <Select
              value={config.operator || 'any_change'}
              onValueChange={(v) => updateConfig({ operator: v, threshold: v === 'any_change' ? null : (config.threshold ?? 50) })}
            >
              <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                <SelectValue placeholder="Any Change" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl p-2">
                <SelectItem value="any_change" className="rounded-lg p-2 font-semibold">Any Change</SelectItem>
                <SelectItem value="greater_than" className="rounded-lg p-2 font-semibold">Greater Than (&gt;)</SelectItem>
                <SelectItem value="less_than" className="rounded-lg p-2 font-semibold">Less Than (&lt;)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {config.operator && config.operator !== 'any_change' ? (
            <div className="space-y-2 animate-in slide-in-from-top-1">
              <Label className="text-[10px] font-semibold text-emerald-600">Threshold Value</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={config.threshold ?? 50}
                onChange={(e) => updateConfig({ threshold: parseInt(e.target.value, 10) || 0 })}
                className="h-10 rounded-xl bg-background border-none text-xs shadow-inner"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {trigger === 'ENTITY_INACTIVE' ? (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
          <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
            <Clock className="h-3 w-3" /> Inactivity Threshold (Days)
          </Label>
          <Input
            type="number"
            min={1}
            value={config.inactivityDays ?? 30}
            onChange={(e) => updateConfig({ inactivityDays: parseInt(e.target.value, 10) || 30 })}
            className="h-10 rounded-xl bg-background border-none text-xs shadow-inner"
          />
          <p className="text-[9px] text-muted-foreground font-medium pl-1 leading-relaxed">
            Fires if no activity has been logged on the entity for this number of days.
          </p>
        </div>
      ) : null}

      {trigger === 'WEBPAGE_VISITED' ? (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-blue-500/5 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner">
          <Label className="text-[10px] font-semibold text-blue-600 flex items-center gap-2">
            <Globe className="h-3 w-3" /> Target URL Pattern
          </Label>
          <Input
            value={config.urlPattern || ''}
            onChange={(e) => updateConfig({ urlPattern: e.target.value })}
            placeholder="e.g. /pricing, /welcome, or *"
            className="h-10 rounded-xl bg-background border-none font-mono text-xs shadow-inner"
          />
          <p className="text-[9px] text-muted-foreground font-medium pl-1 leading-relaxed">
            Fires when a tracked visitor hits a URL matching this pattern.
          </p>
        </div>
      ) : null}

      {trigger === 'EVENT_RECORDED' ? (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
          <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
            <Activity className="h-3 w-3" /> Event Name
          </Label>
          <Input
            value={config.eventName || ''}
            onChange={(e) => updateConfig({ eventName: e.target.value })}
            placeholder="e.g. user_onboarded, plan_upgraded"
            className="h-10 rounded-xl bg-background border-none font-mono text-xs shadow-inner"
          />
          <p className="text-[9px] text-muted-foreground font-medium pl-1 leading-relaxed">
            Fires when a custom telemetry log matches this exact name.
          </p>
        </div>
      ) : null}
    </div>
  );
});
