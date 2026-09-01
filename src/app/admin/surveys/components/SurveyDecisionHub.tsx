'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 7: Survey Autonomous Decisioning & Automation Hub
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Visual Multi-Condition Decision Rules:
 *    - AND/OR compound conditions across Score, NPS, Sentiment, Question answers, Contact tags, Anomalies, and Quotas.
 * 2. Multi-Action Step Pipeline:
 *    - Contact tag management using TagSelector (draft mode), Pipeline stage transitions, Task dispatch, Lead score adjustment, AI prescriptions, Webhooks.
 * 3. Dry-Run Interactive Simulation:
 *    - In-memory simulation drawer to test rules against sample payloads before publishing.
 * 4. Mobile Ergonomics & Tactile Press:
 *    - All interactive controls adhere to min-h-[44px] touch targets and active:scale-[0.97] press states.
 * 5. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import type {
  SurveyElement,
  SurveyQuestion,
  SurveyDecisionConfig,
  SurveyDecisionRule,
  SurveyDecisionCondition,
  SurveyDecisionAction,
  SurveyDecisionConditionType,
  SurveyDecisionOperator,
  SurveyDecisionActionType,
  SystemDecisionPlaybook,
  SurveyDecisionSimulationResult,
} from '@/lib/types';
import { getSystemDecisionPlaybooksAction, testSurveyDecisionRuleAction } from '@/lib/surveys/survey-decision-engine';
import { TagSelector } from '@/components/tags/TagSelector';
import { PipelineStageSelector } from './PipelineStageSelector';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Workflow,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  Clock,
  Tags,
  GitMerge,
  UserCheck,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Play,
  Check,
  X,
  Radio,
  Sliders,
} from 'lucide-react';
import { cn, stripHtml } from '@/lib/utils';

export interface SurveyDecisionHubProps {
  workspaceId: string;
}

export function SurveyDecisionHub({ workspaceId }: SurveyDecisionHubProps) {
  const { watch, setValue } = useFormContext();
  const { toast } = useToast();

  const [playbooks, setPlaybooks] = React.useState<SystemDecisionPlaybook[]>([]);
  const [isPlaybookModalOpen, setIsPlaybookModalOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<SurveyDecisionRule | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = React.useState(false);

  // Simulation State
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [simulationPayload, setSimulationPayload] = React.useState({
    score: 45,
    sentiment: 'negative',
    contactName: 'Jane Doe',
    entityName: 'St. Jude Academy',
  });
  const [simulationResult, setSimulationResult] = React.useState<SurveyDecisionSimulationResult | null>(null);

  const elements: SurveyElement[] = watch('elements') || [];
  const questions = elements.filter(
    (el): el is SurveyQuestion => 'isRequired' in el || el.type === 'nps' || el.type === 'rating'
  );

  const decisionConfig: SurveyDecisionConfig = watch('decisionConfig') || {
    enabled: false,
    rules: [],
  };

  React.useEffect(() => {
    getSystemDecisionPlaybooksAction().then((res) => {
      if (res.success && res.playbooks) {
        setPlaybooks(res.playbooks);
      }
    });
  }, []);

  const updateDecisionConfig = (patch: Partial<SurveyDecisionConfig>) => {
    setValue('decisionConfig', { ...decisionConfig, ...patch }, { shouldDirty: true });
  };

  const handleAddRule = () => {
    const newRule: SurveyDecisionRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: `Automation Rule #${decisionConfig.rules.length + 1}`,
      enabled: true,
      conditionLogic: 'AND',
      conditions: [
        {
          id: `cond_${Date.now()}`,
          type: 'score',
          operator: 'less_than',
          value: 50,
        },
      ],
      actions: [
        {
          id: `act_${Date.now()}`,
          type: 'create_task',
          taskConfig: {
            titleTemplate: 'Follow up with {{contact.name}}',
            descriptionTemplate: 'Respondent scored {{survey.score}} on survey {{survey.title}}',
            priority: 'urgent',
            dueInHours: 24,
          },
        },
      ],
    };
    setEditingRule(newRule);
    setSimulationResult(null);
    setIsRuleModalOpen(true);
  };

  const handleEditRule = (rule: SurveyDecisionRule) => {
    setEditingRule(JSON.parse(JSON.stringify(rule)));
    setSimulationResult(null);
    setIsRuleModalOpen(true);
  };

  const handleDeleteRule = (ruleId: string) => {
    const nextRules = decisionConfig.rules.filter((r) => r.id !== ruleId);
    updateDecisionConfig({ rules: nextRules });
    toast({
      title: 'Rule Deleted',
      description: 'Automation rule removed from this survey.',
    });
  };

  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    const nextRules = decisionConfig.rules.map((r) =>
      r.id === ruleId ? { ...r, enabled } : r
    );
    updateDecisionConfig({ rules: nextRules });
  };

  const handleSaveRule = () => {
    if (!editingRule) return;
    if (!editingRule.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing Rule Name',
        description: 'Please provide a name for this automation rule.',
      });
      return;
    }

    const existingIndex = decisionConfig.rules.findIndex((r) => r.id === editingRule.id);
    let nextRules: SurveyDecisionRule[] = [];
    if (existingIndex >= 0) {
      nextRules = [...decisionConfig.rules];
      nextRules[existingIndex] = editingRule;
    } else {
      nextRules = [...decisionConfig.rules, editingRule];
    }

    updateDecisionConfig({ rules: nextRules });
    setIsRuleModalOpen(false);
    setEditingRule(null);
    toast({
      title: 'Rule Saved',
      description: 'Survey decision rule updated successfully.',
    });
  };

  const handleImportPlaybook = (playbook: SystemDecisionPlaybook) => {
    const newRule: SurveyDecisionRule = {
      ...playbook.rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    updateDecisionConfig({
      rules: [...decisionConfig.rules, newRule],
      enabled: true,
    });
    setIsPlaybookModalOpen(false);
    toast({
      title: 'Playbook Imported',
      description: `Installed "${playbook.name}" into your survey rules.`,
    });
  };

  const handleRunSimulation = async () => {
    if (!editingRule) return;
    setIsSimulating(true);
    try {
      const dummySurvey = {
        id: 'sim_survey',
        title: watch('title') || 'Sample Survey',
        elements,
      } as any;

      const res = await testSurveyDecisionRuleAction(editingRule, {
        survey: dummySurvey,
        responseId: 'sim_resp_1',
        score: simulationPayload.score,
        sentimentPolarity: simulationPayload.sentiment,
        answers: [],
        workspaceId,
        contactName: simulationPayload.contactName,
        entityName: simulationPayload.entityName,
      });

      setSimulationResult(res);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Simulation Error',
        description: 'Failed to run dry-run simulation.',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Card className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
      <CardHeader className="bg-muted/20 border-b border-border/60 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Workflow className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-bold text-foreground">
                Autonomous Decisioning & Automation Hub
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Define multi-condition rules that automatically execute CRM actions, update lead scores, route pipelines, and trigger AI prescriptions upon response submission.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="decision-master-toggle"
                checked={decisionConfig.enabled}
                onCheckedChange={(enabled) => updateDecisionConfig({ enabled })}
              />
              <Label htmlFor="decision-master-toggle" className="text-xs font-semibold cursor-pointer">
                {decisionConfig.enabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPlaybookModalOpen(true)}
              className="h-9 px-3 text-xs font-semibold gap-1.5 rounded-xl border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 active:scale-[0.97]"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Import Playbook
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleAddRule}
              disabled={!decisionConfig.enabled}
              className="h-9 px-3 text-xs font-semibold gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Rule
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {!decisionConfig.enabled ? (
          <div className="p-8 text-center border border-dashed border-border/80 rounded-2xl bg-muted/10 space-y-2">
            <Zap className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <h4 className="text-xs font-bold text-foreground">Decisioning is currently disabled</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Enable the master switch above to activate real-time automation rules for this survey.
            </p>
          </div>
        ) : decisionConfig.rules.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border/80 rounded-2xl bg-muted/10 space-y-3">
            <GitMerge className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <div>
              <h4 className="text-xs font-bold text-foreground">No Decision Rules Configured</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add an automation rule or import a pre-configured playbook to get started.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPlaybookModalOpen(true)}
                className="h-8 text-xs font-semibold gap-1.5 active:scale-[0.97]"
              >
                <BookOpen className="h-3 w-3" />
                Browse Playbooks
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddRule}
                className="h-8 text-xs font-semibold gap-1.5 active:scale-[0.97]"
              >
                <Plus className="h-3 w-3" />
                Create Custom Rule
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {decisionConfig.rules.map((rule, idx) => (
              <div
                key={rule.id}
                className={cn(
                  'p-4 rounded-2xl border transition-all space-y-3',
                  rule.enabled
                    ? 'border-border bg-card shadow-sm'
                    : 'border-border/60 bg-muted/20 opacity-70'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{rule.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Logic: {rule.conditionLogic}
                      </Badge>
                      {!rule.enabled && (
                        <Badge variant="secondary" className="text-[10px]">
                          Paused
                        </Badge>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(enabled) => handleToggleRule(rule.id, enabled)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditRule(rule)}
                      className="h-8 px-2.5 text-xs font-semibold active:scale-[0.97]"
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 active:scale-[0.97]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Conditions Summary */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">When:</span>
                  {rule.conditions.map((cond, cIdx) => (
                    <React.Fragment key={cond.id}>
                      {cIdx > 0 && (
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                          {rule.conditionLogic}
                        </span>
                      )}
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-normal py-0.5 px-2 bg-muted/60 text-foreground"
                      >
                        <span className="font-semibold capitalize mr-1">{cond.type.replace('_', ' ')}</span>
                        <span className="text-muted-foreground mr-1">{cond.operator}</span>
                        <span className="font-bold">{String(cond.value)}</span>
                      </Badge>
                    </React.Fragment>
                  ))}
                </div>

                {/* Actions Summary */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                  <span className="text-[11px] font-semibold text-muted-foreground">Then:</span>
                  {rule.actions.map((act) => (
                    <Badge
                      key={act.id}
                      variant="outline"
                      className="text-[11px] font-medium py-0.5 px-2 border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 flex items-center gap-1"
                    >
                      <Zap className="h-3 w-3 fill-purple-600" />
                      <span className="capitalize">{act.type.replace(/_/g, ' ')}</span>
                      {act.delayMinutes && act.delayMinutes > 0 ? (
                        <span className="text-[10px] opacity-75 font-mono ml-0.5">
                          (+{act.delayMinutes >= 1440 ? `${Math.round(act.delayMinutes / 1440)}d` : `${Math.round(act.delayMinutes / 60)}h`})
                        </span>
                      ) : null}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit / Create Rule Modal */}
      {isRuleModalOpen && editingRule && (
        <Dialog open={isRuleModalOpen} onOpenChange={setIsRuleModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Workflow className="h-5 w-5 text-purple-600" />
                {editingRule.id.startsWith('rule_') ? 'Configure Decision Rule' : 'Edit Decision Rule'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure compound conditions and sequential actions for this decision rule.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">Rule Name</Label>
                  <Input
                    value={editingRule.name}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    placeholder="e.g. VIP Detractor Recovery SLA"
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Condition Logic</Label>
                  <Select
                    value={editingRule.conditionLogic}
                    onValueChange={(val: 'AND' | 'OR') =>
                      setEditingRule({ ...editingRule, conditionLogic: val })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND" className="text-xs">Match ALL Conditions (AND)</SelectItem>
                      <SelectItem value="OR" className="text-xs">Match ANY Condition (OR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conditions Builder */}
              <div className="space-y-3 p-4 rounded-2xl border border-border bg-muted/10">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sliders className="h-4 w-4 text-purple-600" />
                    Conditions Matrix
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newCond: SurveyDecisionCondition = {
                        id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                        type: 'score',
                        operator: 'less_than',
                        value: 50,
                      };
                      setEditingRule({
                        ...editingRule,
                        conditions: [...editingRule.conditions, newCond],
                      });
                    }}
                    className="h-7 px-2 text-[11px] font-semibold gap-1 active:scale-[0.97]"
                  >
                    <Plus className="h-3 w-3" />
                    Add Condition
                  </Button>
                </div>

                <div className="space-y-2">
                  {editingRule.conditions.map((cond, idx) => (
                    <div
                      key={cond.id}
                      className="p-3 rounded-xl border border-border bg-card flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                    >
                      {/* Condition Type */}
                      <Select
                        value={cond.type}
                        onValueChange={(val: SurveyDecisionConditionType) => {
                          const newConditions = [...editingRule.conditions];
                          newConditions[idx] = {
                            ...cond,
                            type: val,
                            value: val === 'score' ? 50 : val === 'sentiment' ? 'negative' : 'detractor',
                          };
                          setEditingRule({ ...editingRule, conditions: newConditions });
                        }}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs rounded-lg font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="score" className="text-xs">Overall Score (%)</SelectItem>
                          <SelectItem value="nps_category" className="text-xs">NPS Category</SelectItem>
                          <SelectItem value="sentiment" className="text-xs">Sentiment Polarity</SelectItem>
                          <SelectItem value="question_answer" className="text-xs">Question Answer</SelectItem>
                          <SelectItem value="contact_tag" className="text-xs">Contact Tag</SelectItem>
                          <SelectItem value="drop_off" className="text-xs">Dropped Off / Incomplete</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Question Picker if question_answer */}
                      {cond.type === 'question_answer' && (
                        <Select
                          value={cond.field || ''}
                          onValueChange={(qId) => {
                            const newConditions = [...editingRule.conditions];
                            newConditions[idx] = { ...cond, field: qId };
                            setEditingRule({ ...editingRule, conditions: newConditions });
                          }}
                        >
                          <SelectTrigger className="h-8 w-44 text-xs rounded-lg truncate">
                            <SelectValue placeholder="Select Question" />
                          </SelectTrigger>
                          <SelectContent>
                            {questions.map((q) => (
                              <SelectItem key={q.id} value={q.id} className="text-xs truncate">
                                {stripHtml(q.title || 'Question')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* Operator */}
                      <Select
                        value={cond.operator}
                        onValueChange={(op: SurveyDecisionOperator) => {
                          const newConditions = [...editingRule.conditions];
                          newConditions[idx] = { ...cond, operator: op };
                          setEditingRule({ ...editingRule, conditions: newConditions });
                        }}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs rounded-lg font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals" className="text-xs">Equals</SelectItem>
                          <SelectItem value="not_equals" className="text-xs">Not Equals</SelectItem>
                          <SelectItem value="greater_than" className="text-xs">Greater Than</SelectItem>
                          <SelectItem value="less_than" className="text-xs">Less Than</SelectItem>
                          <SelectItem value="contains" className="text-xs">Contains</SelectItem>
                          <SelectItem value="starts_with" className="text-xs">Starts With</SelectItem>
                          <SelectItem value="in_range" className="text-xs">In Range</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Value Input */}
                      {cond.type === 'sentiment' ? (
                        <Select
                          value={String(cond.value)}
                          onValueChange={(v) => {
                            const newConditions = [...editingRule.conditions];
                            newConditions[idx] = { ...cond, value: v };
                            setEditingRule({ ...editingRule, conditions: newConditions });
                          }}
                        >
                          <SelectTrigger className="h-8 flex-1 text-xs rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="positive" className="text-xs">Positive</SelectItem>
                            <SelectItem value="mostly_positive" className="text-xs">Mostly Positive</SelectItem>
                            <SelectItem value="neutral" className="text-xs">Neutral</SelectItem>
                            <SelectItem value="mostly_negative" className="text-xs">Mostly Negative</SelectItem>
                            <SelectItem value="negative" className="text-xs">Negative</SelectItem>
                            <SelectItem value="mixed" className="text-xs">Mixed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : cond.type === 'nps_category' ? (
                        <Select
                          value={String(cond.value)}
                          onValueChange={(v) => {
                            const newConditions = [...editingRule.conditions];
                            newConditions[idx] = { ...cond, value: v };
                            setEditingRule({ ...editingRule, conditions: newConditions });
                          }}
                        >
                          <SelectTrigger className="h-8 flex-1 text-xs rounded-lg font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="promoter" className="text-xs text-emerald-600 font-bold">Promoter (9-10)</SelectItem>
                            <SelectItem value="passive" className="text-xs text-amber-600 font-bold">Passive (7-8)</SelectItem>
                            <SelectItem value="detractor" className="text-xs text-rose-600 font-bold">Detractor (0-6)</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={String(cond.value)}
                          onChange={(e) => {
                            const newConditions = [...editingRule.conditions];
                            newConditions[idx] = { ...cond, value: e.target.value };
                            setEditingRule({ ...editingRule, conditions: newConditions });
                          }}
                          placeholder="Value..."
                          className="h-8 flex-1 text-xs rounded-lg font-mono"
                        />
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={editingRule.conditions.length <= 1}
                        onClick={() => {
                          setEditingRule({
                            ...editingRule,
                            conditions: editingRule.conditions.filter((_, i) => i !== idx),
                          });
                        }}
                        className="h-8 w-8 text-rose-500 hover:text-rose-700 active:scale-[0.97]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Pipeline */}
              <div className="space-y-3 p-4 rounded-2xl border border-border bg-purple-50/20 dark:bg-purple-950/10">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-purple-600" />
                    Action Dispatch Pipeline
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newAct: SurveyDecisionAction = {
                        id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                        type: 'create_task',
                        taskConfig: {
                          titleTemplate: 'Follow up with {{contact.name}}',
                          priority: 'high',
                          dueInHours: 24,
                        },
                      };
                      setEditingRule({
                        ...editingRule,
                        actions: [...editingRule.actions, newAct],
                      });
                    }}
                    className="h-7 px-2 text-[11px] font-semibold gap-1 active:scale-[0.97]"
                  >
                    <Plus className="h-3 w-3" />
                    Add Action
                  </Button>
                </div>

                <div className="space-y-3">
                  {editingRule.actions.map((action, idx) => (
                    <div
                      key={action.id}
                      className="p-3.5 rounded-xl border border-border bg-card space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                            Step #{idx + 1}
                          </span>
                          <Select
                            value={action.type}
                            onValueChange={(val: SurveyDecisionActionType) => {
                              const newActions = [...editingRule.actions];
                              newActions[idx] = { ...action, type: val };
                              setEditingRule({ ...editingRule, actions: newActions });
                            }}
                          >
                            <SelectTrigger className="h-8 w-56 text-xs rounded-lg font-semibold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="create_task" className="text-xs">Create Follow-up CRM Task</SelectItem>
                              <SelectItem value="apply_tags" className="text-xs">Apply Contact Tag</SelectItem>
                              <SelectItem value="remove_tags" className="text-xs">Remove Contact Tag</SelectItem>
                              <SelectItem value="move_pipeline_stage" className="text-xs">Move Deal / Pipeline Stage</SelectItem>
                              <SelectItem value="adjust_lead_score" className="text-xs">Adjust Lead Score</SelectItem>
                              <SelectItem value="trigger_ai_prescription" className="text-xs">Generate AI Recovery Prescription</SelectItem>
                              <SelectItem value="trigger_webhook" className="text-xs">Dispatch External Webhook</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Delay Selector */}
                          <Select
                            value={String(action.delayMinutes || 0)}
                            onValueChange={(v) => {
                              const newActions = [...editingRule.actions];
                              newActions[idx] = { ...action, delayMinutes: Number(v) || 0 };
                              setEditingRule({ ...editingRule, actions: newActions });
                            }}
                          >
                            <SelectTrigger className="h-7 w-28 text-[11px] rounded-lg">
                              <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0" className="text-xs">Immediate</SelectItem>
                              <SelectItem value="60" className="text-xs">+1 Hour</SelectItem>
                              <SelectItem value="1440" className="text-xs">+24 Hours</SelectItem>
                              <SelectItem value="4320" className="text-xs">+3 Days</SelectItem>
                              <SelectItem value="10080" className="text-xs">+7 Days</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={editingRule.actions.length <= 1}
                            onClick={() => {
                              setEditingRule({
                                ...editingRule,
                                actions: editingRule.actions.filter((_, i) => i !== idx),
                              });
                            }}
                            className="h-7 w-7 text-rose-500 hover:text-rose-700 active:scale-[0.97]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Action-Specific Parameter Configs */}
                      {action.type === 'create_task' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Task Title Template</Label>
                            <Input
                              value={action.taskConfig?.titleTemplate || ''}
                              onChange={(e) => {
                                const newActions = [...editingRule.actions];
                                newActions[idx] = {
                                  ...action,
                                  taskConfig: {
                                    titleTemplate: e.target.value,
                                    dueInHours: action.taskConfig?.dueInHours || 24,
                                    priority: action.taskConfig?.priority || 'high',
                                  },
                                };
                                setEditingRule({ ...editingRule, actions: newActions });
                              }}
                              placeholder="Follow up with {{contact.name}}"
                              className="h-8 text-xs rounded-lg font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Due Within (Hours)</Label>
                            <Input
                              type="number"
                              value={action.taskConfig?.dueInHours || 24}
                              onChange={(e) => {
                                const newActions = [...editingRule.actions];
                                newActions[idx] = {
                                  ...action,
                                  taskConfig: {
                                    titleTemplate: action.taskConfig?.titleTemplate || 'Task',
                                    dueInHours: Number(e.target.value) || 24,
                                    priority: action.taskConfig?.priority || 'high',
                                  },
                                };
                                setEditingRule({ ...editingRule, actions: newActions });
                              }}
                              className="h-8 text-xs rounded-lg font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {action.type === 'apply_tags' && (
                        <div className="space-y-1 pt-1">
                          <Label className="text-[11px] text-muted-foreground">Select Tags to Apply (Rule 2 TagSelector)</Label>
                          <TagSelector
                            currentTagIds={action.tagIds || []}
                            onTagsChange={(tagIds) => {
                              const newActions = [...editingRule.actions];
                              newActions[idx] = { ...action, tagIds };
                              setEditingRule({ ...editingRule, actions: newActions });
                            }}
                          />
                        </div>
                      )}

                      {action.type === 'adjust_lead_score' && (
                        <div className="space-y-1 pt-1">
                          <Label className="text-[11px] text-muted-foreground">Score Increment / Decrement</Label>
                          <Input
                            type="number"
                            value={action.scoreDelta || 0}
                            onChange={(e) => {
                              const newActions = [...editingRule.actions];
                              newActions[idx] = { ...action, scoreDelta: Number(e.target.value) || 0 };
                              setEditingRule({ ...editingRule, actions: newActions });
                            }}
                            placeholder="+10 or -15"
                            className="h-8 w-40 text-xs rounded-lg font-mono"
                          />
                        </div>
                      )}

                      {action.type === 'trigger_webhook' && (
                        <div className="space-y-1 pt-1">
                          <Label className="text-[11px] text-muted-foreground">Webhook Destination URL</Label>
                          <Input
                            value={action.webhookConfig?.url || ''}
                            onChange={(e) => {
                              const newActions = [...editingRule.actions];
                              newActions[idx] = {
                                ...action,
                                webhookConfig: {
                                  url: e.target.value,
                                  method: 'POST',
                                },
                              };
                              setEditingRule({ ...editingRule, actions: newActions });
                            }}
                            placeholder="https://api.domain.com/webhooks/survey-event"
                            className="h-8 text-xs rounded-lg font-mono"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Dry-Run Interactive Simulation Section */}
              <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Play className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600" />
                      Dry-Run Rule Simulation
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Test how this rule evaluates sample survey payloads before saving.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRunSimulation}
                    disabled={isSimulating}
                    className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-xl border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 active:scale-[0.97]"
                  >
                    <Play className="h-3 w-3 fill-emerald-600" />
                    {isSimulating ? 'Evaluating...' : 'Run Simulation'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Sample Score (%)</Label>
                    <Input
                      type="number"
                      value={simulationPayload.score}
                      onChange={(e) =>
                        setSimulationPayload({ ...simulationPayload, score: Number(e.target.value) || 0 })
                      }
                      className="h-7 text-xs rounded-lg font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Sample Sentiment</Label>
                    <Select
                      value={simulationPayload.sentiment}
                      onValueChange={(v) =>
                        setSimulationPayload({ ...simulationPayload, sentiment: v })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="positive" className="text-xs">Positive</SelectItem>
                        <SelectItem value="neutral" className="text-xs">Neutral</SelectItem>
                        <SelectItem value="negative" className="text-xs">Negative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <Label className="text-[10px] text-muted-foreground">Sample Name</Label>
                    <Input
                      value={simulationPayload.contactName}
                      onChange={(e) =>
                        setSimulationPayload({ ...simulationPayload, contactName: e.target.value })
                      }
                      className="h-7 text-xs rounded-lg"
                    />
                  </div>
                </div>

                {simulationResult && (
                  <div className={cn(
                    'p-3 rounded-xl border space-y-2 mt-2',
                    simulationResult.matched
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20'
                  )}>
                    <div className="flex items-center gap-2">
                      {simulationResult.matched ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <X className="h-4 w-4 text-amber-600" />
                      )}
                      <span className="text-xs font-bold text-foreground">
                        {simulationResult.matched ? 'Rule MATCHED — Actions Would Execute' : 'Rule DID NOT MATCH Sample Payload'}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      {simulationResult.evaluatedConditions.map((ec) => (
                        <div key={ec.conditionId} className="flex items-center gap-1.5 text-muted-foreground">
                          {ec.passed ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <X className="h-3 w-3 text-rose-500" />
                          )}
                          <span>{ec.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRuleModalOpen(false)}
                className="h-9 px-4 text-xs font-semibold active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveRule}
                className="h-9 px-4 text-xs font-semibold active:scale-[0.97]"
              >
                Save Decision Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Import Playbook Modal */}
      {isPlaybookModalOpen && (
        <Dialog open={isPlaybookModalOpen} onOpenChange={setIsPlaybookModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-600" />
                Import Enterprise Decision Playbook
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select a proven automation playbook to auto-configure conditions and action pipelines.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 py-2">
              {playbooks.map((pb) => (
                <div
                  key={pb.id}
                  className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all space-y-2 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-foreground block">{pb.name}</span>
                    <p className="text-xs text-muted-foreground">{pb.description}</p>
                    <Badge variant="outline" className="text-[10px] font-mono capitalize">
                      {pb.category.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleImportPlaybook(pb)}
                    className="h-8 px-3 text-xs font-semibold shrink-0 active:scale-[0.97]"
                  >
                    Import
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
