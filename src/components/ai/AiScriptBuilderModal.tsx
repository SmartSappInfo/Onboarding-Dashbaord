'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLiveAiModel } from '@/hooks/use-live-ai-model';
import { AiAssistantModalHeader } from '@/components/ai/AiAssistantModalHeader';
import { createLearningSignalAction, finalizeLearningSignalAction } from '@/lib/learning-loop-actions';
import { generateScript } from '@/ai/flows/generate-script-flow';
import { Loader2, Sparkles, MessageSquare } from 'lucide-react';
import { RainbowButton } from '@/components/ui/rainbow-button';

interface AiScriptBuilderModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  availableVariables: string[];
  organizationId?: string;
  workspaceId?: string;
  userId?: string;
  onScriptGenerated: (script: { message: string; hasMedia: boolean; mediaPlaceholderUrl?: string; signalId?: string }) => void;
}

export function AiScriptBuilderModal({
  isOpen,
  onOpenChange,
  availableVariables,
  organizationId = 'default',
  workspaceId = '',
  userId = '',
  onScriptGenerated,
}: AiScriptBuilderModalProps) {
  const { toast } = useToast();
  const { provider: liveProvider, modelId: liveModelId } = useLiveAiModel();
  
  const [prompt, setPrompt] = React.useState('');
  const [channel, setChannel] = React.useState<'sms' | 'whatsapp'>('sms');
  const [tone, setTone] = React.useState<'professional' | 'warm' | 'friendly' | 'urgent'>('friendly');
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    try {
      const result = await generateScript({
        prompt,
        channel,
        variables: availableVariables,
        tone,
        organizationId,
        provider: liveProvider,
        modelId: liveModelId,
      });

      // Register with Unified Learning Loop (ULL)
      const signalResult = await createLearningSignalAction({
        prompt: `Channel: ${channel}, Tone: ${tone}. Prompt: ${prompt}`,
        initialState: result,
        artifactType: 'script',
        organizationId,
        workspaceId,
        userId,
        modelId: liveModelId,
        provider: liveProvider,
      });

      const signalId = signalResult.success ? signalResult.id : undefined;

      onScriptGenerated({
        message: result.message,
        hasMedia: result.hasMedia,
        mediaPlaceholderUrl: result.mediaPlaceholderUrl,
        signalId,
      });

      setPrompt('');
      onOpenChange(false);
      toast({
        title: 'Conversational Script Drafted',
        description: `Successfully generated ${channel.toUpperCase()} copy using ${liveModelId}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Script Generation Failed',
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
          title="AI Conversational Script Architect"
          description="Draft high-converting messaging copy for SMS or WhatsApp with merge tags."
          onClose={() => onOpenChange(false)}
        />
        
        <div className="space-y-6 mt-4 text-left">
          {/* Channel and Tone Selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Channel</Label>
              <Select value={channel} onValueChange={(val: 'sms' | 'whatsapp') => setChannel(val)}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="sms">SMS (Text Only)</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Tone of Voice</Label>
              <Select value={tone} onValueChange={(val: any) => setTone(val)}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="friendly">Friendly & Casual</SelectItem>
                  <SelectItem value="professional">Professional & Direct</SelectItem>
                  <SelectItem value="warm">Warm & Encouraging</SelectItem>
                  <SelectItem value="urgent">Urgent & Time-sensitive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prompt input */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Draft Instructions</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Write a friendly notification warning the client about their outstanding balance. Remind them to pay before Friday."
              className="min-h-[160px] rounded-[2rem] bg-muted/20 border-none shadow-inner p-6 leading-relaxed text-base"
              autoFocus
            />
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
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
            {isGenerating ? 'Drafting…' : 'Generate Script'}
          </RainbowButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
