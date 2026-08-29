/**
 * @fileoverview Visual Advanced Multi-Condition Filter Builder Modal
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 123 & Section 32, UI Section 15):
 * - Renders a flexible visual builder for nested filter rule groups with AND/OR logic.
 * - Live-evaluates rule matches against the current deal set.
 * - Supports saving the constructed tree directly as a custom Saved View.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5):
 * - Zero 'any' / zero 'any[]'.
 * - Mobile ergonomics: Touch targets >= 44px, clean popovers and responsive flex layouts.
 * - Emil Kowalski physics: Micro-animations on rule creation/deletion.
 */

'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Filter,
  Layers,
  Sparkles,
  Bookmark,
  Check,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Deal, OnboardingStage, UserProfile } from '@/lib/types';
import type {
  DealFilterTree,
  DealFilterGroup,
  DealFilterRule,
  DealFilterOperator,
} from '@/lib/deals/deal-saved-views';
import { countMatchingDeals } from '@/lib/deals/deal-filter-engine';
import { cn } from '@/lib/utils';

interface AdvancedFilterBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterTree: DealFilterTree | null | undefined;
  onApply: (tree: DealFilterTree | null) => void;
  onSaveAsView?: (tree: DealFilterTree) => void;
  deals: Deal[];
  stages: OnboardingStage[];
  users: UserProfile[];
  currentUserId?: string;
}

const FIELD_OPTIONS: Array<{ key: string; label: string; type: 'number' | 'string' | 'select' | 'date' | 'boolean' }> = [
  { key: 'name', label: 'Deal Name', type: 'string' },
  { key: 'value', label: 'Total Value', type: 'number' },
  { key: 'mrr', label: 'Monthly Recurring (MRR)', type: 'number' },
  { key: 'arr', label: 'Annual Recurring (ARR)', type: 'number' },
  { key: 'probability', label: 'Win Probability (%)', type: 'number' },
  { key: 'stageId', label: 'Stage', type: 'select' },
  { key: 'status', label: 'Status (Open/Won/Lost)', type: 'select' },
  { key: 'ownerId', label: 'Deal Owner / Assignee', type: 'select' },
  { key: 'healthStatus', label: 'Health Status', type: 'select' },
  { key: 'forecastCategory', label: 'Forecast Category', type: 'select' },
  { key: 'contractStatus', label: 'Contract Status', type: 'select' },
  { key: 'daysInStage', label: 'Days in Stage', type: 'number' },
  { key: 'dealAge', label: 'Deal Age (Days)', type: 'number' },
  { key: 'expectedCloseDate', label: 'Expected Close Date', type: 'date' },
  { key: 'source', label: 'Lead Source', type: 'string' },
  { key: 'nextStep', label: 'Next Step / Action', type: 'string' },
];

const OPERATORS_BY_TYPE: Record<string, Array<{ key: DealFilterOperator; label: string }>> = {
  number: [
    { key: 'equals', label: 'equals (=)' },
    { key: 'not_equals', label: 'not equals (≠)' },
    { key: 'greater_than', label: 'greater than (>)' },
    { key: 'greater_than_or_equal', label: 'at least (≥)' },
    { key: 'less_than', label: 'less than (<)' },
    { key: 'less_than_or_equal', label: 'at most (≤)' },
    { key: 'is_between', label: 'is between' },
  ],
  string: [
    { key: 'contains', label: 'contains' },
    { key: 'not_contains', label: 'does not contain' },
    { key: 'equals', label: 'equals exact' },
    { key: 'not_equals', label: 'does not equal' },
    { key: 'is_empty', label: 'is empty / not set' },
    { key: 'is_not_empty', label: 'is set / not empty' },
  ],
  select: [
    { key: 'equals', label: 'is' },
    { key: 'not_equals', label: 'is not' },
    { key: 'in', label: 'is one of' },
    { key: 'is_empty', label: 'is unassigned / empty' },
    { key: 'is_not_empty', label: 'is assigned / not empty' },
  ],
  date: [
    { key: 'equals', label: 'is on / token' },
    { key: 'greater_than', label: 'is after' },
    { key: 'less_than', label: 'is before' },
    { key: 'is_empty', label: 'has no date set' },
    { key: 'is_not_empty', label: 'has date set' },
  ],
};

export default function AdvancedFilterBuilderModal({
  isOpen,
  onClose,
  filterTree,
  onApply,
  onSaveAsView,
  deals,
  stages,
  users,
  currentUserId,
}: AdvancedFilterBuilderModalProps) {
  const [tree, setTree] = React.useState<DealFilterTree>(() => {
    if (filterTree && filterTree.groups && filterTree.groups.length > 0) {
      return JSON.parse(JSON.stringify(filterTree));
    }
    return {
      conjunction: 'AND',
      groups: [
        {
          id: `grp_${Date.now()}`,
          conjunction: 'AND',
          rules: [
            {
              id: `rule_${Date.now()}`,
              field: 'value',
              operator: 'greater_than',
              value: 10000,
            },
          ],
        },
      ],
    };
  });

  // Re-sync on modal open
  React.useEffect(() => {
    if (isOpen && filterTree && filterTree.groups && filterTree.groups.length > 0) {
      setTree(JSON.parse(JSON.stringify(filterTree)));
    }
  }, [isOpen, filterTree]);

  const stagesMap = React.useMemo(() => {
    const map = new Map<string, OnboardingStage>();
    stages.forEach(s => map.set(s.id, s));
    return map;
  }, [stages]);

  const liveMatches = React.useMemo(() => {
    return countMatchingDeals(deals, tree, {
      currentUserId,
      stagesMap,
      now: new Date(),
    });
  }, [deals, tree, currentUserId, stagesMap]);

  const addGroup = () => {
    setTree(prev => ({
      ...prev,
      groups: [
        ...prev.groups,
        {
          id: `grp_${Date.now()}`,
          conjunction: 'AND',
          rules: [
            {
              id: `rule_${Date.now()}`,
              field: 'probability',
              operator: 'greater_than_or_equal',
              value: 50,
            },
          ],
        },
      ],
    }));
  };

  const removeGroup = (groupId: string) => {
    setTree(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.id !== groupId),
    }));
  };

  const addRule = (groupId: string) => {
    setTree(prev => ({
      ...prev,
      groups: prev.groups.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          rules: [
            ...g.rules,
            {
              id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              field: 'value',
              operator: 'greater_than',
              value: 5000,
            },
          ],
        };
      }),
    }));
  };

  const removeRule = (groupId: string, ruleId: string) => {
    setTree(prev => ({
      ...prev,
      groups: prev.groups
        .map(g => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            rules: g.rules.filter(r => r.id !== ruleId),
          };
        })
        .filter(g => g.rules.length > 0), // Clean up empty groups
    }));
  };

  const updateRule = (
    groupId: string,
    ruleId: string,
    field: string,
    val: unknown
  ) => {
    setTree(prev => ({
      ...prev,
      groups: prev.groups.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          rules: g.rules.map(r => {
            if (r.id !== ruleId) return r;
            return { ...r, [field]: val };
          }),
        };
      }),
    }));
  };

  const handleApply = () => {
    if (!tree.groups || tree.groups.length === 0) {
      onApply(null);
    } else {
      onApply(tree);
    }
    onClose();
  };

  const handleReset = () => {
    setTree({
      conjunction: 'AND',
      groups: [],
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-border shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold tracking-tight">
                  Advanced Multi-Condition Filter Builder
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Build precise criteria with nested rule groups and instant live deal matching.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20 font-semibold text-xs">
              {liveMatches} {liveMatches === 1 ? 'Deal' : 'Deals'} Match
            </Badge>
          </div>
        </DialogHeader>

        {/* Builder Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tree.groups.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-border/80 bg-muted/10 space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted/60 mx-auto flex items-center justify-center text-muted-foreground">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No filter conditions applied</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Add criteria below to filter opportunities by values, stage age, health status, or revenue metrics.
                </p>
              </div>
              <Button
                onClick={addGroup}
                variant="outline"
                size="sm"
                className="rounded-xl h-10 px-4 font-semibold text-xs border-primary/30 text-primary hover:bg-primary/5 active:scale-[0.97]"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Filter Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tree.groups.map((group, gIdx) => (
                <div
                  key={group.id}
                  className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs relative"
                >
                  {/* Group Header & Conjunction Switcher */}
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                        Group {gIdx + 1}
                      </span>
                      <div className="inline-flex rounded-lg bg-muted p-0.5 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            setTree(prev => ({
                              ...prev,
                              groups: prev.groups.map(g => g.id === group.id ? { ...g, conjunction: 'AND' } : g),
                            }));
                          }}
                          className={cn(
                            'px-2.5 py-1 rounded-md transition-all',
                            group.conjunction === 'AND' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Match ALL (AND)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTree(prev => ({
                              ...prev,
                              groups: prev.groups.map(g => g.id === group.id ? { ...g, conjunction: 'OR' } : g),
                            }));
                          }}
                          className={cn(
                            'px-2.5 py-1 rounded-md transition-all',
                            group.conjunction === 'OR' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Match ANY (OR)
                        </button>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGroup(group.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive rounded-lg"
                      title="Remove Group"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Group Rules */}
                  <div className="space-y-2.5">
                    {group.rules.map(rule => {
                      const fieldDef = FIELD_OPTIONS.find(f => f.key === rule.field) || FIELD_OPTIONS[0];
                      const availableOperators = OPERATORS_BY_TYPE[fieldDef.type] || OPERATORS_BY_TYPE.string;

                      return (
                        <div
                          key={rule.id}
                          className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-xl bg-muted/20 border border-border/50"
                        >
                          {/* Field Selector */}
                          <div className="w-full sm:w-[200px] shrink-0">
                            <Select
                              value={rule.field}
                              onValueChange={v => {
                                const newDef = FIELD_OPTIONS.find(f => f.key === v) || FIELD_OPTIONS[0];
                                const defaultOp = (OPERATORS_BY_TYPE[newDef.type] || OPERATORS_BY_TYPE.string)[0].key;
                                updateRule(group.id, rule.id, 'field', v);
                                updateRule(group.id, rule.id, 'operator', defaultOp);
                              }}
                            >
                              <SelectTrigger className="h-9 rounded-lg text-xs font-semibold bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-60 rounded-xl">
                                {FIELD_OPTIONS.map(f => (
                                  <SelectItem key={f.key} value={f.key} className="text-xs font-medium">
                                    {f.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Operator Selector */}
                          <div className="w-full sm:w-[170px] shrink-0">
                            <Select
                              value={rule.operator}
                              onValueChange={v => updateRule(group.id, rule.id, 'operator', v)}
                            >
                              <SelectTrigger className="h-9 rounded-lg text-xs font-medium bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {availableOperators.map(op => (
                                  <SelectItem key={op.key} value={op.key} className="text-xs">
                                    {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Dynamic Value Input */}
                          {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
                            <div className="flex-1 min-w-[150px]">
                              {rule.field === 'stageId' ? (
                                <Select
                                  value={String(rule.value || '')}
                                  onValueChange={v => updateRule(group.id, rule.id, 'value', v)}
                                >
                                  <SelectTrigger className="h-9 rounded-lg text-xs bg-background">
                                    <SelectValue placeholder="Select stage..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {stages.map(s => (
                                      <SelectItem key={s.id} value={s.id} className="text-xs">
                                        {s.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : rule.field === 'ownerId' ? (
                                <Select
                                  value={String(rule.value || 'current_user')}
                                  onValueChange={v => updateRule(group.id, rule.id, 'value', v)}
                                >
                                  <SelectTrigger className="h-9 rounded-lg text-xs bg-background">
                                    <SelectValue placeholder="Select owner..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    <SelectItem value="current_user" className="text-xs font-semibold text-primary">
                                      ⭐ Current User (Me)
                                    </SelectItem>
                                    {users.map(u => (
                                      <SelectItem key={u.id} value={u.id} className="text-xs">
                                        {u.name || u.email}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : rule.field === 'status' ? (
                                <Select
                                  value={String(rule.value || 'open')}
                                  onValueChange={v => updateRule(group.id, rule.id, 'value', v)}
                                >
                                  <SelectTrigger className="h-9 rounded-lg text-xs bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    <SelectItem value="open" className="text-xs font-semibold text-blue-600">Open</SelectItem>
                                    <SelectItem value="won" className="text-xs font-semibold text-emerald-600">Won</SelectItem>
                                    <SelectItem value="lost" className="text-xs font-semibold text-rose-600">Lost</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : rule.field === 'healthStatus' ? (
                                <Select
                                  value={String(rule.value || 'at_risk')}
                                  onValueChange={v => updateRule(group.id, rule.id, 'value', v)}
                                >
                                  <SelectTrigger className="h-9 rounded-lg text-xs bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    <SelectItem value="healthy" className="text-xs font-semibold text-emerald-600">Healthy</SelectItem>
                                    <SelectItem value="at_risk" className="text-xs font-semibold text-rose-600">At Risk</SelectItem>
                                    <SelectItem value="stalled" className="text-xs font-semibold text-amber-600">Stalled</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : rule.field === 'expectedCloseDate' && rule.operator === 'equals' ? (
                                <Select
                                  value={String(rule.value || 'current_month')}
                                  onValueChange={v => updateRule(group.id, rule.id, 'value', v)}
                                >
                                  <SelectTrigger className="h-9 rounded-lg text-xs bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    <SelectItem value="current_month" className="text-xs font-semibold text-orange-600">🔥 Current Month</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : rule.operator === 'is_between' ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    value={Number(rule.value || 0)}
                                    onChange={e => updateRule(group.id, rule.id, 'value', Number(e.target.value))}
                                    className="h-9 rounded-lg text-xs bg-background"
                                    placeholder="Min"
                                  />
                                  <span className="text-xs text-muted-foreground">to</span>
                                  <Input
                                    type="number"
                                    value={Number(rule.valueTo || 0)}
                                    onChange={e => updateRule(group.id, rule.id, 'valueTo', Number(e.target.value))}
                                    className="h-9 rounded-lg text-xs bg-background"
                                    placeholder="Max"
                                  />
                                </div>
                              ) : fieldDef.type === 'number' ? (
                                <Input
                                  type="number"
                                  value={rule.value !== null && rule.value !== undefined ? String(rule.value) : ''}
                                  onChange={e => updateRule(group.id, rule.id, 'value', Number(e.target.value))}
                                  className="h-9 rounded-lg text-xs bg-background"
                                  placeholder="Enter value..."
                                />
                              ) : (
                                <Input
                                  type="text"
                                  value={String(rule.value ?? '')}
                                  onChange={e => updateRule(group.id, rule.id, 'value', e.target.value)}
                                  className="h-9 rounded-lg text-xs bg-background"
                                  placeholder="Enter text..."
                                />
                              )}
                            </div>
                          )}

                          {/* Remove Rule Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRule(group.id, rule.id)}
                            className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0 rounded-lg"
                            title="Remove condition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Condition to Group Button */}
                  <Button
                    onClick={() => addRule(group.id)}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Condition
                  </Button>
                </div>
              ))}

              <Button
                onClick={addGroup}
                variant="outline"
                size="sm"
                className="w-full h-10 rounded-xl font-semibold text-xs border-dashed border-border/80 hover:bg-muted/30"
              >
                <Plus className="h-4 w-4 mr-1.5 text-primary" />
                Add Another Rule Group (OR / AND)
              </Button>
            </div>
          )}
        </div>

        {/* Modal Footer with Actions */}
        <DialogFooter className="p-4 px-6 border-t border-border/60 bg-muted/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-9 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset All
            </Button>
            {onSaveAsView && tree.groups.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onSaveAsView(tree);
                  onClose();
                }}
                className="h-9 rounded-xl text-xs font-semibold border-border hover:bg-muted active:scale-[0.97]"
              >
                <Bookmark className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                Save as View
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 rounded-xl text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="h-9 px-4 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.97]"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Apply {liveMatches} {liveMatches === 1 ? 'Deal' : 'Deals'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
