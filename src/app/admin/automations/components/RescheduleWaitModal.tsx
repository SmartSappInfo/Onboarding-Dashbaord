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
import { Input } from '@/components/ui/input';
import { Loader2, Clock, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { rescheduleWaitJobAction } from '@/lib/automation-actions';
import { format, addHours, addDays, setHours, setMinutes } from 'date-fns';

interface RescheduleWaitModalProps {
  jobId: string | null;
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess?: () => void;
}

export function RescheduleWaitModal({
  jobId,
  isOpen,
  onClose,
  userId,
  onSuccess,
}: RescheduleWaitModalProps) {
  const [customDateTime, setCustomDateTime] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    // Default to 1 hour from now formatted for datetime-local input
    const nextHour = addHours(new Date(), 1);
    setCustomDateTime(format(nextHour, "yyyy-MM-dd'T'HH:mm"));
  }, [isOpen]);

  const applyPreset = (preset: '1h' | '4h' | '1d' | 'tomorrow_9am') => {
    const now = new Date();
    let target = now;
    if (preset === '1h') target = addHours(now, 1);
    if (preset === '4h') target = addHours(now, 4);
    if (preset === '1d') target = addDays(now, 1);
    if (preset === 'tomorrow_9am') {
      target = setMinutes(setHours(addDays(now, 1), 9), 0);
    }
    setCustomDateTime(format(target, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleReschedule = async () => {
    if (!jobId || !userId || !customDateTime) return;
    try {
      setIsSaving(true);
      const isoString = new Date(customDateTime).toISOString();

      const result = await rescheduleWaitJobAction(jobId, isoString, userId);
      if (result.success) {
        toast({ title: 'Wait job rescheduled successfully' });
        onSuccess?.();
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Reschedule failed',
          description: result.error,
        });
      }
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Reschedule failed',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!jobId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-2xl p-6 border border-border bg-background shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Clock size={16} className="text-amber-500" /> Reschedule Wait Step Execution
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Snooze or adjust the execution timestamp for job <span className="font-mono">{jobId.slice(0, 8)}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-3">
          <div>
            <Label className="text-xs font-semibold mb-2 block">Quick Snooze Presets</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => applyPreset('1h')} className="text-xs justify-start gap-1.5 h-8 rounded-lg">
                <Clock size={12} /> +1 Hour
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset('4h')} className="text-xs justify-start gap-1.5 h-8 rounded-lg">
                <Clock size={12} /> +4 Hours
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset('1d')} className="text-xs justify-start gap-1.5 h-8 rounded-lg">
                <Calendar size={12} /> +1 Day
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset('tomorrow_9am')} className="text-xs justify-start gap-1.5 h-8 rounded-lg">
                <Calendar size={12} /> Tomorrow 9 AM
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Custom Date & Time</Label>
            <Input
              type="datetime-local"
              value={customDateTime}
              onChange={(e) => setCustomDateTime(e.target.value)}
              className="text-xs h-9 rounded-xl border border-border bg-muted/20"
            />
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/40 gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleReschedule}
            disabled={isSaving || !customDateTime}
            className="gap-2 active:scale-[0.97] transition-all bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : 'Reschedule Execution'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
