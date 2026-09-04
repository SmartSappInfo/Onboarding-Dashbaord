'use client';

import * as React from 'react';
import {
  type CreateIdeaPayload,
  type IdeaPriority,
  type IdeaAssumptionRiskLevel,
} from '@/lib/quick-notes-types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Loader2, Plus, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { developRawIdeaAiAction } from '@/lib/quick-notes-idea-actions';

interface CreateIdeaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  onSubmit: (payload: CreateIdeaPayload) => Promise<void>;
}

export function CreateIdeaDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  onSubmit,
}: CreateIdeaDialogProps) {
  const { toast } = useToast();

  const [title, setTitle] = React.useState('');
  const [rawText, setRawText] = React.useState('');
  const [problem, setProblem] = React.useState('');
  const [proposedSolution, setProposedSolution] = React.useState('');
  const [priority, setPriority] = React.useState<IdeaPriority>('medium');
  const [impact, setImpact] = React.useState(7);
  const [effort, setEffort] = React.useState(4);
  const [confidence, setConfidence] = React.useState(6);

  const [isDeconstructingAi, setIsDeconstructingAi] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // 1-Click AI Deconstruct
  const handleAiDeconstruct = async () => {
    if (!rawText.trim() && !title.trim()) {
      toast({
        title: 'Input Needed',
        description: 'Please type your initial thought or title first before running AI Deconstruct.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeconstructingAi(true);
    try {
      const res = await developRawIdeaAiAction(
        workspaceId,
        rawText || title,
        userId,
        { existingTitle: title }
      );

      if (res.success && res.data) {
        setTitle(res.data.title);
        setProblem(res.data.problem);
        setProposedSolution(res.data.proposedSolution);
        setImpact(res.data.estimatedImpact || 7);
        setEffort(res.data.estimatedEffort || 4);
        setConfidence(res.data.estimatedConfidence || 6);

        toast({
          title: 'Idea Structured by AI',
          description: 'Problem, solution, and estimated ICE scores have been auto-populated.',
        });
      } else {
        toast({
          title: 'AI Structuring Notice',
          description: res.error || 'Failed to auto-structure idea.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error running AI deconstruction', variant: 'destructive' });
    } finally {
      setIsDeconstructingAi(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        problem: problem.trim() || undefined,
        proposedSolution: proposedSolution.trim() || undefined,
        impact,
        effort,
        confidence,
        priority,
        lifecycleStage: 'captured',
      });

      // Reset
      setTitle('');
      setRawText('');
      setProblem('');
      setProposedSolution('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5 sm:p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lightbulb className="h-4 w-4" />
            </span>
            <DialogTitle className="text-base font-bold text-foreground">
              Capture New Idea
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Raw Thought / Fast Input with AI trigger */}
          <div className="space-y-1.5 p-3 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-primary">Raw Thought or Feedback (Optional)</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleAiDeconstruct}
                disabled={isDeconstructingAi}
                className="h-6 px-2 text-[11px] font-bold text-primary hover:bg-primary/20 gap-1 rounded-md"
              >
                {isDeconstructingAi ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                ⚡ AI Deconstruct
              </Button>
            </div>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="e.g. Parents keep asking for a mobile receipt download in WhatsApp during admissions..."
              rows={2}
              className="text-xs bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Idea Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Automated WhatsApp Admissions Concierge"
              className="h-9 text-xs font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Problem Statement</Label>
            <Textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="What friction or customer pain are we addressing?"
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Proposed Solution</Label>
            <Textarea
              value={proposedSolution}
              onChange={(e) => setProposedSolution(e.target.value)}
              placeholder="What mechanism or approach will solve this?"
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Impact (1-10)</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={impact}
                onChange={(e) => setImpact(Number(e.target.value))}
                className="h-8 text-xs text-center font-bold"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Effort (1-10)</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={effort}
                onChange={(e) => setEffort(Number(e.target.value))}
                className="h-8 text-xs text-center font-bold"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Confidence (1-10)</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="h-8 text-xs text-center font-bold"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/40 gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={isSubmitting || !title.trim()}
            className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create Idea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
