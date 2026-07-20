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
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { Tag as TagType, Pipeline, OnboardingStage, AutomationTrigger, Automation } from '@/lib/types';
import { MultiSelect } from '@/components/ui/multi-select';
import { TagSelector } from '@/components/tags';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { createTagAction } from '@/lib/tag-actions';

interface TriggerConfigPanelProps {
  /** Stable ID of the AutomationTriggerDef this panel is configuring. */
  triggerId: string;
  trigger: AutomationTrigger;
  config: Record<string, any>;
  onUpdateConfig: (updates: Record<string, any>) => void;
  allTags: TagType[];
  forms: { id: string; name?: string; title?: string }[];
  surveys: { id: string; internalName?: string; title?: string }[];
  pipelines: Pipeline[];
  stages: OnboardingStage[];
  webhookUrl: string;
  automations?: Automation[];
}

export const TriggerConfigPanel = React.memo(function TriggerConfigPanel({
  triggerId: _triggerId, // stored for parent routing; unused internally
  trigger,
  config,
  onUpdateConfig,
  allTags,
  forms,
  surveys,
  pipelines,
  stages,
  webhookUrl,
  automations = [],
}: TriggerConfigPanelProps) {
  const { toast } = useToast();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as { activeWorkspaceId?: string; activeOrganizationId?: string };
  const { user } = useUser();
  const [hasCopied, setHasCopied] = React.useState(false);

  const firestore = useFirestore();
  const params = useParams();
  const automationId = params.id as string;
  const [isListening, setIsListening] = React.useState(false);
  const [capturedPayload, setCapturedPayload] = React.useState<any>(config.capturedPayload || null);

  React.useEffect(() => {
    if (!firestore || !automationId || automationId === 'new') return;
    const unsub = onSnapshot(doc(firestore, 'automations', automationId), (snapshot) => {
      if (snapshot.exists()) {
        const autoData = snapshot.data();
        if (autoData?.latestCapturedWebhook) {
          setCapturedPayload(autoData.latestCapturedWebhook);
          
          // Sync it into the trigger config if it is different
          if (JSON.stringify(config.capturedPayload) !== JSON.stringify(autoData.latestCapturedWebhook)) {
            onUpdateConfig({ capturedPayload: autoData.latestCapturedWebhook });
          }

          setIsListening(prev => {
            if (prev) {
              toast({
                title: 'Webhook captured!',
                description: 'The incoming test webhook was successfully recorded.',
              });
            }
            return false;
          });
        }
      }
    });
    return () => unsub();
  }, [firestore, automationId, toast, config.capturedPayload, onUpdateConfig]);

  const handleToggleListening = async () => {
    const nextListening = !isListening;
    setIsListening(nextListening);

    if (nextListening) {
      setCapturedPayload(null);
      onUpdateConfig({ capturedPayload: null });

      if (firestore && automationId && automationId !== 'new') {
        try {
          await updateDoc(doc(firestore, 'automations', automationId), {
            latestCapturedWebhook: deleteField()
          });
        } catch (e) {
          console.error('[TriggerConfigPanel] Error clearing latestCapturedWebhook:', e);
        }
      }
    }
  };

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



  const tagOptions = React.useMemo(() => {
    return (allTags || []).map((t) => ({ label: t.name, value: t.id }));
  }, [allTags]);

  const renderValSyntax = (val: unknown) => {
    if (typeof val === 'string') {
      return <span className="text-emerald-800 dark:text-emerald-400 font-mono">"{String(val)}"</span>;
    }
    if (typeof val === 'number') {
      return <span className="text-amber-800 dark:text-amber-400 font-mono font-bold">{String(val)}</span>;
    }
    if (typeof val === 'boolean') {
      return <span className="text-purple-800 dark:text-purple-400 font-mono font-bold">{String(val)}</span>;
    }
    return <span className="text-zinc-900 dark:text-zinc-300 font-mono break-all">{JSON.stringify(val)}</span>;
  };

  return (
    <div className="w-full pt-1">
      {trigger === 'WEBHOOK_RECEIVED' ? (
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-500 bg-blue-500/5 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner text-left">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <Label className="text-[10px] font-semibold text-blue-500 flex items-center gap-2">
                <Globe className="h-3 w-3" /> Ingress Endpoint
              </Label>
              <Badge className="bg-blue-500 text-white border-none text-[8px] h-4">POST</Badge>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-inner overflow-hidden">
                <p className="text-[10px] font-mono text-blue-800 dark:text-blue-300 break-all select-all font-semibold">{webhookUrl}</p>
              </div>
              <Button size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-xl bg-card shadow-lg active:scale-[0.97]" onClick={copyWebhookUrl} type="button">
                {hasCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Webhook Capture</Label>
              {isListening ? (
                <span className="text-[9px] font-bold text-blue-500 animate-pulse">Listening...</span>
              ) : null}
            </div>

            {!capturedPayload ? (
              <div className="p-8 text-center bg-slate-950/20 rounded-2xl border border-dashed border-border/50">
                <Globe className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30 animate-pulse" />
                <p className="text-xs font-semibold text-muted-foreground">No payload captured yet</p>
                <p className="text-[9px] text-muted-foreground/60 mt-1 leading-relaxed">
                  Click the button below to start expectant capture, then send a POST request to your ingress endpoint.
                </p>
              </div>
            ) : (
              <div className="space-y-3 p-4 rounded-2xl bg-card border border-border/50 shadow-sm animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Captured Request</span>
                  <span className="text-[9px] font-medium text-muted-foreground/60">
                    {capturedPayload.capturedAt ? new Date(capturedPayload.capturedAt).toLocaleTimeString() : 'Recently'}
                  </span>
                </div>

                <Tabs defaultValue="body" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/50 p-1">
                    <TabsTrigger value="body" className="text-[10px] font-bold rounded-lg py-1.5">Body</TabsTrigger>
                    <TabsTrigger value="headers" className="text-[10px] font-bold rounded-lg py-1.5">Headers ({Object.keys(capturedPayload.headers || {}).length})</TabsTrigger>
                    <TabsTrigger value="files" className="text-[10px] font-bold rounded-lg py-1.5">Files ({capturedPayload.files?.length || 0})</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="body" className="pt-2">
                    <ScrollArea className="h-40 w-full rounded-xl bg-zinc-100/80 dark:bg-zinc-950 p-3 border border-zinc-200 dark:border-zinc-800/80 font-mono text-[9px]">
                      {Object.keys(capturedPayload.body || {}).length === 0 ? (
                        <span className="text-muted-foreground/50 italic">Empty JSON Body</span>
                      ) : (
                        <div className="space-y-1">
                          {Object.entries(capturedPayload.body || {}).map(([key, val]) => (
                            <div key={key} className="flex justify-between hover:bg-zinc-200/30 dark:hover:bg-white/5 px-2 rounded py-1.5 border-b border-zinc-200/60 dark:border-zinc-900 last:border-b-0">
                              <span className="text-blue-800 dark:text-blue-300 font-bold shrink-0">{key}</span>
                              <span className="truncate max-w-[220px]" title={String(val)}>{renderValSyntax(val)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="headers" className="pt-2">
                    <ScrollArea className="h-40 w-full rounded-xl bg-zinc-100/80 dark:bg-zinc-950 p-3 border border-zinc-200 dark:border-zinc-800/80 font-mono text-[9px]">
                      {Object.keys(capturedPayload.headers || {}).length === 0 ? (
                        <span className="text-muted-foreground/50 italic">No Headers</span>
                      ) : (
                        <div className="space-y-1">
                          {Object.entries(capturedPayload.headers || {}).map(([key, val]) => (
                            <div key={key} className="flex justify-between hover:bg-zinc-200/30 dark:hover:bg-white/5 px-2 rounded py-1.5 border-b border-zinc-200/60 dark:border-zinc-900 last:border-b-0">
                              <span className="text-indigo-800 dark:text-indigo-300 font-bold shrink-0">{key}</span>
                              <span className="text-zinc-900 dark:text-zinc-300 truncate max-w-[220px]" title={String(val)}>{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="files" className="pt-2">
                    <ScrollArea className="h-40 w-full rounded-xl bg-zinc-100/80 dark:bg-zinc-950 p-3 border border-zinc-200 dark:border-zinc-800/80 font-mono text-[9px]">
                      {!capturedPayload.files || capturedPayload.files.length === 0 ? (
                        <span className="text-muted-foreground/50 italic">No File Data Uploaded</span>
                      ) : (
                        <div className="space-y-2">
                          {capturedPayload.files.map((file: any, index: number) => (
                            <div key={index} className="p-3 rounded-xl bg-zinc-200/50 dark:bg-white/5 border border-zinc-300/60 dark:border-zinc-800/50 space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-emerald-800 dark:text-emerald-400 font-black truncate max-w-[220px]">{file.name}</span>
                                <span className="text-zinc-600 dark:text-zinc-400 text-[9px] font-bold">{(file.size / 1024).toFixed(1)} KB</span>
                              </div>
                              <div className="text-[8px] font-mono text-zinc-500 dark:text-zinc-500">Type: {file.type}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            <Button
              type="button"
              onClick={handleToggleListening}
              className={cn(
                "w-full h-10 rounded-xl font-bold text-xs transition-all shadow-md gap-2 border active:scale-[0.97]",
                isListening
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-blue-500 text-white border-blue-600 hover:bg-blue-600 shadow-blue-500/15"
              )}
            >
              {isListening ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                  Cancel Expectant Mode
                </>
              ) : (
                capturedPayload ? "Re-Capture Webhook Payload" : "Capture Webhook Response"
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {trigger === 'TAG_ADDED' || trigger === 'TAG_REMOVED' ? (
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner text-left">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                <Tag className="h-3 w-3" /> Filter by Tags
              </Label>
              <TagSelector
                currentTagIds={config.tagIds || []}
                onTagsChange={(val) => updateConfig({ tagIds: val })}
                className="w-full"
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-emerald-500/10 mt-3">
              <div className="space-y-0.5">
                <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3" /> Trigger Once Per Entity
                </Label>
                <p className="text-[9px] text-muted-foreground/70 leading-relaxed max-w-[260px]">
                  Each entity can only enter this automation once. Re-adding the tag after removal will not re-enroll.
                </p>
              </div>
              <Switch
                checked={!!config.enrollOnce}
                onCheckedChange={(val: boolean) => updateConfig({ enrollOnce: val })}
                className="data-[state=checked]:bg-emerald-500"
              />
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
                  {(pipelines || [])
                    .filter((p: Pipeline) => !activeWorkspaceId || p.workspaceIds?.includes(activeWorkspaceId))
                    .map((p: Pipeline) => (
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

      {trigger === 'AUTOMATION_ENTERED' || trigger === 'AUTOMATION_COMPLETED' ? (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-violet-500/5 p-6 rounded-[2rem] border border-violet-500/20 shadow-inner text-left">
          <Label className="text-[10px] font-semibold text-violet-600 flex items-center gap-2">
            <Settings2 className="h-3 w-3" /> Target Automation to Watch
          </Label>
          <Select
            value={config.watchAutomationId || 'all'}
            onValueChange={(v) => updateConfig({ watchAutomationId: v })}
          >
            <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4 text-left">
              <SelectValue placeholder="All automations" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
              <SelectItem value="all" className="rounded-lg p-2 font-semibold">Any/All Automations</SelectItem>
              {(automations || []).map((a) => (
                <SelectItem key={a.id} value={a.id} className="rounded-lg p-2 font-semibold">
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[9px] text-muted-foreground font-medium pl-1 leading-relaxed">
            Fires when a contact {trigger === 'AUTOMATION_ENTERED' ? 'enters' : 'completes'} the chosen workflow.
          </p>
        </div>
      ) : null}
    </div>
  );
});
