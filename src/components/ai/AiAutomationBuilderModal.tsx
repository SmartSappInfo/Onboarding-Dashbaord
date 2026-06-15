'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLiveAiModel } from '@/hooks/use-live-ai-model';
import { AiAssistantModalHeader } from '@/components/ai/AiAssistantModalHeader';
import { createLearningSignalAction } from '@/lib/learning-loop-actions';
import { generateAutomation } from '@/ai/flows/generate-automation-flow';
import { Loader2, Sparkles, Zap } from 'lucide-react';
import { RainbowButton } from '@/components/ui/rainbow-button';

interface AiAutomationBuilderModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  availableTemplates: { id: string; name: string; type: string }[];
  organizationId?: string;
  workspaceId?: string;
  userId?: string;
  onAutomationGenerated: (automation: {
    name: string;
    description: string;
    trigger: { type: string; config: any };
    steps: any[];
    signalId?: string;
  }) => void;
}

export function AiAutomationBuilderModal({
  isOpen,
  onOpenChange,
  availableTemplates,
  organizationId = 'default',
  workspaceId = '',
  userId = '',
  onAutomationGenerated,
}: AiAutomationBuilderModalProps) {
  const { toast } = useToast();
  const { provider: liveProvider, modelId: liveModelId } = useLiveAiModel();
  
  const [prompt, setPrompt] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    try {
      const result = await generateAutomation({
        prompt,
        availableTemplates,
        organizationId,
        provider: liveProvider,
        modelId: liveModelId,
      });

      // Register with Unified Learning Loop (ULL)
      const signalResult = await createLearningSignalAction({
        prompt: `Automation request: ${prompt}`,
        initialState: result,
        artifactType: 'automation',
        organizationId,
        workspaceId,
        userId,
        modelId: liveModelId,
        provider: liveProvider,
      });

      const signalId = signalResult.success ? signalResult.id : undefined;

      onAutomationGenerated({
        name: result.name,
        description: result.description,
        trigger: result.trigger,
        steps: result.steps,
        signalId,
      });

      setPrompt('');
      onOpenChange(false);
      toast({
        title: 'Automation Workflow Constructed',
        description: `Successfully architected "${result.name}" with ${result.steps.length} steps.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Workflow Generation Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-[2.5rem] p-6 overflow-hidden border-none shadow-2xl bg-card">
        <AiAssistantModalHeader
          title="AI Automation Workflow Architect"
          description="Describe your workflow logic and the AI will construct trigger rules and action steps."
          onClose={() => onOpenChange(false)}
        />
        
        <div className="space-y-6 mt-4 text-left">
          {/* Instructions Input */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Workflow Description</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. When a survey is submitted, wait 2 days. If the score is less than 50, send a follow-up email and add the 'Needs Attention' tag. Otherwise, send the success notification."
              className="min-h-[180px] rounded-[2rem] bg-muted/20 border-none shadow-inner p-6 leading-relaxed text-base"
              autoFocus
            />
          </div>

          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
            <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground">Intelligent Node Mapping</span>
              <p className="text-[10px] text-muted-foreground leading-normal">
                The architect will configure conditional branch forks, delay schedules, and action payloads referencing active email templates in the workspace.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/10 p-4 border-t flex justify-between items-center sm:justify-between mt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
            className="font-bold rounded-xl h-12 px-8"
          >
            Discard
          </Button>
          <RainbowButton
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="h-12 px-12 font-semibold shadow-2xl text-sm"
          >
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isGenerating ? 'Structuring…' : 'Generate Workflow'}
          </RainbowButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
