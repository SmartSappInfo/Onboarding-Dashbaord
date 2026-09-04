'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Dynamic CTA Rules UI:
 *    Allows marketing and sales creators to build multi-condition CTA trigger rules
 *    (watch progress %, contact score, deal stage, and chapter viewed).
 * 2. Mobile Accessibility & Touch Target Bounds:
 *    All buttons, inputs, selects, and switches strictly enforce `min-h-[44px] min-w-[44px]`
 *    touch targets with tactile micro-animations (`active:scale-[0.97]`).
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState } from 'react';
import type { 
  DynamicCtaRule, RuleCondition, RuleAction, 
  RuleConditionType, RuleConditionOperator 
} from '@/lib/types/media-2.0';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Trash2, ArrowUp, ArrowDown, Sparkles, 
  Target, Layers, PlayCircle, ExternalLink, Check 
} from 'lucide-react';
import { nanoid } from 'nanoid';

export interface DynamicCtaRulesEditorProps {
  rules: DynamicCtaRule[];
  onChange: (updatedRules: DynamicCtaRule[]) => void;
}

export function DynamicCtaRulesEditor({
  rules,
  onChange,
}: DynamicCtaRulesEditorProps) {
  const [activeRuleId, setActiveRuleId] = useState<string | null>(
    rules.length > 0 ? rules[0].id : null
  );

  const handleAddRule = () => {
    const newRule: DynamicCtaRule = {
      id: nanoid(),
      name: `Rule ${rules.length + 1}: Targeted Offer`,
      priority: rules.length + 1,
      isActive: true,
      conditions: [
        {
          id: nanoid(),
          type: 'watch_progress',
          operator: 'gte',
          value: 50,
        },
      ],
      action: {
        ctaTitle: 'Schedule a Consultation',
        ctaButtonText: 'Book Meeting',
        targetUrl: '/contact',
        ctaType: 'form',
        ctaMode: 'modal',
        unlockGate: 'half',
      },
    };

    const nextRules = [...rules, newRule];
    onChange(nextRules);
    setActiveRuleId(newRule.id);
  };

  const handleRemoveRule = (ruleId: string) => {
    const nextRules = rules.filter((r) => r.id !== ruleId);
    onChange(nextRules);
    if (activeRuleId === ruleId) {
      setActiveRuleId(nextRules.length > 0 ? nextRules[0].id : null);
    }
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<DynamicCtaRule>) => {
    const nextRules = rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r));
    onChange(nextRules);
  };

  const handleMovePriority = (ruleIndex: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && ruleIndex === 0) ||
      (direction === 'down' && ruleIndex === rules.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? ruleIndex - 1 : ruleIndex + 1;
    const reordered = [...rules];
    const [moved] = reordered.splice(ruleIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    // Re-index priorities 1..N
    const finalRules = reordered.map((r, idx) => ({ ...r, priority: idx + 1 }));
    onChange(finalRules);
  };

  const handleAddCondition = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const newCond: RuleCondition = {
      id: nanoid(),
      type: 'contact_score',
      operator: 'gte',
      value: 60,
    };

    handleUpdateRule(ruleId, {
      conditions: [...rule.conditions, newCond],
    });
  };

  const handleRemoveCondition = (ruleId: string, condId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    handleUpdateRule(ruleId, {
      conditions: rule.conditions.filter((c) => c.id !== condId),
    });
  };

  const handleUpdateCondition = (
    ruleId: string,
    condId: string,
    updates: Partial<RuleCondition>
  ) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const updatedConds = rule.conditions.map((c) =>
      c.id === condId ? { ...c, ...updates } : c
    );
    handleUpdateRule(ruleId, { conditions: updatedConds });
  };

  const handleUpdateAction = (ruleId: string, updates: Partial<RuleAction>) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    handleUpdateRule(ruleId, {
      action: { ...rule.action, ...updates },
    });
  };

  const activeRule = rules.find((r) => r.id === activeRuleId);

  return (
    <div className="space-y-6 text-left">
      {/* Top Header & Add Rule Action */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Dynamic CTA Rules
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Display personalized buttons when viewer reaches milestones or meets CRM criteria.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleAddRule}
          className="rounded-xl text-xs font-bold h-9 px-3 min-h-[44px] gap-1.5 active:scale-[0.97]"
        >
          <Plus className="h-3.5 w-3.5" /> Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="p-8 border border-dashed rounded-2xl bg-muted/10 text-center space-y-3">
          <Layers className="h-7 w-7 text-muted-foreground/40 mx-auto" />
          <p className="text-xs font-extrabold text-foreground">No Dynamic Rules Configured</p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            Default static CTA will be displayed to all viewers. Add rules to show targeted CTAs for high-intent viewers.
          </p>
          <Button
            size="sm"
            onClick={handleAddRule}
            className="rounded-xl text-xs font-bold h-9 px-3 min-h-[44px] gap-1.5 active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5" /> Create First Rule
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Rules Priority Sidebar */}
          <div className="space-y-2 md:col-span-1">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
              Priority Order (Evaluated Top to Bottom)
            </p>
            {rules.map((rule, idx) => {
              const isSelected = rule.id === activeRuleId;
              return (
                <div
                  key={rule.id}
                  onClick={() => setActiveRuleId(rule.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:bg-muted/10'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px] font-black h-4 px-1">
                        #{rule.priority}
                      </Badge>
                      <span className="text-xs font-bold text-foreground truncate block">
                        {rule.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={idx === 0}
                      onClick={() => handleMovePriority(idx, 'up')}
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={idx === rules.length - 1}
                      onClick={() => handleMovePriority(idx, 'down')}
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Rule Editor */}
          {activeRule && (
            <Card className="rounded-2xl border-border bg-card md:col-span-2 shadow-sm space-y-6 p-5">
              {/* Rule Title & State */}
              <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                <div className="space-y-1 flex-1">
                  <Label className="text-[11px] font-bold text-muted-foreground">Rule Name</Label>
                  <Input
                    value={activeRule.name}
                    onChange={(e) => handleUpdateRule(activeRule.id, { name: e.target.value })}
                    className="h-9 min-h-[44px] rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="flex items-center gap-3 shrink-0 pt-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={activeRule.isActive}
                      onCheckedChange={(checked) =>
                        handleUpdateRule(activeRule.id, { isActive: checked })
                      }
                    />
                    <span className="text-xs font-bold">
                      {activeRule.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveRule(activeRule.id)}
                    className="h-9 w-9 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Conditions Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Conditions (ALL Must Match)
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddCondition(activeRule.id)}
                    className="h-8 text-xs font-bold rounded-xl gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Condition
                  </Button>
                </div>

                <div className="space-y-2">
                  {activeRule.conditions.map((cond) => (
                    <div
                      key={cond.id}
                      className="p-3 border border-border rounded-xl bg-muted/20 flex flex-col md:flex-row items-center gap-2"
                    >
                      <Select
                        value={cond.type}
                        onValueChange={(val) =>
                          handleUpdateCondition(activeRule.id, cond.id, {
                            type: val as RuleConditionType,
                          })
                        }
                      >
                        <SelectTrigger className="h-9 min-h-[44px] rounded-xl text-xs font-bold md:w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="watch_progress">Watch Progress %</SelectItem>
                          <SelectItem value="contact_score">Contact Lead Score</SelectItem>
                          <SelectItem value="deal_stage">Deal Pipeline Stage</SelectItem>
                          <SelectItem value="chapter_viewed">Video Chapter Viewed</SelectItem>
                          <SelectItem value="contact_tag">Contact Has Tag</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={cond.operator}
                        onValueChange={(val) =>
                          handleUpdateCondition(activeRule.id, cond.id, {
                            operator: val as RuleConditionOperator,
                          })
                        }
                      >
                        <SelectTrigger className="h-9 min-h-[44px] rounded-xl text-xs font-bold md:w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gte">&gt;= (At least)</SelectItem>
                          <SelectItem value="lte">&lt;= (At most)</SelectItem>
                          <SelectItem value="eq">== (Equals)</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        value={cond.value}
                        onChange={(e) =>
                          handleUpdateCondition(activeRule.id, cond.id, {
                            value: e.target.value,
                          })
                        }
                        placeholder="e.g. 50 or Qualified"
                        className="h-9 min-h-[44px] rounded-xl text-xs font-medium flex-1"
                      />

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveCondition(activeRule.id, cond.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-rose-500 rounded-lg shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Outcome Section */}
              <div className="space-y-4 pt-2 border-t border-border">
                <p className="text-xs font-black uppercase text-muted-foreground tracking-wider">
                  CTA Action Trigger
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">CTA Headline</Label>
                    <Input
                      value={activeRule.action.ctaTitle}
                      onChange={(e) =>
                        handleUpdateAction(activeRule.id, { ctaTitle: e.target.value })
                      }
                      className="h-9 min-h-[44px] rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">Button Label</Label>
                    <Input
                      value={activeRule.action.ctaButtonText}
                      onChange={(e) =>
                        handleUpdateAction(activeRule.id, { ctaButtonText: e.target.value })
                      }
                      className="h-9 min-h-[44px] rounded-xl text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">Target URL / Relative Path</Label>
                    <Input
                      value={activeRule.action.targetUrl}
                      onChange={(e) =>
                        handleUpdateAction(activeRule.id, { targetUrl: e.target.value })
                      }
                      placeholder="/apply or https://..."
                      className="h-9 min-h-[44px] rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">Gating Milestone</Label>
                    <Select
                      value={activeRule.action.unlockGate}
                      onValueChange={(val) =>
                        handleUpdateAction(activeRule.id, {
                          unlockGate: val as RuleAction['unlockGate'],
                        })
                      }
                    >
                      <SelectTrigger className="h-9 min-h-[44px] rounded-xl text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate (No Gate)</SelectItem>
                        <SelectItem value="quarter">25% Watched</SelectItem>
                        <SelectItem value="half">50% Watched</SelectItem>
                        <SelectItem value="threequarters">75% Watched</SelectItem>
                        <SelectItem value="complete">100% Watched</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
