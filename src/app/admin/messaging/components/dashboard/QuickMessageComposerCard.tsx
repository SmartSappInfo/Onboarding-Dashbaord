'use client';

/**
 * @fileOverview Right Sidebar Quick Message Composer.
 * 
 * Part of SmartSapp Communications Hub (Phase 5).
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 7: Everyday UI English, min-h-[44px] touch targets, min-h-[36px] channel pills, active:scale-[0.97].
 * - Rule 4: Strict typing, zero any.
 * - Rule 8 & 18: Fail-closed multi-tenancy with workspace authorization.
 * - Rule 13: Trust Boundary Matrix: USER_UNTRUSTED input validation.
 * - Rule 19: Human-in-the-loop single recipient guard (blocks accidental mass blasts).
 * - Rule 20: Firestore-persisted replay protection with clientRequestId.
 * - Rule 21: Graceful degradation for WhatsApp 24h closed window (actionable template link).
 * - Rule 23: Budget governance with live GSM-7 160-char SMS segment counter and low-balance alerts.
 * - Variables SSOT: Canonical variable token insertion via VariablesPanel (.agents/AGENTS.md).
 */

import * as React from 'react';
import Link from 'next/link';
import { Send, Sparkles, AlertCircle, Loader2, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { VariablesPanel } from '@/components/shared/VariablesPanel';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { MessagingDashboardChannel } from '@/lib/types/messaging-dashboard';
import { dispatchQuickDirectMessageAction } from '@/app/actions/quick-message-actions';

export interface QuickMessageComposerCardProps {
  initialMessage?: string;
  initialSubject?: string;
  initialChannel?: MessagingDashboardChannel;
  workspaceId?: string;
  smsBalance?: number;
  onMessageSent?: () => void;
  className?: string;
}

export function QuickMessageComposerCard({
  initialMessage,
  initialSubject,
  initialChannel,
  workspaceId,
  smsBalance,
  onMessageSent,
  className,
}: QuickMessageComposerCardProps) {
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const resolvedWorkspaceId = workspaceId || activeWorkspaceId || '';

  const [recipient, setRecipient] = React.useState('');
  const [subject, setSubject] = React.useState(initialSubject ?? '');
  const [message, setMessage] = React.useState(initialMessage ?? '');
  const [channel, setChannel] = React.useState<MessagingDashboardChannel>(initialChannel ?? 'sms');
  const [isSending, setIsSending] = React.useState(false);
  const [isVariablesOpen, setIsVariablesOpen] = React.useState(false);

  // Sync state reactively when props update (e.g. clicking a quick template)
  React.useEffect(() => {
    if (initialMessage !== undefined) {
      setMessage(initialMessage);
    }
  }, [initialMessage]);

  React.useEffect(() => {
    if (initialSubject !== undefined) {
      setSubject(initialSubject);
    }
  }, [initialSubject]);

  React.useEffect(() => {
    if (initialChannel !== undefined) {
      setChannel(initialChannel);
    }
  }, [initialChannel]);

  // Rule 19 Single-Target Guard:
  // Rejects delimiter characters [,;\n] and flags multiple distinct numbers while permitting spaced numbers
  const isMultipleRecipients = React.useMemo(() => {
    const trimmed = recipient.trim();
    if (!trimmed) return false;
    if (/[,;\n]/.test(trimmed)) return true;
    if (channel === 'email') {
      return /\s/.test(trimmed);
    }
    const cleanDigits = trimmed.replace(/\D/g, '');
    if (/\s+/.test(trimmed) && cleanDigits.length > 15) {
      return true;
    }
    return false;
  }, [recipient, channel]);

  // Channel Metrics & Segment Math
  const charCount = message.length;
  const segments = Math.max(1, Math.ceil(charCount / 160));
  const isLowBalance = channel === 'sms' && smsBalance !== undefined && smsBalance < 10;

  // Canonical Variable Insertion (.agents/AGENTS.md)
  const handleInsertVariable = React.useCallback((varKey: string) => {
    const token = `{{${varKey}}}`;
    setMessage((prev) => (prev ? `${prev} ${token}` : token));
    setIsVariablesOpen(false);
  }, []);

  const handleSend = async () => {
    if (!recipient.trim() || !message.trim() || isMultipleRecipients || !resolvedWorkspaceId) return;
    if (channel === 'email' && !subject.trim()) return;

    setIsSending(true);

    try {
      const clientRequestId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const res = await dispatchQuickDirectMessageAction({
        workspaceId: resolvedWorkspaceId,
        channel,
        recipient: recipient.trim(),
        body: message.trim(),
        subject: channel === 'email' ? subject.trim() : undefined,
        clientRequestId,
      });

      if (res.success) {
        toast({
          title: 'Message Dispatched',
          description: `Successfully sent ${channel.toUpperCase()} to ${recipient}.`,
          actionConfig: {
            path: '/admin/messaging/conversations',
            label: 'View in Inbox',
          },
        });
        setMessage('');
        setSubject('');
        setRecipient('');
        onMessageSent?.();
      } else {
        if (res.code === 'WHATSAPP_SESSION_CLOSED') {
          toast({
            title: 'WhatsApp Window Closed',
            description: res.error || 'Recipient window is closed. Use an approved template to initiate contact.',
            variant: 'destructive',
            actionConfig: {
              path: '/admin/messaging/templates?channel=whatsapp',
              label: 'Use Approved Template',
            },
          });
        } else {
          toast({
            title: 'Dispatch Failed',
            description: res.error || 'Unable to send message. Check connection and retry.',
            variant: 'destructive',
          });
        }
      }
    } catch {
      toast({
        title: 'Dispatch Error',
        description: 'An unexpected error occurred while sending the message.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const isSendDisabled =
    !recipient.trim() ||
    !message.trim() ||
    isMultipleRecipients ||
    isSending ||
    (channel === 'email' && !subject.trim());

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      {/* Header with Channel Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Quick Compose</h3>
          <p className="text-xs text-muted-foreground">Direct 1-to-1 message dispatch</p>
        </div>
        <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg">
          {(['sms', 'whatsapp', 'email'] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setChannel(ch)}
              className={cn(
                'min-h-[36px] sm:min-h-[32px] px-2.5 py-1 text-xs font-medium rounded-md transition-all active:scale-[0.97]',
                channel === ch
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {ch.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-3">
        {/* Low SMS Balance Alert Pill (Rule 23) */}
        {isLowBalance && (
          <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium">
              <Coins className="w-3.5 h-3.5 shrink-0" />
              <span>Low SMS Balance: {smsBalance} units</span>
            </div>
            <Link
              href="/admin/settings?tab=billing"
              className="font-semibold underline hover:text-amber-800 dark:hover:text-amber-300"
            >
              Top up →
            </Link>
          </div>
        )}

        {/* Recipient Input with Anti-Blast Guard */}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Recipient</label>
          <Input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Enter recipient phone or email..."
            className="min-h-[44px] rounded-xl text-xs sm:text-sm bg-muted/20"
          />
          {isMultipleRecipients && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-500 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Quick compose supports 1-to-1 messages only. </span>
              <Link href="/admin/messaging/composer" className="underline font-semibold hover:text-rose-600">
                Open Campaign Wizard →
              </Link>
            </div>
          )}
        </div>

        {/* Dynamic Subject Line (Email Only) */}
        {channel === 'email' && (
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject line..."
              className="min-h-[44px] rounded-xl text-xs sm:text-sm bg-muted/20"
            />
          </div>
        )}

        {/* Message Body Textarea */}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Message Body</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={4}
            className="rounded-xl text-xs sm:text-sm bg-muted/20 resize-none min-h-[96px]"
          />
        </div>

        {/* Footer Metrics & Variables Panel Trigger */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span className="tabular-nums font-mono">
            {channel === 'sms' && (
              <>
                {charCount} / 160 chars · {segments} {segments === 1 ? 'Segment' : 'Segments'} (GSM-7)
              </>
            )}
            {channel === 'whatsapp' && <>{charCount} chars · 24h Window Guidance</>}
            {channel === 'email' && <>{charCount} chars · Subject required</>}
          </span>

          {/* Variables Popover (Variables SSOT) */}
          <Popover open={isVariablesOpen} onOpenChange={setIsVariablesOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-primary hover:underline font-medium flex items-center gap-1 min-h-[36px] active:scale-[0.97] transition-all"
              >
                <Sparkles className="w-3 h-3" /> Insert Variable
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 p-0 rounded-2xl shadow-2xl border border-border/80 bg-card"
            >
              <div className="p-3 border-b border-border/60">
                <p className="text-xs font-semibold text-foreground">Available Variables</p>
                <p className="text-[11px] text-muted-foreground">Select a token to insert into message</p>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                <VariablesPanel
                  workspaceId={resolvedWorkspaceId}
                  onSelect={handleInsertVariable}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Send Button */}
        <Button
          type="button"
          onClick={handleSend}
          disabled={isSendDisabled}
          className="w-full min-h-[44px] rounded-xl font-medium active:scale-[0.97] transition-all flex items-center justify-center gap-2"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Send Message</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
