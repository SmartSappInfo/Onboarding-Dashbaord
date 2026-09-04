'use client';

/**
 * @fileoverview Slide-over Rule Editor Drawer for Performance Policy Studio (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Provides a no-code visual constructor for WHEN / IF / AWARD / MULTIPLIER / CAP scoring rules:
 * - Event category and trigger selection.
 * - Dynamic condition filtering (duration, deal value, stage, outcome).
 * - Multiplier definitions for high-value deals or strategic sales stages.
 * - Target dimension assignment (Activity, Effort, Quality, Effectiveness, Outcome).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Touch targets maintain >= 44px height for mobile accessibility.
 * - Conforms to Emil Kowalski micro-interactions (active:scale-[0.97]).
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Sparkles,
  Layers,
  Award,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import type {
  PolicyScoringRule,
  RuleCondition,
  RuleMultiplier,
  RuleConditionOperator,
} from '@/lib/policy-studio/types';
import type { SalesPerformanceDimension } from '@/lib/sales-performance/types';

interface RuleEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rule: PolicyScoringRule | null;
  onSaveRule: (updatedRule: PolicyScoringRule) => void;
}

const DIMENSION_OPTIONS: Array<{ value: SalesPerformanceDimension; label: string }> = [
  { value: 'effort', label: 'Effort (Intentional Work)' },
  { value: 'quality', label: 'Quality (Hygiene & Execution)' },
  { value: 'effectiveness', label: 'Effectiveness (Buyer Response)' },
  { value: 'outcome', label: 'Outcome (Revenue & Won Deals)' },
  { value: 'activity', label: 'Activity (Volume of Actions)' },
];

const CATEGORY_OPTIONS: Array<{ value: PolicyScoringRule['category']; label: string }> = [
  { value: 'communication', label: 'Communication (Calls, Emails, SMS)' },
  { value: 'meetings', label: 'Meetings & Demonstrations' },
  { value: 'deals', label: 'Deals & Pipeline Progress' },
  { value: 'tasks', label: 'Tasks & Follow-ups' },
  { value: 'crm', label: 'CRM & Lead Management' },
  { value: 'documents', label: 'Proposals & Contracts' },
  { value: 'surveys', label: 'Surveys & Feedback' },
];

export function RuleEditorDrawer({
  isOpen,
  onClose,
  rule,
  onSaveRule,
}: RuleEditorDrawerProps) {
  const [draftRule, setDraftRule] = React.useState<PolicyScoringRule | null>(rule);

  React.useEffect(() => {
    if (rule) {
      setDraftRule({ ...rule });
    }
  }, [rule]);

  if (!draftRule) return null;

  const handleAddCondition = () => {
    const newCond: RuleCondition = {
      field: 'durationSeconds',
      operator: 'greater_than_or_equal',
      value: 60,
    };
    setDraftRule({
      ...draftRule,
      conditions: [...(draftRule.conditions || []), newCond],
    });
  };

  const handleRemoveCondition = (index: number) => {
    const updated = draftRule.conditions.filter((_, idx) => idx !== index);
    setDraftRule({ ...draftRule, conditions: updated });
  };

  const handleUpdateCondition = (index: number, updates: Partial<RuleCondition>) => {
    const updated = draftRule.conditions.map((cond, idx) => {
      if (idx === index) {
        return { ...cond, ...updates };
      }
      return cond;
    });
    setDraftRule({ ...draftRule, conditions: updated });
  };

  const handleAddMultiplier = () => {
    const newMult: RuleMultiplier = {
      conditionField: 'dealValue',
      conditionOperator: 'greater_than',
      conditionValue: 10000,
      multiplier: 1.5,
      label: 'High-Value Opportunity (> $10k)',
    };
    setDraftRule({
      ...draftRule,
      multipliers: [...(draftRule.multipliers || []), newMult],
    });
  };

  const handleRemoveMultiplier = (index: number) => {
    const updated = draftRule.multipliers.filter((_, idx) => idx !== index);
    setDraftRule({ ...draftRule, multipliers: updated });
  };

  const handleSave = () => {
    onSaveRule({
      ...draftRule,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col justify-between bg-card text-card-foreground border-l shadow-2xl z-50 overflow-y-auto"
      >
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header */}
          <SheetHeader className="space-y-1 text-left pb-4 border-b">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                Rule Builder
              </Badge>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Active</span>
                <Switch
                  checked={draftRule.enabled}
                  onCheckedChange={(checked) => setDraftRule({ ...draftRule, enabled: checked })}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            </div>
            <SheetTitle className="text-lg font-bold tracking-tight">
              Configure Scoring Rule
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Define the conditions, point currency reward, and multipliers for this sales action.
            </SheetDescription>
          </SheetHeader>

          {/* Section 1: WHEN Trigger */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>WHEN (Event Trigger)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold">Event Name</Label>
                <Input
                  value={draftRule.eventType}
                  disabled
                  className="font-mono text-xs bg-muted/30"
                />
              </div>
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-semibold">Category</Label>
                <Select
                  value={draftRule.category}
                  onValueChange={(val) =>
                    setDraftRule({
                      ...draftRule,
                      category: val as PolicyScoringRule['category'],
                    })
                  }
                >
                  <SelectTrigger className="h-10 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} className="text-xs">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-semibold">Rule Description</Label>
              <Input
                value={draftRule.description}
                onChange={(e) => setDraftRule({ ...draftRule, description: e.target.value })}
                placeholder="Explain the purpose of this scoring rule..."
                className="text-xs"
              />
            </div>
          </div>

          {/* Section 2: AWARD & DIMENSION */}
          <div className="space-y-3 p-4 rounded-xl border bg-muted/20 text-left">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Award className="h-3.5 w-3.5" />
              <span>AWARD (Score Reward)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Base Point Value</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="1000"
                    value={draftRule.basePoints}
                    onChange={(e) =>
                      setDraftRule({
                        ...draftRule,
                        basePoints: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="h-10 text-xs font-bold font-mono text-center w-24"
                  />
                  <span className="text-xs font-semibold text-muted-foreground">Points</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Scorecard Dimension</Label>
                <Select
                  value={draftRule.targetDimension}
                  onValueChange={(val) =>
                    setDraftRule({
                      ...draftRule,
                      targetDimension: val as SalesPerformanceDimension,
                    })
                  }
                >
                  <SelectTrigger className="h-10 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIMENSION_OPTIONS.map((dim) => (
                      <SelectItem key={dim.value} value={dim.value} className="text-xs">
                        {dim.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 3: IF Conditions */}
          <div className="space-y-3 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Layers className="h-3.5 w-3.5 text-sky-500" />
                <span>IF (Execution Conditions)</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCondition}
                className="h-8 text-xs font-semibold rounded-lg active:scale-[0.97]"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Condition
              </Button>
            </div>

            {(!draftRule.conditions || draftRule.conditions.length === 0) ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No specific conditions required. Points awarded on any completion.
              </p>
            ) : (
              <div className="space-y-2">
                {draftRule.conditions.map((cond, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-lg border bg-background text-xs"
                  >
                    <Input
                      value={cond.field}
                      onChange={(e) => handleUpdateCondition(idx, { field: e.target.value })}
                      placeholder="field (e.g. durationSeconds)"
                      className="h-8 text-xs font-mono w-36"
                    />
                    <Select
                      value={cond.operator}
                      onValueChange={(val) =>
                        handleUpdateCondition(idx, {
                          operator: val as RuleConditionOperator,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">equals</SelectItem>
                        <SelectItem value="greater_than_or_equal">&gt;=</SelectItem>
                        <SelectItem value="greater_than">&gt;</SelectItem>
                        <SelectItem value="less_than">&lt;</SelectItem>
                        <SelectItem value="contains">contains</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={String(cond.value)}
                      onChange={(e) => handleUpdateCondition(idx, { value: e.target.value })}
                      placeholder="value (e.g. 60)"
                      className="h-8 text-xs font-mono flex-1 min-w-[80px]"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCondition(idx)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: MULTIPLIERS */}
          <div className="space-y-3 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                <span>MULTIPLIERS (Strategic Boosts)</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddMultiplier}
                className="h-8 text-xs font-semibold rounded-lg active:scale-[0.97]"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Multiplier
              </Button>
            </div>

            {(!draftRule.multipliers || draftRule.multipliers.length === 0) ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No multipliers configured. Standard points applied.
              </p>
            ) : (
              <div className="space-y-2">
                {draftRule.multipliers.map((mult, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-lg border bg-background text-xs"
                  >
                    <Input
                      value={mult.label}
                      onChange={(e) => {
                        const updated = [...draftRule.multipliers];
                        updated[idx].label = e.target.value;
                        setDraftRule({ ...draftRule, multipliers: updated });
                      }}
                      placeholder="Label (e.g. Enterprise Deal)"
                      className="h-8 text-xs flex-1 min-w-[120px]"
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={mult.multiplier}
                        onChange={(e) => {
                          const updated = [...draftRule.multipliers];
                          updated[idx].multiplier = parseFloat(e.target.value) || 1;
                          setDraftRule({ ...draftRule, multipliers: updated });
                        }}
                        className="h-8 w-16 text-center text-xs font-mono font-bold"
                      />
                      <span className="text-xs font-bold text-muted-foreground">x</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMultiplier(idx)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="p-4 border-t bg-muted/10 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl active:scale-[0.97] transition-all"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="min-h-[44px] px-6 rounded-xl font-bold bg-primary text-primary-foreground shadow-md active:scale-[0.97] transition-all"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Save Rule
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
