'use client';

import * as React from 'react';
import {
  type Idea,
  type IdeaAiDeconstructionResult,
  type IdeaAssumptionChallengeResult,
} from '@/lib/quick-notes-types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  developRawIdeaAiAction,
  challengeIdeaAssumptionsAiAction,
} from '@/lib/quick-notes-idea-actions';

interface AiIdeaAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  selectedIdea?: Idea | null;
  onApplyDeconstruction?: (result: IdeaAiDeconstructionResult) => void;
}

export function AiIdeaAssistantDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  selectedIdea,
  onApplyDeconstruction,
}: AiIdeaAssistantDialogProps) {
  const { toast } = useToast();

  const [prompt, setPrompt] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [deconstructResult, setDeconstructResult] = React.useState<IdeaAiDeconstructionResult | null>(null);
  const [challengeResult, setChallengeResult] = React.useState<IdeaAssumptionChallengeResult | null>(null);

  const handleRunBrainstorm = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    try {
      const res = await developRawIdeaAiAction(workspaceId, prompt, userId);
      if (res.success && res.data) {
        setDeconstructResult(res.data);
        setChallengeResult(null);
      } else {
        toast({ title: 'AI Assistant Error', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error running AI brainstorm', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunDevilsAdvocate = async () => {
    if (!selectedIdea) return;
    setIsLoading(true);
    try {
      const res = await challengeIdeaAssumptionsAiAction(workspaceId, selectedIdea.id, userId);
      if (res.success && res.data) {
        setChallengeResult(res.data);
        setDeconstructResult(null);
      } else {
        toast({ title: 'Critique Error', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error running Devil\'s Advocate', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-5 sm:p-6 rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <DialogTitle className="text-base font-bold text-foreground">
              AI Idea Strategy Assistant
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {selectedIdea ? (
            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Context Idea</span>
                <h4 className="text-xs font-bold text-foreground">{selectedIdea.title}</h4>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRunDevilsAdvocate}
                disabled={isLoading}
                className="text-xs font-semibold gap-1 text-purple-600 border-purple-500/30 hover:bg-purple-500/10"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlert className="h-3 w-3" />}
                Run Devil&apos;s Advocate
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs font-bold">Describe your raw thought or market problem</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. We want to test a 1-click tuition payment plan for private high schools..."
                rows={3}
                className="text-xs"
              />
              <Button
                size="sm"
                onClick={handleRunBrainstorm}
                disabled={isLoading || !prompt.trim()}
                className="w-full text-xs font-bold bg-primary text-primary-foreground gap-1.5"
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Deconstruct & Formulate Idea
              </Button>
            </div>
          )}

          {/* Deconstruction Output */}
          {deconstructResult && (
            <div className="space-y-3 pt-3 border-t border-border/60">
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    {deconstructResult.title}
                  </h4>
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-none text-[10px]">
                    ICE: {Math.round(((deconstructResult.estimatedImpact * deconstructResult.estimatedConfidence) / deconstructResult.estimatedEffort) * 10) / 10}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Problem:</strong> {deconstructResult.problem}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Solution:</strong> {deconstructResult.proposedSolution}
                </p>
              </div>

              {onApplyDeconstruction && (
                <Button
                  size="sm"
                  onClick={() => {
                    onApplyDeconstruction(deconstructResult);
                    onOpenChange(false);
                  }}
                  className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Apply to Idea Studio
                </Button>
              )}
            </div>
          )}

          {/* Devil's Advocate Output */}
          {challengeResult && (
            <div className="space-y-3 pt-3 border-t border-border/60">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground">Critical Vulnerability Analysis</h4>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold uppercase ${
                    challengeResult.overallRiskRating === 'fatal' || challengeResult.overallRiskRating === 'high'
                      ? 'text-destructive border-destructive/30 bg-destructive/10'
                      : 'text-amber-600 border-amber-500/30 bg-amber-500/10'
                  }`}
                >
                  {challengeResult.overallRiskRating} Risk
                </Badge>
              </div>

              <div className="space-y-2">
                {challengeResult.unstatedAssumptions.map((u, i) => (
                  <div key={i} className="p-2.5 rounded-xl border border-destructive/20 bg-destructive/5 space-y-1">
                    <p className="text-xs font-bold text-foreground">⚠️ {u.statement}</p>
                    <p className="text-[11px] text-destructive italic">{u.potentialFailureMode}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
