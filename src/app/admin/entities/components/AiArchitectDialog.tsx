'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { extractSchoolData } from '@/ai/flows/extract-school-data-flow';
import type { ExtractSchoolDataOutput } from '@/ai/flows/extract-school-data-flow';
import { useLiveAiModel } from '@/hooks/use-live-ai-model';

interface AiArchitectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDataExtracted: (data: ExtractSchoolDataOutput) => void;
}

export function AiArchitectDialog({
  isOpen,
  onClose,
  onDataExtracted,
}: AiArchitectDialogProps) {
  const { toast } = useToast();
  const [text, setText] = React.useState('');
  const [isExtracting, setIsExtracting] = React.useState(false);
  const { provider, modelId } = useLiveAiModel();

  const handleExtract = async () => {
    if (!text.trim() || text.trim().length < 50) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Info',
        description: 'Please paste at least 50 characters of school text.',
      });
      return;
    }

    setIsExtracting(true);
    toast({
      title: 'Architecting Profile...',
      description: 'Parsing contact details, locations, and packages.',
    });
    try {
      const result = await extractSchoolData({ 
        text,
        provider,
        modelId
      });
      if (!result || !result.name) {
        throw new Error('AI was unable to identify a name for this record.');
      }
      onDataExtracted(result);
      setText('');
      onClose();
      toast({
        title: 'Architecting Complete',
        description: `Successfully extracted structured data for "${result.name}".`,
      });
    } catch (error: unknown) {
      console.error('AI Architect extraction error:', error);
      const err = error as { message?: string };
      toast({
        variant: 'destructive',
        title: 'Architecting Failed',
        description: err.message || 'An error occurred during extraction.',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isExtracting && onClose()}>
      <DialogContent className="sm:max-w-2xl rounded-2xl border border-border/80 shadow-2xl bg-card text-card-foreground p-0 overflow-hidden">
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px]">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                AI Form Architect
              </DialogTitle>
              <DialogDescription className="sr-only">
                Paste any unstructured profile, memo, or email. AI will organize and map the data into the form fields.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Profile or memo text
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste raw text here... (memos, emails, descriptions)"
              disabled={isExtracting}
              className="min-h-[200px] rounded-xl bg-muted/20 border border-border/70 p-4 text-sm leading-relaxed focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          {text.trim() && text.trim().length < 50 && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              <AlertCircle size={14} className="shrink-0" />
              Provide at least {50 - text.trim().length} more characters to enable extraction.
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isExtracting}
            className="rounded-xl font-semibold text-xs h-10 px-4 border-border text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-[0.97]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExtract}
            disabled={isExtracting || text.trim().length < 50}
            className="rounded-xl font-bold text-xs h-10 px-5 gap-2 bg-primary text-primary-foreground hover:opacity-90 shadow-sm active:scale-[0.97]"
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Architecting...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Fill Form
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
