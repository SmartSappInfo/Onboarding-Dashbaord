'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Award, PlusCircle, Trash2, Plus, Minus, CheckCircle2 } from 'lucide-react';
import type { FormFieldInstance, AppField } from '@/lib/types';
import type { FormScoreRule, LogicComparisonOperator } from '@/lib/forms/form-logic-types';

interface ScoringRulesManagerProps {
  fields: FormFieldInstance[];
  getAppField: (appFieldId: string) => AppField | undefined;
  scoreRules: FormScoreRule[];
  onScoreRulesChange: (scoreRules: FormScoreRule[]) => void;
}

const DEFAULT_CATEGORIES = [
  { id: 'lead_fit', label: 'Lead Fit / Quality' },
  { id: 'budget', label: 'Budget / Authority' },
  { id: 'risk', label: 'Risk / Compliance' },
  { id: 'knowledge', label: 'Quiz / Knowledge' },
  { id: 'general', label: 'General Score' },
];

export default function ScoringRulesManager({
  fields,
  getAppField,
  scoreRules = [],
  onScoreRulesChange,
}: ScoringRulesManagerProps) {
  const [selectedRuleId, setSelectedRuleId] = React.useState<string | null>(scoreRules[0]?.id || null);

  const selectedRule = React.useMemo(() =>
    scoreRules.find(r => r.id === selectedRuleId) || null,
  [scoreRules, selectedRuleId]);

  const handleAddRule = () => {
    const newId = `score_${Date.now().toString(36)}`;
    const newRule: FormScoreRule = {
      id: newId,
      name: `Score Rule ${scoreRules.length + 1}`,
      category: 'lead_fit',
      scoreDelta: 10,
      conditionGroup: {
        id: `cond_grp_${newId}`,
        combinator: 'AND',
        conditions: [
          {
            id: `c1_${newId}`,
            fieldId: fields[0]?.id || '',
            operator: 'equals',
            value: '',
          },
        ],
      },
    };
    onScoreRulesChange([...scoreRules, newRule]);
    setSelectedRuleId(newId);
  };

  const handleUpdate = (updated: FormScoreRule) => {
    onScoreRulesChange(scoreRules.map(r => (r.id === updated.id ? updated : r)));
  };

  const handleDelete = (id: string) => {
    const filtered = scoreRules.filter(r => r.id !== id);
    onScoreRulesChange(filtered);
    if (selectedRuleId === id) {
      setSelectedRuleId(filtered[0]?.id || null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Score Rules List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" /> Lead Scoring & Grades
              </h3>
              <p className="text-[10px] text-muted-foreground">Multi-category point allocation</p>
            </div>
            <Button
              size="sm"
              onClick={handleAddRule}
              className="h-8 rounded-xl font-bold gap-1 text-[10px]"
            >
              <PlusCircle className="h-3 w-3" /> New Score Rule
            </Button>
          </div>

          <div className="space-y-2">
            {scoreRules.length === 0 ? (
              <div className="p-8 border border-dashed rounded-2xl text-center space-y-2 opacity-50">
                <Award className="h-8 w-8 mx-auto" />
                <p className="text-xs font-semibold">No score rules defined yet</p>
              </div>
            ) : (
              scoreRules.map(rule => (
                <div
                  key={rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedRuleId === rule.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/60 hover:bg-accent/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={rule.scoreDelta >= 0 ? 'default' : 'destructive'} className="text-[10px] font-mono font-bold">
                      {rule.scoreDelta >= 0 ? `+${rule.scoreDelta}` : rule.scoreDelta}
                    </Badge>
                    <span className="text-xs font-bold truncate">{rule.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={e => {
                      e.stopPropagation();
                      handleDelete(rule.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Selected Score Rule Editor */}
        <div className="lg:col-span-8">
          {selectedRule ? (
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="pb-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Input
                      value={selectedRule.name}
                      onChange={e => handleUpdate({ ...selectedRule, name: e.target.value })}
                      className="text-sm font-bold h-8 border-none p-0 focus-visible:ring-0 bg-transparent"
                    />
                    <CardDescription className="text-xs">
                      Adjust lead scores or test points when specific criteria are satisfied.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {selectedRule.category || 'general'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* Category & Points */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Score Category
                    </Label>
                    <Select
                      value={selectedRule.category || 'lead_fit'}
                      onValueChange={v => handleUpdate({ ...selectedRule, category: v })}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_CATEGORIES.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Score Adjustment (Points)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg shrink-0"
                        onClick={() => handleUpdate({ ...selectedRule, scoreDelta: (selectedRule.scoreDelta || 0) - 5 })}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={selectedRule.scoreDelta}
                        onChange={e => handleUpdate({ ...selectedRule, scoreDelta: parseInt(e.target.value) || 0 })}
                        className="h-9 text-center font-bold text-sm rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg shrink-0"
                        onClick={() => handleUpdate({ ...selectedRule, scoreDelta: (selectedRule.scoreDelta || 0) + 5 })}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Condition Trigger */}
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Award Points WHEN Respondent Selects
                  </Label>

                  {selectedRule.conditionGroup.conditions.map((cond, idx) => (
                    <div key={cond.id} className="flex items-center gap-2 bg-muted/20 p-2.5 rounded-xl border">
                      <Select
                        value={cond.fieldId}
                        onValueChange={v => {
                          const updated = [...selectedRule.conditionGroup.conditions];
                          updated[idx] = { ...cond, fieldId: v };
                          handleUpdate({
                            ...selectedRule,
                            conditionGroup: { ...selectedRule.conditionGroup, conditions: updated },
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-lg flex-1">
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
                          handleUpdate({
                            ...selectedRule,
                            conditionGroup: { ...selectedRule.conditionGroup, conditions: updated },
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-lg w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">Equals</SelectItem>
                          <SelectItem value="not_equals">Not Equals</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="greater_than">Greater Than</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        value={String(cond.value ?? '')}
                        onChange={e => {
                          const updated = [...selectedRule.conditionGroup.conditions];
                          updated[idx] = { ...cond, value: e.target.value };
                          handleUpdate({
                            ...selectedRule,
                            conditionGroup: { ...selectedRule.conditionGroup, conditions: updated },
                          });
                        }}
                        placeholder="Expected Value..."
                        className="h-9 text-xs rounded-lg flex-1"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-12 border border-dashed rounded-3xl text-center space-y-3 opacity-40">
              <Award className="h-10 w-10 mx-auto" />
              <p className="text-sm font-semibold">Select or create a scoring rule</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
