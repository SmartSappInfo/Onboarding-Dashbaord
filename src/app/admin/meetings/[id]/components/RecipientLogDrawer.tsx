'use client';

import * as React from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePaginatedReminders } from '../hooks/usePaginatedReminders';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Eye, 
  Mail, 
  Phone, 
  MessageSquare,
  Loader2 
} from 'lucide-react';
import { format } from 'date-fns';

interface RecipientLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  reminderType: string;
  onPreviewMessage: (messageId: string) => void;
}

export function RecipientLogDrawer({
  isOpen,
  onClose,
  meetingId,
  reminderType,
  onPreviewMessage
}: RecipientLogDrawerProps) {
  const { logs, isLoading, error, hasMore, loadMore } = usePaginatedReminders(meetingId, reminderType);

  const getReminderLabel = (type: string) => {
    if (type.startsWith('meeting_invitation_')) {
      const slotId = type.replace('meeting_invitation_', '');
      const invitationLabels: Record<string, string> = {
        'initial': 'Initial Invitation',
        '1_month': '1 Month Before',
        '1_week': '1 Week Before',
        '5_days': '5 Days Before',
        '3_days': '3 Days Before',
        '2_days': '2 Days Before',
        '1_day': '1 Day Before',
        'today': 'Happening Today',
        'last_chance': 'Time Up - Last Chance',
      };
      return invitationLabels[slotId] || slotId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    const labels: Record<string, string> = {
      'meeting_reminder_15min': '15 minutes before',
      'meeting_reminder_1hour': '1 hour before',
      'meeting_reminder_2hours': '2 hours before',
      'meeting_reminder_1day': '1 day before',
      'meeting_time_up': 'At meeting time',
      'facilitator_post_event': 'Facilitator post-event checklist',
      'post_event_absentee': 'Absentee follow-up',
      'post_event_thankyou': 'Thank you notification',
      'post_event_followup': 'Post-event feedback/follow-up',
      'registration_ack': 'Registration confirmation',
      'meeting_invitation': 'Guest Invitation Blast',
    };
    if (labels[type]) return labels[type];

    if (type.startsWith('messaging_slot_reminder_')) {
      const parts = type.split('_');
      const offsetMinutesStr = parts[3];
      if (offsetMinutesStr) {
        const offset = parseInt(offsetMinutesStr, 10);
        if (!isNaN(offset)) {
          if (offset === 0) return 'At meeting start';
          
          const absOffset = Math.abs(offset);
          const days = Math.floor(absOffset / 1440);
          const hours = Math.floor((absOffset % 1440) / 60);
          const mins = absOffset % 60;
          const timeParts = [];
          if (days > 0) timeParts.push(`${days} day${days > 1 ? 's' : ''}`);
          if (hours > 0) timeParts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
          if (mins > 0) timeParts.push(`${mins} min${mins > 1 ? 's' : ''}`);
          
          return `${timeParts.join(' ')} ${offset > 0 ? 'before' : 'after'} meeting`;
        }
      }
    }

    if (type.startsWith('messaging_slot_')) {
      return 'Scheduled Reminder';
    }

    return type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; label: string }> = {
      pending: { variant: 'outline', icon: <Clock className="h-3 w-3 text-amber-500" />, label: 'Pending' },
      sent: { variant: 'default', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Sent' },
      failed: { variant: 'destructive', icon: <XCircle className="h-3 w-3" />, label: 'Failed' },
      cancelled: { variant: 'secondary', icon: <AlertCircle className="h-3 w-3" />, label: 'Cancelled' },
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1.5 py-0.5 rounded-full font-medium">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl flex flex-col h-full bg-background overflow-hidden p-0 border-l">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="text-xl font-bold tracking-tight">
            {getReminderLabel(reminderType)}
          </SheetTitle>
          <SheetDescription className="text-sm">
            List of recipients and delivery status logs for this scheduled notification slot.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
              <p className="font-semibold">Error querying reminder logs</p>
              <p className="mt-1 text-xs opacity-90">{error}</p>
            </div>
          )}

          {isLoading && logs.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl border bg-muted/10">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl p-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-semibold">No logs found</p>
              <p className="text-xs mt-1">No dispatches have been scheduled or triggered for this slot yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between p-4 rounded-xl border bg-muted/10 hover:bg-muted/20 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {log.channel === 'email' ? (
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-sm font-semibold truncate text-foreground">
                        {log.recipientContact}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {log.status === 'sent' ? 'Sent:' : 'Scheduled:'}{' '}
                        {format(new Date(log.status === 'sent' && log.sentAt ? log.sentAt : log.scheduledAt), 'PPp')}
                      </span>
                    </div>
                    {log.error && (
                      <p className="text-[11px] text-destructive mt-1.5 font-medium">
                        Error: {log.error}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    {getStatusBadge(log.status)}
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => onPreviewMessage(log.id)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded-lg h-8 w-8 hover:bg-muted"
                      title="Preview personalized message"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {hasMore && (
                <div className="pt-2 text-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadMore} 
                    disabled={isLoading}
                    className="w-full sm:w-auto gap-2"
                  >
                    {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    Load More Recipients
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
