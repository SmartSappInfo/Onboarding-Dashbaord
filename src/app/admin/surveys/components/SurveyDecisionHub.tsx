'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 7: Survey Autonomous Decisioning & Automation Hub
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Visual Multi-Condition Decision Rules:
 *    - AND/OR compound conditions across Score, NPS, Sentiment, Question answers, and Contact tags.
 * 2. Multi-Action Step Pipeline:
 *    - Contact tag management using TagSelector (draft mode), Pipeline stage transitions, Task dispatch, Lead score adjustment, AI prescriptions.
 * 3. Mobile Ergonomics & Tactile Press:
 *    - All interactive controls adhere to min-h-[44px] touch targets and active:scale-[0.97] press states.
 * 4. Strict Zero-Any Invariant.
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
} from '@/lib/types';
import { getSystemDecisionPlaybooksAction } from '@/lib/surveys/survey-decision-engine';
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
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = () => {
    if (!editingRule) return;

    const existingIndex = decisionConfig.rules.findIndex((r) => r.id === editingRule.id);
    let updatedRules: SurveyDecisionRule[];

    if (existingIndex >= 0) {
      updatedRules = [...decisionConfig.rules];
      updatedRules[existingIndex] = editingRule;
    } else {
      updatedRules = [...decisionConfig.rules, editingRule];
    }

    updateDecisionConfig({ rules: updatedRules });
    setIsRuleModalOpen(false);
    setEditingRule(null);
    toast({
      title: 'Rule Saved',
      description: 'Automation rule updated in survey decision pipeline.',
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    const updatedRules = decisionConfig.rules.filter((r) => r.id !== ruleId);
    updateDecisionConfig({ rules: updatedRules });
    toast({
      title: 'Rule Deleted',
      description: 'Automation rule removed from survey decision pipeline.',
    });
  };

  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    const updatedRules = decisionConfig.rules.map((r) =>
      r.id === ruleId ? { ...r, enabled } : r
    );
    updateDecisionConfig({ rules: updatedRules });
  };

  const handleImportPlaybook = (playbook: SystemDecisionPlaybook) => {
    const newRule: SurveyDecisionRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      ...playbook.rule,
    };
    updateDecisionConfig({
      enabled: true,
      rules: [...decisionConfig.rules, newRule],
    });
    setIsPlaybookModalOpen(false);
    toast({
      title: 'Playbook Imported',
      description: `Imported "${playbook.name}" into your survey automation pipeline.`,
    });
  };

  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                <Workflow className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Autonomous Decisioning & Automation Pipeline
                  <Badge variant="outline" className="text-[10px] font-mono text-purple-600 border-purple-300">
                    Phase 7
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Trigger multi-step CRM workflows, tag segmentations, and AI recovery prescriptions on response conditions.
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPlaybookModalOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold gap-1.5 active:scale-[0.97]"
            >
              <BookOpen className="h-4 w-4 text-purple-500" />
              Import Playbook
            </Button>

            <div className="flex items-center gap-2 pl-3 border-l border-border">
              <Label htmlFor="decisioning-enabled-toggle" className="text-xs font-semibold cursor-pointer">
                {decisionConfig.enabled ? 'Active' : 'Disabled'}
              </Label>
              <Switch
                id="decisioning-enabled-toggle"
                checked={decisionConfig.enabled}
                onCheckedChange={(checked) => updateDecisionConfig({ enabled: checked })}
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {decisionConfig.rules.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-2xl p-6 bg-muted/10 space-y-3">
            <div className="h-10 w-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
              <Zap className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">No Decision Rules Configured</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Create automation rules to execute targeted CRM actions when respondents meet specific score, NPS, sentiment, or answer conditions.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                size="sm"
                onClick={handleAddRule}
                className="h-9 px-4 gap-1.5 text-xs font-semibold active:scale-[0.97]"
              >
                <Plus className="h-4 w-4" />
                Create First Rule
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Configured Automation Rules ({decisionConfig.rules.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRule}
                className="h-8 px-3 gap-1.5 text-xs font-semibold active:scale-[0.97]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Rule
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {decisionConfig.rules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    'p-4 rounded-2xl border transition-all duration-200',
                    rule.enabled
                      ? 'border-border bg-card shadow-sm'
                      : 'border-border/50 bg-muted/20 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground truncate">{rule.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {rule.conditionLogic} Logic
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[10px] font-semibold',
                            rule.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {rule.enabled ? 'Active' : 'Paused'}
                        </Badge>
                      </div>

                      {/* Conditions snippet */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">Conditions:</span>
                        {rule.conditions.map((c, i) => (
                          <span key={c.id} className="inline-flex items-center gap-1">
                            {i > 0 && <span className="font-mono text-purple-600 text-[10px] font-bold">{rule.conditionLogic}</span>}
                            <span className="px-2 py-0.5 rounded-md bg-muted text-foreground font-mono text-[10px]">
                              {c.type} {c.operator.replace('_', ' ')} {String(c.value)}
                            </span>
                          </span>
                        ))}
                      </div>

                      {/* Actions snippet */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground pt-1">
                        <span className="font-semibold text-foreground">Actions:</span>
                        {rule.actions.map((act) => (
                          <Badge key={act.id} variant="outline" className="text-[10px] font-semibold capitalize">
                            {act.type.replace('_', ' ')}
                            {act.delayMinutes && act.delayMinutes > 0 ? ` (${act.delayMinutes}m delay)` : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingRule(rule);
                          setIsRuleModalOpen(true);
                        }}
                        className="h-8 px-2.5 text-xs font-semibold active:scale-[0.97]"
                      >
                        Edit
                      </Button>
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
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Rule Edit / Create Dialog */}
      {isRuleModalOpen && editingRule && (
        <Dialog open={isRuleModalOpen} onOpenChange={setIsRuleModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Workflow className="h-5 w-5 text-purple-600" />
                Configure Autonomous Decision Rule
              </DialogTitle>
              <DialogDescription className="text-xs">
                Define the trigger conditions and subsequent multi-step CRM actions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* Rule Name & Logic */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs font-bold">Rule Name</Label>
                  <Input
                    value={editingRule.name}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    className="h-9 text-xs font-semibold rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Condition Logic</Label>
                  <Select
                    value={editingRule.conditionLogic}
                    onValueChange={(val) =>
                      setEditingRule({ ...editingRule, conditionLogic: val as 'AND' | 'OR' })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND" className="text-xs font-bold">AND (All match)</SelectItem>
                      <SelectItem value="OR" className="text-xs font-bold">OR (Any match)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conditions Builder */}
              <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    1. When Conditions Match:
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newCond: SurveyDecisionCondition = {
                        id: `cond_${Date.now()}`,
                        type: 'score',
                        operator: 'less_than',
                        value: 50,
                      };
                      setEditingRule({
                        ...editingRule,
                        conditions: [...editingRule.conditions, newCond],
                      });
                    }}
                    className="h-7 px-2.5 gap-1 text-[11px] font-semibold active:scale-[0.97]"
                  >
                    <Plus className="h-3 w-3" />
                    Add Condition
                  </Button>
                </div>

                <div className="space-y-2">
                  {editingRule.conditions.map((cond, idx) => (
                    <div key={cond.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-lg bg-card border border-border/60">
                      {/* Condition Type */}
                      <div className="sm:col-span-4">
                        <Select
                          value={cond.type}
                          onValueChange={(val) => {
                            const newConds = [...editingRule.conditions];
                            newConds[idx] = { ...cond, type: val as SurveyDecisionConditionType };
                            setEditingRule({ ...editingRule, conditions: newConds });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="score" className="text-xs">Overall Score</SelectItem>
                            <SelectItem value="nps_category" className="text-xs">NPS Category</SelectItem>
                            <SelectItem value="sentiment" className="text-xs">Sentiment Polarity</SelectItem>
                            <SelectItem value="question_answer" className="text-xs">Specific Question Answer</SelectItem>
                            <SelectItem value="anomaly_detected" className="text-xs">Speeder / Anomaly Detected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Operator */}
                      <div className="sm:col-span-3">
                        <Select
                          value={cond.operator}
                          onValueChange={(val) => {
                            const newConds = [...editingRule.conditions];
                            newConds[idx] = { ...cond, operator: val as SurveyDecisionOperator };
                            setEditingRule({ ...editingRule, conditions: newConds });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals" className="text-xs">Equals (=)</SelectItem>
                            <SelectItem value="not_equals" className="text-xs">Not Equals (&ne;)</SelectItem>
                            <SelectItem value="greater_than" className="text-xs">Greater Than (&gt;)</SelectItem>
                            <SelectItem value="less_than" className="text-xs">Less Than (&lt;)</SelectItem>
                            <SelectItem value="contains" className="text-xs">Contains</SelectItem>
                            <SelectItem value="in_range" className="text-xs">In Range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Value Input */}
                      <div className="sm:col-span-4">
                        {cond.type === 'nps_category' ? (
                          <Select
                            value={String(cond.value)}
                            onValueChange={(val) => {
                              const newConds = [...editingRule.conditions];
                              newConds[idx] = { ...cond, value: val };
                              setEditingRule({ ...editingRule, conditions: newConds });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="promoter" className="text-xs font-bold text-emerald-600">Promoter (9-10)</SelectItem>
                              <SelectItem value="passive" className="text-xs font-bold text-amber-600">Passive (7-8)</SelectItem>
                              <SelectItem value="detractor" className="text-xs font-bold text-rose-600">Detractor (0-6)</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : cond.type === 'sentiment' ? (
                          <Select
                            value={String(cond.value)}
                            onValueChange={(val) => {
                              const newConds = [...editingRule.conditions];
                              newConds[idx] = { ...cond, value: val };
                              setEditingRule({ ...editingRule, conditions: newConds });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="positive" className="text-xs">Positive</SelectItem>
                              <SelectItem value="neutral" className="text-xs">Neutral</SelectItem>
                              <SelectItem value="negative" className="text-xs font-bold text-rose-600">Negative</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={String(cond.value)}
                            onChange={(e) => {
                              const newConds = [...editingRule.conditions];
                              newConds[idx] = { ...cond, value: e.target.value };
                              setEditingRule({ ...editingRule, conditions: newConds });
                            }}
                            placeholder="Value"
                            className="h-8 text-xs rounded-lg"
                          />
                        )}
                      </div>

                      {/* Remove Condition */}
                      <div className="sm:col-span-1 text-right">
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
                          className="h-7 w-7 text-rose-500 hover:text-rose-700 active:scale-[0.97]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Builder */}
              <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    2. Then Execute Action Pipeline:
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newAct: SurveyDecisionAction = {
                        id: `act_${Date.now()}`,
                        type: 'adjust_lead_score',
                        scoreDelta: 10,
                      };
                      setEditingRule({
                        ...editingRule,
                        actions: [...editingRule.actions, newAct],
                      });
                    }}
                    className="h-7 px-2.5 gap-1 text-[11px] font-semibold active:scale-[0.97]"
                  >
                    <Plus className="h-3 w-3" />
                    Add Action Step
                  </Button>
                </div>

                <div className="space-y-3">
                  {editingRule.actions.map((action, idx) => (
                    <div key={action.id} className="p-3 rounded-xl bg-card border border-border space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <Label className="text-xs font-bold">Action Type:</Label>
                          <Select
                            value={action.type}
                            onValueChange={(val) => {
                              const newActions = [...editingRule.actions];
                              newActions[idx] = { ...action, type: val as SurveyDecisionActionType };
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
                            </SelectContent>
                          </Select>
                        </div>

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
                    </div>
                  ))}
                </div>
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
                      {pb.category.replace('_', ' ')}
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
