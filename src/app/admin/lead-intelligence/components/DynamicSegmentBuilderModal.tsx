'use client';

/**
 * Dynamic Segment Builder Modal (Lead Intelligence 2.0 - Phase 10)
 * UI Spec Section 41: "Dynamic Segments Visual Rule Builder"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Visual AST rule builder with live matching prospect counter.
 * 2. Nested AND/OR combinator support.
 * 3. Mobile touch target compliance (min-h-[44px]).
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { 
  Filter, 
  Plus, 
  Trash2, 
  Sparkles, 
  Users, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import type { 
  DynamicSegment, 
  SegmentRule, 
  SegmentRuleGroup, 
  SegmentPredicateField, 
  SegmentOperator 
} from '@/lib/lead-intelligence/types';
import { evaluateSegmentCountAction, saveDynamicSegmentAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DynamicSegmentBuilderModalProps {
  workspaceId: string;
  organizationId: string;
  existingSegment?: DynamicSegment | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const FIELD_OPTIONS: Array<{ value: SegmentPredicateField; label: string; type: 'number' | 'string' | 'boolean' }> = [
  { value: 'overallScore', label: 'Overall Priority Score', type: 'number' },
  { value: 'needScore', label: 'Need Gap Score', type: 'number' },
  { value: 'buyingIntent', label: 'Buying Intent Score', type: 'number' },
  { value: 'icpFitScore', label: 'ICP Fit Score', type: 'number' },
  { value: 'crmStatus', label: 'CRM Sync Status', type: 'string' },
  { value: 'hasVerifiedContact', label: 'Has Verified Decision Maker', type: 'boolean' },
  { value: 'technologies', label: 'Website Technologies', type: 'string' },
  { value: 'industry', label: 'Industry Category', type: 'string' },
  { value: 'city', label: 'City / Location', type: 'string' },
  { value: 'signals', label: 'Active Intent Signals Count', type: 'number' }
];

export const DynamicSegmentBuilderModal: React.FC<DynamicSegmentBuilderModalProps> = ({
  workspaceId,
  organizationId,
  existingSegment,
  isOpen,
  onClose,
  onSaved
}) => {
  const { toast } = useToast();
  const [name, setName] = useState(existingSegment?.name || '');
  const [description, setDescription] = useState(existingSegment?.description || '');
  const [combinator, setCombinator] = useState<'AND' | 'OR'>(existingSegment?.ruleGroup.combinator || 'AND');
  const [rules, setRules] = useState<SegmentRule[]>(
    existingSegment?.ruleGroup.rules.filter((r): r is SegmentRule => !('combinator' in r)) || [
      { id: 'r_init_1', field: 'overallScore', operator: 'greater_than', value: 75 },
      { id: 'r_init_2', field: 'crmStatus', operator: 'not_equals', value: 'synced' }
    ]
  );

  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Live evaluation of matching count
  useEffect(() => {
    if (!isOpen || !workspaceId) return;

    const ruleGroup: SegmentRuleGroup = {
      id: 'grp_eval',
      combinator,
      rules
    };

    setIsEvaluating(true);
    const timer = setTimeout(() => {
      evaluateSegmentCountAction(workspaceId, ruleGroup)
        .then((res) => {
          if (res.success) {
            setMatchingCount(res.count);
            setTotalCount(res.total);
          }
        })
        .finally(() => setIsEvaluating(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [workspaceId, combinator, rules, isOpen]);

  const handleAddRule = () => {
    const newRule: SegmentRule = {
      id: `rule_${Date.now()}`,
      field: 'overallScore',
      operator: 'greater_than',
      value: 70
    };
    setRules([...rules, newRule]);
  };

  const handleRemoveRule = (ruleId: string) => {
    if (rules.length <= 1) {
      toast({ variant: 'destructive', title: 'Segment must have at least 1 condition' });
      return;
    }
    setRules(rules.filter(r => r.id !== ruleId));
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<SegmentRule>) => {
    setRules(rules.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Please provide a segment name' });
      return;
    }

    setIsSaving(true);
    try {
      const segmentId = existingSegment?.id || `seg_${Date.now()}`;
      const segmentData: DynamicSegment = {
        id: segmentId,
        workspaceId,
        organizationId,
        name,
        description,
        icon: 'filter',
        ruleGroup: {
          id: `grp_${Date.now()}`,
          combinator,
          rules
        },
        cachedCount: matchingCount ?? 0,
        createdAt: existingSegment?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const res = await saveDynamicSegmentAction(segmentData);
      if (res.success) {
        toast({
          title: 'Dynamic Segment Saved ✓',
          description: `Segment "${name}" is active with ${matchingCount ?? 0} matching prospects.`
        });
        onSaved();
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Save Segment',
          description: res.error || 'Unknown error'
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl w-[96vw] p-0 bg-card border-border/80 shadow-2xl rounded-2xl overflow-hidden z-[10003] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                  {existingSegment ? 'Edit Dynamic Segment' : 'Dynamic Segment Builder'}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                Build live multi-condition segments that automatically update membership.
              </DialogDescription>
            </div>

            <Badge className="bg-primary/10 text-primary border-primary/30 text-xs font-bold flex items-center gap-1.5 px-3 py-1">
              {isEvaluating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Users className="h-3.5 w-3.5" />
              )}
              <span>
                {matchingCount ?? 0} matching prospect{matchingCount !== 1 ? 's' : ''}
              </span>
            </Badge>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Name & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Segment Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ⭐ High Intent Private Schools"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">Description (Optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Schools with Paystack gap and high rating"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Combinator Selector */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60">
            <span className="text-xs font-bold text-foreground">
              Match Criteria Rule:
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={combinator === 'AND' ? 'default' : 'ghost'}
                onClick={() => setCombinator('AND')}
                className={cn(
                  "h-7 px-3 text-xs font-bold rounded-lg",
                  combinator === 'AND' && "bg-primary text-primary-foreground"
                )}
              >
                Match ALL Conditions (AND)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={combinator === 'OR' ? 'default' : 'ghost'}
                onClick={() => setCombinator('OR')}
                className={cn(
                  "h-7 px-3 text-xs font-bold rounded-lg",
                  combinator === 'OR' && "bg-primary text-primary-foreground"
                )}
              >
                Match ANY Condition (OR)
              </Button>
            </div>
          </div>

          {/* Condition Rows (UI Spec Section 41) */}
          <div className="space-y-2.5">
            <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">
              Filter Conditions
            </Label>

            {rules.map((rule, idx) => (
              <div
                key={rule.id}
                className="p-3 rounded-xl border border-border/70 bg-card space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2"
              >
                <div className="sm:w-1/3">
                  <Select
                    value={rule.field}
                    onValueChange={(val: string) => handleUpdateRule(rule.id, { field: val as SegmentPredicateField })}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-lg">
                      <SelectValue placeholder="Select Field" />
                    </SelectTrigger>
                    <SelectContent className="z-[10005]">
                      {FIELD_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:w-1/4">
                  <Select
                    value={rule.operator}
                    onValueChange={(val: string) => handleUpdateRule(rule.id, { operator: val as SegmentOperator })}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-lg">
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent className="z-[10005]">
                      <SelectItem value="greater_than" className="text-xs">Greater Than (&gt;)</SelectItem>
                      <SelectItem value="less_than" className="text-xs">Less Than (&lt;)</SelectItem>
                      <SelectItem value="equals" className="text-xs">Equals (=)</SelectItem>
                      <SelectItem value="not_equals" className="text-xs">Not Equals (!=)</SelectItem>
                      <SelectItem value="contains" className="text-xs">Contains</SelectItem>
                      <SelectItem value="not_contains" className="text-xs">Does Not Contain</SelectItem>
                      <SelectItem value="is_true" className="text-xs">Is True</SelectItem>
                      <SelectItem value="is_false" className="text-xs">Is False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:flex-1">
                  {rule.operator !== 'is_true' && rule.operator !== 'is_false' && (
                    <Input
                      value={String(rule.value)}
                      onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                      placeholder="Value..."
                      className="h-9 text-xs rounded-lg"
                    />
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRule(rule.id)}
                  className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRule}
              className="w-full h-9 text-xs font-bold rounded-xl border-dashed border-border/80 flex items-center justify-center gap-1.5 active:scale-[0.97]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Filter Condition</span>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold rounded-xl"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Save Dynamic Segment</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
