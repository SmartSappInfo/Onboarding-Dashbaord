'use client';

/**
 * ARCHITECTURE:
 * In-Editor A/B Experiment Builder Modal (Phase 9 - Creative Analytics)
 * 
 * Provides hypothesis configuration, target channel selection,
 * and automated deep-clone creation of Variant B from current canvas.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useTransition } from 'react';
import type {
  CreativeProject,
  CreativeDocument,
  PublishingChannel,
} from '@/lib/creative/creative-types';
import { createCreativeExperimentAction } from '@/app/actions/creative-experiment-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical, Sparkles, Loader2, Split } from 'lucide-react';

interface ExperimentBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: CreativeProject;
  document: CreativeDocument;
}

export function ExperimentBuilderModal({
  open,
  onOpenChange,
  project,
  document,
}: ExperimentBuilderModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState(`${project.name} A/B Test`);
  const [hypothesis, setHypothesis] = useState(
    'A high-contrast curiosity headline increases CTR by >15% compared to current control.'
  );
  const [channel, setChannel] = useState<PublishingChannel>('youtube');
  const [testVariantName, setTestVariantName] = useState('Curiosity Hook');
  const [isPending, startTransition] = useTransition();

  const handleLaunchExperiment = () => {
    if (!name.trim() || !testVariantName.trim()) {
      toast({ title: 'Missing Information', description: 'Please provide test name and variant label.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      const res = await createCreativeExperimentAction(
        project.id,
        project.workspaceId,
        name,
        hypothesis,
        channel,
        document,
        testVariantName
      );

      if (res.success && res.data) {
        toast({
          title: 'Experiment Launched',
          description: `Created Variant B ("${testVariantName}") with 50/50 traffic split.`,
        });
        onOpenChange(false);
      } else {
        toast({
          title: 'Launch Failed',
          description: res.error || 'Could not launch experiment.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FlaskConical className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              Launch A/B Experiment
              <CardInfoTooltip text="Provides hypothesis configuration, target channel selection, and automated deep-clone creation of Variant B from current canvas." />
            </DialogTitle>
            <DialogDescription className="sr-only">
              Provides hypothesis configuration, target channel selection, and automated deep-clone creation of Variant B from current canvas.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Experiment Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Masterclass: Problem vs. Curiosity Angle"
              className="h-10 bg-background border-border/80 text-xs font-medium text-foreground rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Test Hypothesis</Label>
            <Input
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="What do you expect to improve?"
              className="h-10 bg-background border-border/80 text-xs font-medium text-foreground rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Target Channel</Label>
              <Select value={channel} onValueChange={(val: PublishingChannel) => setChannel(val)}>
                <SelectTrigger className="h-10 bg-background border-border/80 text-xs font-medium text-foreground rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border/80 text-foreground">
                  <SelectItem value="youtube">YouTube (Video Cover)</SelectItem>
                  <SelectItem value="facebook">Facebook (Ad / Post)</SelectItem>
                  <SelectItem value="instagram">Instagram (Feed / Story)</SelectItem>
                  <SelectItem value="linkedin">LinkedIn (Media Post)</SelectItem>
                  <SelectItem value="crm_asset">CRM Campaign Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Variant B Label</Label>
              <Input
                value={testVariantName}
                onChange={(e) => setTestVariantName(e.target.value)}
                placeholder="e.g. Red Accent + Question Hook"
                className="h-10 bg-background border-border/80 text-xs font-medium text-foreground rounded-xl"
              />
            </div>
          </div>

          {/* Traffic Allocation Indicator */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-muted-foreground font-medium">
              <Split className="w-4 h-4 text-primary" />
              <span>Traffic Distribution</span>
            </div>
            <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              50% Control / 50% Variant B
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="h-10 text-xs font-medium rounded-xl active:scale-[0.97]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleLaunchExperiment}
            disabled={isPending || !name.trim() || !testVariantName.trim()}
            className="h-10 px-5 font-medium text-xs rounded-xl shadow-sm active:scale-[0.97]"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Launch Experiment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
