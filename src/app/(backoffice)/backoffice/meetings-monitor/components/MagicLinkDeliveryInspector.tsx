/**
 * @fileoverview Magic Link Delivery Inspector Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Table for inspecting bounced/undelivered magic links for upcoming events.
 * - Allows 1-click link resending via `resendMagicJoinLinkAction`.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import { Mail, Send, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { useBackoffice } from '../../context/BackofficeProvider';
import { resendMagicJoinLinkAction, type UndeliveredMagicLink } from '@/lib/backoffice/backoffice-meetings-actions';

interface MagicLinkDeliveryInspectorProps {
  readonly undeliveredLinks: UndeliveredMagicLink[];
  readonly onRefresh: () => void;
}

export default function MagicLinkDeliveryInspector({
  undeliveredLinks,
  onRefresh,
}: MagicLinkDeliveryInspectorProps) {
  const { can } = useBackoffice();
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [resendingId, setResendingId] = React.useState<string | null>(null);

  const handleResend = async (link: UndeliveredMagicLink) => {
    setResendingId(link.id);
    try {
      const idToken = await getToken();
      const res = await resendMagicJoinLinkAction(link.id, link.registrantEmail, idToken);

      if (res.success) {
        toast({
          title: 'Magic Link Resent',
          description: `Dispatched join invitation to ${link.registrantEmail}.`,
        });
        onRefresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Resend Failed',
          description: res.error || 'Failed to dispatch magic link.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to dispatch magic link.',
      });
    } finally {
      setResendingId(null);
    }
  };

  if (undeliveredLinks.length === 0) {
    return (
      <div className="p-12 rounded-2xl border border-border bg-card text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-foreground">100% Magic Link Delivery Rate</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          All participant invitations and join tokens have been successfully delivered.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs font-bold uppercase tracking-wider py-4">Attendee</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Event Session</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Organization</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Delivery Failure Reason</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {undeliveredLinks.map((link) => (
              <TableRow key={link.id} className="border-border/60 hover:bg-muted/40 transition-colors">
                <TableCell className="py-4">
                  <div>
                    <span className="font-bold text-xs text-foreground block">{link.registrantName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{link.registrantEmail}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-xs text-foreground">{link.meetingTitle}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">{link.organizationName}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] rounded-lg border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10">
                    {link.failureReason}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-6">
                  {can('meetings_monitor', 'execute') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResend(link)}
                      disabled={resendingId === link.id}
                      className="h-8 px-2.5 rounded-lg text-xs font-semibold active:scale-[0.97] gap-1"
                    >
                      {resendingId === link.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      <span>Resend Link</span>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
