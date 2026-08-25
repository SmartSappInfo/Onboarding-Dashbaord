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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Clock, Video, User, Mail, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { quickScheduleMeetingAction } from '@/app/actions/meeting-calendar-actions';
import { format } from 'date-fns';

interface QuickScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultHour?: number;
  onSuccess?: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function QuickScheduleModal({
  open,
  onOpenChange,
  defaultDate = new Date(),
  defaultHour = 10,
  onSuccess,
}: QuickScheduleModalProps) {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [dateStr, setDateStr] = React.useState(format(defaultDate, 'yyyy-MM-dd'));
  const [timeStr, setTimeStr] = React.useState(`${defaultHour.toString().padStart(2, '0')}:00`);
  const [duration, setDuration] = React.useState('30');
  const [locationType, setLocationType] = React.useState('google_meet');
  const [contactName, setContactName] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const [forceSchedule, setForceSchedule] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDateStr(format(defaultDate, 'yyyy-MM-dd'));
      setTimeStr(`${defaultHour.toString().padStart(2, '0')}:00`);
    }
  }, [open, defaultDate, defaultHour]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title required', description: 'Please enter a meeting title.' });
      return;
    }
    if (!activeWorkspaceId) return;

    setIsSubmitting(true);
    try {
      const startAt = new Date(`${dateStr}T${timeStr}:00`).toISOString();

      const res = await quickScheduleMeetingAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        hostUserId: user?.uid || 'user',
        hostName: user?.displayName || user?.email || 'Host',
        startAt,
        durationMinutes: parseInt(duration, 10) || 30,
        locationType,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        forceSchedule,
      });

      if (res.success) {
        toast({
          title: 'Meeting Scheduled!',
          description: `"${title}" has been placed on your calendar.`,
        });
        onOpenChange(false);
        setTitle('');
        setDescription('');
        setContactName('');
        setContactEmail('');
        onSuccess?.();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Scheduling Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Quick Schedule Meeting
          </DialogTitle>
          <DialogDescription className="text-xs">
            Directly create and place a meeting onto your workspace calendar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <Label className="font-semibold">Meeting Title *</Label>
            <Input
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Enrollment Strategy Session"
              className="rounded-xl min-h-[44px] text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold">Date</Label>
              <Input
                type="date"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">Start Time</Label>
              <Input
                type="time"
                value={timeStr}
                onChange={e => setTimeStr(e.target.value)}
                className="rounded-xl h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold">Duration (Minutes)</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="rounded-xl h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="15">15 mins</SelectItem>
                  <SelectItem value="30">30 mins</SelectItem>
                  <SelectItem value="45">45 mins</SelectItem>
                  <SelectItem value="60">60 mins (1 hr)</SelectItem>
                  <SelectItem value="90">90 mins</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Location / Video</Label>
              <Select value={locationType} onValueChange={setLocationType}>
                <SelectTrigger className="rounded-xl h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="google_meet">Google Meet</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="ms_teams">Microsoft Teams</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Invitee Contact Info */}
          <div className="pt-2 border-t space-y-3">
            <Label className="font-semibold text-foreground">Invitee Details (Optional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Invitee Name</Label>
                <Input
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Jane Doe"
                  className="rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Invitee Email</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="font-semibold">Description / Agenda</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief context or goals for this session..."
              className="rounded-xl min-h-[60px] text-xs"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold cursor-pointer">Force Schedule Overrides</Label>
              <p className="text-[10px] text-muted-foreground">Bypass calendar collision checking</p>
            </div>
            <Switch checked={forceSchedule} onCheckedChange={setForceSchedule} />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl min-h-[44px] px-5 active:scale-[0.97]"
            >
              {isSubmitting ? 'Scheduling...' : 'Confirm & Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
