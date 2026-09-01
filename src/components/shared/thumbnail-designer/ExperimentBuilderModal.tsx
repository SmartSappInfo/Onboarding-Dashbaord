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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
      <DialogContent className="max-w-lg bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
            <FlaskConical className="w-5 h-5 text-emerald-400" /> Launch A/B Creative Experiment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300">Experiment Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Masterclass: Problem vs. Curiosity Angle"
              className="h-10 bg-slate-900 border-slate-800 text-xs font-semibold text-white rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300">Test Hypothesis</Label>
            <Input
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="What do you expect to improve?"
              className="h-10 bg-slate-900 border-slate-800 text-xs font-semibold text-white rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Target Channel</Label>
              <Select value={channel} onValueChange={(val: PublishingChannel) => setChannel(val)}>
                <SelectTrigger className="h-10 bg-slate-900 border-slate-800 text-xs font-bold text-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="youtube">YouTube (Video Cover)</SelectItem>
                  <SelectItem value="facebook">Facebook (Ad / Post)</SelectItem>
                  <SelectItem value="instagram">Instagram (Feed / Story)</SelectItem>
                  <SelectItem value="linkedin">LinkedIn (Media Post)</SelectItem>
                  <SelectItem value="crm_asset">CRM Campaign Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Variant B Label</Label>
              <Input
                value={testVariantName}
                onChange={(e) => setTestVariantName(e.target.value)}
                placeholder="e.g. Red Accent + Question Hook"
                className="h-10 bg-slate-900 border-slate-800 text-xs font-semibold text-white rounded-xl"
              />
            </div>
          </div>

          {/* Traffic Allocation Indicator */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Split className="w-4 h-4 text-blue-400" />
              <span>Traffic Distribution</span>
            </div>
            <div className="font-mono text-emerald-400 font-bold">
              50% Control / 50% Variant B
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-850">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="h-10 text-xs font-bold border-slate-800 bg-slate-900 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLaunchExperiment}
              disabled={isPending || !name.trim() || !testVariantName.trim()}
              className="h-10 px-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg active:scale-[0.97]"
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
