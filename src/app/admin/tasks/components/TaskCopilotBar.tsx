'use client';

/**
 * @fileOverview TaskCopilotBar component (Phase 4D).
 *
 * Implements:
 * - Natural-language task input bar positioned at top of task registry.
 * - Submits prompt to parseTaskPromptAction without mutating database (Phase 1).
 * - Opens TaskCopilotDialog for user review and explicit confirmation (Phase 2).
 * - Mobile responsive controls with min-h-[44px] touch targets and active:scale-[0.97].
 */

import * as React from 'react';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { parseTaskPromptAction } from '@/app/actions/task-copilot-actions';
import type { TaskCopilotProposal } from '@/ai/schemas/task-copilot-schemas';
import { TaskCopilotDialog } from './TaskCopilotDialog';

export interface TaskCopilotBarProps {
  workspaceId: string;
  onTaskCreated?: (taskId: string) => void;
}

export function TaskCopilotBar({ workspaceId, onTaskCreated }: TaskCopilotBarProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = React.useState('');
  const [isParsing, setIsParsing] = React.useState(false);
  const [proposal, setProposal] = React.useState<TaskCopilotProposal | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleParse = async () => {
    if (!prompt.trim() || prompt.trim().length < 3) {
      toast({
        title: 'Prompt Too Short',
        description: 'Please describe the task with at least 3 characters.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsParsing(true);
      const res = await parseTaskPromptAction(workspaceId, prompt.trim());

      if (!res.success || !res.proposal) {
        toast({
          title: 'Parsing Failed',
          description: res.error || 'Failed to interpret task prompt.',
          variant: 'destructive',
        });
        return;
      }

      setProposal(res.proposal);
      setDialogOpen(true);
      setPrompt('');
    } catch (err: unknown) {
      console.error('[TASK_COPILOT_BAR] Parsing error:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while parsing task.',
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <>
      <div className="p-3 sm:p-4 rounded-2xl border border-primary/20 bg-primary/5 shadow-sm font-figtree">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleParse();
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="relative flex-1">
            <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isParsing}
              placeholder="✨ Describe a task in plain English (e.g., Call Sarah tomorrow high priority with checklist)..."
              className="pl-10 h-11 min-h-[44px] rounded-xl text-sm bg-background border-border/80 focus-visible:ring-primary/30"
              aria-label="Describe a task with AI"
            />
          </div>

          <Button
            type="submit"
            disabled={isParsing || !prompt.trim()}
            className="rounded-xl h-11 min-h-[44px] px-5 text-xs font-bold active:scale-[0.97] bg-primary text-primary-foreground shadow-xs shrink-0"
          >
            {isParsing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Interpreting...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Draft with AI
              </>
            )}
          </Button>
        </form>
      </div>

      <TaskCopilotDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        proposal={proposal}
        workspaceId={workspaceId}
        onTaskCreated={onTaskCreated}
      />
    </>
  );
}
