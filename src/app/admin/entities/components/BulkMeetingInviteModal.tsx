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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarRange, Mail } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { bulkRegisterParticipantsAction } from '@/app/actions/bulk-meeting-actions';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface BulkMeetingInviteModalProps {
  entityIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export default function BulkMeetingInviteModal({
  entityIds,
  open,
  onOpenChange,
  onComplete,
}: BulkMeetingInviteModalProps) {
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const firestore = useFirestore();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [meetingId, setMeetingId] = React.useState('');
  const [actionType, setActionType] = React.useState<'invite' | 'register'>('invite');

  // Fetch recent meetings for the current workspace
  const meetingsQuery = useMemoFirebase(() =>
    firestore && activeWorkspaceId
      ? query(
          collection(firestore, 'meetings'),
          where('workspaceIds', 'array-contains', activeWorkspaceId),
          orderBy('meetingTime', 'desc')
        )
      : null,
    [firestore, activeWorkspaceId]
  );
  
  const { data: meetings, isLoading: isLoadingMeetings } = useCollection<any>(meetingsQuery);

  React.useEffect(() => {
    if (open) {
      setActionType('invite');
      if (meetings && meetings.length > 0) {
        setMeetingId(meetings[0].id);
      }
    }
  }, [open, meetings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingId || entityIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const result = await bulkRegisterParticipantsAction({
        entityIds,
        meetingId,
        workspaceId: activeWorkspaceId!,
        sendInvites: actionType === 'invite',
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: 'Bulk Registrations Handled',
        description: result.message || `Successfully handled registrations for ${result.count} contacts.`,
      });
      onOpenChange(false);
      onComplete?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Meeting Operation Failed',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] rounded-2xl p-0 border-none shadow-2xl overflow-hidden bg-card text-left">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 bg-card/50 backdrop-blur-xl border-b border-border/10 shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight">Bulk Session Scheduler</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground mt-1.5">
              Register or dispatch meeting links in bulk for the{' '}
              <span className="text-primary font-mono">{entityIds.length}</span> selected records.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="meeting-select" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Select Meeting Session
              </Label>
              <Select value={meetingId} onValueChange={setMeetingId} disabled={isLoadingMeetings}>
                <SelectTrigger id="meeting-select" className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner text-xs">
                  <SelectValue placeholder="Select Meeting" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-xl">
                  {meetings?.map((m: any) => {
                    const formattedDate = m.meetingTime
                      ? new Date(m.meetingTime).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'No date';
                    return (
                      <SelectItem key={m.id} value={m.id} className="font-bold text-xs">
                        {m.title} ({formattedDate})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Registration & Communication Strategy
              </Label>
              <RadioGroup
                value={actionType}
                onValueChange={v => setActionType(v as 'invite' | 'register')}
                className="flex flex-col gap-3"
              >
                <div
                  className={cn(
                    'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors',
                    actionType === 'invite' ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <RadioGroupItem value="invite" id="invite-radio" className="mt-1" />
                  <Label htmlFor="invite-radio" className="cursor-pointer">
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-primary" /> Register & Email Invites
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed font-semibold">
                      Approves selected contacts, generates unique joining tokens, and dispatches dynamic joining emails.
                    </p>
                  </Label>
                </div>

                <div
                  className={cn(
                    'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors',
                    actionType === 'register' ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <RadioGroupItem value="register" id="register-radio" className="mt-1" />
                  <Label htmlFor="register-radio" className="cursor-pointer">
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      <CalendarRange className="h-4 w-4 text-emerald-500" /> Silently Approve Attendance
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed font-semibold">
                      Registers participants in the database as approved attendees without triggering Resend email alerts.
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/10 border-t border-border/10 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl font-bold h-10 px-6 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !meetingId}
              className="rounded-xl font-bold h-10 px-8 shadow-md transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  Confirm Action
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
