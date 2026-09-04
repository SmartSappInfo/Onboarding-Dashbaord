'use client';

import * as React from 'react';
import {
  Sparkles,
  Rocket,
  Loader2,
  Layers,
  FileText,
  Target,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generateCampaignConceptAction } from '@/lib/quick-notes-campaign-actions';
import { useUser } from '@/firebase';
import type { Idea } from '@/lib/quick-notes-types';

interface CreateConceptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  ideas?: Idea[];
  preselectedIdeaId?: string;
  onConceptCreated?: () => void;
}

export function CreateConceptDialog({
  isOpen,
  onClose,
  workspaceId,
  ideas = [],
  preselectedIdeaId,
  onConceptCreated,
}: CreateConceptDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const [selectedIdeaId, setSelectedIdeaId] = React.useState<string>(preselectedIdeaId || 'none');
  const [customDirectives, setCustomDirectives] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);

  React.useEffect(() => {
    if (preselectedIdeaId) {
      setSelectedIdeaId(preselectedIdeaId);
    }
  }, [preselectedIdeaId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await generateCampaignConceptAction(workspaceId, {
        ideaId: selectedIdeaId !== 'none' ? selectedIdeaId : undefined,
        customDirectives: customDirectives.trim() || undefined,
        userId: user?.uid || 'system',
      });

      if (res.success && res.concept) {
        toast({
          title: 'Campaign Concept Generated',
          description: `Successfully synthesized concept "${res.concept.title}".`,
        });
        onConceptCreated?.();
        onClose();
      } else {
        toast({
          title: 'Generation Failed',
          description: res.error || 'Failed to synthesize campaign concept.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Unexpected error during concept generation.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-6 space-y-4">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <DialogTitle className="text-base sm:text-lg font-bold">
              Synthesize Campaign Concept
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Transform customer notes and validated Ideas into a grounded, high-converting Campaign Concept.
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Source Idea Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" /> Source Idea (Optional)
            </Label>
            <Select value={selectedIdeaId} onValueChange={setSelectedIdeaId}>
              <SelectTrigger className="h-9 text-xs rounded-xl bg-background border-border/70">
                <SelectValue placeholder="Select an idea to develop" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">✨ Auto-Synthesize from Customer Notes & CRM Feedback</SelectItem>
                {ideas.map((idea) => (
                  <SelectItem key={idea.id} value={idea.id}>
                    💡 {idea.title} ({idea.lifecycleStage})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Select an Idea from Idea Studio to turn its hypotheses and value props into marketing copy.
            </p>
          </div>

          {/* Custom Strategic Directives */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Custom Strategic Directives (Optional)
            </Label>
            <Textarea
              value={customDirectives}
              onChange={(e) => setCustomDirectives(e.target.value)}
              placeholder="e.g. Focus on Ghanaian private school bursars, highlight Momo direct payments, emphasize the term 1 fee deadline..."
              className="text-xs min-h-[90px] rounded-xl bg-background border-border/70 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs h-9 min-h-[44px] sm:min-h-[36px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded-xl text-xs font-semibold h-9 min-h-[44px] sm:min-h-[36px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-[0.97] transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Synthesizing Concept...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Generate Concept with AI
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
