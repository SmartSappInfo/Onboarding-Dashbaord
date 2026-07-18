'use client';

import * as React from 'react';
import { Send, X, Mail, Smartphone, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface QuickComposeButtonProps {
  entityId?: string;
  recipient?: string;
  entityName?: string;
  asMenuItem?: boolean;
}

export default function QuickComposeButton({ entityId, recipient, entityName, asMenuItem }: QuickComposeButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [channel, setChannel] = React.useState<'email' | 'sms'>('email');
  const [to, setTo] = React.useState(recipient || '');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setTo(recipient || '');
      setSubject('');
      setBody('');
    }
  }, [open, recipient]);

  // Global keyboard shortcut: C to open compose
  React.useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (!isInput) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Recipient and message are required.' });
      return;
    }

    setIsSending(true);
    try {
      // Import messaging engine dynamically to avoid bundle bloat
      const { sendRawMessage } = await import('@/lib/messaging-engine');
      const result = await sendRawMessage({
        channel,
        recipient: to.trim(),
        subject: channel === 'email' ? (subject.trim() || 'Quick Message') : undefined,
        body: body.trim(),
      });
      if (!result.success) throw new Error(result.error || 'Send failed');

      // Update lastContactedAt if we have an entity
      if (entityId) {
        const { updateEntityLastContactedAt } = await import('@/lib/messaging-actions');
        await updateEntityLastContactedAt(entityId, activeWorkspaceId || '').catch(() => {});
      }

      toast({ title: 'Message sent', description: `${channel === 'email' ? 'Email' : 'SMS'} sent to ${to}` });
      setOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Send failed', description: error.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {asMenuItem ? (
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          className="rounded-xl p-2.5 gap-3 cursor-pointer"
        >
          <Send className="h-4 w-4 text-primary" />
          <span className="font-bold text-xs">Quick Message</span>
        </DropdownMenuItem>
      ) : (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setOpen(true)}
                variant="ghost"
                size="icon"
                className={cn(
                  'relative h-10 w-10 rounded-xl hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary'
                )}
                aria-label="Compose message (C)"
              >
                <Send className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-semibold">
              <p>Quick Compose <kbd className="ml-1.5 px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">C</kbd></p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-4 bg-primary/5 border-b border-primary/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Quick Compose{entityName ? ` — ${entityName}` : ''}
                </DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground">
                  Send a quick message without the full composer
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {/* Channel Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-xl border border-border/50">
              {([['email', 'Email', Mail], ['sms', 'SMS', Smartphone]] as const).map(([val, label, Icon]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setChannel(val)}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all',
                    channel === val
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Recipient */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">To</Label>
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={channel === 'email' ? 'email@example.com' : '+233...'}
                type={channel === 'email' ? 'email' : 'tel'}
                inputMode={channel === 'email' ? 'email' : 'tel'}
                className="h-11 rounded-xl bg-muted/20 border-none font-bold shadow-inner"
                autoComplete="off"
              />
            </div>

            {/* Subject (email only) */}
            {channel === 'email' && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line…"
                  className="h-11 rounded-xl bg-muted/20 border-none font-bold shadow-inner"
                  autoComplete="off"
                />
              </div>
            )}

            {/* Body */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Message</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message…"
                className="min-h-[120px] rounded-xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed"
                autoFocus
              />
              {channel === 'sms' && body.length > 0 && (
                <p className="text-[9px] text-muted-foreground font-medium text-right">
                  {body.length} chars · ~{Math.ceil(body.length / 160)} segment(s)
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="p-5 bg-muted/30 border-t flex justify-between items-center sm:justify-between">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSending} className="font-bold rounded-xl h-11 px-6">
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !to.trim() || !body.trim()}
              className="rounded-xl font-semibold h-11 px-8 shadow-xl text-sm transition-all active:scale-95 gap-2"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? 'Sending…' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
