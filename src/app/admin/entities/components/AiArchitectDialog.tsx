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

interface AiArchitectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDataExtracted: (data: any) => void;
}

export function AiArchitectDialog({
  isOpen,
  onClose,
  onDataExtracted,
}: AiArchitectDialogProps) {
  const { toast } = useToast();
  const [text, setText] = React.useState('');
  const [isExtracting, setIsExtracting] = React.useState(false);

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
      const result = await extractSchoolData({ text });
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
    } catch (error: any) {
      console.error('AI Architect extraction error:', error);
      toast({
        variant: 'destructive',
        title: 'Architecting Failed',
        description: error.message || 'An error occurred during extraction.',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isExtracting && onClose()}>
      <DialogContent className="sm:max-w-2xl rounded-3xl border-none shadow-2xl bg-card p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-4 text-left border-b bg-muted/20 relative">
          <div className="absolute top-8 right-8 bg-primary/10 p-2.5 rounded-xl text-primary animate-pulse">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
            AI Form Architect
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-muted-foreground mt-1.5">
            Paste any unstructured profile, memo, or email. AI will organize and map the data into the form fields.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Profile or memo text
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste raw text here... (memos, emails, descriptions)"
              disabled={isExtracting}
              className="min-h-[220px] rounded-2xl bg-muted/30 border-none shadow-inner p-5 text-base leading-relaxed focus-visible:ring-1 focus-visible:ring-primary/20 resize-none"
            />
          </div>

          {text.trim() && text.trim().length < 50 && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-500/5 p-3.5 rounded-xl border border-amber-500/10">
              <AlertCircle size={14} className="shrink-0" />
              Provide at least {50 - text.trim().length} more characters to enable extraction.
            </div>
          )}
        </div>

        <DialogFooter className="p-8 pt-4 border-t bg-muted/10 gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isExtracting}
            className="rounded-xl font-semibold text-xs h-11 px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExtract}
            disabled={isExtracting || text.trim().length < 50}
            className="rounded-xl font-bold text-xs h-11 px-8 gap-2 shadow-lg shadow-primary/15"
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
