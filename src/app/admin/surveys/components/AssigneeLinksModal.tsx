'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Mail, MessageSquare, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface AssigneeLink {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  link: string;
}

interface AssigneeLinksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyTitle: string;
  assigneeLinks: AssigneeLink[];
  onSendMessage: (userId: string, channel: 'email' | 'sms') => Promise<void>;
  isLoading?: boolean;
}

export function AssigneeLinksModal({
  open,
  onOpenChange,
  surveyTitle,
  assigneeLinks,
  onSendMessage,
  isLoading = false,
}: AssigneeLinksModalProps) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingMap, setSendingMap] = useState<Record<string, boolean>>({});

  const handleCopyLink = (link: string, userId: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(userId);
    toast({
      title: 'Link Copied',
      description: 'Survey link copied to clipboard.',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (userId: string, channel: 'email' | 'sms') => {
    const key = `${userId}-${channel}`;
    setSendingMap((prev) => ({ ...prev, [key]: true }));
    
    try {
      await onSendMessage(userId, channel);
      toast({
        title: 'Message Sent',
        description: `Survey link sent via ${channel}.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Send',
        description: error instanceof Error ? error.message : 'An error occurred.',
      });
    } finally {
      setSendingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Assignee Survey Links</DialogTitle>
          <DialogDescription className="text-sm">
            Each assignee has a unique link for <span className="font-semibold text-foreground">{surveyTitle}</span>. Copy or send directly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : assigneeLinks.length > 0 ? (
            assigneeLinks.map((assignee, index) => (
            <div key={assignee.userId}>
              {index > 0 && <Separator className="my-4" />}
              
              <div className="space-y-3">
                {/* Assignee Info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-border">
                    <AvatarImage src={assignee.photoURL} alt={assignee.name} />
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {getInitials(assignee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{assignee.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {assignee.email && <span className="truncate">{assignee.email}</span>}
                      {assignee.phone && (
                        <>
                          {assignee.email && <span>•</span>}
                          <span>{assignee.phone}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Link Display */}
                <div className="bg-muted/50 rounded-lg p-3 border border-border">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {assignee.link}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 rounded-lg font-semibold"
                    onClick={() => handleCopyLink(assignee.link, assignee.userId)}
                  >
                    {copiedId === assignee.userId ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Link
                      </>
                    )}
                  </Button>

                  {assignee.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg font-semibold"
                      onClick={() => handleSendMessage(assignee.userId, 'email')}
                      disabled={sendingMap[`${assignee.userId}-email`]}
                    >
                      {sendingMap[`${assignee.userId}-email`] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                      <span className="sr-only">Send Email</span>
                    </Button>
                  )}

                  {assignee.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg font-semibold"
                      onClick={() => handleSendMessage(assignee.userId, 'sms')}
                      disabled={sendingMap[`${assignee.userId}-sms`]}
                    >
                      {sendingMap[`${assignee.userId}-sms`] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                      <span className="sr-only">Send SMS</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No assignees found for this survey.</p>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
