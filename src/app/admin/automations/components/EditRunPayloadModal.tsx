'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Code, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { updateRunPayloadAction } from '@/lib/automation-actions';
import type { AutomationRun } from '@/lib/types';

interface EditRunPayloadModalProps {
  run: AutomationRun | null;
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess?: () => void;
}

export function EditRunPayloadModal({
  run,
  isOpen,
  onClose,
  userId,
  onSuccess,
}: EditRunPayloadModalProps) {
  const [jsonText, setJsonText] = React.useState('');
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (run?.payload) {
      setJsonText(JSON.stringify(run.payload, null, 2));
      setJsonError(null);
    } else {
      setJsonText('{\n}');
      setJsonError(null);
    }
  }, [run]);

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      JSON.parse(text);
      setJsonError(null);
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON format');
    }
  };

  const handleSave = async () => {
    if (!run || !userId) return;
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      setIsSaving(true);

      const result = await updateRunPayloadAction(run.id, parsed, userId);
      if (result.success) {
        toast({ title: 'Run payload updated successfully' });
        onSuccess?.();
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to update payload',
          description: result.error,
        });
      }
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Invalid JSON',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!run) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl p-6 border border-border bg-background shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Code size={16} className="text-primary" /> Edit Run Payload Data
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Modify variable attributes for run <span className="font-mono">{run.id.slice(0, 8)}</span> prior to retrying.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Payload JSON Attributes</Label>
            {jsonError && (
              <span className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
                <AlertTriangle size={10} /> {jsonError}
              </span>
            )}
          </div>

          <Textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            rows={12}
            className="font-mono text-xs p-3 rounded-xl border border-border bg-muted/20 focus-visible:ring-primary leading-relaxed"
            placeholder="{\n  \"first_name\": \"John\"\n}"
          />
        </div>

        <DialogFooter className="pt-3 border-t border-border/40 gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !!jsonError}
            className="gap-2 active:scale-[0.97] transition-all"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : 'Save Payload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
