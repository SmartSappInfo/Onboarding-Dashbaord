/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Contextual AI Question Copilot Modal
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Visual AI Question Optimization dialog.
 * 2. Strict Preview -> Approve -> Apply workflow protecting against silent overwrites.
 * 3. Strict Zero-Any Invariant.
 * 4. Touch-optimized with Emil Kowalski active press scaling (active:scale-[0.97]).
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  ShieldCheck,
  Languages,
  Check,
  ArrowRight,
  Loader2,
  FileText,
  HelpCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { SurveyQuestion } from '@/lib/types';
import {
  refineSurveyQuestionAction,
  type RefineQuestionActionResponse,
} from '@/lib/surveys/survey-ai-refinement-actions';
import type { RefineSurveyQuestionOutput } from '@/ai/flows/refine-survey-question-flow';

interface AiQuestionRefinementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: SurveyQuestion | null;
  workspaceId: string;
  organizationId?: string;
  onApplyRefinement: (patch: Partial<SurveyQuestion>) => void;
  onAddFollowupQuestion?: (newQuestion: Partial<SurveyQuestion>) => void;
}

export function AiQuestionRefinementModal({
  open,
  onOpenChange,
  question,
  workspaceId,
  organizationId,
  onApplyRefinement,
  onAddFollowupQuestion,
}: AiQuestionRefinementModalProps) {
  const { toast } = useToast();
  const [actionType, setActionType] = React.useState<
    'eliminate_bias' | 'simplify_language' | 'generate_options' | 'add_followup' | 'translate'
  >('eliminate_bias');
  const [targetLanguage, setTargetLanguage] = React.useState('Spanish');
  const [customInstructions, setCustomInstructions] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [aiResult, setAiResult] = React.useState<RefineSurveyQuestionOutput | null>(null);

  React.useEffect(() => {
    if (open) {
      setAiResult(null);
      setCustomInstructions('');
    }
  }, [open, question?.id]);

  if (!question) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const res: RefineQuestionActionResponse = await refineSurveyQuestionAction(
        workspaceId,
        organizationId || workspaceId,
        {
          questionTitle: question.title,
          questionDescription: question.description,
          questionType: question.type,
          options: question.options,
          actionType,
          targetLanguage: actionType === 'translate' ? targetLanguage : undefined,
          contextPrompt: customInstructions.trim() || undefined,
        }
      );

      if (res.success && res.result) {
        setAiResult(res.result);
      } else {
        toast({
          variant: 'destructive',
          title: 'AI Refinement Failed',
          description: res.error || 'Could not optimize question.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to contact AI Copilot.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!aiResult) return;

    const patch: Partial<SurveyQuestion> = {
      title: aiResult.improvedTitle,
    };

    if (aiResult.improvedDescription !== undefined) {
      patch.description = aiResult.improvedDescription;
    }

    if (aiResult.improvedOptions && aiResult.improvedOptions.length > 0) {
      patch.options = aiResult.improvedOptions;
    }

    onApplyRefinement(patch);
    toast({
      title: 'Question Refined',
      description: 'AI optimization applied successfully.',
    });
    onOpenChange(false);
  };

  const handleInsertFollowup = () => {
    if (!aiResult?.suggestedFollowup || !onAddFollowupQuestion) return;

    onAddFollowupQuestion({
      title: aiResult.suggestedFollowup.title,
      type: (aiResult.suggestedFollowup.type as SurveyQuestion['type']) || 'long-text',
      options: aiResult.suggestedFollowup.options,
      isRequired: false,
    });

    toast({
      title: 'Follow-up Added',
      description: 'Suggested follow-up question inserted into canvas.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">AI Question Copilot</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enhance measurement accuracy, remove leading bias, or generate balanced choices.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 space-y-5">
          {/* Action Tabs */}
          <Tabs
            value={actionType}
            onValueChange={(val) =>
              setActionType(
                val as 'eliminate_bias' | 'simplify_language' | 'generate_options' | 'add_followup' | 'translate'
              )
            }
            className="w-full"
          >
            <TabsList className="grid grid-cols-5 h-9 p-1 bg-muted/60 rounded-xl">
              <TabsTrigger value="eliminate_bias" className="text-[11px] rounded-lg">
                Neutralize
              </TabsTrigger>
              <TabsTrigger value="simplify_language" className="text-[11px] rounded-lg">
                Simplify
              </TabsTrigger>
              <TabsTrigger value="generate_options" className="text-[11px] rounded-lg">
                Choices
              </TabsTrigger>
              <TabsTrigger value="add_followup" className="text-[11px] rounded-lg">
                Follow-up
              </TabsTrigger>
              <TabsTrigger value="translate" className="text-[11px] rounded-lg">
                Translate
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Translation language picker */}
          {actionType === 'translate' && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold">Target Language</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Spanish">Spanish (Español)</SelectItem>
                  <SelectItem value="French">French (Français)</SelectItem>
                  <SelectItem value="Twi">Twi / Akan</SelectItem>
                  <SelectItem value="German">German (Deutsch)</SelectItem>
                  <SelectItem value="Portuguese">Portuguese</SelectItem>
                  <SelectItem value="Arabic">Arabic</SelectItem>
                  <SelectItem value="Chinese">Simplified Chinese</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Context Instructions */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Custom Instructions (Optional)</Label>
            <Input
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Tone should be friendly for K-12 parents..."
              className="h-9 text-xs rounded-xl"
            />
          </div>

          {/* Original Question Snapshot */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <HelpCircle className="h-3 w-3" />
              <span>Current Question</span>
            </div>
            <div className="text-xs font-semibold text-foreground">{question.title || 'Untitled Question'}</div>
            {question.description && (
              <div className="text-[11px] text-muted-foreground">{question.description}</div>
            )}
            {question.options && question.options.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {question.options.map((opt, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                    {opt}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* AI Result Card */}
          {aiResult && (
            <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Recommended Version</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-600">
                  Ready to Apply
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-foreground">{aiResult.improvedTitle}</div>
                {aiResult.improvedDescription && (
                  <div className="text-[11px] text-muted-foreground">{aiResult.improvedDescription}</div>
                )}
              </div>

              {aiResult.improvedOptions && aiResult.improvedOptions.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Suggested Choices</div>
                  <div className="flex flex-wrap gap-1">
                    {aiResult.improvedOptions.map((opt, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] bg-background">
                        {opt}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {aiResult.suggestedFollowup && (
                <div className="p-2.5 rounded-lg bg-background/80 border border-purple-500/20 space-y-1">
                  <div className="text-[10px] font-bold text-purple-600 uppercase">Suggested Branch Question</div>
                  <div className="text-xs font-medium">{aiResult.suggestedFollowup.title}</div>
                </div>
              )}

              <div className="text-[11px] text-muted-foreground/90 bg-muted/40 p-2 rounded-lg italic">
                💡 {aiResult.rationale}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/60 flex items-center justify-between bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs rounded-xl active:scale-[0.97]"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={handleGenerate}
              className="text-xs rounded-xl gap-1.5 active:scale-[0.97]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  {aiResult ? 'Regenerate' : 'Generate Suggestions'}
                </>
              )}
            </Button>

            {aiResult && (
              <>
                {aiResult.suggestedFollowup && onAddFollowupQuestion && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleInsertFollowup}
                    className="text-xs rounded-xl gap-1 active:scale-[0.97]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Insert Follow-up
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleApply}
                  className="text-xs rounded-xl gap-1.5 active:scale-[0.97]"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply to Question
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}