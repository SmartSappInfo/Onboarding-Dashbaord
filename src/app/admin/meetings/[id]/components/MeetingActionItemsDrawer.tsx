'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Clock,
  Send,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  getMeetingActionItemsAction,
  extractAndSaveMeetingActionItemsAction,
  approveAndSyncActionItemAction,
} from '@/app/actions/meeting-action-items-actions';
import type { AIActionItemDraft } from '@/lib/meetings/types/ai-assistant';

interface MeetingActionItemsDrawerProps {
  meetingId: string;
  transcriptText?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MeetingActionItemsDrawer({
  meetingId,
  transcriptText,
  open,
  onOpenChange,
}: MeetingActionItemsDrawerProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [items, setItems] = React.useState<AIActionItemDraft[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isExtracting, setIsExtracting] = React.useState(false);

  const fetchItems = React.useCallback(async () => {
    if (!activeWorkspaceId || !meetingId) return;
    setIsLoading(true);
    try {
      const res = await getMeetingActionItemsAction(meetingId, activeWorkspaceId);
      if (res.success && res.items) {
        setItems(res.items);
      }
    } catch (err) {
      console.warn('[fetch action items]', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, meetingId]);

  React.useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  const handleExtract = async () => {
    if (!activeWorkspaceId || !meetingId || !transcriptText) return;
    setIsExtracting(true);
    try {
      const res = await extractAndSaveMeetingActionItemsAction({
        meetingId,
        workspaceId: activeWorkspaceId,
        transcriptText,
      });

      if (res.success && res.items) {
        setItems(res.items);
        toast({ title: `Extracted ${res.items.length} Action Items!` });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Extraction failed' });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApproveAndSync = async (itemId: string) => {
    if (!activeWorkspaceId) return;
    try {
      const res = await approveAndSyncActionItemAction({ itemId, workspaceId: activeWorkspaceId });
      if (res.success) {
        toast({ title: 'Task Approved & Synced to CRM' });
        fetchItems();
      }
    } catch (err) {
      console.warn('[sync task]', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Action Items & Commitments
            </DialogTitle>
            {transcriptText && items.length === 0 && (
              <Button
                size="sm"
                onClick={handleExtract}
                disabled={isExtracting}
                className="rounded-xl min-h-[36px] text-xs gap-1.5 active:scale-[0.97]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isExtracting ? 'Extracting...' : 'Extract from Transcript'}
              </Button>
            )}
          </div>
          <DialogDescription className="text-xs">
            Review commitments, buying signals, and objections identified by AI before syncing into CRM tasks.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground opacity-30" />
            <p className="text-xs text-muted-foreground">
              {transcriptText
                ? 'Click "Extract from Transcript" to detect tasks and buying signals.'
                : 'No action items or commitments found for this meeting yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto py-2 pr-1">
            {items.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-2xl border bg-card/60 space-y-2.5 transition-all hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground leading-relaxed">
                    {item.title}
                  </p>
                  <Badge
                    variant={item.priority === 'high' ? 'destructive' : 'secondary'}
                    className="text-[10px] shrink-0 uppercase"
                  >
                    {item.priority}
                  </Badge>
                </div>

                {item.buyingSignalDetected && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-xl w-fit">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Signal: {item.buyingSignalDetected}</span>
                  </div>
                )}

                {item.objectionDetected && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium bg-amber-500/10 px-2.5 py-1 rounded-xl w-fit">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Objection: {item.objectionDetected}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t text-[11px]">
                  <span className="text-muted-foreground">
                    {item.syncedToCRM ? 'Synced to CRM' : 'Pending host approval'}
                  </span>
                  {!item.syncedToCRM ? (
                    <Button
                      size="sm"
                      onClick={() => handleApproveAndSync(item.id)}
                      className="rounded-xl h-7 text-[11px] gap-1 active:scale-[0.97]"
                    >
                      <Send className="h-3 w-3" />
                      Approve & Sync Task
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-500/30">
                      <CheckCircle2 className="h-3 w-3" />
                      Approved
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
