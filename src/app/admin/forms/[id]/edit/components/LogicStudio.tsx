'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  PlusCircle,
  Trash2,
  GitBranch,
  AlertTriangle,
  Sparkles,
  Calculator,
  Award,
  Layers,
  Eye,
  EyeOff,
  XCircle,
} from 'lucide-react';
import type { FormFieldInstance, AppField } from '@/lib/types';
import type { FormPage } from '@/lib/forms/form-types';
import type {
  FormLogicRule,
  LogicComparisonOperator,
  LogicActionType,
  FormCalculationRule,
  FormScoreRule,
} from '@/lib/forms/form-logic-types';
import { evaluateFormLogic, detectLogicCycles } from '@/lib/forms/logic-engine';
import CalculationEditor from './CalculationEditor';
import ScoringRulesManager from './ScoringRulesManager';
import { cn } from '@/lib/utils';

interface LogicStudioProps {
  fields: FormFieldInstance[];
  pages?: FormPage[];
  getAppField: (appFieldId: string) => AppField | undefined;
  rules: FormLogicRule[];
  onRulesChange: (rules: FormLogicRule[]) => void;
  calculations?: FormCalculationRule[];
  onCalculationsChange?: (calculations: FormCalculationRule[]) => void;
  scoreRules?: FormScoreRule[];
  onScoreRulesChange?: (scoreRules: FormScoreRule[]) => void;
}

export default function LogicStudio({
  fields,
  pages = [],
  getAppField,
  rules = [],
  onRulesChange,
  calculations = [],
  onCalculationsChange,
  scoreRules = [],
  onScoreRulesChange,
}: LogicStudioProps) {
  const [activeTab, setActiveTab] = React.useState<'rules' | 'calculations' | 'scoring'>('rules');
  const [selectedRuleId, setSelectedRuleId] = React.useState<string | null>(rules[0]?.id || null);
  const [simulationData, setSimulationData] = React.useState<Record<string, unknown>>({});

  const selectedRule = React.useMemo(() =>
    rules.find(r => r.id === selectedRuleId) || null,
  [rules, selectedRuleId]);

  // DAG Cycle validation
  const cycleStatus = React.useMemo(() =>
    detectLogicCycles(pages, rules),
  [pages, rules]);

  // Simulation Evaluation (16ms reactive)
  const simulationResult = React.useMemo(() => {
    return evaluateFormLogic(rules, scoreRules, calculations, simulationData);
  }, [rules, scoreRules, calculations, simulationData]);

  const handleAddRule = () => {
    const newRuleId = `rule_${Date.now().toString(36)}`;
    const firstField = fields[0];
    const newRule: FormLogicRule = {
      id: newRuleId,
      name: `Logic Rule ${rules.length + 1}`,
      enabled: true,
      priority: rules.length,
      conditionGroup: {
        id: `cond_grp_${newRuleId}`,
        combinator: 'AND',
        conditions: [
          {
            id: `cond_1`,
            fieldId: firstField?.id || '',
            operator: 'equals',
            value: '',
          },
        ],
      },
      actions: [
        {
          id: `act_1`,
          type: 'show_field',
          targetFieldId: fields[1]?.id || firstField?.id || '',
        },
      ],
    };

    onRulesChange([...rules, newRule]);
    setSelectedRuleId(newRuleId);
  };

  const handleUpdateRule = (updated: FormLogicRule) => {
    onRulesChange(rules.map(r => (r.id === updated.id ? updated : r)));
  };

  const handleDeleteRule = (ruleId: string) => {
    const filtered = rules.filter(r => r.id !== ruleId);
    onRulesChange(filtered);
    if (selectedRuleId === ruleId) {
      setSelectedRuleId(filtered[0]?.id || null);
    }
  };

  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    onRulesChange(rules.map(r => (r.id === ruleId ? { ...r, enabled } : r)));
  };

  const handleAddCondition = (rule: FormLogicRule) => {
    const updatedConditions = [
      ...rule.conditionGroup.conditions,
      {
        id: `cond_${Date.now().toString(36)}`,
        fieldId: fields[0]?.id || '',
        operator: 'equals' as LogicComparisonOperator,
        value: '',
      },
    ];
    handleUpdateRule({
      ...rule,
      conditionGroup: {
        ...rule.conditionGroup,
        conditions: updatedConditions,
      },
    });
  };

  const handleDeleteCondition = (rule: FormLogicRule, condIdx: number) => {
    if (rule.conditionGroup.conditions.length <= 1) return;
    const updated = rule.conditionGroup.conditions.filter((_, i) => i !== condIdx);
    handleUpdateRule({
      ...rule,
      conditionGroup: { ...rule.conditionGroup, conditions: updated },
    });
  };

  const handleDeleteAction = (rule: FormLogicRule, actIdx: number, isElse = false) => {
    if (isElse) {
      const updated = (rule.elseActions || []).filter((_, i) => i !== actIdx);
      handleUpdateRule({ ...rule, elseActions: updated });
    } else {
      if (rule.actions.length <= 1) return;
      const updated = rule.actions.filter((_, i) => i !== actIdx);
      handleUpdateRule({ ...rule, actions: updated });
    }
  };

  const handleAddAction = (rule: FormLogicRule, isElse = false) => {
    const targetArray = isElse ? (rule.elseActions || []) : rule.actions;
    const newAction = {
      id: `act_${Date.now().toString(36)}`,
      type: 'show_field' as LogicActionType,
      targetFieldId: fields[0]?.id || '',
    };
    if (isElse) {
      handleUpdateRule({ ...rule, elseActions: [...targetArray, newAction] });
    } else {
      handleUpdateRule({ ...rule, actions: [...targetArray, newAction] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Cycle Warning Banner */}
      {cycleStatus.hasCycle && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="text-xs">
            <p className="font-bold">Logic Jump Conflict Detected</p>
            <p className="opacity-90">{cycleStatus.error}</p>
          </div>
        </div>
      )}

      {/* Mode Sub-Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'rules' | 'calculations' | 'scoring')} className="w-full">
        <div className="flex items-center justify-between pb-2 border-b">
          <TabsList className="bg-muted/40 p-1 rounded-xl">
            <TabsTrigger value="rules" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-background">
              <GitBranch className="h-3.5 w-3.5" /> Branching & Visibility ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="calculations" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-background">
              <Calculator className="h-3.5 w-3.5" /> Calculations ({calculations.length})
            </TabsTrigger>
            <TabsTrigger value="scoring" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-background">
              <Award className="h-3.5 w-3.5" /> Lead Scoring ({scoreRules.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Rules & Branching */}
        <TabsContent value="rules" className="pt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Rules List */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-primary" /> Logic Rules
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Conditional branching and visibility</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddRule}
                  className="h-8 rounded-xl text-xs font-bold gap-1"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> Add Rule
                </Button>
              </div>

              <div className="space-y-2">
                {rules.length === 0 ? (
                  <div className="p-8 text-center border rounded-2xl border-dashed opacity-60">
                    <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold">No logic rules configured yet</p>
                    <p className="text-[10px] text-muted-foreground">Click &quot;Add Rule&quot; to get started</p>
                  </div>
                ) : (
                  rules.map((rule, idx) => (
                    <div
                      key={rule.id}
                      onClick={() => setSelectedRuleId(rule.id)}
                      className={cn(
                        "p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs",
                        selectedRuleId === rule.id
                          ? "bg-primary/5 border-primary/40 shadow-sm"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                          {idx + 1}
                        </div>
                        <div className="truncate">
                          <p className="font-semibold text-foreground truncate">{rule.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {rule.conditionGroup.conditions.length} condition{rule.conditionGroup.conditions.length === 1 ? '' : 's'} → {rule.actions.length} action{rule.actions.length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={checked => handleToggleRule(rule.id, checked)}
                          className="scale-75"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Center: Selected Rule Editor */}
            <div className="lg:col-span-8">
              {selectedRule ? (
                <Card className="rounded-2xl border shadow-sm">
                  <CardHeader className="pb-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Input
                          value={selectedRule.name}
                          onChange={e =>
                            handleUpdateRule({ ...selectedRule, name: e.target.value })
                          }
                          className="text-sm font-bold h-8 border-none p-0 focus-visible:ring-0 bg-transparent"
                        />
                        <CardDescription className="text-xs">
                          Define trigger conditions and subsequent actions.
                        </CardDescription>
                      </div>
                      <Badge variant={selectedRule.enabled ? 'default' : 'secondary'} className="text-[10px]">
                        {selectedRule.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    {/* Condition Builder */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          WHEN (Condition)
                        </Label>
                        <Select
                          value={selectedRule.conditionGroup.combinator}
                          onValueChange={v =>
                            handleUpdateRule({
                              ...selectedRule,
                              conditionGroup: {
                                ...selectedRule.conditionGroup,
                                combinator: v as 'AND' | 'OR',
                              },
                            })
                          }
                        >
                          <SelectTrigger className="h-7 w-24 text-[10px] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AND">ALL (AND)</SelectItem>
                            <SelectItem value="OR">ANY (OR)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedRule.conditionGroup.conditions.map((cond, idx) => (
                        <div key={cond.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-muted/20 p-2.5 rounded-xl border">
                          <Select
                            value={cond.fieldId}
                            onValueChange={v => {
                              const updated = [...selectedRule.conditionGroup.conditions];
                              updated[idx] = { ...cond, fieldId: v };
                              handleUpdateRule({
                                ...selectedRule,
                                conditionGroup: { ...selectedRule.conditionGroup, conditions: updated },
                              });
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg flex-1 min-w-[140px]">
                              <SelectValue placeholder="Select Field" />
                            </SelectTrigger>
                            <SelectContent>
                              {fields.map(f => {
                                const af = getAppField(f.appFieldId);
                                return (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.labelOverride || af?.label || f.appFieldId}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>

                          <Select
                            value={cond.operator}
                            onValueChange={v => {
                              const updated = [...selectedRule.conditionGroup.conditions];
                              updated[idx] = { ...cond, operator: v as LogicComparisonOperator };
                              handleUpdateRule({
                                ...selectedRule,
                                conditionGroup: { ...selectedRule.conditionGroup, conditions: updated },
                              });
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="not_equals">Not Equals</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="not_contains">Does Not Contain</SelectItem>
                              <SelectItem value="is_empty">Is Empty</SelectItem>
                              <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
                              <SelectItem value="greater_than">Greater Than</SelectItem>
                              <SelectItem value="less_than">Less Than</SelectItem>
                              <SelectItem value="greater_than_or_equal">Greater or Equal</SelectItem>
                              <SelectItem value="less_than_or_equal">Less or Equal</SelectItem>
                              <SelectItem value="between">Between Range</SelectItem>
                              <SelectItem value="regex_matches">Regex Matches</SelectItem>
                              <SelectItem value="date_is_before">Date Before</SelectItem>
                              <SelectItem value="date_is_after">Date After</SelectItem>
                              <SelectItem value="age_greater_than">Age &gt; (Years)</SelectItem>
                              <SelectItem value="age_less_than">Age &lt; (Years)</SelectItem>
                            </SelectContent>
                          </Select>

                          {cond.operator !== 'is_empty' && cond.operator !== 'is_not_empty' && (
                            <Input
                              value={String(cond.value ?? '')}
                              onChange={e => {
                                const updated = [...selectedRule.conditionGroup.conditions];
                                updated[idx] = { ...cond, value: e.target.value };
                                handleUpdateRule({
                                  ...selectedRule,
                                  conditionGroup: { ...selectedRule.conditionGroup, conditions: updated },
                                });
                              }}
                              placeholder={cond.operator === 'between' ? 'Min' : 'Expected Value...'}
                              className="h-9 text-xs rounded-lg flex-1 min-w-[100px]"
                            />
                          )}

                          {cond.operator === 'between' && (
                            <Input
                              value={String(cond.secondaryValue ?? '')}
                              onChange={e => {
                                const updated = [...selectedRule.conditionGroup.conditions];
                                updated[idx] = { ...cond, secondaryValue: e.target.value };
                                handleUpdateRule({
                                  ...selectedRule,
                                  conditionGroup: { ...selectedRule.conditionGroup, conditions: updated },
                                });
                              }}
                              placeholder="Max"
                              className="h-9 text-xs rounded-lg w-24"
                            />
                          )}

                          {selectedRule.conditionGroup.conditions.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCondition(selectedRule, idx)}
                              className="h-9 w-9 rounded-lg text-muted-foreground hover:text-rose-500 shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddCondition(selectedRule)}
                        className="h-7 text-[10px] font-bold text-primary"
                      >
                        + Add Condition
                      </Button>
                    </div>

                    {/* Action Builder */}
                    <div className="space-y-3 pt-2 border-t">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        THEN (Actions)
                      </Label>

                      {selectedRule.actions.map((act, idx) => (
                        <div key={act.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-muted/20 p-2.5 rounded-xl border">
                          <Select
                            value={act.type}
                            onValueChange={v => {
                              const updated = [...selectedRule.actions];
                              updated[idx] = { ...act, type: v as LogicActionType };
                              handleUpdateRule({ ...selectedRule, actions: updated });
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="show_field">Show Field</SelectItem>
                              <SelectItem value="hide_field">Hide Field</SelectItem>
                              <SelectItem value="enable_field">Enable Field</SelectItem>
                              <SelectItem value="disable_field">Disable Field</SelectItem>
                              <SelectItem value="require_field">Make Required</SelectItem>
                              <SelectItem value="optional_field">Make Optional</SelectItem>
                              <SelectItem value="set_value">Set Value</SelectItem>
                              <SelectItem value="clear_value">Clear Value</SelectItem>
                              <SelectItem value="jump_to_page">Jump to Page</SelectItem>
                              <SelectItem value="terminate_disqualified">Disqualify / End</SelectItem>
                              <SelectItem value="show_message">Show Warning Banner</SelectItem>
                            </SelectContent>
                          </Select>

                          {act.type === 'jump_to_page' ? (
                            <Select
                              value={act.targetPageId || ''}
                              onValueChange={v => {
                                const updated = [...selectedRule.actions];
                                updated[idx] = { ...act, targetPageId: v };
                                handleUpdateRule({ ...selectedRule, actions: updated });
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs rounded-lg flex-1">
                                <SelectValue placeholder="Select Destination Page" />
                              </SelectTrigger>
                              <SelectContent>
                                {pages.map((p, pIdx) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    Page {pIdx + 1}: {p.title || `Page ${pIdx + 1}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : act.type === 'show_message' || act.type === 'terminate_disqualified' ? (
                            <Input
                              value={act.message || ''}
                              onChange={e => {
                                const updated = [...selectedRule.actions];
                                updated[idx] = { ...act, message: e.target.value };
                                handleUpdateRule({ ...selectedRule, actions: updated });
                              }}
                              placeholder="Message to display to respondent..."
                              className="h-9 text-xs rounded-lg flex-1"
                            />
                          ) : (
                            <Select
                              value={act.targetFieldId || ''}
                              onValueChange={v => {
                                const updated = [...selectedRule.actions];
                                updated[idx] = { ...act, targetFieldId: v };
                                handleUpdateRule({ ...selectedRule, actions: updated });
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs rounded-lg flex-1">
                                <SelectValue placeholder="Select Target Field" />
                              </SelectTrigger>
                              <SelectContent>
                                {fields.map(f => {
                                  const af = getAppField(f.appFieldId);
                                  return (
                                    <SelectItem key={f.id} value={f.id}>
                                      {f.labelOverride || af?.label || f.appFieldId}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          )}

                          {selectedRule.actions.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAction(selectedRule, idx, false)}
                              className="h-9 w-9 rounded-lg text-muted-foreground hover:text-rose-500 shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddAction(selectedRule, false)}
                        className="h-7 text-[10px] font-bold text-primary"
                      >
                        + Add Action
                      </Button>
                    </div>

                    {/* Fallback Action Builder (ELSE) */}
                    <div className="space-y-3 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          ELSE (Fallback Actions - Optional)
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                          Executed when conditions evaluate to false
                        </span>
                      </div>

                      {(selectedRule.elseActions || []).map((act, idx) => (
                        <div key={act.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-muted/20 p-2.5 rounded-xl border">
                          <Select
                            value={act.type}
                            onValueChange={v => {
                              const updated = [...(selectedRule.elseActions || [])];
                              updated[idx] = { ...act, type: v as LogicActionType };
                              handleUpdateRule({ ...selectedRule, elseActions: updated });
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="show_field">Show Field</SelectItem>
                              <SelectItem value="hide_field">Hide Field</SelectItem>
                              <SelectItem value="enable_field">Enable Field</SelectItem>
                              <SelectItem value="disable_field">Disable Field</SelectItem>
                              <SelectItem value="require_field">Make Required</SelectItem>
                              <SelectItem value="optional_field">Make Optional</SelectItem>
                              <SelectItem value="set_value">Set Value</SelectItem>
                              <SelectItem value="clear_value">Clear Value</SelectItem>
                              <SelectItem value="jump_to_page">Jump to Page</SelectItem>
                              <SelectItem value="terminate_disqualified">Disqualify / End</SelectItem>
                              <SelectItem value="show_message">Show Warning Banner</SelectItem>
                            </SelectContent>
                          </Select>

                          {act.type === 'jump_to_page' ? (
                            <Select
                              value={act.targetPageId || ''}
                              onValueChange={v => {
                                const updated = [...(selectedRule.elseActions || [])];
                                updated[idx] = { ...act, targetPageId: v };
                                handleUpdateRule({ ...selectedRule, elseActions: updated });
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs rounded-lg flex-1">
                                <SelectValue placeholder="Select Destination Page" />
                              </SelectTrigger>
                              <SelectContent>
                                {pages.map((p, pIdx) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    Page {pIdx + 1}: {p.title || `Page ${pIdx + 1}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : act.type === 'show_message' || act.type === 'terminate_disqualified' ? (
                            <Input
                              value={act.message || ''}
                              onChange={e => {
                                const updated = [...(selectedRule.elseActions || [])];
                                updated[idx] = { ...act, message: e.target.value };
                                handleUpdateRule({ ...selectedRule, elseActions: updated });
                              }}
                              placeholder="Message to display to respondent..."
                              className="h-9 text-xs rounded-lg flex-1"
                            />
                          ) : (
                            <Select
                              value={act.targetFieldId || ''}
                              onValueChange={v => {
                                const updated = [...(selectedRule.elseActions || [])];
                                updated[idx] = { ...act, targetFieldId: v };
                                handleUpdateRule({ ...selectedRule, elseActions: updated });
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs rounded-lg flex-1">
                                <SelectValue placeholder="Select Target Field" />
                              </SelectTrigger>
                              <SelectContent>
                                {fields.map(f => {
                                  const af = getAppField(f.appFieldId);
                                  return (
                                    <SelectItem key={f.id} value={f.id}>
                                      {f.labelOverride || af?.label || f.appFieldId}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteAction(selectedRule, idx, true)}
                            className="h-9 w-9 rounded-lg text-muted-foreground hover:text-rose-500 shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddAction(selectedRule, true)}
                        className="h-7 text-[10px] font-bold text-muted-foreground hover:text-primary"
                      >
                        + Add Fallback Action
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="p-12 border border-dashed rounded-3xl text-center space-y-3 opacity-40">
                  <Layers className="h-10 w-10 mx-auto" />
                  <p className="text-sm font-semibold">Select or create a logic rule</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Calculations */}
        <TabsContent value="calculations" className="pt-4">
          <CalculationEditor
            fields={fields}
            getAppField={getAppField}
            calculations={calculations}
            onCalculationsChange={onCalculationsChange || (() => {})}
          />
        </TabsContent>

        {/* Tab 3: Lead Scoring */}
        <TabsContent value="scoring" className="pt-4">
          <ScoringRulesManager
            fields={fields}
            getAppField={getAppField}
            scoreRules={scoreRules}
            onScoreRulesChange={onScoreRulesChange || (() => {})}
          />
        </TabsContent>
      </Tabs>

      {/* Bottom: Live Interactive Logic Simulator */}
      <Card className="rounded-3xl border shadow-sm bg-muted/10 overflow-hidden">
        <CardHeader className="py-4 px-6 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">Live Journey & Logic Simulator</CardTitle>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-xs font-mono font-semibold">
                Total Score: {simulationResult.totalScore}
              </Badge>
              {simulationResult.isDisqualified && (
                <Badge variant="destructive" className="text-xs font-bold gap-1">
                  <XCircle className="h-3 w-3" /> Disqualified
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground">
            Test respondent inputs in real time to verify conditional visibility, dynamic calculations, and score meters.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {fields.map(f => {
              const af = getAppField(f.appFieldId);
              const label = f.labelOverride || af?.label || f.appFieldId;
              const isHidden = simulationResult.hiddenFieldIds.has(f.id);
              const isDisabled = simulationResult.disabledFieldIds.has(f.id);
              const overrideVal = simulationResult.overrideValues[f.id];

              return (
                <div
                  key={f.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    isHidden
                      ? 'opacity-40 bg-muted/40 border-dashed'
                      : 'bg-card border-border shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold truncate">{label}</span>
                    {isHidden ? (
                      <Badge variant="secondary" className="text-[9px] h-4 gap-1">
                        <EyeOff className="h-2.5 w-2.5" /> Hidden
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] h-4 gap-1 text-emerald-500 border-emerald-500/30">
                        <Eye className="h-2.5 w-2.5" /> Visible
                      </Badge>
                    )}
                  </div>
                  <Input
                    placeholder="Test value..."
                    value={overrideVal !== undefined ? String(overrideVal) : String(simulationData[f.id] || '')}
                    disabled={isDisabled}
                    onChange={e => setSimulationData({ ...simulationData, [f.id]: e.target.value })}
                    className="h-8 text-xs rounded-xl bg-background"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
