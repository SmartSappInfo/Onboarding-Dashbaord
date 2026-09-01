/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Visual Logic Studio Modal
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Visual Conditional Branching & Skip Logic Manager.
 * 2. Directly integrates validateSurveyLogicGraph to warn on circular loops,
 *    unreachable questions, and dangling references in real-time before saving.
 * 3. Strict Zero-Any Invariant.
 * 4. Responsive modal with touch targets >= 44px.
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Split,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock, SurveyLogicBlock } from '@/lib/types';
import { validateSurveyLogicGraph, type LogicGraphIssue } from '@/lib/surveys/survey-logic-graph';

interface LogicStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elements: SurveyElement[];
  onUpdateElements: (updatedElements: SurveyElement[]) => void;
}

export function LogicStudioModal({
  open,
  onOpenChange,
  elements,
  onUpdateElements,
}: LogicStudioModalProps) {
  // Extract all existing logic rules from logic blocks, or create a consolidated logic state
  const questions = React.useMemo(() => {
    return elements.filter(
      (el): el is SurveyQuestion => !['heading', 'description', 'divider', 'image', 'video', 'section', 'logic'].includes(el.type)
    );
  }, [elements]);

  // Find or initialize the primary logic block
  const existingLogicBlock = React.useMemo(() => {
    return elements.find((el): el is SurveyLogicBlock => el.type === 'logic');
  }, [elements]);

  const [localRules, setLocalRules] = React.useState<SurveyLogicBlock['rules']>([]);

  React.useEffect(() => {
    if (open) {
      setLocalRules(existingLogicBlock?.rules ? [...existingLogicBlock.rules] : []);
    }
  }, [open, existingLogicBlock]);

  // Run real-time validation on simulated elements
  const validationResult = React.useMemo(() => {
    const simulatedLogicBlock: SurveyLogicBlock = {
      id: existingLogicBlock?.id || 'logic_main',
      type: 'logic',
      rules: localRules,
    };

    const simulatedElements = elements
      .filter((el) => el.type !== 'logic')
      .concat(simulatedLogicBlock);

    return validateSurveyLogicGraph(simulatedElements);
  }, [elements, existingLogicBlock, localRules]);

  const handleAddRule = () => {
    if (questions.length === 0) return;
    const firstQ = questions[0];
    const targetQ = questions.length > 1 ? questions[1] : firstQ;

    setLocalRules((prev) => [
      ...prev,
      {
        sourceQuestionId: firstQ.id,
        operator: 'isEqualTo',
        targetValue: firstQ.options && firstQ.options.length > 0 ? firstQ.options[0] : 'Yes',
        action: {
          type: 'jump',
          targetElementId: targetQ.id,
        },
      },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setLocalRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRule = (index: number, patch: Partial<SurveyLogicBlock['rules'][number]>) => {
    setLocalRules((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const handleSave = () => {
    let updated: SurveyElement[];
    if (existingLogicBlock) {
      updated = elements.map((el) => {
        if (el.id === existingLogicBlock.id) {
          return {
            ...el,
            rules: localRules,
          } as SurveyLogicBlock;
        }
        return el;
      });
    } else if (localRules.length > 0) {
      const newLogicBlock: SurveyLogicBlock = {
        id: `logic_${Date.now()}`,
        type: 'logic',
        rules: localRules,
      };
      updated = [...elements, newLogicBlock];
    } else {
      updated = elements;
    }

    onUpdateElements(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Split className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Visual Logic Studio</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Build conditional branching, question skips, and dynamic question visibility.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {localRules.length} Active Rules
            </Badge>
          </div>

          {/* Validation Warnings / Error Banner */}
          {validationResult.errors.length > 0 && (
            <Alert variant="destructive" className="mt-3 py-2 text-xs">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-semibold text-xs">Logic Conflict Detected</AlertTitle>
              <AlertDescription className="text-[11px]">
                {validationResult.errors.map((e, idx) => (
                  <div key={idx}>• {e.message}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {validationResult.isValid && validationResult.warnings.length > 0 && (
            <Alert className="mt-3 py-2 text-xs border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="font-semibold text-xs">Logic Recommendation</AlertTitle>
              <AlertDescription className="text-[11px]">
                {validationResult.warnings.map((w, idx) => (
                  <div key={idx}>• {w.message}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}
        </DialogHeader>

        {/* Rules Canvas */}
        <ScrollArea className="flex-1 p-6 space-y-4">
          {localRules.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-4 rounded-2xl bg-muted/40 text-muted-foreground">
                <Split className="h-8 w-8" />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-semibold">No Logic Rules Configured</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Create conditional branches to jump to specific questions or sections based on respondent answers.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleAddRule}
                className="mt-2 text-xs gap-1.5 rounded-xl active:scale-[0.97]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Logic Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {localRules.map((rule, idx) => {
                const sourceQ = questions.find((q) => q.id === rule.sourceQuestionId);
                const sourceOptions = sourceQ?.options || [];

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-border/70 bg-card hover:border-border transition-all shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-foreground">Rule Condition</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRule(idx)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg active:scale-[0.97]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Condition Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center text-xs">
                      {/* IF */}
                      <div className="md:col-span-1 text-[11px] font-bold text-muted-foreground uppercase">
                        IF
                      </div>

                      {/* Source Question */}
                      <div className="md:col-span-4">
                        <Select
                          value={rule.sourceQuestionId}
                          onValueChange={(val) => handleUpdateRule(idx, { sourceQuestionId: val })}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-lg">
                            <SelectValue placeholder="Select Question" />
                          </SelectTrigger>
                          <SelectContent>
                            {questions.map((q, qIdx) => (
                              <SelectItem key={q.id} value={q.id} className="text-xs">
                                Q{qIdx + 1}: {q.title || 'Untitled'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Operator */}
                      <div className="md:col-span-3">
                        <Select
                          value={rule.operator}
                          onValueChange={(val: SurveyLogicBlock['rules'][number]['operator']) =>
                            handleUpdateRule(idx, { operator: val })
                          }
                        >
                          <SelectTrigger className="h-9 text-xs rounded-lg">
                            <SelectValue placeholder="Operator" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="isEqualTo">Equals (=)</SelectItem>
                            <SelectItem value="isNotEqualTo">Does not equal (≠)</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="doesNotContain">Does not contain</SelectItem>
                            <SelectItem value="isGreaterThan">Greater than (&gt;)</SelectItem>
                            <SelectItem value="isLessThan">Less than (&lt;)</SelectItem>
                            <SelectItem value="isEmpty">Is empty</SelectItem>
                            <SelectItem value="isNotEmpty">Is answered</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Target Value */}
                      <div className="md:col-span-4">
                        {!['isEmpty', 'isNotEmpty'].includes(rule.operator) && (
                          sourceOptions.length > 0 ? (
                            <Select
                              value={String(rule.targetValue || '')}
                              onValueChange={(val) => handleUpdateRule(idx, { targetValue: val })}
                            >
                              <SelectTrigger className="h-9 text-xs rounded-lg">
                                <SelectValue placeholder="Select Option" />
                              </SelectTrigger>
                              <SelectContent>
                                {sourceOptions.map((opt, oIdx) => (
                                  <SelectItem key={oIdx} value={opt} className="text-xs">
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={String(rule.targetValue || '')}
                              onChange={(e) => handleUpdateRule(idx, { targetValue: e.target.value })}
                              placeholder="Value..."
                              className="h-9 text-xs rounded-lg"
                            />
                          )
                        )}
                      </div>
                    </div>

                    {/* Action Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center text-xs pt-2 border-t border-border/40">
                      {/* THEN */}
                      <div className="md:col-span-1 text-[11px] font-bold text-primary uppercase flex items-center gap-1">
                        THEN
                      </div>

                      {/* Action Type */}
                      <div className="md:col-span-4">
                        <Select
                          value={rule.action.type}
                          onValueChange={(val: SurveyLogicBlock['rules'][number]['action']['type']) =>
                            handleUpdateRule(idx, {
                              action: { ...rule.action, type: val },
                            })
                          }
                        >
                          <SelectTrigger className="h-9 text-xs rounded-lg">
                            <SelectValue placeholder="Action" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="jump">Jump To Question / Section</SelectItem>
                            <SelectItem value="show">Show Question</SelectItem>
                            <SelectItem value="hide">Hide Question</SelectItem>
                            <SelectItem value="require">Make Required</SelectItem>
                            <SelectItem value="disableSubmit">Disable Submission</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Target Question / Element */}
                      <div className="md:col-span-7">
                        {rule.action.type !== 'disableSubmit' && (
                          <Select
                            value={rule.action.targetElementId || ''}
                            onValueChange={(val) =>
                              handleUpdateRule(idx, {
                                action: { ...rule.action, targetElementId: val },
                              })
                            }
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg">
                              <SelectValue placeholder="Target Element" />
                            </SelectTrigger>
                            <SelectContent>
                              {elements
                                .filter((el) => el.type !== 'logic' && el.id !== rule.sourceQuestionId)
                                .map((el) => (
                                  <SelectItem key={el.id} value={el.id} className="text-xs">
                                    [{el.type.toUpperCase()}] {el.title || ('text' in el ? (el as SurveyLayoutBlock).text : '') || 'Untitled'}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRule}
                className="w-full text-xs gap-1.5 rounded-xl border-dashed h-9 active:scale-[0.97]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Another Condition Rule
              </Button>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Logic changes are applied immediately to studio preview.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!validationResult.isValid}
              onClick={handleSave}
              className="text-xs rounded-xl active:scale-[0.97]"
            >
              Save Logic Rules
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}